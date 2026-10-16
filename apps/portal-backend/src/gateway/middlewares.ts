// ====================================================================
// NexusHub Portal Backend: Internal API Gateway Middlewares
// ====================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../db/dragonfly';

export const JWT_SECRET = process.env.JWT_SECRET || 'nexushub-portal-jwt-secret-key-2026';

export interface UserContext {
  userId: string;
  username: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'PUBLISHER' | 'SUBSCRIBER';
  tenantId?: string;
  tenantCode?: string;
}

export interface AuthenticatedRequest extends Request {
  context?: UserContext;
}

/**
 * 1. Rate Limiter Middleware (Counter in DragonFly)
 */
export async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow health and auth endpoints to bypass rate limiter
  if (req.path.startsWith('/api/v1/auth') || req.path === '/api/v1/health') {
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const tenant = (req.headers['x-nexus-tenant'] as string) || clientIp;
  const currentMinute = Math.floor(Date.now() / 60000);
  const rateKey = `rate_limit:${tenant}:${currentMinute}`;

  try {
    const requests = await redis.incr(rateKey);
    if (requests === 1) {
      await redis.expire(rateKey, 65); // 65 seconds TTL
    }

    // Default limit: 200 requests per minute in lite mode
    const MAX_REQUESTS = 200;
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - requests));

    if (requests > MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too Many Requests: Rate limit exceeded. Try again in a minute.',
        retryAfter: 60
      });
    }
  } catch (err: any) {
    // If cache fails, do not block traffic
    console.warn(`[Gateway RateLimiter] Cache error: ${err.message}`);
  }

  next();
}

/**
 * 2. Auth Middleware (JWT Bearer Token Validation)
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Public routes
  if (req.path.startsWith('/api/v1/auth/login') || req.path === '/api/v1/health') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserContext;
    req.context = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: `Unauthorized: Token error (${err.message})` });
  }
}

/**
 * 3. Role-Based Access Control (RBAC) Guard
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.context) {
      return res.status(401).json({ error: 'Unauthorized: No user context found' });
    }

    if (!allowedRoles.includes(req.context.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.context.role}' does not have permission for this action.`
      });
    }

    next();
  };
}


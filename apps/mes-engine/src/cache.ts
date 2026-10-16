// ====================================================================
// NexusHub MES Engine: DragonFly In-Memory Routing Table Cache
// ====================================================================

import Redis from 'ioredis';
import { RouteDefinition } from './db';

const DRAGONFLY_HOST = process.env.DRAGONFLY_HOST || 'localhost';
const DRAGONFLY_PORT = parseInt(process.env.DRAGONFLY_PORT || '6379', 10);

export const redis = new Redis({
  host: DRAGONFLY_HOST,
  port: DRAGONFLY_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 100, 2000);
  }
});

redis.on('connect', () => {
  console.log(`[MES Cache] Connected to DragonFly at ${DRAGONFLY_HOST}:${DRAGONFLY_PORT}`);
});

redis.on('error', (err) => {
  console.warn(`[MES Cache] DragonFly error: ${err.message}`);
});

/**
 * Route key format: route:{tenant_code}:{event_type}
 */
export function buildRouteKey(tenantCode: string, eventType: string): string {
  return `route:${tenantCode}:${eventType}`;
}

/**
 * Retrieves route from DragonFly cache
 */
export async function getRouteFromCache(
  tenantCode: string,
  eventType: string
): Promise<RouteDefinition | null> {
  try {
    const key = buildRouteKey(tenantCode, eventType);
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as RouteDefinition;
  } catch (err: any) {
    console.warn(`[MES Cache] Cache read error for ${tenantCode}:${eventType}: ${err.message}`);
    return null;
  }
}

/**
 * Stores route into DragonFly cache with TTL (default 300 seconds)
 */
export async function setRouteToCache(
  tenantCode: string,
  eventType: string,
  route: RouteDefinition,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    const key = buildRouteKey(tenantCode, eventType);
    await redis.setex(key, ttlSeconds, JSON.stringify(route));
  } catch (err: any) {
    console.warn(`[MES Cache] Cache write error for ${tenantCode}:${eventType}: ${err.message}`);
  }
}


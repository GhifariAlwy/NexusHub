// ====================================================================
// NexusHub Portal Backend: Express Server Entry Point
// ====================================================================

// Prevent Node 22/24 TimeoutNegativeWarning from KafkaJS/Redis
const origSetTimeout = global.setTimeout;
global.setTimeout = ((fn: (...args: any[]) => void, delay?: number, ...args: any[]) => {
  return origSetTimeout(fn, Math.max(0, delay || 0), ...args);
}) as any;

import express, { Request, Response } from 'express';
import cors from 'cors';
import { rateLimiterMiddleware, authMiddleware } from './gateway/middlewares';
import { authRouter } from './modules/auth.controller';
import { tenantRouter } from './modules/tenant.controller';
import { catalogRouter } from './modules/catalog.controller';
import { subscriptionRouter } from './modules/subscription.controller';
import { approvalRouter } from './modules/approval.controller';
import { dlqRouter } from './modules/dlq.controller';
import { observabilityRouter } from './modules/observability.controller';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 1. Health Endpoint
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    service: 'NexusHub Portal Backend',
    timestamp: new Date().toISOString()
  });
});

// 2. Gateway Rate Limiter (Counter in DragonFly)
app.use(rateLimiterMiddleware);

// 3. Auth Router (Login & Demo Users are public)
app.use('/api/v1/auth', authRouter);

// 4. Observability Router (Open to Portal Dashboard & Capacity Planning)
app.use('/api/v1/observability', observabilityRouter);

// 5. Protected Gatekeeper for Management Modules
app.use(authMiddleware);

// 6. Business Logic Modules
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);
app.use('/api/v1/approvals', approvalRouter);
app.use('/api/v1/dlq', dlqRouter);

// 7. Error Handling Middleware
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[Portal Backend Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`[Portal Backend] Management Control Plane running on http://localhost:${PORT}`);
});


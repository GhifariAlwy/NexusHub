// ====================================================================
// NexusHub Portal Backend: Subscription Management Controller
// ====================================================================

import { Response, Router } from 'express';
import { pool } from '../db/postgres';
import { AuthenticatedRequest } from '../gateway/middlewares';

export const subscriptionRouter = Router();

// GET /api/v1/subscriptions - List subscriptions
subscriptionRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const currentTenantId = req.context?.tenantId;
  const isSuperAdmin = req.context?.role === 'SUPER_ADMIN';

  try {
    let sql = `
      SELECT s.*, cs.service_code, cs.name as service_name, cs.type as service_type,
             pub.code as publisher_code, sub.code as subscriber_code, sub.name as subscriber_name
      FROM subscriptions s
      JOIN catalog_services cs ON s.service_id = cs.id
      JOIN tenants pub ON cs.publisher_tenant_id = pub.id
      JOIN tenants sub ON s.subscriber_tenant_id = sub.id
    `;
    const params: any[] = [];

    // Filter by tenant unless superadmin
    if (!isSuperAdmin && currentTenantId) {
      params.push(currentTenantId);
      sql += ` WHERE s.subscriber_tenant_id = $1 OR cs.publisher_tenant_id = $1`;
    }

    sql += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(sql, params);
    res.json({ subscriptions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/subscriptions - Subscribe to a service
subscriptionRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { service_id, rate_limit_tier } = req.body;
  const subscriberTenantId = req.context?.tenantId;

  if (!service_id) {
    return res.status(400).json({ error: 'service_id is required' });
  }
  if (!subscriberTenantId) {
    return res.status(400).json({ error: 'User does not belong to a valid tenant' });
  }

  try {
    const query = `
      INSERT INTO subscriptions (service_id, subscriber_tenant_id, status, rate_limit_tier)
      VALUES ($1, $2, 'PENDING_APPROVAL', $3)
      ON CONFLICT (service_id, subscriber_tenant_id)
      DO UPDATE SET status = 'PENDING_APPROVAL', rate_limit_tier = EXCLUDED.rate_limit_tier
      RETURNING *
    `;
    const result = await pool.query(query, [
      service_id,
      subscriberTenantId,
      rate_limit_tier || 'BRONZE'
    ]);
    res.status(201).json({ subscription: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


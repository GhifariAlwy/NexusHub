// ====================================================================
// NexusHub Portal Backend: Unified Service Catalog Controller (REST & Kafka)
// ====================================================================

import { Response, Router } from 'express';
import { pool } from '../db/postgres';
import { AuthenticatedRequest, requireRoles } from '../gateway/middlewares';

export const catalogRouter = Router();

// GET /api/v1/catalog - List all services with subscription status for current tenant
catalogRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const currentTenantId = req.context?.tenantId;
  const { type, search } = req.query;

  try {
    let sql = `
      SELECT cs.*, t.code as publisher_code, t.name as publisher_name,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.service_id = cs.id AND s.status = 'APPROVED') as approved_subscribers_count,
        sub.status as my_subscription_status,
        sub.id as my_subscription_id
      FROM catalog_services cs
      JOIN tenants t ON cs.publisher_tenant_id = t.id
      LEFT JOIN subscriptions sub ON sub.service_id = cs.id AND sub.subscriber_tenant_id = $1
      WHERE 1=1
    `;
    const params: any[] = [currentTenantId || null];

    if (type && type !== 'ALL') {
      params.push(type);
      sql += ` AND cs.type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (cs.name ILIKE $${params.length} OR cs.service_code ILIKE $${params.length})`;
    }

    sql += ` ORDER BY cs.created_at DESC`;

    const result = await pool.query(sql, params);
    res.json({ services: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/catalog - Register a new service (Publisher or Tenant Admin or Super Admin)
catalogRouter.post('/', requireRoles('SUPER_ADMIN', 'TENANT_ADMIN', 'PUBLISHER'), async (req: AuthenticatedRequest, res: Response) => {
  const {
    service_code,
    name,
    type,
    pattern,
    endpoint_or_topic,
    partitions,
    require_encryption,
    schema_contract
  } = req.body;

  if (!service_code || !name || !type || !endpoint_or_topic) {
    return res.status(400).json({ error: 'Missing required service fields' });
  }

  // Publisher belongs to their tenant, Super Admin can specify or default to first tenant
  const publisherTenantId = req.context?.tenantId || (await pool.query('SELECT id FROM tenants LIMIT 1')).rows[0].id;

  // Super Admin can auto-publish, others enter PENDING_APPROVAL
  const status = req.context?.role === 'SUPER_ADMIN' ? 'PUBLISHED' : 'PENDING_APPROVAL';

  try {
    const query = `
      INSERT INTO catalog_services (
        publisher_tenant_id, service_code, name, type, pattern,
        endpoint_or_topic, partitions, require_encryption, schema_contract, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await pool.query(query, [
      publisherTenantId,
      service_code.trim(),
      name.trim(),
      type,
      pattern || (type === 'ASYNC_EVENT' ? 'EXCHANGE_1_N' : 'REQ_REPLY'),
      endpoint_or_topic.trim(),
      partitions || 3,
      Boolean(require_encryption),
      schema_contract ? JSON.stringify(schema_contract) : '{}',
      status
    ]);

    res.status(201).json({ service: result.rows[0] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/catalog/:id - Get service detail
catalogRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = `
      SELECT cs.*, t.code as publisher_code, t.name as publisher_name
      FROM catalog_services cs
      JOIN tenants t ON cs.publisher_tenant_id = t.id
      WHERE cs.id = $1
    `;
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ service: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


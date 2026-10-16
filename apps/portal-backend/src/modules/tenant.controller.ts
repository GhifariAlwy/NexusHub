// ====================================================================
// NexusHub Portal Backend: Tenant Management Controller
// ====================================================================

import { Response, Router } from 'express';
import { pool } from '../db/postgres';
import { AuthenticatedRequest, requireRoles } from '../gateway/middlewares';

export const tenantRouter = Router();

// GET /api/v1/tenants - List all tenants
tenantRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const query = `
      SELECT t.*,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
        (SELECT COUNT(*) FROM catalog_services cs WHERE cs.publisher_tenant_id = t.id) as service_count
      FROM tenants t
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ tenants: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tenants - Register new tenant (Super Admin only)
tenantRouter.post('/', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { code, name, mode, mtls_cert_fingerprint } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Tenant code and name are required' });
  }

  try {
    const query = `
      INSERT INTO tenants (code, name, mode, status, mtls_cert_fingerprint)
      VALUES ($1, $2, $3, 'ACTIVE', $4)
      RETURNING *
    `;
    const result = await pool.query(query, [
      code.toLowerCase().trim(),
      name.trim(),
      mode || 'MULTI_TENANT',
      mtls_cert_fingerprint || null
    ]);
    res.status(201).json({ tenant: result.rows[0] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/tenants/:id/status - Change status (Super Admin only)
tenantRouter.put('/:id/status', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const query = `UPDATE tenants SET status = $1 WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [status, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json({ tenant: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


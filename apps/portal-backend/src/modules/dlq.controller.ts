// ====================================================================
// NexusHub Portal Backend: Dead Letter Queue (DLQ) Management Controller
// ====================================================================

import { Response, Router } from 'express';
import { pool } from '../db/postgres';
import { replayDlqMessage } from '../adapters/kafka';
import { AuthenticatedRequest } from '../gateway/middlewares';

export const dlqRouter = Router();

// GET /api/v1/dlq - List failed DLQ messages
dlqRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const currentTenantId = req.context?.tenantId;
  const isSuperAdmin = req.context?.role === 'SUPER_ADMIN';
  const { status, limit } = req.query;

  try {
    let sql = `
      SELECT d.*, t.code as source_tenant_code, t.name as source_tenant_name
      FROM dlq_records d
      LEFT JOIN tenants t ON d.source_tenant_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!isSuperAdmin && currentTenantId) {
      params.push(currentTenantId);
      sql += ` AND d.source_tenant_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND d.replay_status = $${params.length}`;
    }

    const maxLimit = parseInt((limit as string) || '50', 10);
    params.push(maxLimit);
    sql += ` ORDER BY d.failed_at DESC LIMIT $${params.length}`;

    const result = await pool.query(sql, params);
    res.json({ dlqRecords: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/dlq/:id/replay - Replay message back to processing pipeline
dlqRouter.post('/:id/replay', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const query = `SELECT * FROM dlq_records WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DLQ record not found' });
    }

    const record = result.rows[0];

    // Determine target replay topic:
    // If failure was during routing or ingress, replay to original ingress topic
    const targetTopic = record.original_topic || `ingress.${record.raw_envelope?.source_tenant || 'ecommerce-corp'}`;

    const replayed = await replayDlqMessage(targetTopic, record.raw_envelope);

    if (!replayed) {
      return res.status(500).json({ error: 'Failed to dispatch replay message to Kafka' });
    }

    // Mark as REPLAYED in database
    await pool.query(
      `UPDATE dlq_records SET replay_status = 'REPLAYED' WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: `Message ${record.message_id} successfully replayed to ${targetTopic}`,
      replayedTo: targetTopic
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


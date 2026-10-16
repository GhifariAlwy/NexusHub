// ====================================================================
// NexusHub Portal Backend: Approval Workflow & Automated Provisioning
// ====================================================================

import { Response, Router } from 'express';
import { pool } from '../db/postgres';
import { redis } from '../db/dragonfly';
import { provisionKafkaTopic } from '../adapters/kafka';
import { AuthenticatedRequest, requireRoles } from '../gateway/middlewares';

export const approvalRouter = Router();

// GET /api/v1/approvals - List all pending approvals (Super Admin only)
approvalRouter.get('/', requireRoles('SUPER_ADMIN'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Pending Services
    const servicesQuery = `
      SELECT cs.*, t.code as publisher_code, t.name as publisher_name, 'SERVICE' as approval_type
      FROM catalog_services cs
      JOIN tenants t ON cs.publisher_tenant_id = t.id
      WHERE cs.status = 'PENDING_APPROVAL'
      ORDER BY cs.created_at ASC
    `;
    const pendingServices = (await pool.query(servicesQuery)).rows;

    // 2. Pending Subscriptions
    const subsQuery = `
      SELECT s.*, cs.service_code, cs.name as service_name, cs.type as service_type,
             pub.code as publisher_code, sub.code as subscriber_code, sub.name as subscriber_name,
             'SUBSCRIPTION' as approval_type
      FROM subscriptions s
      JOIN catalog_services cs ON s.service_id = cs.id
      JOIN tenants pub ON cs.publisher_tenant_id = pub.id
      JOIN tenants sub ON s.subscriber_tenant_id = sub.id
      WHERE s.status = 'PENDING_APPROVAL'
      ORDER BY s.created_at ASC
    `;
    const pendingSubscriptions = (await pool.query(subsQuery)).rows;

    res.json({
      pendingServices,
      pendingSubscriptions,
      totalPending: pendingServices.length + pendingSubscriptions.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/approvals/services/:id/approve - Approve a service & provision Kafka
approvalRouter.post('/services/:id/approve', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const serviceRes = await pool.query(
      `SELECT cs.*, t.code as publisher_code FROM catalog_services cs JOIN tenants t ON cs.publisher_tenant_id = t.id WHERE cs.id = $1`,
      [id]
    );

    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceRes.rows[0];

    // 1. If ASYNC_EVENT, auto-provision Kafka Ingress Topic
    if (service.type === 'ASYNC_EVENT') {
      const ingressTopic = `ingress.${service.publisher_code}`;
      await provisionKafkaTopic(ingressTopic, service.partitions || 3);
    }

    // 2. Update service status to PUBLISHED
    const updated = await pool.query(
      `UPDATE catalog_services SET status = 'PUBLISHED' WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({
      success: true,
      message: `Service ${service.service_code} approved and published.`,
      service: updated.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/approvals/subscriptions/:id/approve - Approve a subscription & update DragonFly/Kafka
approvalRouter.post('/subscriptions/:id/approve', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const adminId = req.context?.userId;

  try {
    // 1. Update subscription status
    const subRes = await pool.query(
      `UPDATE subscriptions 
       SET status = 'APPROVED', approved_by = $1 
       WHERE id = $2 
       RETURNING *`,
      [adminId || null, id]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const sub = subRes.rows[0];

    // 2. Fetch service and publisher info
    const serviceRes = await pool.query(
      `SELECT cs.*, t.code as publisher_code 
       FROM catalog_services cs 
       JOIN tenants t ON cs.publisher_tenant_id = t.id 
       WHERE cs.id = $1`,
      [sub.service_id]
    );
    const service = serviceRes.rows[0];

    // 3. If ASYNC_EVENT, sync to Kafka Inbox & DragonFly Route Table
    if (service && service.type === 'ASYNC_EVENT') {
      // Find all approved subscribers for this event
      const allApprovedSubsRes = await pool.query(
        `SELECT t.code as subscriber_code 
         FROM subscriptions s 
         JOIN tenants t ON s.subscriber_tenant_id = t.id 
         WHERE s.service_id = $1 AND s.status = 'APPROVED'`,
        [service.id]
      );

      const targetInboxTopics = allApprovedSubsRes.rows.map(r => `inbox.${r.subscriber_code}`);

      // Auto-provision inbox topics for all approved subscribers
      for (const targetTopic of targetInboxTopics) {
        await provisionKafkaTopic(targetTopic, 3);
      }

      // Update PostgreSQL event_routes table
      const ingressTopic = `ingress.${service.publisher_code}`;
      await pool.query(
        `INSERT INTO event_routes (service_id, source_ingress_topic, event_type, target_inbox_topics, is_active, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())
         ON CONFLICT (source_ingress_topic, event_type)
         DO UPDATE SET target_inbox_topics = EXCLUDED.target_inbox_topics, is_active = TRUE, updated_at = NOW()`,
        [service.id, ingressTopic, service.service_code, JSON.stringify(targetInboxTopics)]
      );

      // Write directly to DragonFly in-memory routing table
      const routeCacheKey = `route:${service.publisher_code}:${service.service_code}`;
      const routeCacheValue = JSON.stringify({
        service_id: service.id,
        pattern: service.pattern,
        require_encryption: service.require_encryption,
        targets: targetInboxTopics,
        is_active: true
      });

      await redis.setex(routeCacheKey, 3600, routeCacheValue);
      console.log(`[Approval] Updated DragonFly route: ${routeCacheKey} -> ${routeCacheValue}`);
    }

    res.json({
      success: true,
      message: 'Subscription approved and routing table updated.',
      subscription: sub
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/approvals/:type/:id/reject - Reject service or subscription
approvalRouter.post('/:type/:id/reject', requireRoles('SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { type, id } = req.params;

  try {
    if (type === 'services') {
      await pool.query(`UPDATE catalog_services SET status = 'REJECTED' WHERE id = $1`, [id]);
    } else if (type === 'subscriptions') {
      await pool.query(`UPDATE subscriptions SET status = 'REVOKED' WHERE id = $1`, [id]);
    }
    res.json({ success: true, message: `${type} request has been rejected.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


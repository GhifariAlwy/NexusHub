// ====================================================================
// NexusHub MES Engine: PostgreSQL Database Client (Routes & DLQ)
// ====================================================================

import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgrespassword',
  database: process.env.PG_DATABASE || 'portal_db',
  max: 10,
  idleTimeoutMillis: 30000
});

export interface RouteDefinition {
  targets: string[];
  is_active: boolean;
  service_id?: string;
  pattern?: string;
}

/**
 * Fallback route lookup in PostgreSQL
 */
export async function getRouteFromDb(
  sourceIngressTopic: string,
  eventType: string
): Promise<RouteDefinition | null> {
  const query = `
    SELECT er.target_inbox_topics, er.is_active, cs.id as service_id, cs.pattern
    FROM event_routes er
    LEFT JOIN catalog_services cs ON er.service_id = cs.id
    WHERE (er.source_ingress_topic = $1 OR er.source_ingress_topic = 'ingress.' || $1 OR 'ingress.' || er.source_ingress_topic = $1)
      AND er.event_type = $2
    LIMIT 1
  `;
  try {
    const res = await pool.query(query, [sourceIngressTopic, eventType]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    let targets: string[] = [];
    if (Array.isArray(row.target_inbox_topics)) {
      targets = row.target_inbox_topics;
    } else if (typeof row.target_inbox_topics === 'string') {
      try {
        targets = JSON.parse(row.target_inbox_topics);
      } catch {
        targets = [row.target_inbox_topics];
      }
    }

    return {
      targets,
      is_active: row.is_active,
      service_id: row.service_id,
      pattern: row.pattern
    };
  } catch (err: any) {
    console.error(`[MES DB] Error fetching route: ${err.message}`);
    return null;
  }
}

/**
 * Record a message failure in PostgreSQL DLQ table
 */
export async function recordDlq(data: {
  message_id: string;
  correlation_id?: string;
  source_tenant?: string;
  original_topic: string;
  failure_stage: 'AGENT_INGRESS' | 'MES_ROUTING' | 'AGENT_CONSUME';
  error_reason: string;
  raw_envelope: any;
}): Promise<void> {
  const query = `
    INSERT INTO dlq_records 
    (message_id, correlation_id, source_tenant_id, original_topic, failure_stage, error_reason, raw_envelope, replay_status)
    VALUES (
      $1, $2, 
      (SELECT id FROM tenants WHERE code = $3 LIMIT 1),
      $4, $5, $6, $7, 'PENDING'
    )
  `;
  try {
    await pool.query(query, [
      data.message_id,
      data.correlation_id || null,
      data.source_tenant || null,
      data.original_topic,
      data.failure_stage,
      data.error_reason,
      JSON.stringify(data.raw_envelope)
    ]);
  } catch (err: any) {
    console.error(`[MES DB] Failed to insert DLQ record: ${err.message}`);
  }
}


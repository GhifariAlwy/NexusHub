// ====================================================================
// NexusHub Client Agent: PostgreSQL Database Client (for DLQ records)
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
    console.error(`[DB] Failed to insert DLQ record: ${err.message}`);
  }
}


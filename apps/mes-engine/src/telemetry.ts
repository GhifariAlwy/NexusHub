// ====================================================================
// NexusHub MES Engine: ClickHouse Audit Logger
// ====================================================================

export interface MesAuditEntry {
  timestamp?: string;
  trace_id: string;
  span_id?: string;
  message_id: string;
  correlation_id: string;
  channel: 'SYNC_API' | 'ASYNC_KAFKA';
  component: 'WSO2_GW' | 'INTERNAL_GW' | 'MES_ROUTER' | 'CLIENT_AGENT';
  source_tenant: string;
  target_tenant?: string;
  service_or_topic: string;
  status: 'SUCCESS' | 'ROUTED' | 'DLQ_ERROR' | 'AUTH_DENIED' | 'THROTTLED';
  payload_size_bytes: number;
  processing_latency_ms: number;
  error_message?: string;
}

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

/**
 * Inserts an audit log into ClickHouse asynchronously (Fire-and-Forget)
 */
export async function sendClickHouseAudit(entry: MesAuditEntry): Promise<void> {
  const row = {
    timestamp: entry.timestamp || new Date().toISOString().replace('T', ' ').replace('Z', ''),
    trace_id: entry.trace_id || '',
    span_id: entry.span_id || '',
    message_id: entry.message_id || '',
    correlation_id: entry.correlation_id || '',
    channel: entry.channel,
    component: entry.component,
    source_tenant: entry.source_tenant || 'unknown',
    target_tenant: entry.target_tenant || '',
    service_or_topic: entry.service_or_topic || '',
    status: entry.status,
    payload_size_bytes: Math.round(entry.payload_size_bytes || 0),
    processing_latency_ms: parseFloat((entry.processing_latency_ms || 0).toFixed(3)),
    error_message: entry.error_message || ''
  };

  try {
    const query = 'INSERT INTO observability_db.audit_logs FORMAT JSONEachRow';
    const res = await fetch(`${CLICKHOUSE_URL}/?query=${encodeURIComponent(query)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[MES Telemetry] ClickHouse warning: ${err}`);
    }
  } catch (err: any) {
    console.warn(`[MES Telemetry] ClickHouse unreachable: ${err.message}`);
  }
}


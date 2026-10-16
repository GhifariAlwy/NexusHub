-- ====================================================================
-- NEXUSHUB LITE: ClickHouse Observability & Audit Log Schema
-- ====================================================================

CREATE DATABASE IF NOT EXISTS observability_db;

-- 1. Tabel Audit Log & Trafik Pesan/API (Untuk Analisis Throughput & Capacity Planning)
CREATE TABLE IF NOT EXISTS observability_db.audit_logs (
    timestamp DateTime64(3, 'Asia/Jakarta'),
    trace_id String,
    span_id String,
    message_id String,
    correlation_id String,
    channel Enum8('SYNC_API' = 1, 'ASYNC_KAFKA' = 2),
    component LowCardinality(String), -- 'WSO2_GW', 'INTERNAL_GW', 'MES_ROUTER', 'CLIENT_AGENT'
    source_tenant LowCardinality(String),
    target_tenant LowCardinality(String),
    service_or_topic LowCardinality(String),
    status LowCardinality(String),    -- 'SUCCESS', 'ROUTED', 'DLQ_ERROR', 'AUTH_DENIED', 'THROTTLED'
    payload_size_bytes UInt32,
    processing_latency_ms Float32,
    error_message String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (channel, source_tenant, service_or_topic, timestamp)
TTL toDateTime(timestamp) + INTERVAL 365 DAY;

-- 2. Tabel Metrik Resource & Komponen (CPU, RAM, Lag, Connections)
CREATE TABLE IF NOT EXISTS observability_db.system_metrics (
    timestamp DateTime64(3, 'Asia/Jakarta'),
    service_name LowCardinality(String), -- 'kafka', 'mes', 'portal-be', 'wso2-apim', 'postgres'
    metric_name LowCardinality(String),  -- 'cpu_usage_pct', 'ram_usage_mb', 'kafka_consumer_lag', 'active_connections'
    metric_value Float64,
    labels Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (service_name, metric_name, timestamp);


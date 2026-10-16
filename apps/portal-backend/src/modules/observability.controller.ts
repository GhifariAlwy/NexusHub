// ====================================================================
// NexusHub Portal Backend: Observability & Capacity Planning Controller
// ====================================================================

import { Request, Response, Router } from 'express';
import { queryClickHouse } from '../adapters/clickhouse';
import { pool } from '../db/postgres';

export const observabilityRouter = Router();

// GET /api/v1/observability/capacity-planning - Real-time metrics & capacity calculation
observabilityRouter.get('/capacity-planning', async (req: Request, res: Response) => {
  // Support multiplier simulation for "what-if" testing from frontend
  const scaleMultiplier = Math.max(1, parseFloat((req.query.scale as string) || '1'));

  try {
    // 1. Fetch aggregate metrics from ClickHouse
    const summaryQuery = `
      SELECT 
        count() as total_events,
        countIf(status = 'DLQ_ERROR') as dlq_errors,
        countIf(channel = 'ASYNC_KAFKA') as kafka_messages,
        countIf(channel = 'SYNC_API') as api_requests,
        avg(payload_size_bytes) as avg_payload_bytes,
        sum(payload_size_bytes) as total_payload_bytes,
        quantile(0.95)(processing_latency_ms) as p95_latency_ms,
        avg(processing_latency_ms) as avg_latency_ms
      FROM observability_db.audit_logs
    `;
    const summaryRows = await queryClickHouse<any>(summaryQuery);
    const summary = summaryRows[0] || {
      total_events: 10,
      dlq_errors: 1,
      kafka_messages: 8,
      api_requests: 2,
      avg_payload_bytes: 512,
      total_payload_bytes: 5120,
      p95_latency_ms: 15.5,
      avg_latency_ms: 8.2
    };

    // 2. Fetch throughput in the last hour
    const throughputQuery = `
      SELECT 
        max(messages_per_sec) as peak_mps,
        avg(messages_per_sec) as avg_mps
      FROM (
        SELECT toStartOfInterval(timestamp, INTERVAL 1 SECOND) as sec, count() as messages_per_sec
        FROM observability_db.audit_logs
        WHERE timestamp >= now() - INTERVAL 1 HOUR
        GROUP BY sec
      )
    `;
    const throughputRows = await queryClickHouse<any>(throughputQuery);
    const rawPeakMps = parseFloat(throughputRows[0]?.peak_mps || '10');
    const rawAvgMps = parseFloat(throughputRows[0]?.avg_mps || '2');

    // Apply simulation scale multiplier
    const peakMps = Math.max(1, Math.round(rawPeakMps * scaleMultiplier));
    const avgMps = Math.max(0.5, parseFloat((rawAvgMps * scaleMultiplier).toFixed(2)));
    const avgPayloadBytes = Math.max(256, Math.round(parseFloat(summary.avg_payload_bytes || '512')));
    const p95Latency = parseFloat(parseFloat(summary.p95_latency_ms || '12.5').toFixed(2));

    // 3. Mathematical Capacity Planning Formulas (from Blueprint Section 6.5)
    // Daily Transactions Projection
    const dailyTransactions = Math.round(avgMps * 86400);

    // Storage Harian (MB) = (Daily Transactions * Avg Bytes) / (Compression Ratio (5) * 1024^2)
    const compressionRatio = 5;
    const bytesToMb = 1024 * 1024;
    const dailyStorageMb = parseFloat(((dailyTransactions * avgPayloadBytes) / (compressionRatio * bytesToMb)).toFixed(2));
    const monthlyStorageGb = parseFloat(((dailyStorageMb * 30) / 1024).toFixed(2));
    const yearlyStorageGb = parseFloat(((dailyStorageMb * 365) / 1024).toFixed(2));
    const fiveYearStorageTb = parseFloat(((dailyStorageMb * 365 * 5) / (1024 * 1024)).toFixed(3));

    // Recommended Kafka Partitions: Target = max(3, ceil(Peak MPS / 500))
    const MAX_THROUGHPUT_PER_CONSUMER = 500;
    const targetPartitions = Math.max(3, Math.ceil(peakMps / MAX_THROUGHPUT_PER_CONSUMER));

    // Recommended MES Engine Pods: min(targetPartitions, max(2, ceil(peakMps / 500)))
    const recommendedMesPods = Math.min(targetPartitions, Math.max(2, Math.ceil(peakMps / MAX_THROUGHPUT_PER_CONSUMER)));

    // Recommended API Gateway Pods (Guaranteed QoS: 1 Core CPU & 1GB RAM per 400 RPS at 70% CPU threshold)
    const peakRps = Math.round(peakMps * 0.4);
    const recommendedApiGwPods = Math.max(2, Math.ceil(peakRps / 400));

    res.json({
      scaleMultiplier,
      realtimeMetrics: {
        totalEvents: parseInt(summary.total_events || '0', 10),
        kafkaMessages: parseInt(summary.kafka_messages || '0', 10),
        apiRequests: parseInt(summary.api_requests || '0', 10),
        dlqErrors: parseInt(summary.dlq_errors || '0', 10),
        avgPayloadBytes,
        p95LatencyMs: p95Latency,
        avgLatencyMs: parseFloat(parseFloat(summary.avg_latency_ms || '0').toFixed(2)),
        peakMps,
        avgMps,
        peakRps
      },
      storageProjections: {
        dailyTransactions,
        compressionRatio,
        dailyMb: dailyStorageMb,
        monthly30DaysGb: monthlyStorageGb,
        yearlyHotStorageGb: yearlyStorageGb,
        fiveYearsColdStorageTb: fiveYearStorageTb
      },
      infrastructureRecommendations: {
        kafka: {
          targetPartitions,
          retentionHours: 24,
          heapMemoryMb: targetPartitions > 10 ? 1024 : 512,
          notes: `Based on peak ${peakMps} MPS with 500 msg/sec per partition consumer throughput ceiling.`
        },
        mesEngine: {
          recommendedPods: recommendedMesPods,
          cpuPerPod: '500m',
          ramPerPod: '256Mi',
          notes: `Stateless routing worker replicas matching Kafka partition balance.`
        },
        apiGateway: {
          recommendedPods: recommendedApiGwPods,
          cpuPerPod: '1000m',
          ramPerPod: '1Gi',
          targetCpuUtilization: '70%',
          qosClass: 'Guaranteed'
        }
      }
    });
  } catch (err: any) {
    console.error('[Capacity Planning] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/observability/stats - Dashboard quick statistics
observabilityRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [servicesRes, tenantsRes, subsRes, dlqRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM catalog_services WHERE status = 'PUBLISHED'`),
      pool.query(`SELECT COUNT(*) FROM tenants WHERE status = 'ACTIVE'`),
      pool.query(`SELECT COUNT(*) FROM subscriptions WHERE status = 'APPROVED'`),
      pool.query(`SELECT COUNT(*) FROM dlq_records WHERE replay_status = 'PENDING'`)
    ]);

    const chRes = await queryClickHouse<any>(`
      SELECT count() as total_audits, quantile(0.95)(processing_latency_ms) as p95
      FROM observability_db.audit_logs
    `);

    res.json({
      publishedServices: parseInt(servicesRes.rows[0].count, 10),
      activeTenants: parseInt(tenantsRes.rows[0].count, 10),
      activeSubscriptions: parseInt(subsRes.rows[0].count, 10),
      pendingDlq: parseInt(dlqRes.rows[0].count, 10),
      totalAuditLogs: parseInt(chRes[0]?.total_audits || '0', 10),
      p95LatencyMs: parseFloat(parseFloat(chRes[0]?.p95 || '0').toFixed(2))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/observability/logs - Recent audit logs table
observabilityRouter.get('/logs', async (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt((req.query.limit as string) || '25', 10));
  try {
    const query = `
      SELECT 
        formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp,
        trace_id, message_id, correlation_id, channel, component,
        source_tenant, target_tenant, service_or_topic, status,
        payload_size_bytes, processing_latency_ms, error_message
      FROM observability_db.audit_logs
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
    const rows = await queryClickHouse(query);
    res.json({ logs: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


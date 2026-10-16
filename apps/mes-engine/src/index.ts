// ====================================================================
// NexusHub MES Engine: Stateless Routing Engine & Asynchronous Audit Engine
// ====================================================================

// Prevent Node 22/24 TimeoutNegativeWarning from KafkaJS calculations
const origSetTimeout = global.setTimeout;
global.setTimeout = ((fn: (...args: any[]) => void, delay?: number, ...args: any[]) => {
  return origSetTimeout(fn, Math.max(0, delay || 0), ...args);
}) as any;

import { Kafka, Producer, Consumer, EachMessagePayload, Partitioners } from 'kafkajs';
import { getRouteFromCache, setRouteToCache } from './cache';
import { getRouteFromDb, recordDlq, RouteDefinition } from './db';
import { sendClickHouseAudit } from './telemetry';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const CLIENT_ID = process.env.CLIENT_ID || 'nexushub-mes-engine';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});

const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner
});
const consumer: Consumer = kafka.consumer({ groupId: 'nexushub-mes-routing-group' });

/**
 * Handles routing logic for each ingress message
 */
async function processMessage(payload: EachMessagePayload): Promise<void> {
  const { topic, partition, message } = payload;
  const startTime = performance.now();
  const rawString = message.value?.toString() || '{}';

  let envelope: any;
  try {
    envelope = JSON.parse(rawString);
  } catch (err: any) {
    console.error(`[MES Engine] Malformed JSON on topic ${topic}: ${err.message}`);
    return;
  }

  const {
    message_id = `msg-${Date.now()}`,
    correlation_id = '',
    traceparent = '',
    source_tenant,
    event_type
  } = envelope;

  const traceId = traceparent?.split('-')[1] || '';

  if (!source_tenant || !event_type) {
    console.warn(`[MES Engine] Message ${message_id} missing source_tenant or event_type`);
    await handleRoutingFailure(
      envelope,
      topic,
      'Missing source_tenant or event_type in envelope',
      traceId
    );
    return;
  }

  // 1. DragonFly Route Lookup
  let route: RouteDefinition | null = await getRouteFromCache(source_tenant, event_type);

  // 2. Fallback to PostgreSQL on Cache Miss
  if (!route) {
    console.log(`[MES Engine] DragonFly cache miss for ${source_tenant}:${event_type}. Falling back to PostgreSQL...`);
    route = await getRouteFromDb(topic, event_type);

    if (route) {
      // Warm up DragonFly cache
      await setRouteToCache(source_tenant, event_type, route, 300);
      console.log(`[MES Engine] Route cached in DragonFly: ${source_tenant}:${event_type} -> [${route.targets.join(', ')}]`);
    }
  }

  // 3. Check Route Validity
  if (!route || !route.is_active || !route.targets || route.targets.length === 0) {
    const reason = !route
      ? `No route configured for ${source_tenant}:${event_type}`
      : `Route is disabled or has empty targets for ${source_tenant}:${event_type}`;
    console.warn(`[MES Engine] Routing failed for ${message_id}: ${reason}`);
    await handleRoutingFailure(envelope, topic, reason, traceId);
    return;
  }

  // 4. Parallel Fan-Out to Target Inbox Topics
  try {
    const dispatchPromises = route.targets.map((targetInboxTopic) => {
      return producer.send({
        topic: targetInboxTopic,
        messages: [
          {
            key: message_id,
            value: rawString,
            headers: {
              traceparent: String(traceparent || ''),
              correlation_id: String(correlation_id || ''),
              source_tenant: String(source_tenant || ''),
              target_topic: String(targetInboxTopic || '')
            }
          }
        ]
      });
    });

    await Promise.all(dispatchPromises);
    const latency = performance.now() - startTime;

    console.log(
      `[MES Engine] ROUTED ${message_id} (${event_type}) from ${topic} to [${route.targets.join(', ')}] in ${latency.toFixed(2)}ms`
    );

    // 5. Asynchronous Audit Logging (Fire-and-Forget)
    const auditRecord = {
      trace_id: traceId,
      message_id,
      correlation_id,
      channel: 'ASYNC_KAFKA' as const,
      component: 'MES_ROUTER' as const,
      source_tenant,
      target_tenant: route.targets.map(t => t.replace('inbox.', '')).join(','),
      service_or_topic: `${source_tenant}:${event_type}`,
      status: 'ROUTED' as const,
      payload_size_bytes: rawString.length,
      processing_latency_ms: latency
    };

    // Emit to topic-log-audit in Kafka
    producer.send({
      topic: 'topic-log-audit',
      messages: [{ key: message_id, value: JSON.stringify(auditRecord) }]
    }).catch(err => console.warn(`[MES Engine] Failed to push to topic-log-audit: ${err.message}`));

    // Emit to ClickHouse directly
    sendClickHouseAudit(auditRecord).catch(err =>
      console.warn(`[MES Engine] Failed to send audit to ClickHouse: ${err.message}`)
    );
  } catch (err: any) {
    console.error(`[MES Engine] Fan-out dispatch error for ${message_id}: ${err.message}`);
    await handleRoutingFailure(envelope, topic, `Dispatch failed: ${err.message}`, traceId);
  }
}

/**
 * Handles routing errors by redirecting to DLQ and logging audit
 */
async function handleRoutingFailure(
  envelope: any,
  originalTopic: string,
  reason: string,
  traceId: string
): Promise<void> {
  const messageId = envelope.message_id || `msg-${Date.now()}`;
  const correlationId = envelope.correlation_id || '';
  const sourceTenant = envelope.source_tenant || 'unknown';

  const dlqPayload = {
    ...envelope,
    dlq_metadata: {
      original_topic: originalTopic,
      failure_stage: 'MES_ROUTING',
      error_reason: reason,
      failed_at: new Date().toISOString()
    }
  };

  try {
    // 1. Send to dlq.global topic in Kafka
    await producer.send({
      topic: 'dlq.global',
      messages: [{ key: messageId, value: JSON.stringify(dlqPayload) }]
    });

    // 2. Insert into PostgreSQL dlq_records
    await recordDlq({
      message_id: messageId,
      correlation_id: correlationId,
      source_tenant: sourceTenant,
      original_topic: originalTopic,
      failure_stage: 'MES_ROUTING',
      error_reason: reason,
      raw_envelope: envelope
    });

    // 3. Emit Audit Log with status DLQ_ERROR
    const auditRecord = {
      trace_id: traceId,
      message_id: messageId,
      correlation_id: correlationId,
      channel: 'ASYNC_KAFKA' as const,
      component: 'MES_ROUTER' as const,
      source_tenant: sourceTenant,
      service_or_topic: originalTopic,
      status: 'DLQ_ERROR' as const,
      payload_size_bytes: JSON.stringify(envelope).length,
      processing_latency_ms: 15,
      error_message: reason
    };

    producer.send({
      topic: 'topic-log-audit',
      messages: [{ key: messageId, value: JSON.stringify(auditRecord) }]
    }).catch(() => {});

    sendClickHouseAudit(auditRecord).catch(() => {});
  } catch (err: any) {
    console.error(`[MES Engine] Critical failure during DLQ handling: ${err.message}`);
  }
}

/**
 * Main worker bootstrap
 */
async function startMesEngine() {
  console.log('[MES Engine] Starting Message Exchange Stateless Engine...');
  try {
    await producer.connect();
    console.log('[MES Engine] Kafka Producer connected.');

    await consumer.connect();
    console.log('[MES Engine] Kafka Consumer connected.');

    const admin = kafka.admin();
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const requiredTopics = [
      'ingress.ecommerce-corp',
      'ingress.logistics-express',
      'ingress.fintech-pay',
      'inbox.ecommerce-corp',
      'inbox.logistics-express',
      'inbox.fintech-pay',
      'dlq.global',
      'topic-log-audit'
    ];
    const missing = requiredTopics.filter(t => !existingTopics.includes(t));
    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map(topic => ({ topic, numPartitions: 3, replicationFactor: 1 })),
        waitForLeaders: true
      });
    }
    await admin.disconnect();

    // Subscribe to ingress topics
    for (const top of ['ingress.ecommerce-corp', 'ingress.logistics-express', 'ingress.fintech-pay']) {
      await consumer.subscribe({ topic: top, fromBeginning: false });
    }
    console.log('[MES Engine] Subscribed to ingress topics');

    await consumer.run({
      autoCommit: true,
      eachMessage: processMessage
    });

    console.log('[MES Engine] Ready and actively processing messages.');
  } catch (err: any) {
    console.error(`[MES Engine] Startup failure: ${err.message}`);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('[MES Engine] Shutting down...');
  await consumer.disconnect();
  await producer.disconnect();
  process.exit(0);
});

startMesEngine();


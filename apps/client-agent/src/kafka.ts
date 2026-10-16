// ====================================================================
// NexusHub Client Agent: Kafka Producer & Consumer Service
// ====================================================================

import { Kafka, Producer, Consumer, EachMessagePayload, Partitioners } from 'kafkajs';
import { decryptPayload } from './crypto';
import { recordDlq } from './db';
import { sendAuditLog } from './telemetry';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const CLIENT_ID = process.env.CLIENT_ID || 'nexushub-client-agent';
const TENANT_CODE = process.env.TENANT_CODE || 'ecommerce-corp';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});

export const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner
});

// Ring buffer to keep recent inbox messages for tenant polling/inspection
export const inboxBuffer: any[] = [];
const MAX_BUFFER_SIZE = 100;

export async function ensureTopicsExist(topics: string[]): Promise<void> {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();
    const toCreate = topics.filter(t => !existing.includes(t));
    if (toCreate.length > 0) {
      await admin.createTopics({
        topics: toCreate.map(topic => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1
        })),
        waitForLeaders: true
      });
      console.log(`[Client Agent] Created initial Kafka topics: ${toCreate.join(', ')}`);
    }
  } catch (err: any) {
    console.warn(`[Client Agent] Note on ensuring topics: ${err.message}`);
  } finally {
    try { await admin.disconnect(); } catch {}
  }
}

export async function initKafka(): Promise<void> {
  await producer.connect();
  console.log(`[Client Agent] Kafka Producer connected to ${KAFKA_BROKERS.join(',')}`);
  
  // Pre-create baseline system topics
  await ensureTopicsExist([
    'ingress.ecommerce-corp',
    'ingress.logistics-express',
    'ingress.fintech-pay',
    'inbox.ecommerce-corp',
    'inbox.logistics-express',
    'inbox.fintech-pay',
    'dlq.global',
    'topic-log-audit'
  ]);
}

/**
 * Publishes envelope to Kafka ingress topic
 */
export async function publishToIngress(topic: string, envelope: any): Promise<void> {
  await producer.send({
    topic,
    messages: [
      {
        key: String(envelope.message_id || `msg-${Date.now()}`),
        value: JSON.stringify(envelope),
        headers: {
          traceparent: String(envelope.traceparent || ''),
          correlation_id: String(envelope.correlation_id || ''),
          source_tenant: String(envelope.source_tenant || '')
        }
      }
    ]
  });
}

/**
 * Sends a failed message directly to DLQ
 */
export async function sendToDlq(
  envelope: any,
  originalTopic: string,
  stage: 'AGENT_INGRESS' | 'MES_ROUTING' | 'AGENT_CONSUME',
  reason: string
): Promise<void> {
  const dlqPayload = {
    ...envelope,
    dlq_metadata: {
      original_topic: originalTopic,
      failure_stage: stage,
      error_reason: reason,
      failed_at: new Date().toISOString()
    }
  };

  try {
    await producer.send({
      topic: 'dlq.global',
      messages: [
        {
          key: envelope.message_id || 'unknown',
          value: JSON.stringify(dlqPayload)
        }
      ]
    });

    await recordDlq({
      message_id: envelope.message_id || 'unknown',
      correlation_id: envelope.correlation_id,
      source_tenant: envelope.source_tenant,
      original_topic: originalTopic,
      failure_stage: stage,
      error_reason: reason,
      raw_envelope: envelope
    });

    await sendAuditLog({
      trace_id: envelope.traceparent?.split('-')[1] || '',
      message_id: envelope.message_id || '',
      correlation_id: envelope.correlation_id || '',
      channel: 'ASYNC_KAFKA',
      component: 'CLIENT_AGENT',
      source_tenant: envelope.source_tenant || 'unknown',
      service_or_topic: originalTopic,
      status: 'DLQ_ERROR',
      payload_size_bytes: JSON.stringify(envelope).length,
      processing_latency_ms: 10,
      error_message: reason
    });

    console.warn(`[Client Agent] Message ${envelope.message_id} routed to dlq.global: ${reason}`);
  } catch (err: any) {
    console.error(`[Client Agent] Failed to publish to DLQ: ${err.message}`);
  }
}

/**
 * Starts background consumer for tenant inboxes
 */
export async function startInboxConsumer(topics: string[]): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId: `client-agent-group-${TENANT_CODE}-${Date.now()}` });
  await consumer.connect();

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  console.log(`[Client Agent] Consumer subscribed to topics: ${topics.join(', ')}`);

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      const startTime = performance.now();
      const rawValue = message.value?.toString() || '{}';
      let envelope: any;

      try {
        envelope = JSON.parse(rawValue);
      } catch (err) {
        console.error(`[Client Agent] Invalid JSON from topic ${topic}`);
        return;
      }

      console.log(`[Client Agent] Received message from ${topic}: ${envelope.message_id} (${envelope.event_type})`);

      // Attempt decryption if SEAL_SIMULATED
      let decryptedPayload = envelope.payload;
      if (envelope.security?.payload_encryption === 'SEAL_SIMULATED') {
        try {
          decryptedPayload = decryptPayload(
            envelope.payload,
            envelope.security.iv,
            envelope.security.tag
          );
          console.log(`[Client Agent] Successfully decrypted payload for ${envelope.message_id}`);
        } catch (err: any) {
          console.error(`[Client Agent] Decryption failed for ${envelope.message_id}: ${err.message}`);
          await sendToDlq(envelope, topic, 'AGENT_CONSUME', `Decryption failed: ${err.message}`);
          return;
        }
      }

      // Add to in-memory buffer for local client app retrieval
      const processedMessage = {
        ...envelope,
        received_at: new Date().toISOString(),
        inbox_topic: topic,
        decrypted_payload: decryptedPayload
      };

      inboxBuffer.unshift(processedMessage);
      if (inboxBuffer.length > MAX_BUFFER_SIZE) {
        inboxBuffer.pop();
      }

      // Record audit log
      const latency = performance.now() - startTime;
      await sendAuditLog({
        trace_id: envelope.traceparent?.split('-')[1] || '',
        message_id: envelope.message_id || '',
        correlation_id: envelope.correlation_id || '',
        channel: 'ASYNC_KAFKA',
        component: 'CLIENT_AGENT',
        source_tenant: envelope.source_tenant || 'unknown',
        target_tenant: topic.replace('inbox.', ''),
        service_or_topic: topic,
        status: 'SUCCESS',
        payload_size_bytes: rawValue.length,
        processing_latency_ms: latency
      });
    }
  });

  return consumer;
}


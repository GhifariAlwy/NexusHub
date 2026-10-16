// ====================================================================
// NexusHub Portal Backend: Kafka Adapter (Topic Provisioning & DLQ Replay)
// ====================================================================

import { Kafka, Partitioners } from 'kafkajs';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

const kafka = new Kafka({
  clientId: 'nexushub-portal-backend',
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner
});

let isProducerConnected = false;

async function ensureProducer() {
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
  }
}

/**
 * Automatically provisions a Kafka topic with specified partitions
 */
export async function provisionKafkaTopic(topicName: string, numPartitions: number = 3): Promise<boolean> {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    if (!existingTopics.includes(topicName)) {
      await admin.createTopics({
        topics: [
          {
            topic: topicName,
            numPartitions: Math.max(1, numPartitions),
            replicationFactor: 1
          }
        ],
        waitForLeaders: true
      });
      console.log(`[Kafka Adapter] Provisioned topic: ${topicName} (partitions: ${numPartitions})`);
    } else {
      console.log(`[Kafka Adapter] Topic ${topicName} already exists`);
    }
    return true;
  } catch (err: any) {
    console.error(`[Kafka Adapter] Failed to provision topic ${topicName}: ${err.message}`);
    return false;
  } finally {
    try { await admin.disconnect(); } catch {}
  }
}

/**
 * Replays a message from DLQ back to target or original topic
 */
export async function replayDlqMessage(targetTopic: string, rawEnvelope: any): Promise<boolean> {
  try {
    await ensureProducer();
    await producer.send({
      topic: targetTopic,
      messages: [
        {
          key: rawEnvelope.message_id || `replay-${Date.now()}`,
          value: typeof rawEnvelope === 'string' ? rawEnvelope : JSON.stringify(rawEnvelope),
          headers: {
            replayed_at: new Date().toISOString(),
            is_replay: 'true',
            traceparent: String(rawEnvelope.traceparent || '')
          }
        }
      ]
    });
    console.log(`[Kafka Adapter] Replayed message ${rawEnvelope.message_id} to ${targetTopic}`);
    return true;
  } catch (err: any) {
    console.error(`[Kafka Adapter] Failed to replay message: ${err.message}`);
    return false;
  }
}


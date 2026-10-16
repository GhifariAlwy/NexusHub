// ====================================================================
// NexusHub Client Agent: Main HTTP Server & Local Runtime
// ====================================================================

// Prevent Node 22/24 TimeoutNegativeWarning from KafkaJS calculations
const origSetTimeout = global.setTimeout;
global.setTimeout = ((fn: (...args: any[]) => void, delay?: number, ...args: any[]) => {
  return origSetTimeout(fn, Math.max(0, delay || 0), ...args);
}) as any;

import express, { Request, Response } from 'express';
import cors from 'cors';
import { encryptPayload } from './crypto';
import { initKafka, publishToIngress, sendToDlq, startInboxConsumer, inboxBuffer } from './kafka';
import { sendAuditLog } from './telemetry';

const app = express();
const PORT = parseInt(process.env.PORT || '5050', 10);
const TENANT_CODE = process.env.TENANT_CODE || 'ecommerce-corp';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check Endpoint
app.get('/api/v1/agent/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    tenant: TENANT_CODE,
    timestamp: new Date().toISOString()
  });
});

// Publish Endpoint (called by NexusClient SDK)
app.post('/api/v1/agent/publish', async (req: Request, res: Response) => {
  const startTime = performance.now();
  const envelope = req.body;

  // 1. Validation
  if (!envelope || !envelope.message_id || !envelope.event_type || !envelope.source_tenant) {
    return res.status(400).json({
      error: 'Invalid envelope: missing message_id, event_type, or source_tenant'
    });
  }

  // 2. Encryption (SEAL_SIMULATED)
  let outboundEnvelope = { ...envelope };
  const rawPayloadString = JSON.stringify(envelope.payload);

  if (envelope.security?.payload_encryption === 'SEAL_SIMULATED') {
    try {
      const encrypted = encryptPayload(envelope.payload);
      outboundEnvelope.payload = encrypted.ciphertext;
      outboundEnvelope.security = {
        ...envelope.security,
        algorithm: encrypted.algorithm,
        iv: encrypted.iv,
        tag: encrypted.tag
      };
      console.log(`[Client Agent] Payload encrypted with AES-256-GCM for ${envelope.message_id}`);
    } catch (err: any) {
      console.error(`[Client Agent] Encryption error: ${err.message}`);
      await sendToDlq(envelope, `ingress.${envelope.source_tenant}`, 'AGENT_INGRESS', `Encryption error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to encrypt payload' });
    }
  }

  // 3. Dispatch to Kafka Ingress Topic
  const ingressTopic = `ingress.${envelope.source_tenant}`;
  try {
    await publishToIngress(ingressTopic, outboundEnvelope);
    const latency = performance.now() - startTime;

    // 4. Record Audit Log in ClickHouse
    await sendAuditLog({
      trace_id: envelope.traceparent?.split('-')[1] || '',
      message_id: envelope.message_id,
      correlation_id: envelope.correlation_id,
      channel: 'ASYNC_KAFKA',
      component: 'CLIENT_AGENT',
      source_tenant: envelope.source_tenant,
      service_or_topic: ingressTopic,
      status: 'SUCCESS',
      payload_size_bytes: rawPayloadString.length,
      processing_latency_ms: latency
    });

    console.log(`[Client Agent] Dispatched ${envelope.message_id} to ${ingressTopic} (${latency.toFixed(2)}ms)`);

    return res.status(200).json({
      status: 'SENT',
      message_id: envelope.message_id,
      correlation_id: envelope.correlation_id,
      ingress_topic: ingressTopic
    });
  } catch (err: any) {
    console.error(`[Client Agent] Kafka publish error: ${err.message}`);
    await sendToDlq(envelope, ingressTopic, 'AGENT_INGRESS', `Kafka dispatch failed: ${err.message}`);
    return res.status(500).json({ error: `Kafka publish error: ${err.message}` });
  }
});

// Get Inbox Messages Endpoint (for subscriber application polling/inspection)
app.get('/api/v1/agent/inbox', (req: Request, res: Response) => {
  const tenant = (req.query.tenant as string) || '';
  const limit = parseInt((req.query.limit as string) || '50', 10);

  let result = inboxBuffer;
  if (tenant) {
    result = result.filter(msg => msg.inbox_topic === `inbox.${tenant}` || !msg.inbox_topic);
  }

  res.json({
    tenant: tenant || 'all',
    count: result.slice(0, limit).length,
    messages: result.slice(0, limit)
  });
});

// Server Initialization
async function bootstrap() {
  try {
    await initKafka();

    // Start consuming default inboxes (for ecommerce, logistics, and fintech in lite mode)
    const activeInboxes = [
      'inbox.ecommerce-corp',
      'inbox.logistics-express',
      'inbox.fintech-pay'
    ];
    await startInboxConsumer(activeInboxes);

    app.listen(PORT, () => {
      console.log(`[Client Agent] HTTP Server listening on port ${PORT} (Tenant: ${TENANT_CODE})`);
    });
  } catch (err: any) {
    console.error(`[Client Agent] Bootstrap failed: ${err.message}`);
    process.exit(1);
  }
}

bootstrap();


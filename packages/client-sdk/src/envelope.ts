// ====================================================================
// Canonical Message Envelope Builder (SDK ↔ Agent ↔ Kafka ↔ MES)
// ====================================================================

import { CanonicalEnvelope, PublishOptions } from './types';
import * as crypto from 'crypto';

/**
 * Generates a W3C traceparent header: '00-${traceId}-${spanId}-01'
 */
export function generateTraceparent(): string {
  const version = '00';
  const traceId = crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  const flags = '01';
  return `${version}-${traceId}-${spanId}-${flags}`;
}

/**
 * Creates a Canonical Message Envelope
 */
export function createCanonicalEnvelope<T = any>(
  sourceTenant: string,
  eventType: string,
  payload: T,
  options: PublishOptions = {}
): CanonicalEnvelope<T> {
  const messageId = `msg-${crypto.randomUUID()}`;
  const correlationId = options.correlationId || `corr-${crypto.randomUUID()}`;
  const traceparent = options.traceparent || generateTraceparent();
  const pattern = options.pattern || 'EXCHANGE_1_N';
  const encryption = options.encryption || 'NONE';

  return {
    envelope_version: '1.0',
    message_id: messageId,
    correlation_id: correlationId,
    traceparent,
    source_tenant: sourceTenant,
    event_type: eventType,
    pattern,
    timestamp: new Date().toISOString(),
    security: {
      payload_encryption: encryption,
      algorithm: encryption === 'SEAL_SIMULATED' ? 'AES-256-GCM' : undefined
    },
    payload
  };
}


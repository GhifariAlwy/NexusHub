// ====================================================================
// NexusHub Client SDK: Type Definitions & Data Contracts
// ====================================================

export type PatternType = 'REQ_REPLY' | 'SUBSCRIPTION_1_1' | 'EXCHANGE_1_N';

export type EncryptionType = 'NONE' | 'SEAL_SIMULATED';

export interface SecurityMetadata {
  payload_encryption: EncryptionType;
  algorithm?: string; // 'AES-256-GCM'
  iv?: string;
  tag?: string;
}

export interface CanonicalEnvelope<T = any> {
  envelope_version: string; // '1.0'
  message_id: string;       // e.g. 'msg-98bf7a12-...'
  correlation_id: string;   // e.g. 'corr-11223344-...'
  traceparent: string;      // W3C TraceContext: '00-traceid-spanid-01'
  source_tenant: string;    // e.g. 'ecommerce-corp'
  event_type: string;       // e.g. 'order.created'
  pattern: PatternType;
  timestamp: string;        // ISO 8601
  security: SecurityMetadata;
  payload: T;               // Raw object or Encrypted Base64 String
}

export interface PublishOptions {
  encryption?: EncryptionType;
  pattern?: PatternType;
  correlationId?: string;
  traceparent?: string;
}

export interface PublishResult {
  success: boolean;
  messageId: string;
  correlationId: string;
  timestamp: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  error?: string;
}

export interface ClientConfig {
  tenantCode: string;
  agentUrl?: string; // Default: 'http://localhost:5050'
  timeoutMs?: number;
}


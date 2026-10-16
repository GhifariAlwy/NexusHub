export type PatternType = 'REQ_REPLY' | 'SUBSCRIPTION_1_1' | 'EXCHANGE_1_N';
export type EncryptionType = 'NONE' | 'SEAL_SIMULATED';
export interface SecurityMetadata {
    payload_encryption: EncryptionType;
    algorithm?: string;
    iv?: string;
    tag?: string;
}
export interface CanonicalEnvelope<T = any> {
    envelope_version: string;
    message_id: string;
    correlation_id: string;
    traceparent: string;
    source_tenant: string;
    event_type: string;
    pattern: PatternType;
    timestamp: string;
    security: SecurityMetadata;
    payload: T;
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
    agentUrl?: string;
    timeoutMs?: number;
}
//# sourceMappingURL=types.d.ts.map
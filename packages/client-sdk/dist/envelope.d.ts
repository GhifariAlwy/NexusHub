import { CanonicalEnvelope, PublishOptions } from './types';
/**
 * Generates a W3C traceparent header: '00-${traceId}-${spanId}-01'
 */
export declare function generateTraceparent(): string;
/**
 * Creates a Canonical Message Envelope
 */
export declare function createCanonicalEnvelope<T = any>(sourceTenant: string, eventType: string, payload: T, options?: PublishOptions): CanonicalEnvelope<T>;
//# sourceMappingURL=envelope.d.ts.map
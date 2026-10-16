"use strict";
// ====================================================================
// Canonical Message Envelope Builder (SDK ↔ Agent ↔ Kafka ↔ MES)
// ====================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTraceparent = generateTraceparent;
exports.createCanonicalEnvelope = createCanonicalEnvelope;
const crypto = __importStar(require("crypto"));
/**
 * Generates a W3C traceparent header: '00-${traceId}-${spanId}-01'
 */
function generateTraceparent() {
    const version = '00';
    const traceId = crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    const flags = '01';
    return `${version}-${traceId}-${spanId}-${flags}`;
}
/**
 * Creates a Canonical Message Envelope
 */
function createCanonicalEnvelope(sourceTenant, eventType, payload, options = {}) {
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
//# sourceMappingURL=envelope.js.map
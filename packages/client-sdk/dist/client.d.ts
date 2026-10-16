import { CanonicalEnvelope, ClientConfig, PublishOptions, PublishResult } from './types';
export declare class NexusClient {
    private tenantCode;
    private agentUrl;
    private timeoutMs;
    constructor(config: ClientConfig);
    getTenantCode(): string;
    /**
     * Publish an event to NexusHub through the local Client Agent
     */
    publish<T = any>(eventType: string, payload: T, options?: PublishOptions): Promise<PublishResult>;
    /**
     * Fetch recent inbox messages from Client Agent
     */
    getInbox(limit?: number): Promise<CanonicalEnvelope[]>;
    /**
     * Register a polling loop or listener for incoming messages
     */
    pollInbox(callback: (message: CanonicalEnvelope) => Promise<void> | void, intervalMs?: number): () => void;
    /**
     * Health check to ensure the Client Agent is online
     */
    pingAgent(): Promise<{
        status: string;
        tenant: string;
    }>;
}
//# sourceMappingURL=client.d.ts.map
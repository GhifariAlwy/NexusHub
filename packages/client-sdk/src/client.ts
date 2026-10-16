// ====================================================================
// NexusHub Client SDK: Main Client Implementation
// ====================================================================

import { CanonicalEnvelope, ClientConfig, PublishOptions, PublishResult } from './types';
import { createCanonicalEnvelope } from './envelope';

export class NexusClient {
  private tenantCode: string;
  private agentUrl: string;
  private timeoutMs: number;

  constructor(config: ClientConfig) {
    if (!config.tenantCode) {
      throw new Error('NexusClient requires a valid tenantCode (e.g. ecommerce-corp)');
    }
    this.tenantCode = config.tenantCode;
    this.agentUrl = (config.agentUrl || 'http://localhost:5050').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs || 5000;
  }

  public getTenantCode(): string {
    return this.tenantCode;
  }

  /**
   * Publish an event to NexusHub through the local Client Agent
   */
  public async publish<T = any>(
    eventType: string,
    payload: T,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    const envelope = createCanonicalEnvelope(this.tenantCode, eventType, payload, options);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.agentUrl}/api/v1/agent/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nexus-Tenant': this.tenantCode,
          'traceparent': envelope.traceparent
        },
        body: JSON.stringify(envelope),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          messageId: envelope.message_id,
          correlationId: envelope.correlation_id,
          timestamp: envelope.timestamp,
          status: 'FAILED',
          error: `Agent returned HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        messageId: envelope.message_id,
        correlationId: envelope.correlation_id,
        timestamp: envelope.timestamp,
        status: data.status || 'SENT'
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        success: false,
        messageId: envelope.message_id,
        correlationId: envelope.correlation_id,
        timestamp: envelope.timestamp,
        status: 'FAILED',
        error: err.name === 'AbortError' ? 'Request timed out' : err.message
      };
    }
  }

  /**
   * Fetch recent inbox messages from Client Agent
   */
  public async getInbox(limit: number = 50): Promise<CanonicalEnvelope[]> {
    const response = await fetch(`${this.agentUrl}/api/v1/agent/inbox?tenant=${this.tenantCode}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch inbox: HTTP ${response.status}`);
    }
    const data = await response.json() as any;
    return data.messages || [];
  }

  /**
   * Register a polling loop or listener for incoming messages
   */
  public pollInbox(
    callback: (message: CanonicalEnvelope) => Promise<void> | void,
    intervalMs: number = 2000
  ): () => void {
    let running = true;
    const seenIds = new Set<string>();

    const interval = setInterval(async () => {
      if (!running) return;
      try {
        const messages = await this.getInbox(20);
        for (const msg of messages) {
          if (!seenIds.has(msg.message_id)) {
            seenIds.add(msg.message_id);
            await callback(msg);
          }
        }
      } catch (err) {
        console.warn(`[NexusClient] Polling error: ${(err as Error).message}`);
      }
    }, intervalMs);

    return () => {
      running = false;
      clearInterval(interval);
    };
  }

  /**
   * Health check to ensure the Client Agent is online
   */
  public async pingAgent(): Promise<{ status: string; tenant: string }> {
    const response = await fetch(`${this.agentUrl}/api/v1/agent/health`);
    if (!response.ok) {
      throw new Error(`Agent health check failed: HTTP ${response.status}`);
    }
    return response.json() as any;
  }
}


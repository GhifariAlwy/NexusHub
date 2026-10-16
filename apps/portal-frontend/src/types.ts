export type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'PUBLISHER' | 'SUBSCRIBER';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  tenantId?: string;
  tenantCode?: string;
  tenantName?: string;
}

export interface CatalogService {
  id: string;
  publisher_tenant_id: string;
  publisher_code: string;
  publisher_name: string;
  service_code: string;
  name: string;
  type: 'SYNC_REST' | 'SYNC_WS' | 'ASYNC_EVENT';
  pattern: 'REQ_REPLY' | 'SUBSCRIPTION_1_1' | 'EXCHANGE_1_N';
  endpoint_or_topic: string;
  partitions: number;
  require_encryption: boolean;
  schema_contract?: any;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED';
  created_at: string;
  approved_subscribers_count: string | number;
  my_subscription_status?: 'PENDING_APPROVAL' | 'APPROVED' | 'REVOKED' | null;
  my_subscription_id?: string | null;
}

export interface Subscription {
  id: string;
  service_id: string;
  service_code: string;
  service_name: string;
  service_type: string;
  publisher_code: string;
  subscriber_code: string;
  subscriber_name: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REVOKED';
  rate_limit_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'UNLIMITED';
  created_at: string;
}

export interface DlqRecord {
  id: string;
  message_id: string;
  correlation_id?: string;
  source_tenant_code?: string;
  original_topic: string;
  failure_stage: 'AGENT_INGRESS' | 'MES_ROUTING' | 'AGENT_CONSUME';
  error_reason: string;
  raw_envelope: any;
  replay_status: 'PENDING' | 'REPLAYED' | 'DISCARDED';
  failed_at: string;
}

export interface CapacityPlanningData {
  scaleMultiplier: number;
  realtimeMetrics: {
    totalEvents: number;
    kafkaMessages: number;
    apiRequests: number;
    dlqErrors: number;
    avgPayloadBytes: number;
    p95LatencyMs: number;
    avgLatencyMs: number;
    peakMps: number;
    avgMps: number;
    peakRps: number;
  };
  storageProjections: {
    dailyTransactions: number;
    compressionRatio: number;
    dailyMb: number;
    monthly30DaysGb: number;
    yearlyHotStorageGb: number;
    fiveYearsColdStorageTb: number;
  };
  infrastructureRecommendations: {
    kafka: {
      targetPartitions: number;
      retentionHours: number;
      heapMemoryMb: number;
      notes: string;
    };
    mesEngine: {
      recommendedPods: number;
      cpuPerPod: string;
      ramPerPod: string;
      notes: string;
    };
    apiGateway: {
      recommendedPods: number;
      cpuPerPod: string;
      ramPerPod: string;
      targetCpuUtilization: string;
      qosClass: string;
    };
  };
}


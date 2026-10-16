-- ====================================================================
-- NEXUSHUB LITE: PostgreSQL Initialization & Seed Data (portal_db)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'MULTI_TENANT', -- 'NATIONAL' | 'MULTI_TENANT'
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- 'PENDING' | 'ACTIVE' | 'SUSPENDED'
    mtls_cert_fingerprint VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Users (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,                        -- 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'PUBLISHER' | 'SUBSCRIBER'
    wso2_scim_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Katalog Layanan Terpadu (REST & Kafka Event)
CREATE TABLE IF NOT EXISTS catalog_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_code VARCHAR(100) UNIQUE NOT NULL,        -- e.g. 'order.created', 'api-cek-resi'
    name VARCHAR(150) NOT NULL,
    type VARCHAR(30) NOT NULL,                        -- 'SYNC_REST' | 'SYNC_WS' | 'ASYNC_EVENT'
    pattern VARCHAR(30) NOT NULL,                     -- 'REQ_REPLY' | 'SUBSCRIPTION_1_1' | 'EXCHANGE_1_N'
    endpoint_or_topic VARCHAR(255) NOT NULL,
    partitions INT DEFAULT 3,
    require_encryption BOOLEAN DEFAULT FALSE,
    schema_contract JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Subscriptions (Langganan API/Topik)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
    subscriber_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL' | 'APPROVED' | 'REVOKED'
    rate_limit_tier VARCHAR(30) DEFAULT 'BRONZE',           -- 'BRONZE' | 'SILVER' | 'GOLD' | 'UNLIMITED'
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_service_sub UNIQUE (service_id, subscriber_tenant_id)
);

-- 5. Tabel Event Routes (In-Memory Fallback & Source of Truth untuk DragonFly & MES)
CREATE TABLE IF NOT EXISTS event_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES catalog_services(id) ON DELETE CASCADE,
    source_ingress_topic VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    target_inbox_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_source_event UNIQUE (source_ingress_topic, event_type)
);

-- 6. Tabel DLQ Records (Pencatatan Pesan Gagal)
CREATE TABLE IF NOT EXISTS dlq_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100),
    source_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    original_topic VARCHAR(100) NOT NULL,
    failure_stage VARCHAR(50) NOT NULL,               -- 'AGENT_INGRESS' | 'MES_ROUTING' | 'AGENT_CONSUME'
    error_reason TEXT,
    raw_envelope JSONB NOT NULL,
    replay_status VARCHAR(30) DEFAULT 'PENDING',      -- 'PENDING' | 'REPLAYED' | 'DISCARDED'
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SEED DATA (3 Tenant, 4 Role Akun User, Katalog Layanan, Rute Awal)
-- ====================================================================

-- 1. Insert Tenants
INSERT INTO tenants (id, code, name, mode, status, mtls_cert_fingerprint) VALUES
('11111111-1111-1111-1111-111111111111', 'ecommerce-corp', 'E-Commerce Corp Indonesia', 'MULTI_TENANT', 'ACTIVE', 'SHA256:ECOM_MOCK_CERT_FINGERPRINT_123'),
('22222222-2222-2222-2222-222222222222', 'logistics-express', 'Logistics Express Nusantara', 'MULTI_TENANT', 'ACTIVE', 'SHA256:LOGIS_MOCK_CERT_FINGERPRINT_456'),
('33333333-3333-3333-3333-333333333333', 'fintech-pay', 'Fintech Pay Global Solusi', 'MULTI_TENANT', 'ACTIVE', 'SHA256:FINTECH_MOCK_CERT_FINGERPRINT_789')
ON CONFLICT (code) DO NOTHING;

-- 2. Insert Users (Password default untuk semua akun: 'admin123' -> hash bcrypt $2a$10$wT2X9b1p9i0V...)
-- Note: backend juga mendukung format plain 'admin123' atau sha256 hash
INSERT INTO users (id, tenant_id, username, email, password_hash, role, wso2_scim_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'superadmin', 'superadmin@nexushub.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'SUPER_ADMIN', 'scim-user-superadmin-001'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'tenantadmin_ecom', 'admin@ecommerce.co.id', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'TENANT_ADMIN', 'scim-user-tenantadmin-002'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'publisher_ecom', 'publisher@ecommerce.co.id', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'PUBLISHER', 'scim-user-publisher-003'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'subscriber_logistics', 'subscriber@logistics.co.id', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'SUBSCRIBER', 'scim-user-subscriber-004'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'subscriber_fintech', 'subscriber@fintechpay.co.id', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'SUBSCRIBER', 'scim-user-subscriber-005')
ON CONFLICT (username) DO NOTHING;

-- 3. Insert Catalog Services
INSERT INTO catalog_services (id, publisher_tenant_id, service_code, name, type, pattern, endpoint_or_topic, partitions, require_encryption, schema_contract, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', '11111111-1111-1111-1111-111111111111', 'order.created', 'Order Created Event Notification', 'ASYNC_EVENT', 'EXCHANGE_1_N', 'order.created', 3, TRUE, '{"type": "object", "properties": {"order_id": {"type": "string"}, "amount": {"type": "number"}, "customer": {"type": "string"}}}'::jsonb, 'PUBLISHED'),
('550e8400-e29b-41d4-a716-446655440002', '22222222-2222-2222-2222-222222222222', 'api-cek-resi', 'Cek Status Resi Pengiriman Real-Time', 'SYNC_REST', 'REQ_REPLY', '/api/v1/shipments/track', 1, FALSE, '{"type": "object", "properties": {"waybill_no": {"type": "string"}}}'::jsonb, 'PUBLISHED'),
('550e8400-e29b-41d4-a716-446655440003', '22222222-2222-2222-2222-222222222222', 'api-cek-tarif', 'Cek Estimasi Ongkos Kirim Domestik', 'SYNC_REST', 'REQ_REPLY', '/api/v1/shipments/rates', 1, FALSE, '{"type": "object", "properties": {"origin": {"type": "string"}, "destination": {"type": "string"}, "weight_kg": {"type": "number"}}}'::jsonb, 'PUBLISHED')
ON CONFLICT (service_code) DO NOTHING;

-- 4. Insert Subscriptions
INSERT INTO subscriptions (id, service_id, subscriber_tenant_id, status, rate_limit_tier, approved_by) VALUES
('77777777-7777-7777-7777-777777777771', '550e8400-e29b-41d4-a716-446655440001', '22222222-2222-2222-2222-222222222222', 'APPROVED', 'GOLD', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('77777777-7777-7777-7777-777777777772', '550e8400-e29b-41d4-a716-446655440001', '33333333-3333-3333-3333-333333333333', 'APPROVED', 'GOLD', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('77777777-7777-7777-7777-777777777773', '550e8400-e29b-41d4-a716-446655440002', '11111111-1111-1111-1111-111111111111', 'APPROVED', 'SILVER', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (service_id, subscriber_tenant_id) DO NOTHING;

-- 5. Insert Event Routes (Rute Fan-Out 1:N untuk order.created)
INSERT INTO event_routes (id, service_id, source_ingress_topic, event_type, target_inbox_topics, is_active) VALUES
('99999999-9999-9999-9999-999999999991', '550e8400-e29b-41d4-a716-446655440001', 'ingress.ecommerce-corp', 'order.created', '["inbox.logistics-express", "inbox.fintech-pay"]'::jsonb, TRUE)
ON CONFLICT (source_ingress_topic, event_type) DO UPDATE SET target_inbox_topics = EXCLUDED.target_inbox_topics, is_active = EXCLUDED.is_active;


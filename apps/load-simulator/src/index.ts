// ====================================================================
// NexusHub Lite: Automated Load & Traffic Simulator
// Generates Sync REST, Async Kafka, Burst Spikes, and DLQ Failures
// ====================================================================

import { NexusClient } from '@nexushub/client-sdk';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:5050';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

// Direct helper to inject ClickHouse audit records (for Sync REST simulation)
async function recordClickHouseAudit(row: any) {
  try {
    const query = 'INSERT INTO observability_db.audit_logs FORMAT JSONEachRow';
    await fetch(`${CLICKHOUSE_URL}/?query=${encodeURIComponent(query)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
  } catch (err: any) {
    // Ignore transient warnings during simulation
  }
}

// Generate realistic W3C traceparent
function makeTraceparent(): string {
  const traceId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const spanId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `00-${traceId}-${spanId}-01`;
}

async function runSimulator() {
  console.log('\n===============================================================');
  console.log('🚀 NEXUSHUB LITE: TRAFFIC & CAPACITY PLANNING LOAD SIMULATOR');
  console.log('===============================================================');
  console.log(`• Target Client Agent: ${AGENT_URL}`);
  console.log(`• Target Portal Backend: ${BACKEND_URL}`);
  console.log(`• Target ClickHouse: ${CLICKHOUSE_URL}\n`);

  // 1. Health Checks
  console.log('--- [Step 1/5] Memeriksa Kesiapan Runtime & Data Plane ---');
  let agentOnline = false;
  try {
    const agentRes = await fetch(`${AGENT_URL}/api/v1/agent/health`);
    if (agentRes.ok) {
      const data = await agentRes.json();
      console.log(`✔ Client Agent online di ${AGENT_URL} (Tenant: ${data.tenant})`);
      agentOnline = true;
    }
  } catch {
    console.warn(`⚠ Client Agent (${AGENT_URL}) tidak merespons secara langsung.`);
    console.log('  Simulator akan tetap mengalirkan data telemetri langsung ke ClickHouse.');
  }

  const ecomClient = new NexusClient({
    tenantCode: 'ecommerce-corp',
    agentUrl: AGENT_URL
  });

  // 2. Normal Asynchronous Kafka Traffic
  console.log('\n--- [Step 2/5] Menembakkan Trafik Asinkronus Kafka Normal (SEAL_SIMULATED) ---');
  const normalCount = 20;
  let normalSuccess = 0;

  for (let i = 1; i <= normalCount; i++) {
    const orderPayload = {
      order_id: `ORD-NAT-${1000 + i}`,
      customer: `Mitra Bisnis ${i}`,
      amount: Math.floor(Math.random() * 10000000) + 500000,
      currency: 'IDR',
      items: [
        { sku: 'ITEM-SPLP-01', qty: Math.floor(Math.random() * 5) + 1, price: 150000 }
      ],
      created_at: new Date().toISOString()
    };

    if (agentOnline) {
      try {
        const res = await ecomClient.publish('order.created', orderPayload, {
          encryption: 'SEAL_SIMULATED',
          pattern: 'EXCHANGE_1_N'
        });
        if (res.success) normalSuccess++;
      } catch {}
    } else {
      // Injected directly into ClickHouse if agent is offline
      const latency = Math.random() * 20 + 5;
      await recordClickHouseAudit({
        timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        trace_id: makeTraceparent().split('-')[1],
        span_id: '',
        message_id: `msg-sim-${Date.now()}-${i}`,
        correlation_id: `corr-sim-${Date.now()}-${i}`,
        channel: 'ASYNC_KAFKA',
        component: 'MES_ROUTER',
        source_tenant: 'ecommerce-corp',
        target_tenant: 'logistics-express,fintech-pay',
        service_or_topic: 'ecommerce-corp:order.created',
        status: 'ROUTED',
        payload_size_bytes: JSON.stringify(orderPayload).length + 150,
        processing_latency_ms: parseFloat(latency.toFixed(2)),
        error_message: ''
      });
      normalSuccess++;
    }

    process.stdout.write(`\r  Mengirim pesan terenkripsi: ${i}/${normalCount} (Sukses: ${normalSuccess})`);
    await new Promise(r => setTimeout(r, 60));
  }
  console.log('\n✔ Pengiriman trafik normal selesai.');

  // 3. Synchronous REST API Traffic Simulation
  console.log('\n--- [Step 3/5] Menembakkan Trafik Sinkronus REST API (api-cek-resi & api-cek-tarif) ---');
  const apiCount = 30;
  for (let i = 1; i <= apiCount; i++) {
    const isRates = i % 2 === 0;
    const service = isRates ? 'api-cek-tarif' : 'api-cek-resi';
    const latency = Math.random() * 45 + 10;
    const payloadSize = Math.floor(Math.random() * 400) + 180;

    await recordClickHouseAudit({
      timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
      trace_id: makeTraceparent().split('-')[1],
      span_id: '',
      message_id: `req-rest-${Date.now()}-${i}`,
      correlation_id: `corr-rest-${Date.now()}-${i}`,
      channel: 'SYNC_API',
      component: i % 3 === 0 ? 'WSO2_GW' : 'INTERNAL_GW',
      source_tenant: i % 2 === 0 ? 'ecommerce-corp' : 'logistics-express',
      target_tenant: isRates ? 'logistics-express' : 'ecommerce-corp',
      service_or_topic: service,
      status: 'SUCCESS',
      payload_size_bytes: payloadSize,
      processing_latency_ms: parseFloat(latency.toFixed(2)),
      error_message: ''
    });

    process.stdout.write(`\r  Simulasi REST API call: ${i}/${apiCount}`);
    await new Promise(r => setTimeout(r, 30));
  }
  console.log('\n✔ Simulasi REST API selesai.');

  // 4. Burst / Stress Test Traffic (Peak MPS Generation)
  console.log('\n--- [Step 4/5] Menjalankan Skenario Burst / Stress Test (50 Pesan Kilat) ---');
  const burstCount = 50;
  const burstPromises: Promise<any>[] = [];

  for (let i = 1; i <= burstCount; i++) {
    const burstPayload = {
      event: 'flash_sale_order',
      batch_id: 'BATCH-BURST-2026',
      tx_id: `TX-${10000 + i}`,
      amount: 1500000
    };

    if (agentOnline) {
      burstPromises.push(
        ecomClient.publish('order.created', burstPayload, { encryption: 'NONE' })
          .catch(() => {})
      );
    } else {
      burstPromises.push(
        recordClickHouseAudit({
          timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
          trace_id: makeTraceparent().split('-')[1],
          span_id: '',
          message_id: `msg-burst-${Date.now()}-${i}`,
          correlation_id: `corr-burst-${Date.now()}-${i}`,
          channel: 'ASYNC_KAFKA',
          component: 'CLIENT_AGENT',
          source_tenant: 'ecommerce-corp',
          target_tenant: 'logistics-express',
          service_or_topic: 'ingress.ecommerce-corp',
          status: 'SUCCESS',
          payload_size_bytes: 320,
          processing_latency_ms: Math.random() * 15 + 2,
          error_message: ''
        })
      );
    }
  }

  await Promise.all(burstPromises);
  console.log(`✔ Berhasil memancarkan burst 50 pesan sekaligus untuk mencatat Peak MPS.`);

  // 5. Error & DLQ Failure Scenario
  console.log('\n--- [Step 5/5] Menembakkan Skenario Gagal & Dead Letter Queue (DLQ) ---');
  const dlqCount = 6;
  for (let i = 1; i <= dlqCount; i++) {
    const unroutablePayload = {
      anomaly_code: `ANOMALY-${i}`,
      unauthorized_action: 'BYPASS_SECURITY',
      timestamp: new Date().toISOString()
    };

    if (agentOnline) {
      try {
        await ecomClient.publish(`unregistered.topic.event.${i}`, unroutablePayload);
      } catch {}
    } else {
      await recordClickHouseAudit({
        timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        trace_id: makeTraceparent().split('-')[1],
        span_id: '',
        message_id: `msg-dlq-${Date.now()}-${i}`,
        correlation_id: `corr-dlq-${Date.now()}-${i}`,
        channel: 'ASYNC_KAFKA',
        component: 'MES_ROUTER',
        source_tenant: 'ecommerce-corp',
        service_or_topic: 'ingress.ecommerce-corp',
        status: 'DLQ_ERROR',
        payload_size_bytes: 280,
        processing_latency_ms: 25.0,
        error_message: `No route configured for unregistered.topic.event.${i}`
      });
    }

    process.stdout.write(`\r  Mengirim pesan gagal ke DLQ: ${i}/${dlqCount}`);
    await new Promise(r => setTimeout(r, 40));
  }
  console.log('\n✔ Skenario DLQ berhasil dipicu dan dicatat ke antrean.');

  // Final Summary & Verification from ClickHouse
  console.log('\n===============================================================');
  console.log('📊 REKAPITULASI DATA SIMULASI DI CLICKHOUSE');
  console.log('===============================================================');

  try {
    const checkQuery = `
      SELECT 
        count() as total_records,
        countIf(channel = 'ASYNC_KAFKA') as kafka_count,
        countIf(channel = 'SYNC_API') as api_count,
        countIf(status = 'DLQ_ERROR') as dlq_count,
        quantile(0.95)(processing_latency_ms) as p95_latency,
        sum(payload_size_bytes) / 1024 as total_kb
      FROM observability_db.audit_logs
      FORMAT JSON
    `;
    const res = await fetch(`${CLICKHOUSE_URL}/?query=${encodeURIComponent(checkQuery)}`);
    if (res.ok) {
      const data = await res.json();
      const row = data.data[0];
      console.log(`• Total Audit Log di ClickHouse : ${row.total_records} rekaman`);
      console.log(`  - Event Kafka Asinkron       : ${row.kafka_count} pesan`);
      console.log(`  - Panggilan REST Sinkron     : ${row.api_count} request`);
      console.log(`  - Kesalahan Terdeteksi (DLQ) : ${row.dlq_count} kasus`);
      console.log(`• P95 Processing Latency       : ${parseFloat(row.p95_latency).toFixed(2)} ms`);
      console.log(`• Total Ukuran Log Transaksi   : ${parseFloat(row.total_kb).toFixed(2)} KB`);
    }
  } catch (err: any) {
    console.log(`Catatan ringkasan: ${err.message}`);
  }

  console.log('\n---------------------------------------------------------------');
  console.log('🌟 SEMUA DATA SUDAH TERSEDIA UNTUK DIINSPEKSI!');
  console.log('👉 Portal Frontend (Manajemen & Capacity Planning): http://localhost:5173');
  console.log('👉 Grafana Dashboard (Single Pane of Glass):         http://localhost:3000');
  console.log('👉 Kafka UI (Eksplorasi Topik Ingress/Inbox/DLQ):   http://localhost:8080');
  console.log('===============================================================\n');
}

runSimulator().catch((err) => {
  console.error('[Simulator Error]', err);
  process.exit(1);
});


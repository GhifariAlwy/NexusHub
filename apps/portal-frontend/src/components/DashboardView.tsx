import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Radio, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Layers, 
  Send
} from 'lucide-react';
import { api } from '../api';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const [statsData, logsData] = await Promise.all([
        api.getStats(),
        api.getRecentLogs(15)
      ]);
      setStats(statsData);
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'ROUTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SUCCESS</span>;
      case 'DLQ_ERROR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30">DLQ ERROR</span>;
      case 'THROTTLED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">THROTTLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-700 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Single-Laptop Architecture & Health */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-semibold">
                Single-Laptop Active Data Plane
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">
              Portal Manajemen Interoperabilitas Terpadu
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Platform Data Exchange setara SPLP menghubungkan pertukaran data Sinkronus (REST API) dan Asinkronus (Kafka Event) dengan enkripsi AES-256-GCM, audit otomatis, dan kalkulator kapasitas.
            </p>
          </div>

          {/* Quick Core Services Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">Kafka KRaft</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">DragonFly</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">ClickHouse</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">PostgreSQL</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* Card 1: Published Services */}
        <div className="bg-slate-850 bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Layanan Aktif</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '-' : stats?.publishedServices ?? 3}
          </div>
          <div className="text-xs text-indigo-400/80 mt-1 flex items-center">
            REST & Kafka Events
          </div>
        </div>

        {/* Card 2: Active Tenants */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Organisasi Mitra</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '-' : stats?.activeTenants ?? 3}
          </div>
          <div className="text-xs text-emerald-400/80 mt-1">
            Terverifikasi Multi-Tenant
          </div>
        </div>

        {/* Card 3: Active Subscriptions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Langganan Disetujui</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '-' : stats?.activeSubscriptions ?? 3}
          </div>
          <div className="text-xs text-sky-400/80 mt-1">
            Rute Fan-Out 1:N Aktif
          </div>
        </div>

        {/* Card 4: P95 Latency */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">P95 Latensi</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '-' : `${stats?.p95LatencyMs ?? 0} ms`}
          </div>
          <div className="text-xs text-purple-400/80 mt-1">
            Real-time ClickHouse OLAP
          </div>
        </div>

        {/* Card 5: Total Audit Logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Audit Log</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '-' : stats?.totalAuditLogs ?? 0}
          </div>
          <div className="text-xs text-amber-400/80 mt-1">
            Tersimpan di ClickHouse
          </div>
        </div>

        {/* Card 6: Pending DLQ */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Antrean DLQ</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats?.pendingDlq > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${stats?.pendingDlq > 0 ? 'text-rose-400' : 'text-white'}`}>
            {loading ? '-' : stats?.pendingDlq ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Pesan Memerlukan Replay
          </div>
        </div>

      </div>

      {/* Live Audit Log Feed Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              Live Audit Log & Distributed Tracing Feed
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Direct ClickHouse Stream
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-500 mr-1.5 focus:ring-0"
              />
              Auto Refresh (4s)
            </label>

            <button
              onClick={fetchData}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Refresh Manual"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-mono">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Trace ID</th>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Komponen</th>
                <th className="px-4 py-3">Pengirim ➔ Penerima</th>
                <th className="px-4 py-3">Topik / Layanan</th>
                <th className="px-4 py-3">Ukuran</th>
                <th className="px-4 py-3">Latensi</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Belum ada riwayat audit log. Jalankan `npm run simulate` untuk mengalirkan data.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="px-4 py-2.5 text-indigo-400 font-medium">
                      {log.trace_id ? `${log.trace_id.substring(0, 8)}...` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700">
                        {log.channel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-semibold">
                      {log.component}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200">
                      <span className="text-emerald-400">{log.source_tenant}</span>
                      {log.target_tenant && (
                        <>
                          <span className="text-slate-500 mx-1">➔</span>
                          <span className="text-sky-400">{log.target_tenant}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 truncate max-w-[180px]">
                      {log.service_or_topic}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {log.payload_size_bytes} B
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-medium">
                      {log.processing_latency_ms} ms
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};


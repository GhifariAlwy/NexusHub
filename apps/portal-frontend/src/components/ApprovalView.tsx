import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Radio, 
  Globe, 
  Layers, 
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { api } from '../api';

interface ApprovalViewProps {
  onApprovalDone: () => void;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({ onApprovalDone }) => {
  const [pendingServices, setPendingServices] = useState<any[]>([]);
  const [pendingSubscriptions, setPendingSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await api.getApprovals();
      setPendingServices(res.pendingServices || []);
      setPendingSubscriptions(res.pendingSubscriptions || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApproveService = async (id: string, code: string) => {
    try {
      setProcessingId(id);
      await api.approveService(id);
      await fetchApprovals();
      onApprovalDone();
      alert(`Layanan "${code}" berhasil disetujui! Kafka Ingress Topic telah otomatis di-provisioning.`);
    } catch (err: any) {
      alert(`Gagal menyetujui layanan: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveSubscription = async (id: string, serviceCode: string, subscriberCode: string) => {
    try {
      setProcessingId(id);
      await api.approveSubscription(id);
      await fetchApprovals();
      onApprovalDone();
      alert(`Langganan ${subscriberCode} ke "${serviceCode}" disetujui!\n• Kafka Inbox Topic otomatis dibuat\n• In-Memory Routing Table di DragonFly & PostgreSQL langsung disinkronkan.`);
    } catch (err: any) {
      alert(`Gagal menyetujui langganan: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (type: 'services' | 'subscriptions', id: string) => {
    if (!confirm('Apakah Anda yakin ingin menolak permohonan ini?')) return;
    try {
      setProcessingId(id);
      await api.rejectApproval(type, id);
      await fetchApprovals();
      onApprovalDone();
    } catch (err: any) {
      alert(`Gagal menolak: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const totalPending = pendingServices.length + pendingSubscriptions.length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white">Pusat Persetujuan (Approval Workflow)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Super Admin Area
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Setiap persetujuan akan memicu orkestrasi otomatis: pembuatan topik Kafka, pendaftaran ACL, dan pembaruan rute DragonFly.
          </p>
        </div>

        <button
          onClick={fetchApprovals}
          className="flex items-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Muat Ulang
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 font-mono">
          Memeriksa antrean permohonan...
        </div>
      ) : totalPending === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Tidak Ada Permohonan Tertunda</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Seluruh pendaftaran layanan baru dan permintaan langganan telah diproses.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Section 1: Pending Services */}
          {pendingServices.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Permohonan Publikasi Layanan ({pendingServices.length})
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-slate-800">
                {pendingServices.map((svc) => (
                  <div key={svc.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-white">{svc.service_code}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 font-mono">
                          {svc.type}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">({svc.pattern})</span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium">{svc.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Diajukan oleh: <strong className="text-slate-200">{svc.publisher_name}</strong> ({svc.publisher_code})
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end md:self-center">
                      <button
                        disabled={processingId === svc.id}
                        onClick={() => handleReject('services', svc.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 transition-all"
                      >
                        Tolak
                      </button>
                      <button
                        disabled={processingId === svc.id}
                        onClick={() => handleApproveService(svc.id, svc.service_code)}
                        className="flex items-center px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow shadow-indigo-600/30"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {processingId === svc.id ? 'Memproses...' : 'Setujui & Buat Topik'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Pending Subscriptions */}
          {pendingSubscriptions.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Permohonan Langganan Event / API ({pendingSubscriptions.length})
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-slate-800">
                {pendingSubscriptions.map((sub) => (
                  <div key={sub.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-emerald-400">
                          {sub.subscriber_name} ({sub.subscriber_code})
                        </span>
                        <span className="text-slate-500 text-xs">➔ langganan ke ➔</span>
                        <span className="font-mono text-sm font-bold text-white">
                          {sub.service_code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Publisher Asal: <strong className="text-slate-200">{sub.publisher_code}</strong> | SLA Tier: <span className="text-amber-400 font-mono font-semibold">{sub.rate_limit_tier}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end md:self-center">
                      <button
                        disabled={processingId === sub.id}
                        onClick={() => handleReject('subscriptions', sub.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 transition-all"
                      >
                        Tolak
                      </button>
                      <button
                        disabled={processingId === sub.id}
                        onClick={() => handleApproveSubscription(sub.id, sub.service_code, sub.subscriber_code)}
                        className="flex items-center px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow shadow-emerald-600/30"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {processingId === sub.id ? 'Memproses...' : 'Setujui & Sinkronkan Rute DragonFly'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};


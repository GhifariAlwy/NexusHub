import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Radio, 
  Globe, 
  Lock, 
  CheckCircle2, 
  Clock, 
  Code, 
  Send, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';
import { CatalogService, User } from '../types';

interface CatalogViewProps {
  currentUser: User | null;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ currentUser }) => {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [subscribingService, setSubscribingService] = useState<CatalogService | null>(null);

  // New Service Form State
  const [newService, setNewService] = useState({
    service_code: '',
    name: '',
    type: 'ASYNC_EVENT',
    pattern: 'EXCHANGE_1_N',
    endpoint_or_topic: '',
    partitions: 3,
    require_encryption: true,
    schema_contract: '{\n  "order_id": "string",\n  "amount": "number"\n}'
  });

  const [selectedTier, setSelectedTier] = useState('GOLD');

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.getCatalog(filterType, searchTerm);
      setServices(res.services || []);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [filterType, searchTerm]);

  const handleRegisterService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let contract = {};
      try {
        contract = JSON.parse(newService.schema_contract);
      } catch {
        contract = { raw: newService.schema_contract };
      }

      await api.createService({
        ...newService,
        schema_contract: contract
      });

      setShowRegisterModal(false);
      setNewService({
        service_code: '',
        name: '',
        type: 'ASYNC_EVENT',
        pattern: 'EXCHANGE_1_N',
        endpoint_or_topic: '',
        partitions: 3,
        require_encryption: true,
        schema_contract: '{\n  "key": "value"\n}'
      });
      fetchCatalog();
      alert('Layanan berhasil didaftarkan! Jika didaftarkan oleh Publisher, layanan akan masuk ke Approval Workflow Super Admin.');
    } catch (err: any) {
      alert(`Gagal mendaftarkan layanan: ${err.message}`);
    }
  };

  const handleSubscribe = async () => {
    if (!subscribingService) return;
    try {
      await api.subscribeService(subscribingService.id, selectedTier);
      setSubscribingService(null);
      fetchCatalog();
      alert(`Permintaan langganan ke "${subscribingService.service_code}" berhasil diajukan! Menunggu approval Super Admin.`);
    } catch (err: any) {
      alert(`Gagal mengajukan langganan: ${err.message}`);
    }
  };

  const isPublisherOrAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'PUBLISHER' || currentUser?.role === 'TENANT_ADMIN';

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Katalog Layanan Terpadu Nasional</h1>
          <p className="text-sm text-slate-400">
            Etalase publikasi dan langganan API Sinkronus (REST) dan Event Asinkronus (Kafka Broker).
          </p>
        </div>

        {isPublisherOrAdmin && (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Daftarkan Layanan Baru
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari layanan atau kode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center space-x-1.5 w-full md:w-auto">
          {['ALL', 'ASYNC_EVENT', 'SYNC_REST'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === t
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              {t === 'ALL' ? 'Semua Tipe' : t === 'ASYNC_EVENT' ? 'Kafka Events (Asinkron)' : 'REST API (Sinkron)'}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 font-mono">
            Memuat etalase katalog...
          </div>
        ) : services.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            Tidak ada layanan yang sesuai dengan filter atau kata kunci.
          </div>
        ) : (
          services.map((svc) => {
            const isEvent = svc.type === 'ASYNC_EVENT';
            const isMySub = svc.my_subscription_status;

            return (
              <div 
                key={svc.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 ${
                      isEvent 
                        ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' 
                        : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    }`}>
                      {isEvent ? <Radio className="w-3.5 h-3.5 mr-1" /> : <Globe className="w-3.5 h-3.5 mr-1" />}
                      {isEvent ? 'Kafka Event' : 'REST API'}
                    </span>

                    {svc.require_encryption && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center" title="Enkripsi AES-256-GCM Aktif">
                        <Lock className="w-3 h-3 mr-1" />
                        SEAL
                      </span>
                    )}
                  </div>

                  {/* Title & Code */}
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {svc.name}
                  </h3>
                  <div className="font-mono text-xs text-indigo-400 font-semibold mt-0.5">
                    {svc.service_code}
                  </div>

                  {/* Metadata Specs */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span>Publisher</span>
                      <span className="text-slate-200 font-medium">{svc.publisher_name} ({svc.publisher_code})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span>Pola Integrasi</span>
                      <span className="font-mono text-slate-300">{svc.pattern}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span>Target Ingress / URL</span>
                      <span className="font-mono text-slate-300 truncate max-w-[170px]" title={svc.endpoint_or_topic}>
                        {svc.endpoint_or_topic}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Subscribers Terhubung</span>
                      <span className="text-emerald-400 font-semibold">{svc.approved_subscribers_count} Tenant</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-mono">
                    Status: <span className="text-emerald-400 font-medium">{svc.status}</span>
                  </div>

                  {/* Subscription Button State */}
                  {currentUser?.role === 'SUBSCRIBER' && (
                    isMySub === 'APPROVED' ? (
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Aktif Langganan
                      </span>
                    ) : isMySub === 'PENDING_APPROVAL' ? (
                      <span className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Menunggu Approval
                      </span>
                    ) : (
                      <button
                        onClick={() => setSubscribingService(svc)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow"
                      >
                        Langganan Layanan
                      </button>
                    )
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Modal 1: Register New Service */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white">Daftarkan Layanan Baru ke Katalog</h2>
            
            <form onSubmit={handleRegisterService} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Layanan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pembayaran Virtual Account Callback"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Kode Unik Layanan</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. payment.success"
                    value={newService.service_code}
                    onChange={(e) => setNewService({ ...newService, service_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tipe Layanan</label>
                  <select
                    value={newService.type}
                    onChange={(e) => setNewService({ ...newService, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ASYNC_EVENT">Kafka Event (Asinkron)</option>
                    <option value="SYNC_REST">REST API (Sinkron)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Pola Integrasi</label>
                  <select
                    value={newService.pattern}
                    onChange={(e) => setNewService({ ...newService, pattern: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="EXCHANGE_1_N">Exchange 1:N (Fan-Out)</option>
                    <option value="SUBSCRIPTION_1_1">Subscription 1:1</option>
                    <option value="REQ_REPLY">Request-Reply (Sinkron)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Topik Ingress / Endpoint URL</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. payment.success atau /api/v1/payment"
                    value={newService.endpoint_or_topic}
                    onChange={(e) => setNewService({ ...newService, endpoint_or_topic: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="encCheck"
                  checked={newService.require_encryption}
                  onChange={(e) => setNewService({ ...newService, require_encryption: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
                />
                <label htmlFor="encCheck" className="text-slate-300 cursor-pointer">
                  Wajibkan Enkripsi Payload AES-256-GCM (SEAL_SIMULATED)
                </label>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Skema Kontrak JSON (Schema Contract)</label>
                <textarea
                  rows={4}
                  value={newService.schema_contract}
                  onChange={(e) => setNewService({ ...newService, schema_contract: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow"
                >
                  Kirim & Daftarkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Subscribe Confirmation */}
      {subscribingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Ajukan Langganan Layanan</h2>
            <p className="text-xs text-slate-400">
              Anda mengajukan akses konsumsi data untuk layanan <strong className="text-indigo-400">{subscribingService.name}</strong> ({subscribingService.service_code}).
            </p>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-300 font-medium">Pilih Rate Limit Tier (SLA)</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="GOLD">GOLD (Maks. 500 RPS / Pesan per dtk)</option>
                <option value="SILVER">SILVER (Maks. 200 RPS / Pesan per dtk)</option>
                <option value="BRONZE">BRONZE (Maks. 50 RPS / Pesan per dtk)</option>
                <option value="UNLIMITED">UNLIMITED (Dedicated Trunk)</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSubscribingService(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleSubscribe}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow"
              >
                Konfirmasi Ajukan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Server, 
  TrendingUp, 
  Sliders, 
  HelpCircle, 
  Layers, 
  Zap,
  Clock,
  Database
} from 'lucide-react';
import { api } from '../api';
import { CapacityPlanningData } from '../types';

export const CapacityPlanningView: React.FC = () => {
  const [data, setData] = useState<CapacityPlanningData | null>(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchCapacity = async (scaleVal: number) => {
    try {
      setLoading(true);
      const res = await api.getCapacityPlanning(scaleVal);
      setData(res);
    } catch (err) {
      console.error('Failed to load capacity planning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacity(scale);
  }, [scale]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Simulasi & Kalkulator Capacity Planning</h1>
          <p className="text-sm text-slate-400">
            Perhitungan proyeksi storage, partisi Kafka, dan alokasi pod berdasarkan data agregasi real-time dari ClickHouse OLAP.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-indigo-950/60 border border-indigo-800/80 rounded-xl px-4 py-2">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-xs text-indigo-200 font-medium">
            Live OLAP ClickHouse Connected
          </span>
        </div>
      </div>

      {/* Interactive Scale Simulator Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Simulasi Beban Trafik (What-If Scale Slider)</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Geser slider untuk mensimulasikan peningkatan volume pesan transaksi nasional dan lihat bagaimana rekomendasi infrastruktur dan storage otomatis beradaptasi.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end space-y-2 min-w-[280px]">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono text-slate-400">Skala Trafik:</span>
              <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-mono font-bold text-base shadow shadow-indigo-600/30">
                {scale}x Trafik
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={scale}
              onChange={(e) => setScale(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between w-full text-[10px] text-slate-500 font-mono">
              <span>1x (Aktual)</span>
              <span>10x</span>
              <span>25x</span>
              <span>50x (Puncak)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 3 Main Modules (Metrics, Storage Projections, Infrastructure Recommendations) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Module 1: Live Traffic Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Metrik Trafik & Karakteristik</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                ClickHouse
              </span>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">Puncak Throughput (Peak MPS)</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {data?.realtimeMetrics.peakMps ?? 0} msg/dtk
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">Rata-rata MPS</span>
                <span className="text-slate-200 font-bold">
                  {data?.realtimeMetrics.avgMps ?? 0} msg/dtk
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">P95 Latensi Pemrosesan</span>
                <span className="text-purple-400 font-bold">
                  {data?.realtimeMetrics.p95LatencyMs ?? 0} ms
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">Rata-rata Ukuran Payload</span>
                <span className="text-sky-400 font-bold">
                  {data?.realtimeMetrics.avgPayloadBytes ?? 0} Bytes
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Catatan Karakteristik:</div>
            <div>Beban payload dienkripsi dengan AES-256-GCM sehingga ukuran bertambah rata-rata 33% akibat Base64 encoding.</div>
          </div>
        </div>

        {/* Module 2: Storage Growth Projections */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Proyeksi Kebutuhan Storage</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                5x Kompresi
              </span>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">Pertumbuhan Harian</span>
                <span className="text-amber-400 font-bold">
                  {data?.storageProjections.dailyMb ?? 0} MB / hari
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">Hot Storage (30 Hari)</span>
                <span className="text-slate-200 font-bold">
                  {data?.storageProjections.monthly30DaysGb ?? 0} GB
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">ClickHouse SSD (1 Tahun)</span>
                <span className="text-indigo-400 font-bold text-sm">
                  {data?.storageProjections.yearlyHotStorageGb ?? 0} GB
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
                <span className="text-slate-400 font-sans">Cold Archival S3 (5 Tahun)</span>
                <span className="text-rose-400 font-bold text-sm">
                  {data?.storageProjections.fiveYearsColdStorageTb ?? 0} TB
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Rumus Digunakan:</div>
            <div className="font-mono text-[10px] text-indigo-300">
              Storage Harian = (Tx * AvgByte) / (5 * 1024²)
            </div>
          </div>
        </div>

        {/* Module 3: Sizing Recommendations */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Rekomendasi Kapasitas Infra</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Otomatis
              </span>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-slate-300 font-semibold">Kafka Partisi Target</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-sm">
                    {data?.infrastructureRecommendations.kafka.targetPartitions ?? 3} Partisi
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  Target = max(3, ceil(Peak MPS / 500))
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-slate-300 font-semibold">MES Engine Replicas</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-sm">
                    {data?.infrastructureRecommendations.mesEngine.recommendedPods ?? 2} Pods
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  Replikasi worker paralel sesuai kuota partisi consumer group.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-slate-300 font-semibold">API Gateway Pods</span>
                  <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-bold text-sm">
                    {data?.infrastructureRecommendations.apiGateway.recommendedPods ?? 2} Pods
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  QoS Guaranteed (1 Core CPU & 1GB RAM) ambang batas 70% CPU.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/60 text-[11px] text-indigo-300">
            Kalkulator ini mendasarkan rekomendasi pada prinsip SPLP Nasional untuk menjamin isolasi beban dan ketahanan sistem (*high availability*).
          </div>
        </div>

      </div>

    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  Code, 
  ExternalLink,
  RefreshCw,
  Search
} from 'lucide-react';
import { api } from '../api';
import { DlqRecord } from '../types';

export const DlqView: React.FC = () => {
  const [records, setRecords] = useState<DlqRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [selectedEnvelope, setSelectedEnvelope] = useState<any | null>(null);

  const fetchDlq = async () => {
    try {
      setLoading(true);
      const res = await api.getDlqRecords(filterStatus);
      setRecords(res.dlqRecords || []);
    } catch (err) {
      console.error('Failed to load DLQ records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDlq();
  }, [filterStatus]);

  const handleReplay = async (id: string, messageId: string) => {
    try {
      setReplayingId(id);
      const res = await api.replayDlqMessage(id);
      await fetchDlq();
      alert(`Pesan "${messageId}" berhasil di-replay kembali ke ${res.replayedTo}!`);
    } catch (err: any) {
      alert(`Gagal me-replay pesan: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white">Manajemen Dead Letter Queue (DLQ)</h1>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
              dlq.global
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Daftar pesan transaksi yang gagal dirutekan atau gagal didekripsi. Anda dapat memeriksa alasan kegagalan dan melakukan replay.
          </p>
        </div>

        <button
          onClick={fetchDlq}
          className="flex items-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Muat Ulang
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2">
        {[
          { label: 'Semua Status', val: '' },
          { label: 'Pending Replay', val: 'PENDING' },
          { label: 'Telah Di-Replay', val: 'REPLAYED' }
        ].map((item) => (
          <button
            key={item.val}
            onClick={() => setFilterStatus(item.val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === item.val
                ? 'bg-rose-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* DLQ Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Message ID</th>
                <th className="px-4 py-3">Topik Asal</th>
                <th className="px-4 py-3">Tahap Kegagalan</th>
                <th className="px-4 py-3">Alasan Error</th>
                <th className="px-4 py-3">Waktu Gagal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Memuat antrean pesan DLQ...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Antrean DLQ bersih. Tidak ada pesan gagal yang tercatat.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const isReplayed = rec.replay_status === 'REPLAYED';
                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-indigo-400 font-semibold">
                        {rec.message_id}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {rec.original_topic}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                          {rec.failure_stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-rose-300 max-w-xs truncate" title={rec.error_reason}>
                        {rec.error_reason}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(rec.failed_at).toLocaleTimeString('id-ID')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isReplayed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center w-fit">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            REPLAYED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center w-fit">
                            <Clock className="w-3 h-3 mr-1" />
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => setSelectedEnvelope(rec.raw_envelope)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-sans transition-colors"
                        >
                          Payload
                        </button>
                        <button
                          disabled={replayingId === rec.id}
                          onClick={() => handleReplay(rec.id, rec.message_id)}
                          className={`px-3 py-1 rounded text-[11px] font-sans font-semibold transition-all inline-flex items-center ${
                            isReplayed
                              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              : 'bg-rose-600 hover:bg-rose-500 text-white shadow shadow-rose-600/30'
                          }`}
                        >
                          <RotateCw className={`w-3 h-3 mr-1 ${replayingId === rec.id ? 'animate-spin' : ''}`} />
                          {isReplayed ? 'Replay Ulang' : 'Replay Message'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Envelope Modal */}
      {selectedEnvelope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Code className="w-4 h-4 mr-2 text-indigo-400" />
                Raw Canonical Message Envelope
              </h3>
              <button
                onClick={() => setSelectedEnvelope(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Tutup
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs overflow-auto flex-1">
              {JSON.stringify(selectedEnvelope, null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
};


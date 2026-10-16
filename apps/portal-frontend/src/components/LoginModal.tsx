import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  User, 
  Lock, 
  ArrowRight, 
  Radio, 
  Truck, 
  CreditCard,
  Building
} from 'lucide-react';
import { api } from '../api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (u: string, p: string = 'admin123') => {
    try {
      setLoading(true);
      setError('');
      const data = await api.login(u, p);
      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const quickRoles = [
    {
      username: 'superadmin',
      label: 'Super Admin / Tech Ops',
      tenant: 'Platform Pusat (Full Access & Approvals)',
      role: 'SUPER_ADMIN',
      icon: ShieldCheck,
      color: 'border-rose-500/40 hover:bg-rose-500/10 text-rose-400'
    },
    {
      username: 'tenantadmin_ecom',
      label: 'Tenant Admin',
      tenant: 'E-Commerce Corp Indonesia',
      role: 'TENANT_ADMIN',
      icon: Building,
      color: 'border-amber-500/40 hover:bg-amber-500/10 text-amber-400'
    },
    {
      username: 'publisher_ecom',
      label: 'Publisher Event (order.created)',
      tenant: 'E-Commerce Corp Indonesia',
      role: 'PUBLISHER',
      icon: Radio,
      color: 'border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400'
    },
    {
      username: 'subscriber_logistics',
      label: 'Subscriber 1 (Logistics Express)',
      tenant: 'Logistics Express Nusantara',
      role: 'SUBSCRIBER',
      icon: Truck,
      color: 'border-sky-500/40 hover:bg-sky-500/10 text-sky-400'
    },
    {
      username: 'subscriber_fintech',
      label: 'Subscriber 2 (Fintech Pay)',
      tenant: 'Fintech Pay Global Solusi',
      role: 'SUBSCRIBER',
      icon: CreditCard,
      color: 'border-indigo-500/40 hover:bg-indigo-500/10 text-indigo-400'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-6 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h2 className="text-xl font-bold text-white">Role Switcher & Autentikasi Pengguna</h2>
          <p className="text-xs text-slate-400 mt-1">
            Pilih salah satu aktor untuk mensimulasikan hak akses multi-tenant dan workflow interoperabilitas.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* 1-Click Role Switcher Presets */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Pilih Profil Demo Cepat (1-Click Switch):
          </div>

          <div className="grid grid-cols-1 gap-2">
            {quickRoles.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.username}
                  disabled={loading}
                  onClick={() => handleLogin(item.username)}
                  className={`flex items-center justify-between p-3 rounded-xl border bg-slate-800/40 transition-all text-left group ${item.color}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.tenant} • <span className="font-mono text-[10px] text-slate-500">{item.username}</span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual Form Toggle */}
        <div className="pt-4 border-t border-slate-800">
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer font-medium hover:text-white">
              Atau masuk manual dengan username & password
            </summary>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin(username, password);
              }}
              className="mt-3 space-y-3"
            >
              <div>
                <label className="block text-slate-300 mb-1">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow"
              >
                {loading ? 'Memverifikasi...' : 'Masuk'}
              </button>
            </form>
          </details>
        </div>

      </div>
    </div>
  );
};


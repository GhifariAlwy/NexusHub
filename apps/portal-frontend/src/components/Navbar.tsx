import React from 'react';
import { 
  Layers, 
  BarChart3, 
  BookOpen, 
  CheckSquare, 
  AlertOctagon, 
  Cpu, 
  UserCheck, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onOpenRoleSwitcher: () => void;
  pendingApprovalsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenRoleSwitcher,
  pendingApprovalsCount
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'catalog', label: 'Katalog Layanan', icon: BookOpen },
    ...(isSuperAdmin ? [{
      id: 'approvals',
      label: 'Approval Workflow',
      icon: CheckSquare,
      badge: pendingApprovalsCount
    }] : []),
    { id: 'dlq', label: 'Manajemen DLQ', icon: AlertOctagon },
    { id: 'capacity', label: 'Kalkulator Kapasitas', icon: Cpu }
  ];

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'TENANT_ADMIN': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'PUBLISHER': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'SUBSCRIBER': return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                NexusHub Lite
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">
                SPLP v1.0
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center px-3.5 py-2 rounded-lg text-sm font-medium transition-all relative ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-2 px-1.5 py-0.2 text-xs font-bold rounded-full bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Links & User Role Switcher */}
          <div className="flex items-center space-x-3">
            {/* External Links to Grafana & Kafka UI */}
            <div className="hidden lg:flex items-center space-x-2 border-r border-slate-800 pr-3">
              <a
                href="http://localhost:3000"
                target="_blank"
                rel="noreferrer"
                className="flex items-center text-xs text-slate-400 hover:text-indigo-400 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/50 transition-colors"
                title="Buka Grafana Observability Dashboard"
              >
                Grafana
                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
              </a>
              <a
                href="http://localhost:8080"
                target="_blank"
                rel="noreferrer"
                className="flex items-center text-xs text-slate-400 hover:text-indigo-400 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/50 transition-colors"
                title="Buka Kafka UI Topic Explorer"
              >
                Kafka UI
                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
              </a>
            </div>

            {/* Role Switcher Pill */}
            {currentUser && (
              <button
                onClick={onOpenRoleSwitcher}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 transition-all text-left group"
              >
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-slate-200">
                      {currentUser.username}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${getRoleBadgeColor(currentUser.role)}`}>
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {currentUser.tenantName || currentUser.tenantCode}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


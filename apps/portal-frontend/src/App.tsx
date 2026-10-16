import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { ApprovalView } from './components/ApprovalView';
import { DlqView } from './components/DlqView';
import { CapacityPlanningView } from './components/CapacityPlanningView';
import { LoginModal } from './components/LoginModal';
import { api, authStorage } from './api';
import { User } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(authStorage.getUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Auto-login as superadmin on initial load if no session exists
  useEffect(() => {
    if (!currentUser) {
      api.login('superadmin', 'admin123')
        .then((data) => setCurrentUser(data.user))
        .catch((err) => console.warn('Auto-login notice:', err.message));
    }
  }, []);

  const refreshApprovalsCount = async () => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      try {
        const res = await api.getApprovals();
        setPendingApprovalsCount(res.totalPending || 0);
      } catch {}
    }
  };

  useEffect(() => {
    refreshApprovalsCount();
    const interval = setInterval(refreshApprovalsCount, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'catalog' && <CatalogView currentUser={currentUser} />}
        {activeTab === 'approvals' && (
          <ApprovalView onApprovalDone={refreshApprovalsCount} />
        )}
        {activeTab === 'dlq' && <DlqView />}
        {activeTab === 'capacity' && <CapacityPlanningView />}
      </main>

      {/* Role Switcher Modal */}
      <LoginModal
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          // If non-superadmin, switch away from approvals tab
          if (user.role !== 'SUPER_ADMIN' && activeTab === 'approvals') {
            setActiveTab('dashboard');
          }
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            NexusHub Lite • Arsitektur Interoperabilitas Setara SPLP (Mode Hemat 1 Laptop)
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Total RAM Aktif: &lt; 2.6 GB (PostgreSQL, DragonFly, Kafka KRaft, ClickHouse, Alloy, Grafana)
          </div>
        </div>
      </footer>

    </div>
  );
};


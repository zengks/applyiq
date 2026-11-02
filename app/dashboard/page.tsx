'use client';

import { StoreProvider, useStore } from '@/lib/store';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import TrialBanner from '@/components/TrialBanner';
import OnboardingWizard from '@/components/modals/OnboardingWizard';
import AddJobModal from '@/components/modals/AddJobModal';
import PricingModal from '@/components/modals/PricingModal';
import DetailDrawer from '@/components/modals/DetailDrawer';
import Dashboard from '@/components/views/Dashboard';
import Applications from '@/components/views/Applications';
import AIAnalysis from '@/components/views/AIAnalysis';
import ResumeVault from '@/components/views/ResumeVault';
const Analytics = dynamic(() => import('@/components/views/Analytics'), { loading: () => <p style={{ padding: 24 }}>Loading analytics…</p> });
import Profile from '@/components/views/Profile';

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { activeView, showOnboarding, darkMode, loading, loadError, retryLoad, syncStatus, retrySave, discardUnsaved } = useStore();

  if (loadError) return <main role="alert" style={{ padding: 32 }}><p>{loadError}</p><button onClick={() => void retryLoad()}>Retry loading</button></main>;

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: darkMode ? '#0f0e0d' : '#f5f3f0', color: '#ec4899', fontWeight: 700 }}>
        Loading…
      </div>
    );
  }

  const views: Record<string, React.ReactNode> = {
    dashboard:    <Dashboard />,
    applications: <Applications />,
    ai:           <AIAnalysis />,
    resume:       <ResumeVault />,
    stats:        <Analytics />,
    profile:      <Profile />,
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: darkMode ? '#0f0e0d' : '#f5f3f0' }}>
      {showOnboarding && <OnboardingWizard />}
      {menuOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="mobile-nav-bar"><button aria-expanded={menuOpen} aria-controls="app-navigation" onClick={() => setMenuOpen(value => !value)}>☰ Menu</button><span>ApplyIQ</span></div>
        {syncStatus.pending > 0 && <div role={syncStatus.error ? 'alert' : 'status'} style={{ padding: '12px 24px', background: '#fffbeb', color: '#92400e', zIndex: 110 }}>
          {syncStatus.error || `Saving ${syncStatus.pending} change${syncStatus.pending === 1 ? '' : 's'}…`}
          {syncStatus.error && <button onClick={() => void retrySave()} disabled={syncStatus.saving} style={{ marginLeft: 12 }}>Retry save</button>}
          {syncStatus.error && <button onClick={() => { if (window.confirm('Discard unsaved changes on this page and reload your saved data?')) void discardUnsaved(); }} disabled={syncStatus.saving} style={{ marginLeft: 12 }}>Reload saved data</button>}
        </div>}
        <TrialBanner />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {views[activeView]}
        </div>
      </div>
      <DetailDrawer />
      <AddJobModal />
      <PricingModal />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}

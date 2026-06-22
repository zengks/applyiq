'use client';

import { StoreProvider, useStore } from '@/lib/store';
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
import Analytics from '@/components/views/Analytics';

function AppShell() {
  const { activeView, showOnboarding, darkMode } = useStore();

  const views: Record<string, React.ReactNode> = {
    dashboard:    <Dashboard />,
    applications: <Applications />,
    ai:           <AIAnalysis />,
    resume:       <ResumeVault />,
    stats:        <Analytics />,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: darkMode ? '#0f0e0d' : '#f5f3f0' }}>
      {showOnboarding && <OnboardingWizard />}
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

export default function Home() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}

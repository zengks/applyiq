'use client';

import { useStore } from '@/lib/store';
import { ActiveView } from '@/lib/types';

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const DashIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const BriefcaseIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </svg>
);
const AIIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const BarIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: ActiveView;
  badge?: React.ReactNode;
  activeView: ActiveView;
  darkMode: boolean;
  onSelect: (view: ActiveView) => void;
}

function NavItem({ icon, label, view, badge, activeView, darkMode, onSelect }: NavItemProps) {
  const active = activeView === view;
  const activeBg = darkMode ? 'rgba(236,72,153,0.15)' : '#fce7f3';
  const activeTxt = darkMode ? '#f0ede9' : '#be185d';
  const inactiveTxt = darkMode ? '#8a8784' : '#6b6864';

  return (
    <div
      onClick={() => onSelect(view)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
        borderRadius: 7, cursor: 'pointer', fontSize: 13,
        fontWeight: active ? 600 : 500,
        background: active ? activeBg : 'transparent',
        color: active ? activeTxt : inactiveTxt,
        borderLeft: active ? '2px solid #ec4899' : '2px solid transparent',
        marginBottom: 2,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = darkMode ? 'rgba(255,255,255,0.05)' : '#f9f7f5'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {badge}
    </div>
  );
}

export default function Sidebar() {
  const { activeView, darkMode, profileName, profileTitle, isPro, trialDaysLeft, trialDaysTotal, urgentCount, showTrialBanner, showExpiredBanner, dispatch } = useStore();

  const selectView = (view: ActiveView) => dispatch({ type: 'SET_VIEW', view });

  const sidebarBg = darkMode ? '#0a0908' : '#ffffff';
  const borderColor = darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4';
  const textMuted = darkMode ? '#8a8784' : '#9ca3af';
  const textPrimary = darkMode ? '#f0ede9' : '#1a1917';

  const initial = (profileName?.trim()?.[0] ?? 'U').toUpperCase();
  const trialPct = Math.round((trialDaysLeft / trialDaysTotal) * 100);

  // Shared props so the hoisted NavItem stays in sync with store state.
  const navProps = { activeView, darkMode, onSelect: selectView };

  return (
    <aside style={{
      width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
      height: '100vh', background: sidebarBg, borderRight: `1px solid ${borderColor}`,
    }}>
      {/* Logo */}
      <div style={{ padding: 20, borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SparkleIcon />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: textPrimary, letterSpacing: '-0.4px' }}>ApplyIQ</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Job Assistant</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        <NavItem {...navProps} icon={<DashIcon />} label="Dashboard" view="dashboard" />
        <NavItem {...navProps} icon={<BriefcaseIcon />} label="Applications" view="applications"
          badge={urgentCount > 0 ? (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, minWidth: 18, textAlign: 'center' }}>{urgentCount}</span>
          ) : undefined}
        />
        <NavItem {...navProps} icon={<AIIcon />} label="AI Analysis" view="ai"
          badge={<span style={{ background: '#ec4899', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em' }}>AI</span>}
        />
        <NavItem {...navProps} icon={<FileIcon />} label="Resume Vault" view="resume" />
        <NavItem {...navProps} icon={<BarIcon />} label="Analytics" view="stats" />

        <div style={{ height: 1, background: borderColor, margin: '10px 2px' }} />

        <NavItem {...navProps} icon={<UserIcon />} label="Profile" view="profile" />

        <form action="/auth/signout" method="post" style={{ margin: 0 }}>
          <button
            type="submit"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left',
              color: darkMode ? '#8a8784' : '#6b6864', border: 'none', borderLeft: '2px solid transparent',
              background: 'transparent', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = darkMode ? 'rgba(255,255,255,0.05)' : '#f9f7f5'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </form>
      </nav>

      {/* Trial / Pro widget */}
      {!isPro && (showTrialBanner || showExpiredBanner) && (
        <div style={{
          margin: '0 10px 10px', padding: '12px 14px', borderRadius: 10,
          background: darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#fcd34d' : '#92400e' }}>⏳ Free Trial</div>
            <div style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: darkMode ? 'rgba(245,158,11,0.2)' : '#fde68a', color: darkMode ? '#fcd34d' : '#92400e' }}>{trialDaysLeft}d left</div>
          </div>
          <div style={{ height: 3, background: darkMode ? 'rgba(255,255,255,0.1)' : '#fde68a', borderRadius: 2, overflow: 'hidden', margin: '6px 0' }}>
            <div style={{ height: '100%', width: `${trialPct}%`, background: '#f59e0b', borderRadius: 2 }} />
          </div>
          <button onClick={() => dispatch({ type: 'OPEN_PRICING' })} style={{ width: '100%', marginTop: 9, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, padding: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Upgrade to Pro →
          </button>
        </div>
      )}
      {isPro && (
        <div style={{ margin: '0 10px 10px', padding: '12px 14px', borderRadius: 10, background: darkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, background: '#d1fae5', color: '#059669' }}>✓</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Pro Active</div>
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: darkMode ? '#6ee7b7' : '#065f46' }}>Unlimited everything unlocked</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => selectView('profile')}
          title="View profile"
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileName || 'Your Name'}</div>
            <div style={{ fontSize: 11, color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileTitle || 'Job Seeker'}</div>
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_DARK', value: !darkMode })}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${borderColor}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted, flexShrink: 0 }}
        >
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </aside>
  );
}

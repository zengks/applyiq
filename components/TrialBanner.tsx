'use client';

import { useStore } from '@/lib/store';

export default function TrialBanner() {
  const { showTrialBanner, showExpiredBanner, trialDaysLeft, trialDaysTotal, darkMode, dispatch } = useStore();

  const trialPct = Math.round((trialDaysLeft / trialDaysTotal) * 100);

  if (showTrialBanner) {
    const bg = darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb';
    const borderB = darkMode ? 'rgba(245,158,11,0.2)' : '#fde68a';
    const textMain = darkMode ? '#fcd34d' : '#92400e';
    const iconBg = darkMode ? 'rgba(245,158,11,0.15)' : '#fef3c7';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', background: bg, borderBottom: `1px solid ${borderB}`, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, background: iconBg, border: '1.5px solid #fde68a', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⏳</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: textMain }}>{trialDaysLeft} days left in your free trial</div>
          <div style={{ height: 3, background: darkMode ? 'rgba(255,255,255,0.1)' : '#fde68a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${trialPct}%`, background: '#f59e0b', borderRadius: 2 }} />
          </div>
        </div>
        <button onClick={() => dispatch({ type: 'OPEN_PRICING' })} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Upgrade Now
        </button>
      </div>
    );
  }

  if (showExpiredBanner) {
    const bg = darkMode ? 'rgba(236,72,153,0.1)' : '#fce7f3';
    const borderB = darkMode ? 'rgba(236,72,153,0.2)' : '#f9a8d4';
    const textMain = darkMode ? '#f9a8d4' : '#9d174d';
    const textSub = darkMode ? '#f3a8d4' : '#be185d';
    const iconBg = darkMode ? 'rgba(236,72,153,0.15)' : '#fce7f3';
    const iconBorder = darkMode ? 'rgba(236,72,153,0.3)' : '#f9a8d4';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', background: bg, borderBottom: `1px solid ${borderB}`, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, background: iconBg, border: `1.5px solid ${iconBorder}`, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔒</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: textMain }}>Your free trial has ended</div>
          <div style={{ fontSize: 12, color: textSub }}>Upgrade to keep your data and continue using all AI features.</div>
        </div>
        <button onClick={() => dispatch({ type: 'OPEN_PRICING' })} style={{ background: '#ec4899', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
          View Plans →
        </button>
      </div>
    );
  }

  return null;
}

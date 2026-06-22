'use client';

import { useStore } from '@/lib/store';

const PLANS = [
  {
    name: 'Free Forever',
    priceMonthly: '$0',
    priceAnnual: '$0',
    features: ['5 applications', '1 resume', '3 AI analyses/month', 'Basic dashboard'],
    cta: 'Current Plan',
    disabled: true,
    highlight: false,
  },
  {
    name: 'Pro',
    priceMonthly: '$15/mo',
    priceAnnual: '$9/mo',
    features: ['Unlimited applications', '3 resume versions', 'Unlimited AI analyses', 'Cover letter generator', 'Interview prep', 'Salary insights'],
    cta: 'Start Pro — Try Free',
    disabled: false,
    highlight: true,
    badge: 'MOST POPULAR',
  },
  {
    name: 'Team',
    priceMonthly: '$39/mo',
    priceAnnual: '$29/mo',
    features: ['Everything in Pro', '5 team seats', 'Shared resume vault', 'Team analytics', 'Priority support'],
    cta: 'Start Team',
    disabled: false,
    highlight: false,
  },
];

export default function PricingModal() {
  const { showPricingModal, billingCycle, darkMode, dispatch } = useStore();

  if (!showPricingModal) return null;

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
  };

  function selectPlan(plan: typeof PLANS[0]) {
    if (plan.disabled) return;
    dispatch({ type: 'SET_PRO', value: true });
    dispatch({ type: 'CLOSE_PRICING' });
  }

  return (
    <>
      <div onClick={() => dispatch({ type: 'CLOSE_PRICING' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 820, maxWidth: 'calc(100vw - 40px)', maxHeight: 'calc(100vh - 40px)',
        background: t.card, borderRadius: 20, padding: 36, zIndex: 60, overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', animation: 'scaleIn 0.15s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.6px', margin: '0 0 8px' }}>Upgrade ApplyIQ</h2>
          <p style={{ fontSize: 14, color: t.s, margin: 0 }}>Land your next job faster with AI-powered tools.</p>
        </div>

        {/* Billing toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', background: t.inner, padding: 4, borderRadius: 10, gap: 4 }}>
            {(['monthly', 'annual'] as const).map(cycle => (
              <button key={cycle} onClick={() => dispatch({ type: 'SET_BILLING', cycle })}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  background: billingCycle === cycle ? '#ec4899' : 'transparent',
                  color: billingCycle === cycle ? '#fff' : t.m,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                {cycle === 'annual' && (
                  <span style={{ background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>30% off</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div style={{ display: 'flex', gap: 16 }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              flex: 1, borderRadius: 14, padding: '24px 22px', position: 'relative',
              border: plan.highlight ? '2px solid #ec4899' : `1px solid ${t.d}`,
              boxShadow: plan.highlight ? '0 8px 30px rgba(236,72,153,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
              background: t.card,
            }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#ec4899', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.p, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: t.p, letterSpacing: '-0.8px' }}>
                  {billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly}
                </div>
                {plan.name !== 'Free Forever' && (
                  <div style={{ fontSize: 12, color: t.m }}>billed {billingCycle === 'annual' ? 'annually' : 'monthly'}</div>
                )}
              </div>

              <div style={{ height: 1, background: t.d, marginBottom: 16 }} />

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.s }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => selectPlan(plan)}
                disabled={plan.disabled}
                style={{
                  width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                  fontSize: 14, fontWeight: 700, cursor: plan.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                  background: plan.disabled ? t.inner : plan.highlight ? '#ec4899' : t.inner,
                  color: plan.disabled ? t.m : plan.highlight ? '#fff' : t.p,
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: t.m }}>
          Cancel anytime · No hidden fees · All your data is preserved forever
        </div>
      </div>
    </>
  );
}

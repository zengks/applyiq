'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

type Tier = 'free' | 'pro' | 'team';

interface PlanDef {
  tier: Tier;
  name: string;
  features: string[];
  highlight: boolean;
  badge?: string;
  /** Team has no Stripe price configured yet, so it can't be purchased. */
  available: boolean;
}

const PLANS: PlanDef[] = [
  {
    tier: 'free',
    name: 'Free Forever',
    features: ['5 applications', '1 resume', '3 AI requests/calendar month', 'Basic dashboard'],
    highlight: false,
    available: true,
  },
  {
    tier: 'pro',
    name: 'Pro',
    features: ['Unlimited applications', '3 resume versions', 'AI analyses with fair-use limits', 'Cover letter generator', 'Interview prep', 'Salary insights'],
    highlight: true,
    badge: 'MOST POPULAR',
    available: true,
  },
  {
    tier: 'team',
    name: 'Team',
    features: ['Everything in Pro', '5 team seats', 'Shared resume vault', 'Team analytics', 'Priority support'],
    highlight: false,
    available: false,
  },
];

export default function PricingModal() {
  const { showPricingModal, billingCycle, darkMode, isPro, isTrialing, subscription, dispatch } = useStore();
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<'monthly' | 'annual', { amount: number; currency: string }> | null>(null);
  useEffect(() => {
    if (!showPricingModal) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/stripe/prices', { signal: controller.signal });
        if (!response.ok) throw new Error('Prices are unavailable. Please reopen this window to retry.');
        const data = await response.json();
        if (![data.monthly?.amount, data.annual?.amount].every(v => typeof v === 'number' && v > 0)) throw new Error('Prices are unavailable.');
        setPrices(data);
        setError('');
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Prices are unavailable.');
      }
    })();
    return () => controller.abort();
  }, [showPricingModal]);

  if (!showPricingModal) return null;

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
  };

  // Only the Pro tier is purchasable today (Free is current, Team has no price yet).
  // The monthly/annual toggle decides the actual Stripe price.
  async function selectPlan(plan: PlanDef) {
    if (plan.tier !== 'pro' || !plan.available || isPro || isTrialing || !prices || loadingTier) return;
    setError('');
    setLoadingTier(plan.tier);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billingCycle }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url); // → Stripe Checkout (hosted)
      } else {
        setError(data.error || 'Could not start checkout. Please try again.');
        setLoadingTier(null);
      }
    } catch {
      setError('Could not reach checkout. Please try again.');
      setLoadingTier(null);
    }
  }

  function ctaFor(plan: PlanDef): { label: string; disabled: boolean } {
    if (plan.tier === 'free') return { label: isPro ? 'Free plan' : 'Current Plan', disabled: true };
    if (plan.tier === 'team') return { label: 'Coming soon', disabled: true };
    if (isPro || isTrialing) return { label: isTrialing ? '✓ Trial active' : '✓ Current Plan', disabled: true };
    if (!prices) return { label: 'Loading prices…', disabled: true };
    if (loadingTier === 'pro') return { label: 'Redirecting…', disabled: true };
    return { label: subscription?.priceId || subscription?.trialEndsAt ? 'Continue with Pro' : 'Start Pro — Try Free', disabled: false };
  }

  const money = (amount: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  const discount = prices && prices.monthly.currency === prices.annual.currency
    ? Math.max(0, Math.round((1 - prices.annual.amount / (12 * prices.monthly.amount)) * 100)) : 0;

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
                {cycle === 'annual' && discount > 0 && (
                  <span style={{ background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{discount}% off</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="pricing-plans" style={{ display: 'flex', gap: 16 }}>
          {PLANS.map(plan => {
            const cta = ctaFor(plan);
            const purchasable = plan.tier === 'pro' && !isPro;
            return (
            <div key={plan.name} style={{
              flex: 1, borderRadius: 14, padding: '24px 22px', position: 'relative',
              border: plan.highlight ? '2px solid #ec4899' : `1px solid ${t.d}`,
              boxShadow: plan.highlight ? '0 8px 30px rgba(236,72,153,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
              background: t.card, opacity: plan.available ? 1 : 0.6,
            }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#ec4899', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.p, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: t.p, letterSpacing: '-0.8px' }}>
                  {plan.tier === 'pro'
                    ? prices ? `${money(billingCycle === 'annual' ? prices.annual.amount / 12 : prices.monthly.amount, prices[billingCycle].currency)}/mo` : 'Loading…'
                    : plan.tier === 'team' ? 'Coming soon' : '$0'}
                </div>
                {plan.name !== 'Free Forever' && (
                  <div style={{ fontSize: 12, color: t.m }}>{plan.tier === 'pro' && prices
                    ? `${money(prices[billingCycle].amount, prices[billingCycle].currency)} billed ${billingCycle === 'annual' ? 'annually' : 'monthly'}`
                    : 'Not available yet'}</div>
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
                disabled={cta.disabled}
                style={{
                  width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                  fontSize: 14, fontWeight: 700, cursor: cta.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                  background: cta.disabled ? t.inner : purchasable && plan.highlight ? '#ec4899' : t.inner,
                  color: cta.disabled ? t.m : purchasable && plan.highlight ? '#fff' : t.p,
                }}
              >
                {cta.label}
              </button>
            </div>
            );
          })}
        </div>

        {error && (
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{error}</div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: t.m }}>
          Pro and trial AI usage: 30 requests/hour, subject to a monthly fair-use budget. Cancel anytime.
        </div>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function Profile() {
  const {
    email, profileName, profileTitle, resumeText, darkMode,
    isPro, isTrialing, trialDaysLeft, subscription, dispatch,
  } = useStore();

  const [name, setName] = useState(profileName);
  const [title, setTitle] = useState(profileTitle);
  const [resume, setResume] = useState(resumeText);
  const [saved, setSaved] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
    inputBg: darkMode ? '#151413' : '#f9f7f5',
    inputBorder: darkMode ? '#2c2926' : '#dedad5',
  };

  const dirty = name !== profileName || title !== profileTitle || resume !== resumeText;

  const cardStyle = {
    background: t.card, borderRadius: 14, padding: '22px 24px',
    border: `1px solid ${t.d}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 9, border: `1px solid ${t.inputBorder}`,
    background: t.inputBg, color: t.p, fontSize: 14, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: t.m, marginBottom: 6, display: 'block',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  };

  async function handleSave() {
    const saved = await dispatch({ type: 'SET_PROFILE', name: name.trim() || 'User', title: title.trim() || 'Job Seeker', resume });
    setSaved(saved);
    if (saved) setTimeout(() => setSaved(false), 2000);
  }

  async function openBillingPortal() {
    setBillingError('');
    setBillingLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        setBillingError(data.error || 'Could not open billing portal.');
      }
    } catch {
      setBillingError('Could not reach the billing portal. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  }

  // Subscription summary
  const planLabel = isPro ? 'Pro' : isTrialing ? 'Free Trial' : 'Free';
  const planSub = isPro
    ? (subscription?.cancelAtPeriodEnd ? 'Cancels at the end of the current period' : 'Pro features unlocked')
    : isTrialing
      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your trial`
      : 'Upgrade to unlock more AI analyses and more';
  const planAccent = isPro ? '#059669' : isTrialing ? '#f59e0b' : '#ec4899';
  const planBg = isPro
    ? (darkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5')
    : isTrialing
      ? (darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb')
      : (darkMode ? 'rgba(236,72,153,0.1)' : '#fce7f3');

  const initial = (name.trim()[0] ?? 'U').toUpperCase();

  return (
    <div className="workspace-view" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 760, animation: 'fadeUp 0.25s ease' }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>Profile &amp; Account</h1>
        <p style={{ fontSize: 14, color: t.s, margin: '6px 0 0' }}>Manage your details, resume, and subscription.</p>
      </div>

      {/* Identity header */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.p }}>{profileName || 'Your Name'}</div>
          <div style={{ fontSize: 13, color: t.m }}>{email || 'Not signed in'}</div>
        </div>
        <span style={{ background: planBg, color: planAccent, fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {planLabel}
        </span>
      </div>

      {/* Editable details */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: '0 0 18px' }}>Personal Details</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input style={{ ...inputStyle, color: t.m, cursor: 'not-allowed' }} value={email} disabled readOnly />
          <div style={{ fontSize: 11, color: t.m, marginTop: 6 }}>Your email is managed through your login and can&apos;t be changed here.</div>
        </div>

        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Job Title / Field</label>
            <input style={inputStyle} placeholder="Senior Software Engineer" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Resume Text</label>
          <textarea
            style={{ ...inputStyle, minHeight: 160, resize: 'vertical', lineHeight: 1.6 }}
            placeholder="Paste your resume text here. This is what the AI uses to score your fit."
            value={resume}
            onChange={e => setResume(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={!dirty && !saved}
            style={{
              padding: '10px 22px', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700,
              fontFamily: 'inherit', cursor: dirty ? 'pointer' : 'default',
              background: saved ? '#059669' : dirty ? '#ec4899' : (darkMode ? '#2c2926' : '#ede9e4'),
              color: saved || dirty ? '#fff' : t.m,
            }}
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 1 })}
            style={{ padding: '10px 18px', borderRadius: 9, border: `1px solid ${t.d}`, background: 'transparent', color: t.s, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Re-run setup wizard
          </button>
        </div>
      </div>

      {/* Subscription */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: '0 0 18px' }}>Subscription</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: planBg, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: t.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
            {isPro ? '✓' : isTrialing ? '⏳' : '✦'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: planAccent }}>{planLabel} plan</div>
            <div style={{ fontSize: 12, color: t.s }}>{planSub}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isPro || subscription?.priceId ? (
            <button
              onClick={openBillingPortal}
              disabled={billingLoading}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#ec4899', color: '#fff', fontSize: 14, fontWeight: 700, cursor: billingLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: billingLoading ? 0.7 : 1 }}
            >
              {billingLoading ? 'Opening…' : 'Manage Billing'}
            </button>
          ) : (
            <button
              onClick={() => dispatch({ type: 'OPEN_PRICING' })}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#ec4899', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Upgrade to Pro →
            </button>
          )}
        </div>
        {billingError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 10 }}>{billingError}</div>}
      </div>

      {/* Sign out — native POST so the session cookie is cleared server-side */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: '0 0 6px' }}>Session</h2>
        <p style={{ fontSize: 13, color: t.s, margin: '0 0 16px' }}>Sign out of ApplyIQ on this device.</p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}

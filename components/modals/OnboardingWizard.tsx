'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function OnboardingWizard() {
  const { onboardingStep, darkMode, dispatch } = useStore();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [resume, setResume] = useState('');
  const [parsing, setParsing] = useState(false);

  async function uploadResumeFile(file: File) {
    setParsing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume/parse', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && data.text) setResume(data.text);
    } catch {
      // leave the textarea as-is on failure
    } finally {
      setParsing(false);
    }
  }

  function pickResumeFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void uploadResumeFile(file);
    };
    input.click();
  }

  const card = darkMode ? '#1c1b19' : '#ffffff';
  const bg = darkMode ? '#0f0e0d' : '#f5f3f0';
  const textPrimary = darkMode ? '#f0ede9' : '#1a1917';
  const textSecondary = darkMode ? '#b4bac4' : '#4b5563';
  const textMuted = darkMode ? '#8a8784' : '#9ca3af';
  const inputBg = darkMode ? '#151413' : '#f9f7f5';
  const inputBorder = darkMode ? '#2c2926' : '#dedad5';
  const borderColor = darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4';

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 9, border: `1px solid ${inputBorder}`,
    background: inputBg, color: textPrimary, fontSize: 14, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: textMuted, marginBottom: 6, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

  const handleFinish = () => {
    dispatch({ type: 'SET_PROFILE', name: name || 'User', title: title || 'Job Seeker', resume });
    dispatch({ type: 'CLOSE_ONBOARDING' });
  };

  const firstName = name.split(' ')[0] || 'there';

  return (
    <div style={{ position: 'fixed', inset: 0, background: bg, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 480, background: card, borderRadius: 20, padding: 40, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', animation: 'scaleIn 0.2s ease' }}>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ width: s === onboardingStep ? 24 : 8, height: 8, borderRadius: 4, background: s === onboardingStep ? '#ec4899' : (darkMode ? '#2c2926' : '#ede9e4'), transition: 'all 0.2s' }} />
          ))}
        </div>

        {onboardingStep === 1 && (
          <div>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: textPrimary, textAlign: 'center', marginBottom: 10, letterSpacing: '-0.5px' }}>Welcome to ApplyIQ</h1>
            <p style={{ fontSize: 14, color: textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>Your AI-powered job search assistant. Let&apos;s get you set up in under a minute.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Your Name</label>
              <input style={inputStyle} placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Job Title / Field</label>
              <input style={inputStyle} placeholder="Senior Software Engineer" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <button
              onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 2 })}
              disabled={!name.trim()}
              style={{ width: '100%', padding: '13px', background: name.trim() ? '#ec4899' : (darkMode ? '#2c2926' : '#ede9e4'), color: name.trim() ? '#fff' : textMuted, border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
            >
              Continue →
            </button>
          </div>
        )}

        {onboardingStep === 2 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: textPrimary, marginBottom: 8, letterSpacing: '-0.3px' }}>Paste Your Resume</h2>
            <p style={{ fontSize: 14, color: textSecondary, marginBottom: 20, lineHeight: 1.6 }}>This helps our AI match you to jobs accurately. You can update it anytime in Resume Vault.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Resume Text</label>
              <button type="button" onClick={pickResumeFile} disabled={parsing}
                style={{ fontSize: 12, fontWeight: 700, color: '#ec4899', background: 'transparent', border: 'none', cursor: parsing ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {parsing ? 'Reading file…' : '↑ Upload PDF / DOCX / TXT'}
              </button>
            </div>
            <textarea
              style={{ ...inputStyle, minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
              placeholder="Paste your full resume text here..."
              value={resume}
              onChange={e => setResume(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 1 })} style={{ flex: 1, padding: 12, background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: textSecondary, fontFamily: 'inherit' }}>
                ← Back
              </button>
              <button onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 3 })} style={{ flex: 2, padding: 12, background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {onboardingStep === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: textPrimary, marginBottom: 10, letterSpacing: '-0.4px' }}>You&apos;re all set, {firstName}!</h2>
            <p style={{ fontSize: 14, color: textSecondary, marginBottom: 28, lineHeight: 1.6 }}>Your profile is ready. Start by analyzing a job posting to see your match score, get a cover letter, and more.</p>

            <button
              onClick={() => { handleFinish(); dispatch({ type: 'SET_VIEW', view: 'ai' }); }}
              style={{ width: '100%', padding: 13, background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}
            >
              Analyze My First Job →
            </button>
            <button
              onClick={handleFinish}
              style={{ width: '100%', padding: 13, background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: textSecondary, fontFamily: 'inherit' }}
            >
              Take me to the dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

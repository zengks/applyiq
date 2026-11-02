'use client';

import { useStore } from '@/lib/store';
import { ActiveTab } from '@/lib/types';

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'keywords',  label: 'Keywords' },
  { key: 'cover',     label: 'Cover Letter' },
  { key: 'interview', label: 'Interview' },
  { key: 'insights',  label: 'Insights' },
];

export default function AIAnalysis() {
  const { jobUrl, jobDescription, aiLoading, analysisShown, aiResult, aiError, aiErrorMsg, activeTab, resumeText, darkMode, coverCopied, dispatch } = useStore();

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

  const cardStyle = { background: t.card, borderRadius: 14, padding: '20px 22px', border: `1px solid ${t.d}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 9, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.p, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const };

  async function handleAnalyze() {
    if (!jobUrl.trim()) return;
    dispatch({ type: 'AI_START' });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobUrl, jobDescription, resumeText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      dispatch({ type: 'AI_SUCCESS', result: data });
    } catch (err) {
      dispatch({ type: 'AI_ERROR', message: err instanceof Error ? err.message : 'Analysis failed.' });
    }
  }

  async function copyLetter() {
    if (!aiResult?.coverLetter) return;
    await navigator.clipboard.writeText(aiResult.coverLetter);
    dispatch({ type: 'SET_COVER_COPIED', value: true });
    setTimeout(() => dispatch({ type: 'SET_COVER_COPIED', value: false }), 2000);
  }

  const score = aiResult?.matchScore ?? 0;
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="workspace-view" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>AI Analysis</h1>
          <p style={{ fontSize: 14, color: t.s, margin: '6px 0 0' }}>Drop in a job posting URL — AI reads the page and returns your match score, cover letter, interview prep, and more.</p>
        </div>
        {analysisShown && (
          <button onClick={() => dispatch({ type: 'AI_RESET' })} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${t.d}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: t.s, fontFamily: 'inherit' }}>
            ← New Analysis
          </button>
        )}
      </div>

      {/* Input card */}
      {!analysisShown && (
        <div style={cardStyle}>
          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 16 }}>
            <input style={inputStyle} placeholder="Job posting URL (required) — AI reads the page for you" value={jobUrl} onChange={e => dispatch({ type: 'SET_JOB_URL', value: e.target.value })} />
            <button
              onClick={handleAnalyze}
              disabled={aiLoading || !jobUrl.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: aiLoading || !jobUrl.trim() ? '#e5e7eb' : '#ec4899', color: aiLoading || !jobUrl.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: aiLoading || !jobUrl.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}
            >
              {aiLoading ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Analyze with AI
                </>
              )}
            </button>
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
            placeholder="Optional: paste the job description here as a fallback if the page can't be auto-read."
            value={jobDescription}
            onChange={e => dispatch({ type: 'SET_JOB_DESC', value: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 14 }}>
            {['Match Score', 'Keyword Gap', 'Cover Letter', 'Interview Prep', 'Salary Insights'].map(tag => (
              <span key={tag} style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: t.inner, color: t.m }}>{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {aiLoading && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16, animation: 'pulse-fade 1.5s ease infinite' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #fce7f3', borderTopColor: '#ec4899', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: t.s }}>Analyzing with Claude AI...</div>
        </div>
      )}

      {/* Error */}
      {aiError && !aiLoading && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40, gap: 12 }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.p }}>Analysis failed</div>
          <div style={{ fontSize: 13, color: t.s, textAlign: 'center', maxWidth: 380 }}>{aiErrorMsg || 'Check your connection or try a different job description.'}</div>
          <button onClick={handleAnalyze} style={{ padding: '9px 20px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {analysisShown && aiResult && !aiLoading && (
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Match ring */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke={darkMode ? '#2c2926' : '#f3f4f6'} strokeWidth="10" />
              <circle cx="60" cy="60" r="54" fill="none" stroke="#ec4899" strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
              <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="800" fill={darkMode ? '#f0ede9' : '#1a1917'} fontFamily="Plus Jakarta Sans, sans-serif">{score}%</text>
            </svg>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.m, marginTop: 8, textAlign: 'center' }}>Match Score</div>
            {aiResult.role && <div style={{ fontSize: 13, fontWeight: 700, color: t.p, marginTop: 8, textAlign: 'center' }}>{aiResult.role}</div>}
            {aiResult.company && <div style={{ fontSize: 12, color: t.m, textAlign: 'center' }}>{aiResult.company}</div>}
            {aiResult.cost && (
              <div style={{ fontSize: 10, color: t.m, textAlign: 'center', marginTop: 8 }} title={`${aiResult.cost.model} · $${aiResult.cost.monthSpendUsd.toFixed(2)} this month`}>
                Cost: ${aiResult.cost.costUsd.toFixed(4)}
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'SAVE_AI_TO_BOARD' })}
              style={{ width: '100%', marginTop: 16, padding: '9px', background: t.inner, color: t.p, border: `1px solid ${t.d}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Save to Board
            </button>
          </div>

          {/* Tabs panel */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${t.d}` }}>
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => dispatch({ type: 'SET_TAB', tab: tab.key })}
                  style={{ flex: 1, padding: '14px 0', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? '#ec4899' : t.m, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: activeTab === tab.key ? '2px solid #ec4899' : '2px solid transparent', marginBottom: -1 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 22 }}>
              {/* Keywords tab */}
              {activeTab === 'keywords' && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Matched Keywords</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                      {(aiResult.matchedKeywords ?? []).map(k => (
                        <span key={k} style={{ background: '#ecfdf5', color: '#059669', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>{k}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Missing Keywords</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                      {(aiResult.missingKeywords ?? []).map(k => (
                        <span key={k} style={{ background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, border: '1.5px dashed #f59e0b' }}>{k}</span>
                      ))}
                    </div>
                  </div>
                  {aiResult.aiSuggestion && (
                    <div style={{ background: darkMode ? '#1a0d2e' : '#faf8ff', borderRadius: 10, padding: '16px 18px', border: `1px solid ${darkMode ? '#4c1d95' : '#e9d5ff'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Suggestion</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: darkMode ? '#e2dcf5' : '#312352', lineHeight: 1.75, letterSpacing: '0.01em' }}>{aiResult.aiSuggestion}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Cover Letter tab */}
              {activeTab === 'cover' && (
                <div>
                  <div style={{ background: t.inner, borderRadius: 10, padding: 18, marginBottom: 16, minHeight: 200, fontSize: 14, color: t.p, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
                    {aiResult.coverLetter}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleAnalyze} style={{ padding: '9px 18px', background: t.inner, color: t.s, border: `1px solid ${t.d}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Regenerate
                    </button>
                    <button onClick={copyLetter} style={{ padding: '9px 18px', background: coverCopied ? '#059669' : '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                      {coverCopied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Interview tab */}
              {activeTab === 'interview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(aiResult.interviewQuestions ?? []).map((iq, i) => (
                    <div key={i} style={{ background: t.inner, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.p, marginBottom: 8 }}>Q{i + 1}: {iq.q}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 14 }}>💡</span>
                        <div style={{ fontSize: 13, color: t.s, lineHeight: 1.6 }}>{iq.hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Insights tab */}
              {activeTab === 'insights' && (
                <div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: t.p, letterSpacing: '-1px', marginBottom: 4 }}>{aiResult.salaryRange}</div>
                  <div style={{ fontSize: 12, color: t.m, marginBottom: 20 }}>Estimated salary range</div>
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                    {[{ label: 'Industry', value: aiResult.industry }, { label: 'Seniority', value: aiResult.seniority }].map(item => (
                      <div key={item.label} style={{ background: t.inner, borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.p }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Culture Signals</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                    {(aiResult.culture ?? []).map(c => (
                      <span key={c} style={{ background: t.inner, color: t.s, fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 20, border: `1px solid ${t.d}` }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysisShown && !aiLoading && !aiError && !jobUrl && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.p }}>Ready to analyze</div>
          <div style={{ fontSize: 14, color: t.s, textAlign: 'center', maxWidth: 360 }}>Paste a job posting URL above and click &quot;Analyze with AI&quot; — it reads the page and builds your personalized match report.</div>
        </div>
      )}
    </div>
  );
}

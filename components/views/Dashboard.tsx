'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Application } from '@/lib/types';
import { getLogoColor, getInitial, STATUS_LABELS, STATUS_COLORS, getMatchColors, deadlineColor, formatDeadline, todayString, greetingPrefix, POSTING_BADGES, postingHeadline } from '@/lib/utils';

export default function Dashboard() {
  const { applications, profileName, darkMode, isPro, isTrialing, trialDaysLeft, stalePostings, dispatch } = useStore();
  // Session-only: dismissing hides the banner until the next reload, the badges
  // on the board stay either way.
  const [staleDismissed, setStaleDismissed] = useState(false);

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
  };

  const applied = applications.filter(a => a.status !== 'saved');
  const interviews = applications.filter(a => a.status === 'interview');
  const offers = applications.filter(a => a.status === 'offer');
  const avgMatch = applied.length ? Math.round(applied.reduce((s, a) => s + a.match, 0) / applied.length) : 0;
  const interviewRate = applied.length ? Math.round((interviews.length / applied.length) * 100) : 0;

  const recent = [...applications].slice(0, 6);
  const withDeadlines = applications.filter(a => a.deadline).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()).slice(0, 4);
  const topMatches = [...applications].sort((a, b) => b.match - a.match).slice(0, 3);

  const firstName = profileName?.split(' ')[0] || 'there';

  const cardStyle = {
    background: t.card, borderRadius: 14, padding: '20px 22px',
    border: `1px solid ${t.d}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  return (
    <div className="workspace-view" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22, animation: 'fadeUp 0.25s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>
            {greetingPrefix()}, {firstName} 👋
          </h1>
          <p style={{ fontSize: 14, color: t.s, margin: '6px 0 0' }}>{todayString()} · Your job search at a glance.</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'ai' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Analyze a Job
        </button>
      </div>

      {/* Dead / closed postings */}
      {stalePostings.length > 0 && !staleDismissed && (
        <StalePostingsAlert
          apps={stalePostings}
          darkMode={darkMode}
          onOpen={id => dispatch({ type: 'OPEN_DETAIL', id })}
          onDismiss={() => setStaleDismissed(true)}
        />
      )}

      {/* Upgrade promo + sponsored links — only for non-Pro users */}
      {!isPro && !isTrialing && <UpgradePromo isTrialing={isTrialing} trialDaysLeft={trialDaysLeft} darkMode={darkMode} dispatch={dispatch} />}

      {/* Stats grid */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <StatCard label="Total Applied" value={String(applied.length)} sub="Across your saved records" subColor="#059669" iconBg="#fce7f3" icon={<BriefcaseStatIcon />} darkMode={darkMode} />
        <StatCard label="Interviews" value={String(interviews.length)} sub={`→ ${interviewRate}% interview rate`} subColor="#f59e0b" iconBg="#fffbeb" icon={<ChatIcon />} darkMode={darkMode} />
        <StatCard label="Avg. Match" value={String(avgMatch)} suffix="%" sub="Across all applications" subColor={t.m} iconBg="#fce7f3" icon={<SparkleStatIcon />} darkMode={darkMode} />
        <OfferCard count={offers.length} darkMode={darkMode} />
      </div>

      {/* Main grid */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 20, alignItems: 'start' }}>
        {/* Recent applications */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${t.d}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: t.p, margin: 0 }}>Recent Applications</h2>
            <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'applications' })} style={{ fontSize: 12, fontWeight: 600, color: '#ec4899', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit' }}>
              View board →
            </button>
          </div>
          {recent.map((app: Application) => {
            const sc = STATUS_COLORS[app.status];
            const mc = getMatchColors(app.match);
            const pb = app.status === 'offer' || app.status === 'rejected' ? null : POSTING_BADGES[app.postingStatus];
            return (
              <div
                key={app.id}
                onClick={() => dispatch({ type: 'OPEN_DETAIL', id: app.id })}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px', borderBottom: `1px solid ${t.d}`, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.inner; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800, background: getLogoColor(app.company) }}>
                  {getInitial(app.company)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.p, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.role}</div>
                  <div style={{ fontSize: 12, color: t.m }}>{app.company}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {pb && (
                    <span title={app.postingNote || undefined} style={{ background: pb.bg, color: pb.text, border: `1px solid ${pb.border}`, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                      {pb.icon} {pb.label}
                    </span>
                  )}
                  <span style={{ background: sc.bg, color: sc.text, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{STATUS_LABELS[app.status]}</span>
                  <span style={{ background: mc.bg, color: mc.text, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, minWidth: 42, textAlign: 'center' }}>{app.match}%</span>
                </div>
              </div>
            );
          })}
          {recent.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: t.m, fontSize: 13 }}>No applications yet. Add your first one!</div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Deadlines */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: t.p, margin: '0 0 14px' }}>Upcoming Deadlines</h2>
            {withDeadlines.length === 0 ? (
              <div style={{ fontSize: 13, color: t.m }}>No upcoming deadlines.</div>
            ) : withDeadlines.map(app => (
              <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.p }}>{app.role}</div>
                  <div style={{ fontSize: 11, color: t.m }}>{app.company}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: deadlineColor(app.deadline), background: darkMode ? 'rgba(255,255,255,0.06)' : '#f9f7f5', padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
                  {formatDeadline(app.deadline)}
                </span>
              </div>
            ))}
          </div>

          {/* AI Top Matches */}
          <div style={{ ...cardStyle, background: darkMode ? '#1a1018' : 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#f0ede9' : '#1a1917', margin: 0 }}>AI Top Matches</h2>
            </div>
            {topMatches.map(app => {
              const mc = getMatchColors(app.match);
              return (
                <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f0ede9' : '#1a1917' }}>{app.role}</div>
                    <div style={{ fontSize: 11, color: darkMode ? '#8a8784' : '#9ca3af' }}>{app.company}</div>
                  </div>
                  <span style={{ background: mc.bg, color: mc.text, fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>{app.match}%</span>
                </div>
              );
            })}
            <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'ai' })} style={{ width: '100%', marginTop: 10, padding: '9px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Analyze a New Job →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Top-of-dashboard warning listing saved jobs whose posting has been closed or
 * taken down at the source, so a dead link can't sit unnoticed on the board.
 */
function StalePostingsAlert({ apps, darkMode, onOpen, onDismiss }: {
  apps: Application[]; darkMode: boolean; onOpen: (id: string) => void; onDismiss: () => void;
}) {
  const removed = apps.filter(a => a.postingStatus === 'removed').length;
  const expired = apps.length - removed;
  const parts = [
    removed ? `${removed} taken down` : '',
    expired ? `${expired} no longer accepting applications` : '',
  ].filter(Boolean).join(' · ');

  const textP = darkMode ? '#f0ede9' : '#1a1917';
  const textM = darkMode ? '#b4bac4' : '#6b6864';

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', borderRadius: 14,
      background: darkMode ? 'rgba(245,158,11,0.09)' : '#fffbeb',
      border: `1px solid ${darkMode ? 'rgba(245,158,11,0.3)' : '#fcd34d'}`,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: darkMode ? 'rgba(245,158,11,0.18)' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} aria-hidden>⚠</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: textP, letterSpacing: '-0.2px' }}>
          {apps.length === 1
            ? '1 saved job is no longer live at its source'
            : `${apps.length} saved jobs are no longer live at their source`}
        </div>
        <div style={{ fontSize: 12, color: textM, marginTop: 3 }}>{parts}. Open one to see what happened, or remove it from your board.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {apps.slice(0, 5).map(a => {
            const pb = POSTING_BADGES[a.postingStatus];
            return (
              <button
                key={a.id}
                onClick={() => onOpen(a.id)}
                title={postingHeadline(a.postingStatus)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20,
                  background: darkMode ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  border: `1px solid ${pb?.border ?? '#fcd34d'}`,
                  color: pb?.text ?? textP, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span aria-hidden>{pb?.icon}</span>{a.role} · {a.company}
              </button>
            );
          })}
          {apps.length > 5 && <span style={{ fontSize: 12, color: textM, alignSelf: 'center' }}>+{apps.length - 5} more</span>}
        </div>
      </div>
      <button
        onClick={onDismiss}
        title="Dismiss"
        aria-label="Dismiss"
        style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: 'none', background: 'transparent', color: textM, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
      >
        ✕
      </button>
    </div>
  );
}

function StatCard({ label, value, suffix, sub, subColor, iconBg, icon, darkMode }: {
  label: string; value: string; suffix?: string; sub: string; subColor: string; iconBg: string; icon: React.ReactNode; darkMode: boolean;
}) {
  const card = darkMode ? '#1c1b19' : '#ffffff';
  const border = darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4';
  const textP = darkMode ? '#f0ede9' : '#1a1917';
  const textM = darkMode ? '#8a8784' : '#9ca3af';
  return (
    <div style={{ background: card, borderRadius: 14, padding: '20px 22px', border: `1px solid ${border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: textM, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      </div>
      <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', marginBottom: 5, color: textP }}>
        {value}{suffix && <span style={{ fontSize: 20, fontWeight: 600, color: textM }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 12, color: subColor, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

function OfferCard({ count, darkMode }: { count: number; darkMode: boolean }) {
  const bg = darkMode ? 'linear-gradient(135deg,#2d0a1e,#1a0d2e)' : 'linear-gradient(135deg,#fce7f3,#f5f3ff)';
  const numC = darkMode ? '#f0ede9' : '#1a1917';
  const lblC = darkMode ? 'rgba(240,237,233,0.7)' : '#9d174d';
  const border = darkMode ? 'rgba(255,255,255,0.07)' : '#f3e8ff';
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '20px 22px', border: `1px solid ${border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -14, right: -14, width: 70, height: 70, background: 'radial-gradient(circle,rgba(236,72,153,0.45) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: lblC, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Offers</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', marginBottom: 5, color: numC, position: 'relative' }}>{count}</div>
      <div style={{ fontSize: 12, color: '#ec4899', fontWeight: 600, position: 'relative' }}>🎉 You&apos;re doing great!</div>
    </div>
  );
}

// Shown only to non-Pro users: an upgrade reminder plus a small strip of
// sponsored external resources. Pro users see none of this.
const SPONSORED = [
  { label: 'LinkedIn Jobs', desc: 'Find roles that match your profile', url: 'https://www.linkedin.com/jobs/' },
  { label: 'Levels.fyi', desc: 'Compare salaries before you negotiate', url: 'https://www.levels.fyi/' },
  { label: 'Indeed', desc: 'Browse millions of open positions', url: 'https://www.indeed.com/' },
];

function UpgradePromo({ isTrialing, trialDaysLeft, darkMode, dispatch }: {
  isTrialing: boolean; trialDaysLeft: number; darkMode: boolean; dispatch: ReturnType<typeof useStore>['dispatch'];
}) {
  const textM = darkMode ? '#8a8784' : '#9ca3af';
  const cardBg = darkMode ? '#1c1b19' : '#ffffff';
  const border = darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4';

  const headline = isTrialing
    ? `You have ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left on your free trial`
    : 'Your Free plan';
  const sub = isTrialing
    ? 'Upgrade to Pro to keep more AI analyses, cover letters, and interview prep after your trial.'
    : 'Upgrade to Pro to unlock more AI analyses, cover letters, interview prep, and salary insights.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Upgrade banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, padding: '18px 22px', borderRadius: 14,
        background: darkMode ? 'linear-gradient(135deg,#2d0a1e,#1a0d2e)' : 'linear-gradient(135deg,#fdf2f8,#f5f3ff)',
        border: `1px solid ${darkMode ? 'rgba(236,72,153,0.25)' : '#fbcfe8'}`,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: darkMode ? '#f0ede9' : '#1a1917', letterSpacing: '-0.3px' }}>{headline}</div>
          <div style={{ fontSize: 13, color: darkMode ? '#b4bac4' : '#6b6864', marginTop: 3 }}>{sub}</div>
        </div>
        <button
          onClick={() => dispatch({ type: 'OPEN_PRICING' })}
          style={{ flexShrink: 0, padding: '10px 20px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >
          Upgrade to Pro →
        </button>
      </div>

      {/* Sponsored resources */}
      <div style={{ background: cardBg, borderRadius: 14, border: `1px solid ${border}`, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: textM, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resources for your search</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: textM, border: `1px solid ${border}`, borderRadius: 20, padding: '2px 8px' }}>Sponsored</span>
        </div>
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {SPONSORED.map(s => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              style={{ display: 'block', padding: '12px 14px', borderRadius: 10, textDecoration: 'none', background: darkMode ? '#151413' : '#f9f7f5', border: `1px solid ${border}` }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ec4899' }}>{s.label} ↗</div>
              <div style={{ fontSize: 12, color: textM, marginTop: 2 }}>{s.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

const BriefcaseStatIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const SparkleStatIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

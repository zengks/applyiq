'use client';

import { useStore } from '@/lib/store';
import { Application, AppStatus } from '@/lib/types';
import { getLogoColor, getInitial, getMatchColors, formatDeadline, deadlineColor } from '@/lib/utils';

const COLUMNS: { status: AppStatus; label: string; color: string }[] = [
  { status: 'saved',     label: 'Saved',        color: '#9ca3af' },
  { status: 'applied',   label: 'Applied',       color: '#3b82f6' },
  { status: 'interview', label: 'Interview',     color: '#f59e0b' },
  { status: 'offer',     label: 'Offer',         color: '#059669' },
  { status: 'rejected',  label: 'Not Selected',  color: '#9ca3af' },
];

export default function Applications() {
  const { applications, darkMode, dispatch } = useStore();

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
    colBg: darkMode ? '#151413' : '#f9f7f5',
  };

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', animation: 'fadeUp 0.25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>Applications</h1>
        <button
          onClick={() => dispatch({ type: 'OPEN_ADD_JOB' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Job
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, flex: 1 }}>
        {COLUMNS.map(col => {
          const cards = applications.filter(a => a.status === col.status);
          return (
            <div key={col.status} style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                <span style={{ background: col.color + '22', color: col.color, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>{cards.length}</span>
              </div>
              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cards.map(app => (
                  <KanbanCard key={app.id} app={app} darkMode={darkMode} colColor={col.status === 'offer' ? '#059669' : undefined}
                    onOpen={() => dispatch({ type: 'OPEN_DETAIL', id: app.id })}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ padding: '20px 14px', borderRadius: 11, border: `1.5px dashed ${t.d}`, textAlign: 'center', fontSize: 12, color: t.m }}>No jobs here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ app, darkMode, colColor, onOpen }: { app: Application; darkMode: boolean; colColor?: string; onOpen: () => void }) {
  const mc = getMatchColors(app.match);
  const cardBg = darkMode ? '#1c1b19' : '#ffffff';
  const border = darkMode ? 'rgba(255,255,255,0.07)' : '#ede9e4';
  const textP = darkMode ? '#f0ede9' : '#1a1917';
  const textM = darkMode ? '#8a8784' : '#9ca3af';
  const rejected = app.status === 'rejected';

  return (
    <div
      onClick={onOpen}
      style={{
        background: cardBg, borderRadius: 11, padding: 14, cursor: 'pointer',
        border: colColor ? `1.5px solid ${colColor}44` : `1px solid ${border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        opacity: rejected ? 0.55 : 1,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.09)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: getLogoColor(app.company), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
          {getInitial(app.company)}
        </div>
        <span style={{ background: mc.bg, color: mc.text, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{app.match}%</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: textP, marginBottom: 3, textDecoration: rejected ? 'line-through' : 'none' }}>{app.role}</div>
      <div style={{ fontSize: 12, color: textM, marginBottom: app.deadline ? 8 : 0 }}>{app.company}</div>
      {app.deadline && (
        <div style={{ fontSize: 11, fontWeight: 600, color: deadlineColor(app.deadline) }}>
          {formatDeadline(app.deadline)}
        </div>
      )}
    </div>
  );
}

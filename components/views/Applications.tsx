'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Application, AppStatus } from '@/lib/types';
import { getLogoColor, getInitial, getMatchColors, formatDeadline, deadlineColor, POSTING_BADGES } from '@/lib/utils';

const COLUMNS: { status: AppStatus; label: string; color: string }[] = [
  { status: 'saved',     label: 'Saved',        color: '#9ca3af' },
  { status: 'applied',   label: 'Applied',       color: '#3b82f6' },
  { status: 'interview', label: 'Interview',     color: '#f59e0b' },
  { status: 'offer',     label: 'Offer',         color: '#059669' },
  { status: 'rejected',  label: 'Not Selected',  color: '#9ca3af' },
];

export default function Applications() {
  const { applications, darkMode, dispatch, checkPostings, checkingPostings, checkingPostingIds, staleCount, postingCheckError } = useStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<AppStatus | null>(null);

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
    colBg: darkMode ? '#151413' : '#f9f7f5',
  };

  const handleDrop = (status: AppStatus) => {
    if (draggingId) {
      const app = applications.find(a => a.id === draggingId);
      if (app && app.status !== status) {
        dispatch({ type: 'UPDATE_APP_STATUS', id: draggingId, status });
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  return (
    <div className="workspace-view" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', animation: 'fadeUp 0.25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>Applications</h1>
          {staleCount > 0 && (
            <p style={{ fontSize: 13, color: '#b45309', margin: '6px 0 0', fontWeight: 600 }}>
              ⚠ {staleCount} posting{staleCount === 1 ? ' is' : 's are'} no longer live at the source.
            </p>
          )}
          {postingCheckError && (
            <p style={{ fontSize: 13, color: t.m, margin: '6px 0 0' }}>{postingCheckError}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => checkPostings(applications.filter(a => a.url?.trim()).map(a => a.id))}
          disabled={checkingPostings}
          title="Re-check every saved posting against its source"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'transparent', color: t.m, border: `1px solid ${t.d}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: checkingPostings ? 'default' : 'pointer', fontFamily: 'inherit', opacity: checkingPostings ? 0.6 : 1 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
          {checkingPostings ? 'Checking…' : 'Check links'}
        </button>
        <button
          onClick={() => dispatch({ type: 'OPEN_ADD_JOB' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Job
        </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, flex: 1 }}>
        {COLUMNS.map(col => {
          const cards = applications.filter(a => a.status === col.status);
          const isOver = dragOverCol === col.status;
          return (
            <div
              key={col.status}
              onDragOver={e => { e.preventDefault(); if (dragOverCol !== col.status) setDragOverCol(col.status); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(prev => prev === col.status ? null : prev); }}
              onDrop={e => { e.preventDefault(); handleDrop(col.status); }}
              style={{
                width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
                padding: 6, margin: -6, borderRadius: 12,
                background: isOver ? col.color + '14' : 'transparent',
                outline: isOver ? `1.5px dashed ${col.color}88` : '1.5px dashed transparent',
                transition: 'background 0.12s, outline-color 0.12s',
              }}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                <span style={{ background: col.color + '22', color: col.color, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>{cards.length}</span>
              </div>
              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {cards.map(app => (
                  <KanbanCard key={app.id} app={app} darkMode={darkMode} colColor={col.status === 'offer' ? '#059669' : undefined}
                    checking={checkingPostingIds.includes(app.id)}
                    dragging={draggingId === app.id}
                    onDragStart={() => setDraggingId(app.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                    onOpen={() => dispatch({ type: 'OPEN_DETAIL', id: app.id })}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ padding: '20px 14px', borderRadius: 11, border: `1.5px dashed ${t.d}`, textAlign: 'center', fontSize: 12, color: t.m }}>{isOver ? 'Drop here' : 'No jobs here'}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ app, darkMode, colColor, checking, dragging, onOpen, onDragStart, onDragEnd }: { app: Application; darkMode: boolean; colColor?: string; checking: boolean; dragging: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const mc = getMatchColors(app.match);
  // Settled jobs (offer / not selected) don't need a dead-link warning — matches
  // what `stalePostings` counts.
  const settled = app.status === 'offer' || app.status === 'rejected';
  const posting = settled ? null : POSTING_BADGES[app.postingStatus];
  const cardBg = darkMode ? '#1c1b19' : '#ffffff';
  const border = darkMode ? 'rgba(255,255,255,0.07)' : '#ede9e4';
  const textP = darkMode ? '#f0ede9' : '#1a1917';
  const textM = darkMode ? '#8a8784' : '#9ca3af';
  const rejected = app.status === 'rejected';

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', app.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{
        background: cardBg, borderRadius: 11, padding: 14, cursor: 'grab',
        border: posting ? `1.5px solid ${posting.border}` : colColor ? `1.5px solid ${colColor}44` : `1px solid ${border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        opacity: dragging ? 0.4 : rejected ? 0.55 : 1,
        transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.12s',
      }}
      onMouseEnter={e => { if (!dragging) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.09)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: getLogoColor(app.company), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
          {getInitial(app.company)}
        </div>
        <span style={{ background: mc.bg, color: mc.text, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{app.match}%</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: textP, marginBottom: 3, textDecoration: rejected ? 'line-through' : 'none' }}>{app.role}</div>
      <div style={{ fontSize: 12, color: textM, marginBottom: app.deadline || posting || checking ? 8 : 0 }}>{app.company}</div>
      {posting && (
        <div
          title={app.postingNote || undefined}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: posting.bg, color: posting.text, border: `1px solid ${posting.border}`, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginBottom: app.deadline ? 8 : 0, letterSpacing: '0.02em' }}
        >
          <span aria-hidden>{posting.icon}</span>{posting.label}
        </div>
      )}
      {checking && !posting && (
        <div style={{ fontSize: 10, fontWeight: 700, color: textM, marginBottom: app.deadline ? 8 : 0 }}>Checking link…</div>
      )}
      {app.deadline && (
        <div style={{ fontSize: 11, fontWeight: 600, color: deadlineColor(app.deadline) }}>
          {formatDeadline(app.deadline)}
        </div>
      )}
    </div>
  );
}

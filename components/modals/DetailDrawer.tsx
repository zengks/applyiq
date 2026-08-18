'use client';

import { useStore } from '@/lib/store';
import { AppStatus } from '@/lib/types';
import { STATUS_LABELS, getLogoColor, getInitial, getMatchColors, deadlineColor, formatDeadline, POSTING_BADGES, postingHeadline, relativeTime } from '@/lib/utils';

const STATUSES: AppStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_ACTIVE_STYLES: Record<AppStatus, { bg: string; color: string; border: string }> = {
  saved:     { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  applied:   { bg: '#eff6ff', color: '#3b82f6', border: '#93c5fd' },
  interview: { bg: '#fffbeb', color: '#f59e0b', border: '#fcd34d' },
  offer:     { bg: '#ecfdf5', color: '#059669', border: '#6ee7b7' },
  rejected:  { bg: '#fef2f2', color: '#ef4444', border: '#fca5a5' },
};

export default function DetailDrawer() {
  const { selectedApp, showDetailDrawer, darkMode, dispatch, checkPostings, checkingPostingIds } = useStore();

  if (!showDetailDrawer || !selectedApp) return null;

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

  const mc = getMatchColors(selectedApp.match);
  const checking = checkingPostingIds.includes(selectedApp.id);
  const alert = POSTING_BADGES[selectedApp.postingStatus];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => dispatch({ type: 'CLOSE_DETAIL' })}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: t.card, zIndex: 50, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        animation: 'slideIn 0.25s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${t.d}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: getLogoColor(selectedApp.company), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
            {getInitial(selectedApp.company)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.p, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedApp.role}</div>
            <div style={{ fontSize: 13, color: t.m }}>{selectedApp.company}</div>
          </div>
          <button
            onClick={() => dispatch({ type: 'CLOSE_DETAIL' })}
            style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${t.d}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.m, flexShrink: 0, fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status pills */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {STATUSES.map(s => {
                const active = selectedApp.status === s;
                const style = STATUS_ACTIVE_STYLES[s];
                return (
                  <button
                    key={s}
                    onClick={() => dispatch({ type: 'UPDATE_APP_STATUS', id: selectedApp.id, status: s })}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? style.bg : 'transparent',
                      color: active ? style.color : t.m,
                      border: active ? `1.5px solid ${style.border}` : `1.5px solid ${t.d}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: t.inner, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Match Score</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: mc.text }}>{selectedApp.match}%</div>
            </div>
            <div style={{ background: t.inner, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Deadline</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: deadlineColor(selectedApp.deadline) }}>
                {selectedApp.deadline ? formatDeadline(selectedApp.deadline) : '—'}
              </div>
            </div>
          </div>

          {/* URL + posting health */}
          {selectedApp.url && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Job Posting</div>
              <a href={selectedApp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#ec4899', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' }}>
                {selectedApp.url}
              </a>

              {alert && (
                <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: alert.bg, border: `1px solid ${alert.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: alert.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span aria-hidden>{alert.icon}</span>{postingHeadline(selectedApp.postingStatus)}
                  </div>
                  <div style={{ fontSize: 12, color: alert.text, opacity: 0.9, marginTop: 5, lineHeight: 1.5 }}>
                    {selectedApp.postingNote} You can still keep it on your board for your records, or delete it.
                  </div>
                </div>
              )}

              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: t.m }}>
                  {checking
                    ? 'Checking the link…'
                    : selectedApp.postingStatus === 'unknown' && selectedApp.postingCheckedAt
                      ? `Couldn't verify · checked ${relativeTime(selectedApp.postingCheckedAt)}`
                      : selectedApp.postingStatus === 'active'
                        ? `Live at last check · ${relativeTime(selectedApp.postingCheckedAt)}`
                        : selectedApp.postingCheckedAt
                          ? `Checked ${relativeTime(selectedApp.postingCheckedAt)}`
                          : 'Not checked yet'}
                </span>
                <button
                  onClick={() => checkPostings([selectedApp.id])}
                  disabled={checking}
                  style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${t.d}`, background: 'transparent', color: t.m, fontSize: 11, fontWeight: 700, cursor: checking ? 'default' : 'pointer', fontFamily: 'inherit', opacity: checking ? 0.6 : 1 }}
                >
                  {checking ? 'Checking…' : 'Re-check'}
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.m, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Notes</div>
            <textarea
              value={selectedApp.notes}
              onChange={e => dispatch({ type: 'UPDATE_APP_NOTES', id: selectedApp.id, notes: e.target.value })}
              placeholder="Add notes about this application..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.p, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 100, lineHeight: 1.6, boxSizing: 'border-box' as const }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 22px', borderTop: `1px solid ${t.d}`, display: 'flex', gap: 10 }}>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'ai' })}
            style={{ flex: 2, padding: '10px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Analyze with AI
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_APP', id: selectedApp.id })}
            style={{ flex: 1, padding: '10px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

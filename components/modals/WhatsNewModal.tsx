'use client';

import { useEffect, useState } from 'react';
import { VERSION_LABEL, type ChangelogEntry } from '@/lib/version';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function WhatsNewModal({
  open, onClose, darkMode,
}: { open: boolean; onClose: () => void; darkMode: boolean }) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [source, setSource] = useState<'releases' | 'commits'>('releases');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await (await fetch('/api/changelog', { signal: ctrl.signal })).json();
        setEntries(data.entries ?? []);
        setSource(data.source ?? 'releases');
        if (data.error) setError(data.error);
      } catch {
        if (!ctrl.signal.aborted) setError('Could not load the changelog.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [open]);

  if (!open) return null;

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 560, maxWidth: 'calc(100vw - 40px)', maxHeight: 'calc(100vh - 80px)',
        background: t.card, borderRadius: 16, zIndex: 65, display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'scaleIn 0.15s ease', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.d}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: t.p, margin: 0, letterSpacing: '-0.4px' }}>What&apos;s New</h2>
            <div style={{ fontSize: 12, color: t.m, marginTop: 3 }}>
              {VERSION_LABEL}{source === 'commits' ? ' · recent changes' : ' · releases'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${t.d}`, background: 'transparent', cursor: 'pointer', color: t.m, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 24px 20px', overflowY: 'auto' }}>
          {loading && <div style={{ padding: 28, textAlign: 'center', color: t.m, fontSize: 13 }}>Loading…</div>}
          {!loading && error && <div style={{ padding: 28, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: t.m, fontSize: 13 }}>No release notes yet.</div>
          )}
          {!loading && entries.map((e) => (
            <div key={e.id} style={{ padding: '16px 0', borderBottom: `1px solid ${t.d}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <a href={e.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 14, fontWeight: 700, color: t.p, textDecoration: 'none' }}>
                  {e.title}
                  {e.kind === 'commit' && <span style={{ fontSize: 10, fontWeight: 700, color: t.m, marginLeft: 8, padding: '1px 6px', borderRadius: 20, border: `1px solid ${t.d}` }}>commit</span>}
                </a>
                {e.date && <span style={{ fontSize: 11, color: t.m, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(e.date)}</span>}
              </div>
              {e.body && (
                <div style={{ fontSize: 13, color: t.s, lineHeight: 1.65, marginTop: 8, whiteSpace: 'pre-wrap' }}>{e.body}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

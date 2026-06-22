'use client';

import { useStore } from '@/lib/store';
import { Application, AppStatus } from '@/lib/types';

export default function AddJobModal() {
  const { showAddJobModal, newJob, darkMode, dispatch } = useStore();

  if (!showAddJobModal) return null;

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inputBg: darkMode ? '#151413' : '#f9f7f5',
    inputBorder: darkMode ? '#2c2926' : '#dedad5',
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 9,
    border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.p,
    fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: t.m, marginBottom: 6, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

  function handleSubmit() {
    if (!newJob.company.trim() || !newJob.role.trim()) return;
    const app: Application = {
      id: Date.now(),
      company: newJob.company.trim(),
      role: newJob.role.trim(),
      status: newJob.status as AppStatus,
      match: 0,
      deadline: newJob.deadline || null,
      url: newJob.url,
      notes: newJob.notes,
    };
    dispatch({ type: 'ADD_APP', app });
    dispatch({ type: 'CLOSE_ADD_JOB' });
  }

  const set = (field: keyof typeof newJob) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    dispatch({ type: 'SET_NEW_JOB', field, value: e.target.value });

  return (
    <>
      <div onClick={() => dispatch({ type: 'CLOSE_ADD_JOB' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, background: t.card, borderRadius: 16, padding: 28, zIndex: 60,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', animation: 'scaleIn 0.15s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: t.p, margin: 0, letterSpacing: '-0.4px' }}>Add Job Application</h2>
          <button onClick={() => dispatch({ type: 'CLOSE_ADD_JOB' })} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.d}`, background: 'transparent', cursor: 'pointer', color: t.m, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Company *</label>
            <input style={inputStyle} placeholder="e.g. Google" value={newJob.company} onChange={set('company')} />
          </div>
          <div>
            <label style={labelStyle}>Job Title *</label>
            <input style={inputStyle} placeholder="e.g. Software Engineer" value={newJob.role} onChange={set('role')} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Job Posting URL</label>
          <input style={inputStyle} placeholder="https://..." value={newJob.url} onChange={set('url')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={newJob.status} onChange={set('status')}>
              <option value="saved">Saved</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input type="date" style={inputStyle} value={newJob.deadline} onChange={set('deadline')} />
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.6 }} placeholder="Any notes about this role..." value={newJob.notes} onChange={set('notes')} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => dispatch({ type: 'CLOSE_ADD_JOB' })} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${t.d}`, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: t.s, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newJob.company.trim() || !newJob.role.trim()}
            style={{ padding: '10px 22px', background: newJob.company.trim() && newJob.role.trim() ? '#ec4899' : '#e5e7eb', color: newJob.company.trim() && newJob.role.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: newJob.company.trim() && newJob.role.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
          >
            Add Application
          </button>
        </div>
      </div>
    </>
  );
}

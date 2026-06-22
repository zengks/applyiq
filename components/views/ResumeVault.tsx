'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Resume } from '@/lib/types';

export default function ResumeVault() {
  const { resumes, darkMode, dispatch } = useStore();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const t = {
    p: darkMode ? '#f0ede9' : '#1a1917',
    s: darkMode ? '#b4bac4' : '#4b5563',
    m: darkMode ? '#8a8784' : '#9ca3af',
    d: darkMode ? 'rgba(255,255,255,0.09)' : '#ede9e4',
    card: darkMode ? '#1c1b19' : '#ffffff',
    inner: darkMode ? '#151413' : '#f9f7f5',
  };

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void addResume(file);
  }

  async function addResume(file: File) {
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume/parse', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed.');
        return;
      }
      const newResume: Resume = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        updatedAt: new Date().toISOString().split('T')[0],
        jobsMatched: 0,
        atsScore: Math.floor(Math.random() * 30) + 60,
        isDefault: resumes.length === 0,
        text: data.text || '',
        filePath: data.filePath || null,
      };
      dispatch({ type: 'ADD_RESUME', resume: newResume });
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22, animation: 'fadeUp 0.25s ease' }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.p, letterSpacing: '-0.7px', margin: 0 }}>Resume Vault</h1>
        <p style={{ fontSize: 14, color: t.s, margin: '6px 0 0' }}>Manage your resume versions. Set one as default for AI analysis.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#ec4899' : t.d}`,
          borderRadius: 14, padding: '36px 24px', textAlign: 'center',
          background: dragging ? '#fce7f3' : t.card,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => {
          if (uploading) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.docx,.txt,.md';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) void addResume(file);
          };
          input.click();
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 14, background: dragging ? '#ec4899' : '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={dragging ? '#fff' : '#ec4899'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: dragging ? '#be185d' : t.p }}>
          {uploading ? 'Uploading & reading…' : dragging ? 'Drop your resume here' : 'Upload a new resume'}
        </div>
        <div style={{ fontSize: 12, color: t.m, marginTop: 4 }}>PDF, DOCX, TXT, or MD · Drag & drop or click to browse</div>
        {uploadError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{uploadError}</div>}
      </div>

      {/* Resume grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {resumes.map(resume => (
          <ResumeCard key={resume.id} resume={resume} darkMode={darkMode}
            onSetDefault={() => dispatch({ type: 'SET_DEFAULT_RESUME', id: resume.id })}
          />
        ))}
      </div>
    </div>
  );
}

function ResumeCard({ resume, darkMode, onSetDefault }: { resume: Resume; darkMode: boolean; onSetDefault: () => void }) {
  const card = darkMode ? '#1c1b19' : '#ffffff';
  const inner = darkMode ? '#151413' : '#f9f7f5';
  const border = darkMode ? 'rgba(255,255,255,0.07)' : '#ede9e4';
  const textP = darkMode ? '#f0ede9' : '#1a1917';
  const textM = darkMode ? '#8a8784' : '#9ca3af';

  return (
    <div style={{
      background: card, borderRadius: 14, padding: '20px 22px',
      border: resume.isDefault ? '1.5px solid #ec4899' : `1px solid ${border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      position: 'relative',
    }}>
      {resume.isDefault && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#ec4899', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Active
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resume.name}</div>
          <div style={{ fontSize: 11, color: textM, marginTop: 2 }}>Updated {resume.updatedAt}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: inner, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: textP }}>{resume.jobsMatched}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: textM, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Jobs Matched</div>
        </div>
        <div style={{ background: inner, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: resume.atsScore >= 80 ? '#059669' : resume.atsScore >= 65 ? '#d97706' : '#ef4444' }}>{resume.atsScore}%</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: textM, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ATS Score</div>
        </div>
      </div>

      <button
        onClick={onSetDefault}
        disabled={resume.isDefault}
        style={{
          width: '100%', padding: '9px', fontSize: 13, fontWeight: 700, cursor: resume.isDefault ? 'default' : 'pointer',
          background: resume.isDefault ? '#fce7f3' : inner,
          color: resume.isDefault ? '#ec4899' : textP,
          border: `1px solid ${resume.isDefault ? '#f9a8d4' : border}`,
          borderRadius: 9, fontFamily: 'inherit',
        }}
      >
        {resume.isDefault ? '✓ Active Resume' : 'Set as Default'}
      </button>
    </div>
  );
}

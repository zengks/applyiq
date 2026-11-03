'use client';

import { useState } from 'react';
import type { AIResult, AnalysisInput } from '@/lib/types';
import { useStore } from '@/lib/store';
import { analysisSaveParams, checked, duplicateJobs, mapApplicationRow } from '@/lib/jobWorkspace';

export default function SaveAnalysisToWorkspace({
  result,
  input,
}: {
  result: AIResult;
  input: AnalysisInput;
}) {
  const { applications, dispatch, saveWorkspace, syncStatus } = useStore();
  const candidates = duplicateJobs(applications, {
    url: input.jobUrl,
    company: result.company,
    role: result.role,
  });
  const [target, setTarget] = useState(candidates[0]?.id ?? 'new');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedTarget, setSavedTarget] = useState('');
  const [message, setMessage] = useState('');

  async function save() {
    if (busy || syncStatus.pending || savedTarget || (target === 'new' && candidates.length && !confirmed))
      return;
    const jobId = target === 'new' ? crypto.randomUUID() : target;
    const params = analysisSaveParams(jobId, result, input);
    setBusy(true);
    setMessage('');
    try {
      const saved = await saveWorkspace(async (client) => {
        if (target === 'new') {
          const auth = checked(await client.auth.getUser());
          if (!auth.data.user) throw new Error('Not authenticated');
          const job = checked(
            await client
              .from('applications')
              .upsert({
                id: jobId,
                user_id: auth.data.user.id,
                company: result.company || 'Unknown',
                role: result.role || 'Unknown',
                url: input.jobUrl,
                description: params.posting_text,
                captured_at: params.posting_text ? new Date().toISOString() : null,
                match: params.analysis_result.matchScore,
              })
              .select('*')
              .single(),
          );
          void dispatch({ type: 'SYNC_APP', app: mapApplicationRow(job.data) });
        }
        checked(await client.rpc('save_application_analysis', params));
        setSavedTarget(jobId);
        setMessage(
          input.resumeText.trim()
            ? 'Résumé, analysis, and cover letter saved to the workspace.'
            : 'Analysis and cover letter saved. No résumé was supplied for this analysis.',
        );
      });
      if (!saved) setMessage('Materials are queued. Keep the page open and use Retry save above.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: '100%', marginTop: 16, textAlign: 'left', fontSize: 12 }}>
      <label htmlFor="analysis-save-target" style={{ display: 'block', marginBottom: 6 }}>
        Save analysis and materials to
      </label>
      <select
        id="analysis-save-target"
        value={target}
        disabled={busy || !!savedTarget || syncStatus.pending > 0}
        onChange={(e) => {
          setTarget(e.target.value);
          setConfirmed(false);
        }}
        style={{
          width: '100%',
          padding: 8,
          border: '1px solid #d1d5db',
          borderRadius: 8,
          background: 'transparent',
          color: 'inherit',
        }}
      >
        <option value="new">New application</option>
        {applications.map((app) => (
          <option key={app.id} value={app.id}>
            {app.company} — {app.role}
          </option>
        ))}
      </select>
      {target === 'new' && candidates.length > 0 && (
        <label style={{ display: 'block', marginTop: 10 }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> A
          similar job exists. Create a separate opportunity anyway.
        </label>
      )}
      <button
        onClick={() => (savedTarget ? void dispatch({ type: 'OPEN_DETAIL', id: savedTarget }) : void save())}
        disabled={
          busy ||
          syncStatus.pending > 0 ||
          (!savedTarget && target === 'new' && candidates.length > 0 && !confirmed)
        }
        style={{
          marginTop: 10,
          width: '100%',
          border: 0,
          padding: 10,
          borderRadius: 8,
          background: '#db2777',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        {savedTarget ? 'Open job workspace' : busy ? 'Saving…' : 'Save materials'}
      </button>
      {message && (
        <p role="status" style={{ lineHeight: 1.6 }}>
          {message}
        </p>
      )}
    </div>
  );
}

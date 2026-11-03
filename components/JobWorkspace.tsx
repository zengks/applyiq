'use client';

import { useEffect, useRef, useState } from 'react';
import type { Application, AppStatus, JobMaterial, JobWorkspaceData } from '@/lib/types';
import { useStore } from '@/lib/store';
import {
  analysisSaveParams,
  checked,
  loadJobWorkspace,
  localDate,
  mergeSavedFields,
} from '@/lib/jobWorkspace';
import { STATUS_LABELS, postingHeadline } from '@/lib/utils';

const STATUSES: AppStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];
const dateTime = (value: string) => new Date(value).toLocaleString();
const detailsFor = (app: Application) => ({
  description: app.description ?? '',
  nextAction: app.nextAction ?? '',
  nextActionDue: app.nextActionDue ?? '',
  nextActionDone: app.nextActionDone ?? false,
  appliedAt: app.appliedAt ?? '',
});
function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function JobWorkspace({ application }: { application: Application }) {
  const {
    darkMode,
    dispatch,
    workspaceClient,
    saveWorkspace,
    syncStatus,
    retrySave,
    resumes,
    checkPostings,
    checkingPostingIds,
  } = useStore();
  const [tab, setTab] = useState<'overview' | 'materials' | 'history'>('overview');
  const [data, setData] = useState<JobWorkspaceData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(() => detailsFor(application));
  const [savedDetails, setSavedDetails] = useState(() => detailsFor(application));
  const [resumeId, setResumeId] = useState(application.selectedResumeId ?? '');
  const [vaultId, setVaultId] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const [letterId, setLetterId] = useState('');
  const [letterTitle, setLetterTitle] = useState('Cover letter');
  const [letterText, setLetterText] = useState('');
  const [letterSource, setLetterSource] = useState<string | null>(null);
  const [savedLetterText, setSavedLetterText] = useState('');
  const [savedLetterTitle, setSavedLetterTitle] = useState('Cover letter');
  const [submittedOn, setSubmittedOn] = useState(localDate);
  const [submissionLetter, setSubmissionLetter] = useState('');
  const panel = useRef<HTMLElement>(null);
  const detailsForm = useRef<HTMLFormElement>(null);
  const submissionDateField = useRef<HTMLInputElement>(null);
  const queuedResume = useRef<{ id: string; text: string; name: string } | null>(null);
  const queuedLetter = useRef<{ id: string; text: string; title: string } | null>(null);
  const queuedDetails = useRef<ReturnType<typeof detailsFor> | null>(null);
  const queuedAnalysis = useRef<string | null>(null);
  const detailsBaseline = useRef(savedDetails);
  const dirtyDetails = JSON.stringify(details) !== JSON.stringify(savedDetails);
  const dirty =
    dirtyDetails ||
    !!resumeText.trim() ||
    !!resumeName.trim() ||
    letterText !== savedLetterText ||
    letterTitle !== savedLetterTitle;
  const disabled = busy || syncStatus.pending > 0;
  const resumeVersions = data?.materials.filter((item) => item.kind === 'resume') ?? [];
  const analyses = data?.materials.filter((item) => item.kind === 'analysis') ?? [];
  const letters = data?.materials.filter((item) => item.kind === 'cover_letter') ?? [];
  const selectedResume = resumeVersions.find((item) => item.id === resumeId);
  const selectedAnalysis = analyses.find((item) => item.id === analysisId);

  useEffect(() => {
    detailsBaseline.current = savedDetails;
  }, [savedDetails]);

  useEffect(() => {
    if (syncStatus.pending) return;
    let active = true;
    void loadJobWorkspace(workspaceClient, application.id)
      .then((result) => {
        if (!active) return;
        setData(result);
        setLoadError('');
        const incoming = detailsFor(result.application);
        const previousBaseline = detailsBaseline.current;
        setDetails((current) => mergeSavedFields(current, previousBaseline, incoming));
        detailsBaseline.current = incoming;
        setSavedDetails(incoming);
        let confirmed = false;
        const pendingResume = queuedResume.current;
        if (pendingResume && result.materials.some((item) => item.id === pendingResume.id)) {
          setResumeText((value) => (value === pendingResume.text ? '' : value));
          setResumeName((value) => (value === pendingResume.name ? '' : value));
          setResumeId(pendingResume.id);
          queuedResume.current = null;
          confirmed = true;
        }
        const pendingLetter = queuedLetter.current;
        if (pendingLetter && result.materials.some((item) => item.id === pendingLetter.id)) {
          setSavedLetterText(pendingLetter.text);
          setSavedLetterTitle(pendingLetter.title);
          setLetterId(pendingLetter.id);
          queuedLetter.current = null;
          confirmed = true;
        }
        const pendingDetails = queuedDetails.current;
        if (
          pendingDetails &&
          JSON.stringify(detailsFor(result.application)) === JSON.stringify(pendingDetails)
        ) {
          setSavedDetails(pendingDetails);
          queuedDetails.current = null;
          confirmed = true;
        }
        if (queuedAnalysis.current && result.materials.some((item) => item.id === queuedAnalysis.current)) {
          setAnalysisId(queuedAnalysis.current);
          queuedAnalysis.current = null;
          confirmed = true;
        }
        if (confirmed)
          setNotice((previous) =>
            previous.includes('queued') ? 'Queued changes were saved successfully.' : previous,
          );
        setResumeId(
          (previous) =>
            previous ||
            result.application.selectedResumeId ||
            result.materials.find((item) => item.kind === 'resume')?.id ||
            '',
        );
        setAnalysisId(
          (previous) => previous || result.materials.find((item) => item.kind === 'analysis')?.id || '',
        );
        void dispatch({ type: 'SYNC_APP', app: result.application });
      })
      .catch((error) => {
        console.error('Workspace load failed:', error);
        if (active)
          setLoadError('Could not load this workspace. Your saved materials have not been replaced.');
      });
    return () => {
      active = false;
    };
  }, [application.id, workspaceClient, dispatch, syncStatus.pending, refresh]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previous?.focus();
  }, []);

  function close() {
    if (busy) return;
    if (
      !dirty ||
      window.confirm(
        syncStatus.pending
          ? 'Close this workspace? Queued saves will stay pending; edits you have not saved will be discarded.'
          : 'Discard unsaved edits? Saved versions will stay available.',
      )
    )
      void dispatch({ type: 'CLOSE_DETAIL' });
  }
  async function save(run: Parameters<typeof saveWorkspace>[0], success: string) {
    if (disabled) return false;
    setBusy(true);
    setNotice('');
    try {
      const saved = await saveWorkspace(run);
      setNotice(saved ? success : 'This change is queued. Keep the page open and use Retry save above.');
      if (saved) setRefresh((value) => value + 1);
      return saved;
    } finally {
      setBusy(false);
    }
  }
  async function saveDetails() {
    if (!detailsForm.current) return;
    // Read the submitted controls as well as React state. Native date pickers
    // and browser autofill can update a control without an onChange event.
    const fields = new FormData(detailsForm.current);
    const values = {
      description: String(fields.get('description') ?? ''),
      nextAction: String(fields.get('nextAction') ?? ''),
      nextActionDue: String(fields.get('nextActionDue') ?? ''),
      nextActionDone: fields.has('nextActionDone'),
      appliedAt: String(fields.get('appliedAt') ?? ''),
    };
    setDetails(values);
    queuedDetails.current = values;
    const capturedAt =
      values.description !== application.description
        ? new Date().toISOString()
        : (application.capturedAt ?? null);
    const saved = await save(async (client) => {
      checked(
        await client
          .from('applications')
          .update({
            description: values.description,
            captured_at: capturedAt,
            applied_at: values.appliedAt || null,
            next_action: values.nextAction,
            next_action_due: values.nextActionDue || null,
            next_action_done: values.nextActionDone,
          })
          .eq('id', application.id)
          .select('id')
          .single(),
      );
    }, 'Job details and next action saved.');
    if (saved) setSavedDetails(values);
  }
  async function attachResume(source: {
    name: string;
    text: string;
    filePath: string | null;
    sourceResumeId: string | null;
  }) {
    const id = crypto.randomUUID();
    queuedResume.current = { id, text: source.text, name: source.name };
    const saved = await save(async (client) => {
      checked(
        await client.rpc('save_application_material', {
          record_id: id,
          job_id: application.id,
          material_kind: 'resume',
          material_title: source.name.slice(0, 200),
          material_body: source,
        }),
      );
    }, 'Résumé snapshot saved. Future vault edits will not change this version.');
    if (saved) {
      setResumeId(id);
      setResumeText('');
      setResumeName('');
    }
  }
  async function analyze() {
    if (disabled || !selectedResume || (!application.description?.trim() && !application.url)) return;
    setBusy(true);
    setNotice('Analyzing the saved posting and selected résumé…');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl: application.url,
          jobDescription: application.description ?? '',
          resumeText: selectedResume.body.text,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Analysis failed.');
      const params = analysisSaveParams(
        application.id,
        result,
        {
          jobUrl: application.url,
          jobDescription: application.description ?? '',
          resumeText: selectedResume.body.text,
          resumeName: selectedResume.body.name,
          sourceResumeId: selectedResume.body.sourceResumeId,
          filePath: selectedResume.body.filePath,
        },
        selectedResume.id,
      );
      queuedAnalysis.current = params.analysis_record;
      const saved = await saveWorkspace(async (client) => {
        checked(await client.rpc('save_application_analysis', params));
      });
      setNotice(
        saved
          ? 'Analysis and generated cover letter saved as new versions.'
          : 'The generated materials are queued. Keep this page open and use Retry save above.',
      );
      if (saved) {
        setAnalysisId(params.analysis_record);
        setRefresh((value) => value + 1);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Analysis failed.');
    } finally {
      setBusy(false);
    }
  }
  function openLetter(item: JobMaterial & { kind: 'cover_letter' }) {
    if (
      (letterText !== savedLetterText || letterTitle !== savedLetterTitle) &&
      !window.confirm('Discard unsaved cover-letter edits?')
    )
      return false;
    setLetterId(item.id);
    setLetterTitle(item.title);
    setSavedLetterTitle(item.title);
    setLetterText(item.body.text);
    setSavedLetterText(item.body.text);
    setLetterSource(item.body.analysisVersionId);
    return true;
  }
  async function saveLetter() {
    const id = crypto.randomUUID();
    const text = letterText;
    const title = letterTitle.trim() || 'Cover letter';
    queuedLetter.current = { id, text, title };
    const saved = await save(async (client) => {
      checked(
        await client.rpc('save_application_material', {
          record_id: id,
          job_id: application.id,
          material_kind: 'cover_letter',
          material_title: title,
          material_body: { text, analysisVersionId: letterSource },
        }),
      );
    }, 'Cover letter saved as a new version. Earlier versions remain unchanged.');
    if (saved) {
      setLetterId(id);
      setSavedLetterText(text);
      setLetterTitle(title);
      setSavedLetterTitle(title);
    }
  }
  async function recordSubmission() {
    const date = submissionDateField.current?.value || '';
    if (!resumeId || !date) {
      setNotice('Choose a résumé version and a valid submission date.');
      return;
    }
    setSubmittedOn(date);
    const params = {
      record_id: crypto.randomUUID(),
      job_id: application.id,
      resume_version: resumeId,
      cover_version: submissionLetter || null,
      submission_date: date,
    };
    const saved = await save(async (client) => {
      checked(await client.rpc('record_application_submission', params));
    }, 'Submission recorded with the exact selected materials.');
    if (saved && !application.appliedAt) {
      setDetails((value) => ({ ...value, appliedAt: value.appliedAt || date }));
      setSavedDetails((value) => ({ ...value, appliedAt: value.appliedAt || date }));
    }
  }
  const versionLabel = (item: JobMaterial) => {
    const siblings = data?.materials.filter((version) => version.kind === item.kind) ?? [];
    return `v${siblings.length - siblings.findIndex((version) => version.id === item.id)} · ${item.title} · ${dateTime(item.createdAt)}`;
  };
  const materialLabel = (id: string | null) => {
    const material = data?.materials.find((item) => item.id === id);
    return material ? versionLabel(material) : id ? 'Saved version' : 'None';
  };
  const resumeOptions = resumeVersions.map((item) => (
    <option key={item.id} value={item.id}>
      {versionLabel(item)}
    </option>
  ));
  const letterOptions = letters.map((item) => (
    <option key={item.id} value={item.id}>
      {versionLabel(item)}
    </option>
  ));

  return (
    <>
      <button className="job-workspace-backdrop" aria-label="Close job workspace" onClick={close} />
      <section
        ref={panel}
        className="job-workspace"
        data-theme={darkMode ? 'dark' : 'light'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
          if (event.key === 'Tab') {
            const items = Array.from(
              panel.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary',
              ) ?? [],
            ).filter((item) => item.getClientRects().length > 0);
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="job-workspace-header">
          <div>
            <span className="jw-eyebrow">Application workspace</span>
            <h2 id="workspace-title">{application.role}</h2>
            <p>{application.company}</p>
          </div>
          <button aria-label="Close workspace" disabled={busy} onClick={close}>
            ✕
          </button>
        </header>
        <div className="jw-statuses" aria-label="Application status">
          {STATUSES.map((status) => (
            <button
              key={status}
              aria-pressed={application.status === status}
              disabled={disabled}
              onClick={() => void dispatch({ type: 'UPDATE_APP_STATUS', id: application.id, status })}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <nav className="jw-tabs" aria-label="Workspace sections">
          {(['overview', 'materials', 'history'] as const).map((value) => (
            <button
              key={value}
              aria-current={tab === value ? 'page' : undefined}
              onClick={() => setTab(value)}
            >
              {value === 'overview'
                ? 'Job & next action'
                : value === 'materials'
                  ? 'Résumés & materials'
                  : 'Submissions & timeline'}
            </button>
          ))}
        </nav>
        <div className="jw-content">
          {notice && (
            <p className="jw-notice" role="status">
              {notice}
            </p>
          )}
          {dirty && <p className="jw-unsaved">You have unsaved edits.</p>}
          {loadError && (
            <div role="alert" className="jw-notice">
              {loadError} <button onClick={() => setRefresh((value) => value + 1)}>Retry loading</button>
            </div>
          )}
          {!data && !loadError && <p role="status">Loading saved materials…</p>}
          {syncStatus.error && (
            <div role="alert" className="jw-notice">
              {syncStatus.error}{' '}
              <button disabled={syncStatus.saving} onClick={() => void retrySave()}>
                Retry workspace save
              </button>
            </div>
          )}
          <fieldset disabled={disabled} className="jw-fields">
            {tab === 'overview' && (
              <form
                ref={detailsForm}
                className="jw-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveDetails();
                }}
              >
                <section className="jw-card">
                  <h3>Saved job posting</h3>
                  {application.url && (
                    <>
                      <a
                        href={/^https?:\/\//i.test(application.url) ? application.url : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open original posting ↗
                      </a>
                      <p className="jw-muted">
                        {postingHeadline(application.postingStatus)}{' '}
                        <button
                          type="button"
                          className="jw-link"
                          disabled={checkingPostingIds.includes(application.id)}
                          onClick={() => void checkPostings([application.id])}
                        >
                          Check link
                        </button>
                      </p>
                    </>
                  )}
                  <p className="jw-muted">
                    Keep the original text so it stays available if the source closes. Each analysis preserves
                    the text it used.
                  </p>
                  <label htmlFor="jw-description">Posting description</label>
                  <textarea
                    id="jw-description"
                    name="description"
                    rows={12}
                    maxLength={60000}
                    value={details.description}
                    onChange={(e) => setDetails({ ...details, description: e.target.value })}
                  />
                  <p className="jw-muted">
                    {application.capturedAt
                      ? `Text captured ${dateTime(application.capturedAt)}`
                      : 'No posting text captured yet.'}
                  </p>
                </section>
                <section className="jw-card">
                  <h3>Next action</h3>
                  <p className="jw-muted">One clear step to keep this application moving.</p>
                  <label htmlFor="jw-next">What will you do next?</label>
                  <input
                    id="jw-next"
                    name="nextAction"
                    maxLength={500}
                    placeholder="e.g. Follow up with the recruiter"
                    value={details.nextAction}
                    onChange={(e) => setDetails({ ...details, nextAction: e.target.value })}
                  />
                  <label htmlFor="jw-due">Due date</label>
                  <input
                    id="jw-due"
                    name="nextActionDue"
                    type="date"
                    value={details.nextActionDue}
                    onChange={(e) => setDetails({ ...details, nextActionDue: e.target.value })}
                  />
                  <label className="jw-checkbox">
                    <input
                      type="checkbox"
                      name="nextActionDone"
                      checked={details.nextActionDone}
                      onChange={(e) => setDetails({ ...details, nextActionDone: e.target.checked })}
                    />{' '}
                    Action completed
                  </label>
                  <label htmlFor="jw-applied">Application date</label>
                  <input
                    id="jw-applied"
                    name="appliedAt"
                    type="date"
                    value={details.appliedAt}
                    onChange={(e) => setDetails({ ...details, appliedAt: e.target.value })}
                  />
                  <button className="jw-primary" type="submit" disabled={disabled}>
                    Save job details
                  </button>
                  <p className="jw-muted">Dates are calendar dates. Notifications are a future milestone.</p>
                  <h3>Notes</h3>
                  <textarea
                    aria-label="Application notes"
                    rows={5}
                    value={application.notes}
                    onChange={(e) =>
                      void dispatch({ type: 'UPDATE_APP_NOTES', id: application.id, notes: e.target.value })
                    }
                  />
                </section>
              </form>
            )}
            {tab === 'materials' && data && (
              <>
                <div className="jw-grid">
                  <section className="jw-card">
                    <h3>Résumé versions</h3>
                    <p className="jw-muted">
                      Snapshots belong to this job. Updating your profile or vault never changes them.
                    </p>
                    <label htmlFor="jw-resume">Saved résumé for this job</label>
                    <select id="jw-resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                      <option value="">Choose a version</option>
                      {resumeOptions}
                    </select>
                    {selectedResume && (
                      <>
                        <details>
                          <summary>Read selected résumé</summary>
                          <pre>{selectedResume.body.text}</pre>
                        </details>
                        <div className="jw-actions">
                          <button
                            onClick={() =>
                              downloadText(`${selectedResume.body.name}.txt`, selectedResume.body.text)
                            }
                          >
                            Download text
                          </button>
                          {selectedResume.body.filePath && (
                            <a
                              target="_blank"
                              rel="noopener noreferrer"
                              href={`/api/resume/file?path=${encodeURIComponent(selectedResume.body.filePath)}`}
                            >
                              View source file ↗
                            </a>
                          )}
                          <button
                            disabled={disabled}
                            onClick={() => {
                              setResumeName(`${selectedResume.body.name} (edited)`);
                              setResumeText(selectedResume.body.text);
                            }}
                          >
                            Create edited version
                          </button>
                          <button
                            disabled={disabled || resumeId === application.selectedResumeId}
                            onClick={() =>
                              void save(async (client) => {
                                checked(
                                  await client
                                    .from('applications')
                                    .update({ selected_resume_id: resumeId })
                                    .eq('id', application.id)
                                    .select('id')
                                    .single(),
                                );
                              }, 'Résumé selection saved.')
                            }
                          >
                            Use this résumé
                          </button>
                        </div>
                      </>
                    )}
                    <label htmlFor="jw-vault">Attach from your résumé vault</label>
                    <select id="jw-vault" value={vaultId} onChange={(e) => setVaultId(e.target.value)}>
                      <option value="">Choose a vault résumé</option>
                      {resumes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={disabled || !vaultId}
                      onClick={() => {
                        const source = resumes.find((item) => item.id === vaultId);
                        if (source)
                          void attachResume({
                            name: source.name,
                            text: source.text,
                            filePath: source.filePath,
                            sourceResumeId: source.id,
                          });
                      }}
                    >
                      Save résumé snapshot
                    </button>
                    <details>
                      <summary>Paste or tailor a résumé for this job</summary>
                      <label htmlFor="jw-resume-name">Version name</label>
                      <input
                        id="jw-resume-name"
                        maxLength={200}
                        value={resumeName}
                        onChange={(e) => setResumeName(e.target.value)}
                      />
                      <label htmlFor="jw-resume-text">Résumé text</label>
                      <textarea
                        id="jw-resume-text"
                        rows={8}
                        maxLength={60000}
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                      />
                      <button
                        disabled={disabled || !resumeName.trim() || !resumeText.trim()}
                        onClick={() =>
                          void attachResume({
                            name: resumeName.trim(),
                            text: resumeText,
                            filePath: null,
                            sourceResumeId: null,
                          })
                        }
                      >
                        Save new résumé version
                      </button>
                    </details>
                  </section>
                  <section className="jw-card">
                    <h3>Saved analyses</h3>
                    <p className="jw-muted">
                      Every analysis keeps its posting text and résumé reference. AI suggestions are advisory.
                    </p>
                    <button
                      className="jw-primary"
                      disabled={
                        disabled ||
                        !selectedResume ||
                        (!application.description?.trim() && !application.url) ||
                        dirtyDetails
                      }
                      onClick={() => void analyze()}
                    >
                      {busy ? 'Working…' : 'Analyze selected résumé'}
                    </button>
                    {dirtyDetails && <p className="jw-muted">Save job details before analyzing.</p>}
                    {!selectedResume && <p className="jw-muted">Choose or attach a résumé first.</p>}
                    <label htmlFor="jw-analysis">Analysis version</label>
                    <select
                      id="jw-analysis"
                      value={analysisId}
                      onChange={(e) => setAnalysisId(e.target.value)}
                    >
                      <option value="">Choose an analysis</option>
                      {analyses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {versionLabel(item)}
                        </option>
                      ))}
                    </select>
                    {selectedAnalysis && (
                      <div className="jw-analysis">
                        <p className="jw-score">{selectedAnalysis.body.result.matchScore}% match</p>
                        <p className="jw-muted">
                          Résumé: {materialLabel(selectedAnalysis.body.resumeVersionId)}
                        </p>
                        <p>{selectedAnalysis.body.result.aiSuggestion}</p>
                        <h4>Matched requirements</h4>
                        <p>{selectedAnalysis.body.result.matchedKeywords.join(', ') || 'None recorded'}</p>
                        <h4>Gaps to review</h4>
                        <p>{selectedAnalysis.body.result.missingKeywords.join(', ') || 'None recorded'}</p>
                        <details>
                          <summary>Interview questions & insights</summary>
                          {selectedAnalysis.body.result.interviewQuestions.map((item, i) => (
                            <div key={i}>
                              <strong>{item.q}</strong>
                              <p>{item.hint}</p>
                            </div>
                          ))}
                          <p>
                            {selectedAnalysis.body.result.salaryRange} ·{' '}
                            {selectedAnalysis.body.result.seniority} · {selectedAnalysis.body.result.industry}
                          </p>
                        </details>
                        <details>
                          <summary>Posting text used for this analysis</summary>
                          <pre>
                            {selectedAnalysis.body.jobDescription ||
                              'No text snapshot was available. Paste the posting into Job & next action to preserve it.'}
                          </pre>
                        </details>
                      </div>
                    )}
                  </section>
                </div>
                <section className="jw-card">
                  <h3>Cover-letter versions</h3>
                  <p className="jw-muted">
                    Edit a letter, then save a new version. Earlier versions and submission records stay
                    intact.
                  </p>
                  <label htmlFor="jw-letter">Open a saved letter</label>
                  <select
                    id="jw-letter"
                    value={letterId}
                    onChange={(e) => {
                      const item = letters.find((item) => item.id === e.target.value);
                      if (item) openLetter(item);
                      else if (
                        letterText === savedLetterText ||
                        window.confirm('Discard unsaved letter edits?')
                      ) {
                        setLetterId('');
                        setLetterText('');
                        setSavedLetterText('');
                        setLetterTitle('Cover letter');
                        setSavedLetterTitle('Cover letter');
                        setLetterSource(null);
                      }
                    }}
                  >
                    <option value="">Write a new letter</option>
                    {letterOptions}
                  </select>
                  <label htmlFor="jw-letter-title">Version name</label>
                  <input
                    id="jw-letter-title"
                    maxLength={200}
                    value={letterTitle}
                    onChange={(e) => setLetterTitle(e.target.value)}
                  />
                  <label htmlFor="jw-letter-text">Cover letter</label>
                  <textarea
                    id="jw-letter-text"
                    rows={12}
                    maxLength={30000}
                    value={letterText}
                    onChange={(e) => setLetterText(e.target.value)}
                  />
                  <div className="jw-actions">
                    <button
                      className="jw-primary"
                      disabled={disabled || !letterText.trim()}
                      onClick={() => void saveLetter()}
                    >
                      Save as new version
                    </button>
                    <button
                      disabled={!letterText}
                      onClick={() => downloadText(`${letterTitle || 'Cover letter'}.txt`, letterText)}
                    >
                      Download text
                    </button>
                  </div>
                </section>
              </>
            )}
            {tab === 'history' && data && (
              <div className="jw-grid">
                <section className="jw-card">
                  <h3>Record submitted materials</h3>
                  <p className="jw-muted">
                    Record what you sent yourself. This saves a record; it does not submit an application
                    externally.
                  </p>
                  <label htmlFor="jw-submit-resume">Submitted résumé</label>
                  <select
                    id="jw-submit-resume"
                    value={resumeId}
                    onChange={(e) => setResumeId(e.target.value)}
                  >
                    <option value="">Choose a résumé version</option>
                    {resumeOptions}
                  </select>
                  <label htmlFor="jw-submit-letter">Submitted cover letter</label>
                  <select
                    id="jw-submit-letter"
                    value={submissionLetter}
                    onChange={(e) => setSubmissionLetter(e.target.value)}
                  >
                    <option value="">No cover letter submitted</option>
                    {letterOptions}
                  </select>
                  <label htmlFor="jw-submit-date">Date submitted</label>
                  <input
                    id="jw-submit-date"
                    ref={submissionDateField}
                    type="date"
                    value={submittedOn}
                    onChange={(e) => setSubmittedOn(e.target.value)}
                  />
                  <button
                    className="jw-primary"
                    disabled={disabled || !resumeId || !submittedOn}
                    onClick={() => void recordSubmission()}
                  >
                    Record submission
                  </button>
                  <h3>Submission history</h3>
                  {!data.submissions.length && (
                    <p className="jw-muted">No materials recorded as submitted yet.</p>
                  )}
                  {data.submissions.map((item) => (
                    <article className="jw-history-item" key={item.id}>
                      <strong>{item.submittedOn}</strong>
                      <p>
                        Résumé: {materialLabel(item.resumeVersionId)}
                        <br />
                        Cover letter: {materialLabel(item.coverLetterVersionId)}
                      </p>
                      <button
                        onClick={() => {
                          const letter = letters.find((letter) => letter.id === item.coverLetterVersionId);
                          if (letter && !openLetter(letter)) return;
                          if (!letter) {
                            if (
                              letterText !== savedLetterText &&
                              !window.confirm('Discard unsaved letter edits?')
                            )
                              return;
                            setLetterId('');
                            setLetterText('');
                            setSavedLetterText('');
                            setLetterTitle('Cover letter');
                            setSavedLetterTitle('Cover letter');
                            setLetterSource(null);
                          }
                          setResumeId(item.resumeVersionId);
                          setTab('materials');
                        }}
                      >
                        View submitted materials
                      </button>
                      <p className="jw-muted">Recorded {dateTime(item.createdAt)}</p>
                    </article>
                  ))}
                </section>
                <section className="jw-card">
                  <h3>Status timeline</h3>
                  <p className="jw-muted">
                    Changes are recorded from this release onward. Earlier history has not been reconstructed.
                  </p>
                  {!data.events.length && <p className="jw-muted">No recorded status changes yet.</p>}
                  <ol className="jw-timeline">
                    {data.events.map((event) => (
                      <li key={event.id}>
                        <strong>{STATUS_LABELS[event.status]}</strong>
                        <span>{dateTime(event.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}
          </fieldset>
        </div>
        <footer className="jw-footer">
          <span>
            {syncStatus.pending
              ? 'Changes waiting to sync'
              : dirty
                ? 'Unsaved edits'
                : 'Saved versions stay with this application'}
          </span>
          <button
            className="jw-danger"
            disabled={disabled}
            onClick={() => {
              if (window.confirm('Delete this application and its saved materials and history?'))
                void dispatch({ type: 'DELETE_APP', id: application.id });
            }}
          >
            Delete application
          </button>
        </footer>
      </section>
    </>
  );
}

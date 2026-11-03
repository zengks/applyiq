import { describe, expect, it } from 'vitest';
import type { AIResult, AnalysisInput, Application } from '@/lib/types';
import {
  analysisSaveParams,
  canonicalJobUrl,
  duplicateJobs,
  mapApplicationRow,
  mergeSavedFields,
} from '@/lib/jobWorkspace';

const app: Application = {
  id: 'job',
  company: 'Acme, Inc.',
  role: 'Senior Engineer',
  status: 'saved',
  match: 0,
  deadline: null,
  url: 'https://jobs.example.com/roles/42/?utm_source=email#apply',
  notes: '',
  postingStatus: 'removed',
  postingCheckedAt: null,
  postingNote: '',
};
const input: AnalysisInput = {
  jobUrl: app.url,
  jobDescription: 'Original posting',
  resumeText: 'Original résumé',
  resumeName: 'Résumé v1',
  filePath: null,
  sourceResumeId: 'vault',
};
const result: AIResult = {
  matchScore: 82,
  company: 'Acme',
  role: 'Engineer',
  matchedKeywords: ['TypeScript'],
  missingKeywords: ['Go'],
  aiSuggestion: 'Use specific evidence',
  coverLetter: 'Original cover letter',
  interviewQuestions: [],
  salaryRange: 'Unknown',
  industry: 'Software',
  seniority: 'Senior',
  culture: [],
  jobPostingText: 'Fetched text',
};

describe('job workspace identity and snapshots', () => {
  it('merges newly saved fields without erasing a local edit', () => {
    const baseline = { appliedAt: '', nextAction: 'Prepare', description: '' };
    const draft = { ...baseline, nextAction: 'My unsaved follow-up' };
    const saved = { appliedAt: '2026-11-02', nextAction: 'Prepare', description: 'Newly captured posting' };
    expect(mergeSavedFields(draft, baseline, saved)).toEqual({
      ...saved,
      nextAction: 'My unsaved follow-up',
    });
  });
  it('recognizes tracking, scheme, fragment and trailing-slash URL variations', () => {
    expect(canonicalJobUrl(app.url)).toBe(canonicalJobUrl('http://www.jobs.example.com/roles/42'));
    expect(
      duplicateJobs([app], {
        company: 'Different',
        role: 'Title',
        url: 'https://jobs.example.com/roles/42?utm_campaign=other',
      }),
    ).toEqual([app]);
  });
  it('keeps distinct job identifiers and non-tracking query values', () => {
    expect(
      duplicateJobs([app], { company: 'Different', role: 'Title', url: 'https://jobs.example.com/roles/43' }),
    ).toEqual([]);
    expect(canonicalJobUrl('https://x.test/viewjob?jk=123')).not.toBe(
      canonicalJobUrl('https://x.test/viewjob?jk=456'),
    );
  });
  it('flags matching company and role for human confirmation even with a changed link', () => {
    expect(duplicateJobs([app], { company: ' ACME inc ', role: 'senior   engineer', url: '' })).toEqual([
      app,
    ]);
    expect(duplicateJobs([app], { company: 'Acme Inc', role: 'Designer', url: '' })).toEqual([]);
    expect(duplicateJobs([app], { company: '', role: '', url: '' })).toEqual([]);
  });
  it('creates fixed request IDs and detached input snapshots before a retry is enqueued', () => {
    const source = { ...input };
    const params = analysisSaveParams(app.id, result, source);
    const original = structuredClone(params);
    source.resumeText = 'Later profile edit';
    source.jobDescription = 'Later posting edit';
    expect(params).toEqual(original);
    expect(params.resume_snapshot?.text).toBe('Original résumé');
    expect(params.posting_text).toBe('Original posting');
    expect(params.analysis_result).not.toHaveProperty('jobPostingText');
    expect(new Set([params.resume_record, params.analysis_record, params.letter_record]).size).toBe(3);
  });
  it('reuses a selected immutable résumé reference rather than copying the current profile', () => {
    const params = analysisSaveParams(app.id, result, input, 'snapshot-v1');
    expect(params.resume_record).toBe('snapshot-v1');
    expect(params.resume_snapshot).toBeNull();
  });
  it('uses captured posting text when there was no pasted fallback, without fabricating a résumé', () => {
    const params = analysisSaveParams(app.id, result, { ...input, jobDescription: '', resumeText: '' });
    expect(params.posting_text).toBe('Fetched text');
    expect(params.resume_record).toBeNull();
    expect(params.resume_snapshot).toBeNull();
  });
  it('rehydrates saved next actions and captured descriptions even for a removed posting', () => {
    const row = mapApplicationRow({
      id: 'job',
      company: 'Acme',
      role: 'Engineer',
      status: 'applied',
      match: 82,
      url: app.url,
      notes: '',
      posting_status: 'removed',
      description: 'Preserved original',
      captured_at: '2026-11-02T22:00:00Z',
      applied_at: '2026-11-02',
      next_action: 'Follow up',
      next_action_due: '2026-11-09',
      next_action_done: false,
      selected_resume_id: 'snapshot-v1',
    });
    expect(row).toMatchObject({
      description: 'Preserved original',
      nextAction: 'Follow up',
      nextActionDue: '2026-11-09',
      selectedResumeId: 'snapshot-v1',
      appliedAt: '2026-11-02',
      postingStatus: 'removed',
    });
  });
});

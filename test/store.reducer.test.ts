import { describe, expect, it } from 'vitest';
import { reducer, INITIAL, type State, type Action } from '@/lib/store';
import type { Application, AIResult, Resume } from '@/lib/types';

const app = (over: Partial<Application> = {}): Application => ({
  id: 'a1', company: 'Stripe', role: 'FE', status: 'saved', match: 80, deadline: null, url: '', notes: '', ...over,
});

const resume = (over: Partial<Resume> = {}): Resume => ({
  id: 'r1', name: 'R', updatedAt: '2026-06-01', jobsMatched: 0, atsScore: 70, isDefault: false, text: '', filePath: null, ...over,
});

const aiResult: AIResult = {
  matchScore: 88, role: 'FE', company: 'Linear', matchedKeywords: [], missingKeywords: [],
  aiSuggestion: '', coverLetter: '', interviewQuestions: [], salaryRange: '', industry: '', seniority: '', culture: [],
};

describe('reducer', () => {
  it('HYDRATE loads payload and clears loading; onboarding = !onboarded', () => {
    const next = reducer(INITIAL, {
      type: 'HYDRATE',
      payload: {
        email: 'alex@example.com', profileName: 'Alex', profileTitle: 'Dev', resumeText: 'cv', darkMode: true,
        billingCycle: 'monthly', onboarded: false, applications: [app()], resumes: [resume()], subscription: null,
      },
    });
    expect(next.loading).toBe(false);
    expect(next.profileName).toBe('Alex');
    expect(next.darkMode).toBe(true);
    expect(next.showOnboarding).toBe(true);
    expect(next.applications).toHaveLength(1);
  });

  it('ADD_APP prepends', () => {
    const start: State = { ...INITIAL, applications: [app({ id: 'old' })] };
    const next = reducer(start, { type: 'ADD_APP', app: app({ id: 'new' }) });
    expect(next.applications.map(a => a.id)).toEqual(['new', 'old']);
  });

  it('UPDATE_APP_STATUS only changes the target and does not mutate input', () => {
    const start: State = { ...INITIAL, applications: [app({ id: 'a1' }), app({ id: 'a2' })] };
    const next = reducer(start, { type: 'UPDATE_APP_STATUS', id: 'a2', status: 'offer' });
    expect(next.applications.find(a => a.id === 'a2')!.status).toBe('offer');
    expect(next.applications.find(a => a.id === 'a1')!.status).toBe('saved');
    expect(start.applications.find(a => a.id === 'a2')!.status).toBe('saved'); // immutability
  });

  it('DELETE_APP removes and closes drawer', () => {
    const start: State = { ...INITIAL, applications: [app({ id: 'a1' })], showDetailDrawer: true, selectedAppId: 'a1' };
    const next = reducer(start, { type: 'DELETE_APP', id: 'a1' });
    expect(next.applications).toHaveLength(0);
    expect(next.showDetailDrawer).toBe(false);
    expect(next.selectedAppId).toBeNull();
  });

  it('OPEN_DETAIL / CLOSE_DETAIL toggle drawer + selection', () => {
    const opened = reducer(INITIAL, { type: 'OPEN_DETAIL', id: 'a1' });
    expect(opened).toMatchObject({ showDetailDrawer: true, selectedAppId: 'a1' });
    const closed = reducer(opened, { type: 'CLOSE_DETAIL' });
    expect(closed).toMatchObject({ showDetailDrawer: false, selectedAppId: null });
  });

  it('AI flow transitions', () => {
    const started = reducer({ ...INITIAL, aiError: true, aiErrorMsg: 'x' }, { type: 'AI_START' });
    expect(started).toMatchObject({ aiLoading: true, aiError: false, aiErrorMsg: '', analysisShown: false });

    const ok = reducer(started, { type: 'AI_SUCCESS', result: aiResult });
    expect(ok).toMatchObject({ aiLoading: false, analysisShown: true, activeTab: 'keywords' });
    expect(ok.aiResult).toEqual(aiResult);

    const err = reducer(started, { type: 'AI_ERROR', message: 'boom' });
    expect(err).toMatchObject({ aiLoading: false, aiError: true, aiErrorMsg: 'boom' });

    const reset = reducer(ok, { type: 'AI_RESET' });
    expect(reset).toMatchObject({ analysisShown: false, aiResult: null, jobDescription: '', jobUrl: '' });
  });

  it('SAVE_AI_TO_BOARD is a no-op without a result', () => {
    const next = reducer(INITIAL, { type: 'SAVE_AI_TO_BOARD' });
    expect(next).toBe(INITIAL);
  });

  it('SAVE_AI_TO_BOARD prepends an app and switches view', () => {
    const start: State = { ...INITIAL, aiResult, jobUrl: 'http://x' };
    const next = reducer(start, { type: 'SAVE_AI_TO_BOARD' });
    expect(next.activeView).toBe('applications');
    expect(next.applications[0]).toMatchObject({ company: 'Linear', role: 'FE', match: 88, url: 'http://x', status: 'saved' });
    expect(typeof next.applications[0].id).toBe('string');
    expect(next.applications[0].id.length).toBeGreaterThan(0);
  });

  it('SET_DEFAULT_RESUME makes exactly one default', () => {
    const start: State = { ...INITIAL, resumes: [resume({ id: 'r1', isDefault: true }), resume({ id: 'r2' })] };
    const next = reducer(start, { type: 'SET_DEFAULT_RESUME', id: 'r2' });
    expect(next.resumes.filter(r => r.isDefault).map(r => r.id)).toEqual(['r2']);
  });

  it('SET_NEW_JOB updates a single field; OPEN_ADD_JOB resets the form', () => {
    const typed = reducer(INITIAL, { type: 'SET_NEW_JOB', field: 'company', value: 'Acme' });
    expect(typed.newJob.company).toBe('Acme');
    const opened = reducer(typed, { type: 'OPEN_ADD_JOB' });
    expect(opened.showAddJobModal).toBe(true);
    expect(opened.newJob.company).toBe('');
  });

  it('simple setters', () => {
    expect(reducer(INITIAL, { type: 'SET_DARK', value: true }).darkMode).toBe(true);
    expect(reducer(INITIAL, { type: 'SET_VIEW', view: 'stats' }).activeView).toBe('stats');
    expect(reducer(INITIAL, { type: 'SET_BILLING', cycle: 'monthly' }).billingCycle).toBe('monthly');
    expect(reducer(INITIAL, { type: 'SET_TAB', tab: 'cover' }).activeTab).toBe('cover');
    expect(reducer(INITIAL, { type: 'CLOSE_ONBOARDING' }).showOnboarding).toBe(false);
    const p = reducer(INITIAL, { type: 'SET_PROFILE', name: 'A', title: 'B', resume: 'C' });
    expect(p).toMatchObject({ profileName: 'A', profileTitle: 'B', resumeText: 'C' });
  });

  it('unknown action returns the same reference', () => {
    expect(reducer(INITIAL, { type: 'NOPE' } as unknown as Action)).toBe(INITIAL);
  });
});

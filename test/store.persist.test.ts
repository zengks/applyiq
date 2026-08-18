import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistAction, INITIAL, type State } from '@/lib/store';
import type { Application, Resume } from '@/lib/types';

function makeSupabase() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ insert, update, upsert, delete: del }));
  return { client: { from } as unknown as SupabaseClient, from, insert, upsert, update, del, eq };
}

const UID = 'user-123';
const app = (over: Partial<Application> = {}): Application => ({
  id: 'a1', company: 'Stripe', role: 'FE', status: 'saved', match: 80, deadline: null, url: '', notes: '',
  postingStatus: 'unknown', postingCheckedAt: null, postingNote: '', ...over,
});
const resume = (over: Partial<Resume> = {}): Resume => ({
  id: 'r1', name: 'R', updatedAt: '2026-06-01', jobsMatched: 0, atsScore: 70, isDefault: true, text: 'cv', filePath: 'user-123/x.pdf', ...over,
});

describe('persistAction', () => {
  it('POSTING_CHECK_DONE writes each verdict back to its row', async () => {
    const m = makeSupabase();
    const state: State = { ...INITIAL, applications: [app({ id: 'a1' }), app({ id: 'a2' })] };
    await persistAction({
      type: 'POSTING_CHECK_DONE',
      results: [
        { id: 'a1', status: 'removed', note: 'gone', checkedAt: '2026-06-22T12:00:00.000Z' },
        { id: 'a2', status: 'active', note: 'live', checkedAt: '2026-06-22T12:00:00.000Z' },
      ],
    }, state, m.client, UID);
    expect(m.from).toHaveBeenCalledWith('applications');
    expect(m.update).toHaveBeenCalledWith({ posting_status: 'removed', posting_checked_at: '2026-06-22T12:00:00.000Z', posting_note: 'gone' });
    expect(m.update).toHaveBeenCalledWith({ posting_status: 'active', posting_checked_at: '2026-06-22T12:00:00.000Z', posting_note: 'live' });
    expect(m.eq).toHaveBeenCalledWith('id', 'a1');
    expect(m.eq).toHaveBeenCalledWith('id', 'a2');
  });

  it('ADD_APP inserts the snake-cased row from state.applications[0]', async () => {
    const m = makeSupabase();
    const state: State = { ...INITIAL, applications: [app()] };
    await persistAction({ type: 'ADD_APP', app: app() }, state, m.client, UID);
    expect(m.from).toHaveBeenCalledWith('applications');
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', user_id: UID, company: 'Stripe', match: 80 }));
  });

  it('UPDATE_APP_STATUS updates by id', async () => {
    const m = makeSupabase();
    await persistAction({ type: 'UPDATE_APP_STATUS', id: 'a1', status: 'offer' }, INITIAL, m.client, UID);
    expect(m.update).toHaveBeenCalledWith({ status: 'offer' });
    expect(m.eq).toHaveBeenCalledWith('id', 'a1');
  });

  it('DELETE_APP deletes by id', async () => {
    const m = makeSupabase();
    await persistAction({ type: 'DELETE_APP', id: 'a1' }, INITIAL, m.client, UID);
    expect(m.del).toHaveBeenCalled();
    expect(m.eq).toHaveBeenCalledWith('id', 'a1');
  });

  it('ADD_RESUME inserts mapped row incl. file_path', async () => {
    const m = makeSupabase();
    const state: State = { ...INITIAL, resumes: [resume()] };
    await persistAction({ type: 'ADD_RESUME', resume: resume() }, state, m.client, UID);
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'r1', user_id: UID, name: 'R', file_path: 'user-123/x.pdf', ats_score: 70, is_default: true,
    }));
  });

  it('SET_DEFAULT_RESUME unsets all then sets one', async () => {
    const m = makeSupabase();
    await persistAction({ type: 'SET_DEFAULT_RESUME', id: 'r2' }, INITIAL, m.client, UID);
    expect(m.update).toHaveBeenNthCalledWith(1, { is_default: false });
    expect(m.eq).toHaveBeenNthCalledWith(1, 'user_id', UID);
    expect(m.update).toHaveBeenNthCalledWith(2, { is_default: true });
    expect(m.eq).toHaveBeenNthCalledWith(2, 'id', 'r2');
  });

  it('SET_PROFILE upserts the profile', async () => {
    const m = makeSupabase();
    const state: State = { ...INITIAL, profileName: 'Alex', profileTitle: 'Dev', resumeText: 'cv' };
    await persistAction({ type: 'SET_PROFILE', name: 'Alex', title: 'Dev', resume: 'cv' }, state, m.client, UID);
    expect(m.from).toHaveBeenCalledWith('profiles');
    expect(m.upsert).toHaveBeenCalledWith({ id: UID, full_name: 'Alex', job_title: 'Dev', resume_text: 'cv' });
  });

  it('SET_DARK / CLOSE_ONBOARDING update the profile', async () => {
    const m1 = makeSupabase();
    await persistAction({ type: 'SET_DARK', value: true }, INITIAL, m1.client, UID);
    expect(m1.update).toHaveBeenCalledWith({ dark_mode: true });

    const m2 = makeSupabase();
    await persistAction({ type: 'CLOSE_ONBOARDING' }, INITIAL, m2.client, UID);
    expect(m2.update).toHaveBeenCalledWith({ onboarded: true });
  });

  it('UI-only actions perform no DB writes', async () => {
    const m = makeSupabase();
    await persistAction({ type: 'SET_TAB', tab: 'cover' }, INITIAL, m.client, UID);
    await persistAction({ type: 'OPEN_DETAIL', id: 'a1' }, INITIAL, m.client, UID);
    expect(m.from).not.toHaveBeenCalled();
  });

  it('swallows DB errors without throwing', async () => {
    const m = makeSupabase();
    m.insert.mockRejectedValueOnce(new Error('db down'));
    const state: State = { ...INITIAL, applications: [app()] };
    await expect(persistAction({ type: 'ADD_APP', app: app() }, state, m.client, UID)).resolves.toBeUndefined();
  });
});

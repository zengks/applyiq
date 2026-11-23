import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Application, JobInterview } from '@/lib/types';
const mocks = vi.hoisted(() => ({ useStore: vi.fn(), dispatch: vi.fn() }));
vi.mock('@/lib/store', () => ({ useStore: mocks.useStore }));
vi.mock('@/lib/useLocalDay', () => ({
  useLocalDay: () => ({ day: '2026-11-02', timeZone: 'America/Vancouver' }),
}));
import Today from '@/components/views/Today';
const app: Application = {
  id: 'job',
  company: 'Acme',
  role: 'Engineer',
  status: 'saved',
  match: 0,
  deadline: '2026-11-03',
  url: '',
  notes: '',
  postingStatus: 'unknown',
  postingCheckedAt: null,
  postingNote: '',
  nextAction: 'Follow up',
  nextActionDue: '2026-11-02',
};
const interview: JobInterview = {
  id: 'interview',
  applicationId: app.id,
  ownerId: 'owner',
  title: 'Portfolio interview',
  startsAt: '2026-11-02T20:00:00Z',
  endsAt: '2026-11-02T20:30:00Z',
  localStart: '2026-11-03T09:00',
  localEnd: '2026-11-03T09:30',
  utcOffsetSeconds: 46800,
  timeZone: 'Pacific/Auckland',
  status: 'scheduled',
  revision: 0,
  createdAt: '2026-11-01T22:00:00Z',
  updatedAt: '2026-11-01T22:00:00Z',
};
beforeEach(() => {
  mocks.dispatch.mockReset().mockResolvedValue(true);
  mocks.useStore.mockReturnValue({
    applications: [app],
    interviews: [],
    darkMode: false,
    dispatch: mocks.dispatch,
    syncStatus: { pending: 0, error: '', saving: false },
  });
});
describe('Today view', () => {
  it('shows why an item is due and opens its application workspace', () => {
    render(<Today />);
    expect(screen.getByText('Nov 2, 2026 · America/Vancouver')).toBeInTheDocument();
    const action = screen.getByRole('article', { name: 'Follow up · Acme' });
    fireEvent.click(within(action).getByRole('button', { name: 'Open workspace ↗' }));
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'OPEN_DETAIL',
      id: 'job',
    });
  });
  it('completes an action through the persistent store', async () => {
    render(<Today />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    await screen.findByText('Action saved.');
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_APP_ACTION',
      id: 'job',
      done: true,
    });
  });
  it('reschedules using the submitted native date and preserves the other task fields', async () => {
    render(<Today />);
    const card = screen.getByRole('article', { name: 'Follow up · Acme' });
    fireEvent.click(within(card).getByRole('button', { name: 'Reschedule' }));
    const input = within(card).getByLabelText('Next-action date') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      '2026-11-10',
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Save date' }));
    await screen.findByText('Date saved.');
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_APP_ACTION',
      id: 'job',
      due: '2026-11-10',
    });
  });
  it('keeps failed date writes visible as queued, rather than claiming success', async () => {
    mocks.dispatch.mockResolvedValue(false);
    render(<Today />);
    const card = screen.getByRole('article', {
      name: 'Application deadline · Acme',
    });
    fireEvent.click(within(card).getByRole('button', { name: 'Reschedule' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Save date' }));
    await screen.findByText('Date change is queued. Keep this page open and use Retry save above.');
    expect(screen.queryByText('Date saved.')).not.toBeInTheDocument();
  });
  it.each([
    ['completed', 'Interview saved. Update any imported calendar copy separately.'],
    ['cancelled', 'This interview changed elsewhere. Today now shows the latest saved interviews.'],
  ] as const)('completes only the displayed revision when the saved interview is %s', async (status, notice) => {
    const savedInterview = { ...interview, status, revision: 1 };
    const row = {
      id: interview.id,
      application_id: app.id,
      user_id: interview.ownerId,
      title: interview.title,
      starts_at: interview.startsAt,
      ends_at: interview.endsAt,
      time_zone: interview.timeZone,
      local_start: interview.localStart,
      local_end: interview.localEnd,
      utc_offset_seconds: interview.utcOffsetSeconds,
      status,
      revision: 1,
      created_at: interview.createdAt,
      updated_at: interview.updatedAt,
    };
    const eq = vi.fn<(column: string, value: string | number) => unknown>();
    const updateQuery = {
      eq,
      then: (resolve: (value: object) => void) => resolve({ error: null }),
    };
    eq.mockReturnValue(updateQuery);
    const listQuery = {
      eq: () => listQuery,
      order: () => listQuery,
      then: (resolve: (value: object) => void) => resolve({ data: [row], error: null }),
    };
    const update = vi.fn(() => updateQuery);
    const client = { from: () => ({ update, select: () => listQuery }) };
    const store = {
      ...mocks.useStore(),
      accountId: interview.ownerId,
      interviews: [interview],
      saveWorkspace: async (work: (client: SupabaseClient) => Promise<void>) => {
        await work(client as unknown as SupabaseClient);
        return true;
      },
    };
    mocks.useStore.mockReturnValue(store);
    const { rerender } = render(<Today />);
    const today = screen.getByRole('region', { name: /^Today/ });
    fireEvent.click(within(today).getByRole('button', { name: 'Mark interview complete' }));
    await screen.findByText(notice);
    expect(update).toHaveBeenCalledWith({ status: 'completed' });
    expect(updateQuery.eq.mock.calls).toEqual([
      ['id', interview.id],
      ['application_id', app.id],
      ['user_id', interview.ownerId],
      ['revision', interview.revision],
    ]);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'SYNC_INTERVIEWS',
      applicationId: app.id,
      interviews: [savedInterview],
    });
    store.interviews = [savedInterview];
    rerender(<Today />);
    expect(screen.queryByRole('button', { name: 'Mark interview complete' })).not.toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });
});

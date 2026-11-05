import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Application } from '@/lib/types';
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
});

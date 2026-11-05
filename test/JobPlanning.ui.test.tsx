import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import type { Application } from '@/lib/types';
const mocks = vi.hoisted(() => ({
  useStore: vi.fn(),
  load: vi.fn(),
  rpc: vi.fn(),
  save: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock('@/lib/store', () => ({ useStore: mocks.useStore }));
vi.mock('@/lib/planning', async (original) => ({
  ...(await original<typeof import('@/lib/planning')>()),
  loadJobPlanning: mocks.load,
}));
import JobPlanning, { type PlannerHandle } from '@/components/JobPlanning';
const job: Application = {
  id: 'job',
  company: 'Acme',
  role: 'Engineer',
  status: 'saved',
  match: 0,
  deadline: null,
  url: '',
  notes: '',
  postingStatus: 'unknown',
  postingCheckedAt: null,
  postingNote: '',
};
const native = (label: string, value: string) =>
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
    screen.getByLabelText(label),
    value,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ contacts: [], interviews: [] });
  mocks.rpc.mockResolvedValue({ data: '2026-11-05T17:00:00Z', error: null });
  mocks.dispatch.mockResolvedValue(true);
  mocks.save.mockImplementation(async (work) => {
    await work({ rpc: mocks.rpc });
    return true;
  });
  mocks.useStore.mockReturnValue({
    workspaceClient: { rpc: mocks.rpc },
    accountId: 'owner',
    saveWorkspace: mocks.save,
    dispatch: mocks.dispatch,
    syncStatus: { pending: 0 },
  });
});
const ready = async () => {
  render(<JobPlanning application={job} onDirtyChange={() => {}} onBusyChange={() => {}} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add contact' })).toBeEnabled());
};
describe('job planning forms', () => {
  it('saves contact values from the native form even without React change events', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    native('Contact name', 'Native recruiter');
    native('Contact email', 'person@example.invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    await screen.findByText('Contact saved.');
    expect(mocks.rpc).toHaveBeenCalledWith(
      'save_job_contact',
      expect.objectContaining({
        job_id: 'job',
        expected_revision: null,
        details: expect.objectContaining({
          name: 'Native recruiter',
          email: 'person@example.invalid',
        }),
      }),
    );
  });
  it('resolves wall-clock time with authoritative server tzdata before saving UTC', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule interview' }));
    native('Interview title', 'Technical');
    native('Interview date and time', '2026-11-05T10:00');
    native('Interview time zone (IANA)', 'America/Vancouver');
    fireEvent.click(screen.getByRole('button', { name: 'Save interview' }));
    await screen.findByText('Interview saved. Re-export any calendar copy after changes.');
    expect(mocks.rpc).toHaveBeenCalledWith('resolve_interview_time', {
      local_time: '2026-11-05T10:00',
      zone_name: 'America/Vancouver',
      occurrence: 'reject',
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      'save_job_interview',
      expect.objectContaining({
        details: expect.objectContaining({
          starts_at: '2026-11-05T17:00:00Z',
          ends_at: '2026-11-05T17:45:00.000Z',
        }),
      }),
    );
  });
  it('keeps ambiguous times editable and never queues an incorrect instant', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'That time occurs twice when the clocks move back. Choose the earlier or later occurrence.',
      },
    });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule interview' }));
    native('Interview title', 'Technical');
    native('Interview date and time', '2027-11-07T01:30');
    fireEvent.click(screen.getByRole('button', { name: 'Save interview' }));
    await screen.findByText(/That time occurs twice/);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByRole('form', { name: 'Interview editor' })).toBeInTheDocument();
  });
  it('retains failed forms and exposes native edits to the parent close guard', async () => {
    mocks.save.mockResolvedValue(false);
    const ref = createRef<PlannerHandle>();
    render(
      <JobPlanning ref={ref} application={job} onDirtyChange={() => {}} onBusyChange={() => {}} />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add contact' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    native('Contact name', 'Unsaved');
    expect(ref.current?.isDirty()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    await screen.findByText('This change is queued. Keep this page open and use Retry save above.');
    expect(screen.getByLabelText('Contact name')).toHaveValue('Unsaved');
  });
});

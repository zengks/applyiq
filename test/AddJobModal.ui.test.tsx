import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '@/lib/store';
import type { NewJobForm } from '@/lib/types';

const mocks = vi.hoisted(() => ({ useStore: vi.fn(), save: vi.fn(), openDetail: vi.fn() }));
vi.mock('@/lib/store', () => ({ useStore: mocks.useStore }));
import AddJobModal from '@/components/modals/AddJobModal';

const emptyJob: NewJobForm = {
  company: '', role: '', url: '', status: 'saved', deadline: '', notes: '', description: '',
};

function Harness() {
  const [open, setOpen] = useState(true);
  const [job, setJob] = useState(emptyJob);
  mocks.useStore.mockReturnValue({
    showAddJobModal: open,
    newJob: job,
    darkMode: false,
    applications: [{ id: 'existing', company: 'Acme', role: 'Engineer', url: '' }],
    checkPostings: vi.fn(),
    async dispatch(action: Action) {
      if (action.type === 'CLOSE_ADD_JOB') setOpen(false);
      if (action.type === 'SET_NEW_JOB') {
        setJob(current => ({ ...current, [action.field]: action.value }));
      }
      if (action.type === 'ADD_APP') return mocks.save(action.app);
      if (action.type === 'OPEN_DETAIL') mocks.openDetail(action.id);
      return true;
    },
  });
  return <>
    <button onClick={() => { setJob(emptyJob); setOpen(true); }}>Open add job</button>
    <AddJobModal />
  </>;
}

function fillJob(company: string) {
  fireEvent.change(screen.getByLabelText('Company *'), { target: { value: company } });
  fireEvent.change(screen.getByLabelText('Job Title *'), { target: { value: 'Engineer' } });
}

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue(true);
  mocks.openDetail.mockReset();
});

describe('Add Job', () => {
  it('reads the native deadline at submission even if a change event is missed', async () => {
    render(<Harness />);
    fillJob('Northstar');
    (screen.getByLabelText('Deadline') as HTMLInputElement).value = '2026-11-25';
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add Application' })));
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ deadline: '2026-11-25' }));
    expect(mocks.openDetail).toHaveBeenCalledTimes(1);
  });

  it('requires a new duplicate confirmation after cancelling the form', () => {
    render(<Harness />);
    fillJob('Acme');
    fireEvent.click(screen.getByRole('checkbox', { name: /separate opportunity/ }));
    expect(screen.getByRole('button', { name: 'Add Application' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open add job' }));
    fillJob('Acme');
    expect(screen.getByRole('checkbox', { name: /separate opportunity/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Add Application' })).toBeDisabled();
  });

  it('leaves the replacement form open when a dismissed save finishes', async () => {
    let finish!: (saved: boolean) => void;
    mocks.save.mockReturnValue(new Promise<boolean>(resolve => { finish = resolve; }));
    render(<Harness />);
    fillJob('Northstar');
    fireEvent.click(screen.getByRole('button', { name: 'Add Application' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open add job' }));
    fillJob('Replacement');
    await act(async () => finish(true));
    expect(screen.getByLabelText('Company *')).toHaveValue('Replacement');
    expect(screen.getByRole('button', { name: 'Add Application' })).toBeEnabled();
    expect(mocks.openDetail).not.toHaveBeenCalled();
  });
});

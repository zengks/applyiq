import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceDraft } from '@/lib/useWorkspaceDraft';
import {
  clearAccountDrafts,
  readWorkspaceDraft,
  setDraftsEnabled,
  writeWorkspaceDraft,
  type WorkspaceDraft,
} from '@/lib/workspaceDraft';
const owner = '11111111-1111-4111-8111-111111111111';
const job = '33333333-3333-4333-8333-333333333333';
const baseline = {
  description: 'Original',
  nextAction: '',
  nextActionDue: '',
  nextActionDone: false,
  appliedAt: '',
  notes: '',
};
const value: WorkspaceDraft = {
  details: { ...baseline, notes: 'Unsaved notes' },
  baseline: { ...baseline },
  resumeName: '',
  resumeText: '',
  letterId: '',
  letterTitle: 'Cover letter',
  letterText: '',
  letterSource: null,
  savedLetterText: '',
  savedLetterTitle: 'Cover letter',
};
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 2, 12));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('device recovery lifecycle', () => {
  it('writes only after opt-in, then offers explicit recovery after remount', () => {
    const first = renderHook(() => useWorkspaceDraft(owner, job, value, true));
    act(() => vi.advanceTimersByTime(500));
    expect(readWorkspaceDraft(localStorage, owner, job)).toBeNull();
    act(() => first.result.current.toggle(true));
    act(() => vi.advanceTimersByTime(500));
    expect(readWorkspaceDraft(localStorage, owner, job)?.data.details.notes).toBe('Unsaved notes');
    first.unmount();
    const second = renderHook(() =>
      useWorkspaceDraft(owner, job, { ...value, details: baseline }, true),
    );
    expect(second.result.current.candidate?.data.details.notes).toBe('Unsaved notes');
    act(() => vi.advanceTimersByTime(500));
    expect(readWorkspaceDraft(localStorage, owner, job)?.data.details.notes).toBe('Unsaved notes');
  });
  it('does not recreate private drafts when unmount follows sign-out', () => {
    setDraftsEnabled(localStorage, owner, true);
    const hook = renderHook(() => useWorkspaceDraft(owner, job, value, true));
    act(() => vi.advanceTimersByTime(500));
    expect(readWorkspaceDraft(localStorage, owner, job)).not.toBeNull();
    clearAccountDrafts(localStorage, owner);
    hook.unmount();
    expect(localStorage.length).toBe(0);
  });
  it('does not recreate drafts after opting out', () => {
    setDraftsEnabled(localStorage, owner, true);
    const hook = renderHook(() => useWorkspaceDraft(owner, job, value, true));
    act(() => vi.advanceTimersByTime(500));
    act(() => hook.result.current.toggle(false));
    hook.unmount();
    expect(localStorage.length).toBe(0);
  });
  it('captures native control values synchronously on pagehide', () => {
    setDraftsEnabled(localStorage, owner, true);
    const unchanged = { ...value, details: baseline };
    renderHook(() =>
      useWorkspaceDraft(owner, job, unchanged, true, () => ({
        ...unchanged,
        details: { ...baseline, nextActionDue: '2026-11-10' },
      })),
    );
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(readWorkspaceDraft(localStorage, owner, job)?.data.details.nextActionDue).toBe(
      '2026-11-10',
    );
  });
  it('surfaces a quota failure without claiming a recovery copy was stored', () => {
    setDraftsEnabled(localStorage, owner, true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const hook = renderHook(() => useWorkspaceDraft(owner, job, value, true));
    act(() => vi.advanceTimersByTime(500));
    expect(hook.result.current.error).toContain('could not be stored');
    expect(hook.result.current.lastSaved).toBeNull();
  });
  it('keeps an unresolved stored draft intact while the form changes', () => {
    setDraftsEnabled(localStorage, owner, true);
    writeWorkspaceDraft(localStorage, owner, job, value);
    const hook = renderHook(({ data }) => useWorkspaceDraft(owner, job, data, true), {
      initialProps: { data: value },
    });
    hook.rerender({
      data: { ...value, details: { ...baseline, notes: 'New typing' } },
    });
    act(() => vi.advanceTimersByTime(500));
    expect(readWorkspaceDraft(localStorage, owner, job)?.data.details.notes).toBe('Unsaved notes');
  });
});

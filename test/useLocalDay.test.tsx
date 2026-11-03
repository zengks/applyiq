import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalDay } from '@/lib/useLocalDay';
afterEach(() => vi.useRealTimers());
describe('local agenda clock', () => {
  it('rolls the agenda over at local midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 50));
    const hook = renderHook(() => useLocalDay());
    expect(hook.result.current.day).toBe('2026-11-02');
    act(() => vi.advanceTimersByTime(30_000));
    expect(hook.result.current.day).toBe('2026-11-03');
  });
  it('refreshes immediately after a sleeping tab receives focus', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 12));
    const hook = renderHook(() => useLocalDay());
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(hook.result.current.day).toBe('2026-11-05');
  });
});

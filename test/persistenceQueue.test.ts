import { describe, expect, it, vi } from 'vitest';
import { PersistenceQueue, type SyncStatus } from '@/lib/persistenceQueue';

describe('save recovery', () => {
  it('retains failed writes, stops later writes, then retries in order', async () => {
    const statuses: SyncStatus[] = [];
    const queue = new PersistenceQueue(status => statuses.push(status));
    const events: string[] = [];
    let unavailable = true;
    const first = () => { events.push('first'); return unavailable ? Promise.reject({ message: 'database unavailable' }) : Promise.resolve(); };
    expect(await queue.enqueue(first)).toBe(false);
    expect(await queue.enqueue(async () => { events.push('second'); })).toBe(false);
    expect(events).toEqual(['first']);
    expect(statuses.at(-1)).toMatchObject({ pending: 2, saving: false, error: expect.any(String) });
    unavailable = false;
    await queue.retry();
    expect(events).toEqual(['first', 'first', 'second']);
    expect(statuses.at(-1)).toEqual({ pending: 0, saving: false, error: '' });
  });

  it('does not write a newer edit before an earlier slow save finishes', async () => {
    const events: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queue = new PersistenceQueue(vi.fn());
    const one = queue.enqueue(async () => { await gate; events.push(1); });
    const two = queue.enqueue(async () => { events.push(2); });
    expect(events).toEqual([]);
    release();
    expect(await Promise.all([one, two])).toEqual([true, true]);
    expect(events).toEqual([1, 2]);
  });
});

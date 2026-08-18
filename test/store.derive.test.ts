import { describe, expect, it } from 'vitest';
import { deriveStoreValues, postingsDueForCheck, INITIAL, type State } from '@/lib/store';
import type { Application, Subscription } from '@/lib/types';

const NOW = new Date('2026-06-22T12:00:00Z').getTime();
const DAY = 86400000;

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  status: 'trialing', trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, priceId: null, ...over,
});

const app = (deadline: string | null, over: Partial<Application> = {}): Application => ({
  id: Math.random().toString(), company: 'C', role: 'R', status: 'saved', match: 0, deadline, url: '', notes: '',
  postingStatus: 'unknown', postingCheckedAt: null, postingNote: '', ...over,
});

describe('deriveStoreValues', () => {
  it('isPro only when active', () => {
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: sub({ status: 'active' }) }, NOW).isPro).toBe(true);
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: sub({ status: 'trialing' }) }, NOW).isPro).toBe(false);
  });

  it('trialDaysLeft counts up from trialEndsAt and clamps at 0', () => {
    const inFive = new Date(NOW + 5 * DAY).toISOString();
    expect(deriveStoreValues({ ...INITIAL, subscription: sub({ trialEndsAt: inFive }) }, NOW).trialDaysLeft).toBe(5);
    const past = new Date(NOW - 2 * DAY).toISOString();
    expect(deriveStoreValues({ ...INITIAL, subscription: sub({ trialEndsAt: past }) }, NOW).trialDaysLeft).toBe(0);
    expect(deriveStoreValues({ ...INITIAL, subscription: null }, NOW).trialDaysLeft).toBe(0);
  });

  it('showTrialBanner only while trialing with days left', () => {
    const inThree = new Date(NOW + 3 * DAY).toISOString();
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: sub({ status: 'trialing', trialEndsAt: inThree }) }, NOW).showTrialBanner).toBe(true);
    const past = new Date(NOW - DAY).toISOString();
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: sub({ status: 'trialing', trialEndsAt: past }) }, NOW).showTrialBanner).toBe(false);
  });

  it('showExpiredBanner when not loading, not pro, not trialing', () => {
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: null }, NOW).showExpiredBanner).toBe(true);
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: sub({ status: 'canceled' }) }, NOW).showExpiredBanner).toBe(true);
    expect(deriveStoreValues({ ...INITIAL, loading: true, subscription: null }, NOW).showExpiredBanner).toBe(false);
    expect(deriveStoreValues({ ...INITIAL, loading: false, subscription: sub({ status: 'active' }) }, NOW).showExpiredBanner).toBe(false);
  });

  it('urgentCount counts deadlines within 0..3 days inclusive', () => {
    const state: State = {
      ...INITIAL,
      applications: [
        app(null),                                            // ignored
        app(new Date(NOW - DAY).toISOString().slice(0, 10)),  // past → ignored
        app(new Date(NOW + 2 * DAY).toISOString().slice(0, 10)), // urgent
        app(new Date(NOW + 3 * DAY).toISOString().slice(0, 10)), // urgent
        app(new Date(NOW + 10 * DAY).toISOString().slice(0, 10)), // far → ignored
      ],
    };
    expect(deriveStoreValues(state, NOW).urgentCount).toBe(2);
  });

  it('selectedApp resolves by id, null when missing', () => {
    const a = app(null);
    const state: State = { ...INITIAL, applications: [a], selectedAppId: a.id };
    expect(deriveStoreValues(state, NOW).selectedApp).toBe(a);
    expect(deriveStoreValues({ ...state, selectedAppId: 'nope' }, NOW).selectedApp).toBeNull();
    expect(deriveStoreValues({ ...state, selectedAppId: null }, NOW).selectedApp).toBeNull();
  });
});

describe('stale postings', () => {
  it('counts expired and removed postings that are still actionable', () => {
    const state: State = {
      ...INITIAL,
      applications: [
        app(null, { id: 'ok', postingStatus: 'active' }),
        app(null, { id: 'unchecked' }),
        app(null, { id: 'gone', postingStatus: 'removed' }),
        app(null, { id: 'closed', status: 'applied', postingStatus: 'expired' }),
        app(null, { id: 'won', status: 'offer', postingStatus: 'removed' }),      // settled → ignored
        app(null, { id: 'lost', status: 'rejected', postingStatus: 'expired' }),  // settled → ignored
      ],
    };
    const d = deriveStoreValues(state, NOW);
    expect(d.stalePostings.map(a => a.id)).toEqual(['gone', 'closed']);
    expect(d.staleCount).toBe(2);
  });

  it('checkingPostings tracks in-flight ids', () => {
    expect(deriveStoreValues(INITIAL, NOW).checkingPostings).toBe(false);
    expect(deriveStoreValues({ ...INITIAL, checkingPostingIds: ['a1'] }, NOW).checkingPostings).toBe(true);
  });
});

describe('postingsDueForCheck', () => {
  const fresh = new Date(NOW - 60_000).toISOString();
  const old = new Date(NOW - 2 * DAY).toISOString();

  it('picks postings with a URL that are stale and still actionable', () => {
    const apps = [
      app(null, { id: 'no-url', url: '' }),
      app(null, { id: 'fresh', url: 'https://x.co/1', postingCheckedAt: fresh }),
      app(null, { id: 'stale', url: 'https://x.co/2', postingCheckedAt: old }),
      app(null, { id: 'never', url: 'https://x.co/3' }),
      app(null, { id: 'won', url: 'https://x.co/4', status: 'offer' }),
      app(null, { id: 'lost', url: 'https://x.co/5', status: 'rejected' }),
    ];
    expect(postingsDueForCheck(apps, NOW)).toEqual(['stale', 'never']);
  });

  it('caps the batch at the request limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => app(null, { id: `a${i}`, url: 'https://x.co/j' }));
    expect(postingsDueForCheck(many, NOW)).toHaveLength(25);
  });
});

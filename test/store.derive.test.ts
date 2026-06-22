import { describe, expect, it } from 'vitest';
import { deriveStoreValues, INITIAL, type State } from '@/lib/store';
import type { Application, Subscription } from '@/lib/types';

const NOW = new Date('2026-06-22T12:00:00Z').getTime();
const DAY = 86400000;

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  status: 'trialing', trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, priceId: null, ...over,
});

const app = (deadline: string | null): Application => ({
  id: Math.random().toString(), company: 'C', role: 'R', status: 'saved', match: 0, deadline, url: '', notes: '',
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

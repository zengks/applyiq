import { afterEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { mapStripeSubscription } from '@/lib/stripe/sync';

afterEach(() => vi.unstubAllEnvs());

describe('priceIdForPlan', () => {
  it('returns the env price id for each plan', async () => {
    vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', 'price_monthly');
    vi.stubEnv('STRIPE_PRICE_ID_ANNUAL', 'price_annual');
    vi.resetModules();
    const { priceIdForPlan } = await import('@/lib/stripe/config');
    expect(priceIdForPlan('monthly')).toBe('price_monthly');
    expect(priceIdForPlan('annual')).toBe('price_annual');
  });
});

function fakeSub(over: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'trialing',
    trial_end: 1700000000,
    current_period_end: 1700600000,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_monthly' } }] },
    metadata: {},
    ...over,
  } as unknown as Stripe.Subscription;
}

describe('mapStripeSubscription', () => {
  it('maps the common fields', () => {
    const row = mapStripeSubscription(fakeSub());
    expect(row).toMatchObject({
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      price_id: 'price_monthly',
      status: 'trialing',
      cancel_at_period_end: false,
    });
    expect(row.trial_ends_at).toBe(new Date(1700000000 * 1000).toISOString());
    expect(row.current_period_end).toBe(new Date(1700600000 * 1000).toISOString());
  });

  it('reads customer id when customer is an object', () => {
    const row = mapStripeSubscription(fakeSub({ customer: { id: 'cus_obj' } }));
    expect(row.stripe_customer_id).toBe('cus_obj');
  });

  it('nulls trial_ends_at when there is no trial', () => {
    const row = mapStripeSubscription(fakeSub({ trial_end: null }));
    expect(row.trial_ends_at).toBeNull();
  });

  it('nulls price_id when there are no items', () => {
    const row = mapStripeSubscription(fakeSub({ items: { data: [] } }));
    expect(row.price_id).toBeNull();
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getUser: vi.fn(), read: vi.fn(), write: vi.fn(), reserve: vi.fn(),
  customer: vi.fn(), history: vi.fn(), checkout: vi.fn(), pending: vi.fn(), retrieve: vi.fn(), signature: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: m.getUser } }),
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: () => m.read(table) }) }),
      upsert: (row: unknown) => m.write(table, row),
    }),
    rpc: () => ({ single: m.reserve }),
  }),
}));
vi.mock('@/lib/stripe/server', () => ({ stripe: {
  customers: { create: m.customer },
  subscriptions: { list: m.history, retrieve: m.retrieve },
  checkout: { sessions: { create: m.checkout, list: m.pending } },
  webhooks: { constructEvent: m.signature },
} }));
vi.mock('@/lib/stripe/config', () => ({
  TRIAL_DAYS: 14, SITE_URL: 'https://applyiq.example',
  PRICE_IDS: { monthly: 'price_monthly', annual: 'price_annual' },
  priceIdForPlan: (plan: string) => `price_${plan}`,
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'stripe-signature': 'synthetic-signature' }) }));
import { POST as checkout } from '@/app/api/stripe/checkout/route';
import { POST as webhook } from '@/app/api/stripe/webhook/route';

const subscription = {
  id: 'sub_new', customer: 'cus_owned', status: 'active', trial_end: null,
  metadata: { supabase_user_id: 'user-owned' }, cancel_at_period_end: false,
  items: { data: [{ price: { id: 'price_monthly' }, current_period_end: 1900000000 }] },
};
const request = () => new Request('https://applyiq.example/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan: 'monthly' }) });
const eventRequest = () => new Request('https://applyiq.example/api/stripe/webhook', { method: 'POST', body: '{}' });

beforeEach(() => {
  vi.resetAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: 'user-owned', email: 'test@example.invalid' } } });
  m.read.mockResolvedValue({ data: { stripe_customer_id: 'cus_owned' }, error: null });
  m.write.mockResolvedValue({ error: null });
  m.reserve.mockResolvedValue({ data: { request_id: 'stable-reservation', plan: 'monthly', expires_at: '2030-01-01T00:31:00Z' }, error: null });
  m.history.mockResolvedValue({ data: [] });
  m.checkout.mockResolvedValue({ url: 'https://checkout.stripe.com/synthetic' });
  m.pending.mockResolvedValue({ data: [] });
  m.retrieve.mockResolvedValue(subscription);
});

describe('checkout correctness', () => {
  it('reuses an existing open checkout after a retry instead of creating another', async () => {
    m.pending.mockResolvedValue({ data: [{ client_reference_id: 'user-owned', metadata: { checkout_request_id: 'stable-reservation' }, url: 'https://checkout.stripe.com/existing' }] });
    const response = await checkout(request());
    expect(await response.json()).toEqual({ url: 'https://checkout.stripe.com/existing' });
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests without creating Stripe resources', async () => {
    m.getUser.mockResolvedValue({ data: { user: null } });
    expect((await checkout(request())).status).toBe(401);
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('uses a stable idempotency key for simultaneous/repeated checkout attempts', async () => {
    const responses = await Promise.all([checkout(request()), checkout(request())]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(m.checkout.mock.calls[0][1]).toEqual(m.checkout.mock.calls[1][1]);
    expect(m.checkout.mock.calls[0][0]).toEqual(m.checkout.mock.calls[1][0]);
  });
  it('rejects a duplicate active subscription', async () => {
    m.history.mockResolvedValue({ data: [{ id: 'sub_existing', status: 'active' }] });
    expect((await checkout(request())).status).toBe(409);
    expect(m.checkout).not.toHaveBeenCalled();
  });
  it('does not grant another trial to a returning subscriber', async () => {
    m.history.mockResolvedValue({ data: [{ id: 'sub_old', status: 'canceled' }] });
    expect((await checkout(request())).status).toBe(200);
    expect(m.checkout.mock.calls[0][0].subscription_data).not.toHaveProperty('trial_period_days');
  });
  it('requires a successful customer mapping save before creating checkout', async () => {
    m.read.mockResolvedValue({ data: null, error: null });
    m.customer.mockResolvedValue({ id: 'cus_created' });
    m.write.mockResolvedValue({ error: { message: 'database unavailable' } });
    expect((await checkout(request())).status).toBe(503);
    expect(m.checkout).not.toHaveBeenCalled();
  });
});

describe('webhook delivery and retries', () => {
  it('returns 500 on a returned database error so Stripe will retry', async () => {
    m.signature.mockReturnValue({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: { id: 'sub_new' } } });
    m.write.mockResolvedValue({ error: { message: 'write failed' } });
    expect((await webhook(eventRequest())).status).toBe(500);
  });
  it('refreshes subscriptions from current Stripe state instead of a stale event', async () => {
    m.signature.mockReturnValue({ id: 'evt_2', type: 'customer.subscription.updated', data: { object: { id: 'sub_new', status: 'past_due' } } });
    expect((await webhook(eventRequest())).status).toBe(200);
    expect(m.write).toHaveBeenCalledWith('subscriptions', expect.objectContaining({ status: 'active', current_period_end: new Date(1900000000000).toISOString() }));
  });
  it.each([
    { parent: { subscription_details: { subscription: 'sub_new' } } },
    { subscription: 'sub_new' },
  ])('accepts current and older invoice event shapes', async invoice => {
    m.signature.mockReturnValue({ id: 'evt_invoice', type: 'invoice.paid', data: { object: invoice } });
    expect((await webhook(eventRequest())).status).toBe(200);
    expect(m.retrieve).toHaveBeenCalledWith('sub_new');
  });
  it('records refund/dispute events for review', async () => {
    m.signature.mockReturnValue({ id: 'evt_risk', type: 'charge.dispute.created', data: { object: {} } });
    expect((await webhook(eventRequest())).status).toBe(200);
    expect(m.write).toHaveBeenCalledWith('stripe_webhook_events', expect.objectContaining({ requires_review: true }));
  });
  it('rejects invalid signatures before touching the database', async () => {
    m.signature.mockImplementation(() => { throw new Error('bad signature'); });
    expect((await webhook(eventRequest())).status).toBe(400);
    expect(m.write).not.toHaveBeenCalled();
  });
});

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { priceIdForPlan, TRIAL_DAYS, SITE_URL, type Plan } from '@/lib/stripe/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createHash } from 'node:crypto';
import { readJsonBody } from '@/lib/server/requestBody';

export async function POST(req: Request) {
  let plan: Plan;
  try { ({ plan } = await readJsonBody(req, 1024) as { plan: Plan }); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (plan !== 'monthly' && plan !== 'annual') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  try {

  // Reuse an existing Stripe customer for this user, or create one.
  const { data: existing, error: lookupError } = await admin
    .from('subscriptions')
    .select('stripe_customer_id,stripe_subscription_id,trial_ends_at,status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const { data: checkout, error: checkoutError } = await admin.rpc('begin_billing_checkout', {
    account_id: user.id, selected_plan: plan,
  }).single<{ request_id: string; expires_at: string; plan: Plan }>();
  if (checkoutError) {
    if (checkoutError.message.startsWith('Checkout already')) return NextResponse.json({ error: checkoutError.message }, { status: 409 });
    throw checkoutError;
  }
  if (!checkout) throw new Error('Could not reserve checkout');

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    }, { idempotencyKey: `applyiq-customer-${user.id}` });
    customerId = customer.id;
    const { error } = await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId });
    if (error) throw error;
  }

  // Stripe is authoritative even when a webhook was delayed or missed.
  const history = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  if (history.has_more) return NextResponse.json({ error: 'Please manage your existing billing account or contact support before starting another subscription.' }, { status: 409 });
  const current = history.data.find(sub => !['canceled', 'incomplete_expired'].includes(sub.status));
  if (current) return NextResponse.json({ error: 'You already have a subscription. Use Manage Billing to change or resume it.' }, { status: 409 });
  const trialEligible = history.data.length === 0 && !existing?.stripe_subscription_id && !existing?.trial_ends_at;
  const pending = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
  const existingSession = pending.data.find(session => session.client_reference_id === user.id && session.metadata?.checkout_request_id === checkout.request_id);
  if (existingSession?.url) return NextResponse.json({ url: existingSession.url });
  if (pending.has_more) return NextResponse.json({ error: 'Please complete your existing checkout before starting another.' }, { status: 409 });
  const suffix = createHash('sha256').update(checkout.request_id).digest('hex').slice(0, 8).replace(/[0-9]/g, n => String.fromCharCode(97 + Number(n)));

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    metadata: { checkout_request_id: checkout.request_id, plan },
    expires_at: Math.floor(new Date(checkout.expires_at).getTime() / 1000),
    integration_identifier: `applyiq_checkout_${suffix}`,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    // Require a card up front even though the trial is free.
    payment_method_collection: 'always',
    subscription_data: {
      ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {}),
      metadata: { supabase_user_id: user.id },
    },
    success_url: `${SITE_URL}/dashboard?checkout=success`,
    cancel_url: `${SITE_URL}/dashboard?checkout=cancelled`,
  }, { idempotencyKey: `applyiq-checkout-${checkout.request_id}` });

  return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout failed:', error);
    return NextResponse.json({ error: 'Could not start checkout. Please try again shortly.' }, { status: 503 });
  }
}

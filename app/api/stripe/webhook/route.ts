import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mapStripeSubscription } from '@/lib/stripe/sync';
import { PRICE_IDS } from '@/lib/stripe/config';

/** Mirror a Stripe subscription into the subscriptions table. */
async function syncSubscription(admin: SupabaseClient, sub: Stripe.Subscription) {
  const row = mapStripeSubscription(sub);
  if (!Object.values(PRICE_IDS).includes(row.price_id ?? '')) return;

  // Prefer the user id stamped on the subscription; fall back to a customer lookup.
  let userId = sub.metadata?.supabase_user_id ?? null;
  if (!userId) {
    const { data, error } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', row.stripe_customer_id)
      .maybeSingle();
    if (error) throw error;
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error('Subscription has no ApplyIQ account');

  // An old canceled subscription must never replace a newer active one.
  const { data: existing, error: readError } = await admin.from('subscriptions').select('stripe_subscription_id,status').eq('user_id', userId).maybeSingle();
  if (readError) throw readError;
  if (existing?.stripe_subscription_id && existing.stripe_subscription_id !== sub.id && ['active', 'trialing'].includes(existing.status) && ['canceled', 'incomplete_expired'].includes(sub.status)) return;
  const { error } = await admin.from('subscriptions').upsert({ user_id: userId, ...row });
  if (error) throw error;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscription(admin, sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Read the current object so late/out-of-order deliveries cannot regress state.
        await syncSubscription(admin, await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id));
        break;

      case 'customer.subscription.trial_will_end': {
        // Fires ~3 days before the trial ends — notify the user before we charge.
        const sub = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
        await syncSubscription(admin, sub);
        // Reminder email delivery is configured separately in Stripe Billing.
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Keep older snapshot webhook destinations working during API upgrades.
        const legacy = event.data.object as unknown as { subscription?: string | { id: string } | null };
        const subscription = invoice.parent?.subscription_details?.subscription ?? legacy.subscription;
        if (subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof subscription === 'string' ? subscription : subscription.id);
          await syncSubscription(admin, sub);
        }
        break;
      }
      case 'charge.dispute.created':
      case 'charge.refunded':
      case 'radar.early_fraud_warning.created':
        console.error(`Billing review required: ${event.type} (${event.id})`);
        break;
    }
    const { error } = await admin.from('stripe_webhook_events').upsert({
      id: event.id, event_type: event.type,
      requires_review: ['charge.dispute.created', 'charge.refunded', 'radar.early_fraud_warning.created'].includes(event.type),
    });
    if (error) throw error;
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

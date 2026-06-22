import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mapStripeSubscription } from '@/lib/stripe/sync';

/** Mirror a Stripe subscription into the subscriptions table. */
async function syncSubscription(admin: SupabaseClient, sub: Stripe.Subscription) {
  const row = mapStripeSubscription(sub);

  // Prefer the user id stamped on the subscription; fall back to a customer lookup.
  let userId = sub.metadata?.supabase_user_id ?? null;
  if (!userId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', row.stripe_customer_id)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) return;

  await admin.from('subscriptions').upsert({ user_id: userId, ...row });
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
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end': {
        // Fires ~3 days before the trial ends — notify the user before we charge.
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, sub);
        // TODO(email): send "your trial ends soon / card will be charged" notification.
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as { subscription?: string | null };
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          await syncSubscription(admin, sub);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

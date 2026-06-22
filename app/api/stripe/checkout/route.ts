import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { priceIdForPlan, TRIAL_DAYS, SITE_URL, type Plan } from '@/lib/stripe/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { plan } = (await req.json()) as { plan?: Plan };
  if (plan !== 'monthly' && plan !== 'annual') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  // Reuse an existing Stripe customer for this user, or create one.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    // Require a card up front even though the trial is free.
    payment_method_collection: 'always',
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { supabase_user_id: user.id },
    },
    success_url: `${SITE_URL}/dashboard?checkout=success`,
    cancel_url: `${SITE_URL}/dashboard?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}

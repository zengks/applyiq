import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { SITE_URL } from '@/lib/stripe/config';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/** Opens the Stripe Billing Portal so a user can update card / cancel. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet' }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${SITE_URL}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}

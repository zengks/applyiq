import type Stripe from 'stripe';

export interface SubscriptionRow {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  price_id: string | null;
  status: Stripe.Subscription.Status;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/** Maps a Stripe subscription into the columns of our `subscriptions` table (minus user_id). */
export function mapStripeSubscription(sub: Stripe.Subscription): SubscriptionRow {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    price_id: sub.items.data[0]?.price.id ?? null,
    status: sub.status,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

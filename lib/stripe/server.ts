import Stripe from 'stripe';

/** Server-side Stripe client. Never import this into client components. */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-10-28.endive',
  maxNetworkRetries: 2,
  timeout: 20_000,
});

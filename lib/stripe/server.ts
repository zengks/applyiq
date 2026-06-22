import Stripe from 'stripe';

/** Server-side Stripe client. Never import this into client components. */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

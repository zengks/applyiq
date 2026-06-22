/** Length of the free trial before the first charge. */
export const TRIAL_DAYS = 14;

export type Plan = 'monthly' | 'annual';

/** Stripe Price IDs per plan (set in .env.local). */
export const PRICE_IDS: Record<Plan, string> = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL!,
};

export function priceIdForPlan(plan: Plan): string {
  return PRICE_IDS[plan];
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

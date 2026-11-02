import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { PRICE_IDS } from '@/lib/stripe/config';

function format(price: Stripe.Price) {
  return {
    id: price.id,
    amount: (price.unit_amount ?? 0) / 100,
    currency: price.currency,
    interval: price.recurring?.interval ?? null,
  };
}

/** Live price amounts so the pricing UI always matches Stripe. */
export async function GET() {
  try {
  const [monthly, annual] = await Promise.all([
    stripe.prices.retrieve(PRICE_IDS.monthly),
    stripe.prices.retrieve(PRICE_IDS.annual),
  ]);
  if (!monthly.active || !annual.active || monthly.recurring?.interval !== 'month' || annual.recurring?.interval !== 'year' || monthly.recurring.interval_count !== 1 || annual.recurring.interval_count !== 1) {
    throw new Error('Expected active monthly and annual subscription prices');
  }
  return NextResponse.json({ monthly: format(monthly), annual: format(annual) });
  } catch (error) {
    console.error('Could not load Stripe prices:', error);
    return NextResponse.json({ error: 'Prices are temporarily unavailable.' }, { status: 503 });
  }
}

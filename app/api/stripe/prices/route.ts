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
  const [monthly, annual] = await Promise.all([
    stripe.prices.retrieve(PRICE_IDS.monthly),
    stripe.prices.retrieve(PRICE_IDS.annual),
  ]);
  return NextResponse.json({ monthly: format(monthly), annual: format(annual) });
}

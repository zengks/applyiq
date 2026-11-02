// Seed a ready-to-use PREMIUM (active Pro) account for local testing.
//
//   node --env-file=.env.local scripts/seed-premium.mjs
//
// Creates (or updates) an auth user with a confirmed email and an `active`
// subscription row, so the app treats them as Pro (isPro === true) without
// going through Stripe Checkout / webhooks. Idempotent: re-running resets the
// password and subscription.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRICE_ID = process.env.STRIPE_PRICE_ID_ANNUAL ?? 'price_seed_annual';

if (!URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed-premium.mjs');
  process.exit(1);
}

const EMAIL = process.env.SEED_TEST_EMAIL ?? 'premium@applyiq.test';
const PASSWORD = process.env.SEED_TEST_PASSWORD;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new globalThis.URL(URL).hostname);
if (!PASSWORD || PASSWORD.length < 20) throw new Error('Provide a unique SEED_TEST_PASSWORD with at least 20 characters.');
if (!local && process.env.ALLOW_REMOTE_TEST_SEED !== 'yes') throw new Error('Remote seeding is disabled. Use a dedicated test project and explicitly set ALLOW_REMOTE_TEST_SEED=yes.');
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Seeding requires Stripe test-mode configuration.');

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  // Paginate through users (fine for a dev project).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  // 1. Create or update the auth user (confirmed email so they can log in immediately).
  let user = await findUserByEmail(EMAIL);
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Premium Tester' },
    });
    if (error) throw error;
    user = data.user;
    console.log(`• Reusing existing user ${EMAIL} (${user.id}) — password reset.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Premium Tester' },
    });
    if (error) throw error;
    user = data.user;
    console.log(`• Created user ${EMAIL} (${user.id}).`);
  }

  // 2. Ensure the profile is set up (trigger creates the row; we fill it in).
  const { error: pErr } = await admin.from('profiles').upsert({
    id: user.id,
    full_name: 'Premium Tester',
    job_title: 'Staff Engineer',
    onboarded: true,
    billing_cycle: 'annual',
  });
  if (pErr) throw pErr;
  console.log('• Profile set (onboarded, named).');

  // 3. Active Pro subscription so isPro === true (no Stripe round-trip needed).
  const oneYear = new Date(Date.now() + 365 * 86400000).toISOString();
  const { error: sErr } = await admin.from('subscriptions').upsert({
    user_id: user.id,
    stripe_customer_id: `cus_seed_${user.id.slice(0, 8)}`,
    stripe_subscription_id: `sub_seed_${user.id.slice(0, 8)}`,
    price_id: PRICE_ID,
    status: 'active',
    trial_ends_at: null,
    current_period_end: oneYear,
    cancel_at_period_end: false,
  });
  if (sErr) throw sErr;
  console.log('• Subscription set to ACTIVE (Pro) through', oneYear.slice(0, 10) + '.');

  console.log('\n────────────────────────────────────────');
  console.log('  PREMIUM TEST ACCOUNT READY');
  console.log('  URL:      ' + (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000') + '/login');
  console.log('  Email:    ' + EMAIL);
  console.log('  Password: the unique value supplied in SEED_TEST_PASSWORD (not logged).');
  console.log('────────────────────────────────────────');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err);
  process.exit(1);
});

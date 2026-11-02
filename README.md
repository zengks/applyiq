# ApplyIQ

ApplyIQ helps job seekers track applications, manage résumés, and prepare job-specific match reports, cover letters, and interview questions.

## Run locally

Use Node 26, or a version satisfying the `engines` field in `package.json`.

```sh
npm ci
cp .env.local.example .env.local
# Fill in the required values locally.
npm run dev
```

Open [localhost:3000](http://localhost:3000). `/` is the landing page, `/login` and `/register` handle accounts, and `/dashboard` contains the application workspace.

Supabase supplies Auth, Postgres, and private résumé storage. Anthropic supplies AI analysis. Stripe Checkout and the Billing Portal manage Pro subscriptions. All privileged credentials stay on the server; only the Supabase URL and public anon key belong in browser code. Use separate test credentials and databases for development.

## Database setup

For a new database, apply the SQL files in `supabase/migrations` in order. The hardening migration adds atomic default-résumé selection, plan enforcement, AI usage reservations, checkout coordination, and webhook event records. It includes the posting-status columns for older installations that missed `0003`.

The original installation used the SQL Editor, so `0001`–`0003` may not have entries in hosted migration history. Reconcile that baseline before using `supabase db push` against an existing project. Do not replay an old baseline after hardening, because the older scripts recreate access policies.

In Supabase Auth, configure the site URL and confirmation redirect URL (`/auth/callback`). Review the password policy and leaked-password protection in the dashboard. The signup form requires 12 characters; the hosted Auth policy must be configured separately.

## Billing setup

Configure the monthly and annual Price IDs and public site URL. The pricing modal reads current amounts and currency from Stripe; it does not assume an annual discount. Only Pro is purchasable. The Free plan needs no card.

Forward these events to `/api/stripe/webhook`, with the corresponding signing secret:

- `checkout.session.completed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`
- `invoice.paid`, `invoice.payment_failed`
- `charge.dispute.created`, `charge.refunded`, `radar.early_fraud_warning.created`

The server uses Stripe API `2026-10-28.endive` and accepts current and older invoice snapshot shapes. Configure trial reminder emails and the Billing Portal in Stripe. Tax registration and collection settings require a separate launch review; automatic tax is not enabled by this change.

Checkout uses a database reservation and Stripe idempotency keys. Repeated attempts reuse an open session. An in-progress checkout holds its selected billing cycle for about 30 minutes; finish it or wait for expiry before switching cycles. Returning subscribers do not receive another trial.

## Current plan limits

| Capability | Free | Pro and active trial |
| --- | --- | --- |
| Applications | 5 | Unlimited |
| Résumé versions | 1 | 3 |
| AI requests | 3 per UTC calendar month | 30 per hour with a monthly processing budget |
| File upload | 10 MB per file | 10 MB per file |

The AI processing budget is a $50 monthly provider-cost guard, not an extra customer charge. Accepted attempts count toward the request allowance even when a posting is blocked, because they can consume provider tokens. Database failures block new AI spending. Match scores are advisory; résumé uploads do not receive invented ATS scores.

## Verification

```sh
npm run typecheck
npm run lint
npm run test:run
npm audit --omit=dev
npm run build -- --webpack
npm run start
```

Webpack is a supported fallback when the execution environment prevents Turbopack from creating worker sockets. The build downloads the configured Google font.

See [testing and verification](docs/TESTING.md), [dependency maintenance](docs/DEPENDENCIES.md), and the [improvement plan](docs/ROADMAP.md).

## Architecture

- `app/dashboard/page.tsx` renders the authenticated workspace and loads analytics on demand.
- `lib/store.tsx` hydrates Supabase data and dispatches writes through `lib/persistenceQueue.ts`. Failed writes remain queued until retry or an explicit reload of saved data. Pending changes are held in memory, with a warning before leaving.
- `app/api/analyze/route.ts` validates bounded input, reserves usage atomically, calls Claude, records every completed model call, and validates the result.
- `lib/server/postingFetch.ts` checks DNS answers and redirects, pins connections to validated public IPs, and bounds response size and duration.
- DOCX previews sanitize converted HTML and use a sandbox policy.
- Subscription rows are writable only by the server. Webhook write failures return an error so Stripe retries.

`npm run seed:premium` is an explicit test utility. It requires a unique `SEED_TEST_PASSWORD`, Stripe test mode, and opt-in for a remote test database. Never use a shared seeded account in production.

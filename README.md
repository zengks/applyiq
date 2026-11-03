# ApplyIQ

ApplyIQ helps job seekers track applications, manage résumés, and prepare job-specific match reports, cover letters, and interview questions.

## Job workspaces

Open any application card to work with everything for that job:

1. Save the posting text and its capture date. A saved description can be analyzed after the source disappears, including jobs without a URL.
2. Attach a snapshot from the résumé vault, or paste a tailored version. Edits create new versions and leave earlier snapshots intact.
3. Analyze the selected résumé against the saved description. The résumé reference, analysis, and generated letter are saved together. Standalone AI results can also be saved to a new or existing application with the exact inputs used for that analysis.
4. Edit and save cover-letter versions; download résumé and letter text.
5. Record the submission date and exact résumé/letter versions actually sent. Reopening that record selects those versions, even after later edits.
6. Save a next action, due date, and completion state. The board shows the next action. Status changes have a timeline from this release onward.

Similar URLs and company/title pairs prompt confirmation before creating another job. Queued saves reuse fixed record IDs, show failures, and retain the operation for retry. Unsaved form edits warn before closing. Keep the page open until queued writes finish; queued operations and in-flight AI results are held in memory. Optional device recovery protects workspace form edits across reloads (see below). Notes are edited locally and written with **Save job details**, rather than on every keystroke.

Vault slots remain plan-limited. Each job can keep up to 200 material versions across résumés, analyses, and letters. The workspace shows the latest 100 submission records and 200 status events. Résumé text snapshots remain independent of the vault; the optional original-file link uses the existing private file and can become unavailable if that source file is removed. Recording a submission does not send an application, and next actions do not send notifications.

## Today and device draft recovery

The dashboard opens on **Today**: overdue, today, upcoming, undated, and completed next actions, plus deadlines for saved applications that have not been submitted. Complete/reopen actions, reschedule dates, and open the corresponding workspace directly. An offer or rejection does not hide an explicit next action; recording a submission removes its application deadline. Interview appointments, calendar export, and external notifications are future work.

Dates are calendar dates in the browser's local day; the view displays its time zone and refreshes after midnight or returning to the tab. It never converts date-only deadlines through midnight UTC.

In a job workspace, **Keep recovery drafts on this device** is opt-in. It stores unsaved posting/notes/action/date fields, pasted résumé edits, and letter edits in this browser, separated by verified account and job. Up to ten workspaces are retained for seven days; expired copies are removed when accessed. Restore is explicit and never automatically writes to Supabase, retries a queued operation, or calls AI. Review restored edits and use the normal Save buttons. Newer saved fields are preserved unless you edited that field locally; overlapping changes produce a review notice.

Device storage is not encrypted against someone with access to the browser profile. Skip it on shared devices. Turning recovery off or explicitly signing out clears this account's local drafts and preference. Browser storage restrictions/quota errors are shown; keep the page open until database saves finish. Recovery is not a backup of completed database records, uploads, queued operations, or unfinished AI responses.

Dashboard job lists initially load metadata; large posting and notes bodies load when the workspace opens. Workspace editing remains disabled until the full saved record loads.

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

For a new database, apply the SQL files in `supabase/migrations` in order. The hardening migration adds atomic default-résumé selection, plan enforcement, AI usage reservations, checkout coordination, and webhook event records. It includes the posting-status columns for older installations that missed `0003`. The job-workspace migration adds immutable materials, submitted-version references, next actions, and status events with account and application ownership constraints.

The original installation used the SQL Editor, so `0001`–`0003` may not have entries in hosted migration history. Reconcile that baseline before using `supabase db push` against an existing project. Do not replay an old baseline after hardening, because the older scripts recreate access policies.

The timestamped migration filenames match the versions recorded by the hosted migration runner. Their SQL checksums were verified against hosted history; the filename alignment does not change or reapply the SQL.

In Supabase Auth, configure the site URL and confirmation redirect URL (`/auth/callback`). Review the password policy and leaked-password protection in the dashboard. The signup form requires 12 characters; the hosted Auth policy must be configured separately.

## Billing setup — on hold

**Leave billing as-is until the user explicitly authorizes resumption.** Coordinate all Stripe work with the existing **Plan Stripe account management** chat. Direct two-way messaging is authorized; billing changes are not. See [Stripe coordination and resume gate](docs/STRIPE_COORDINATION.md) for the designated sandbox, chat IDs, preservation rules, and required CAD Payment Link / USD Pro checkout reconciliation.

The setup notes below describe the existing implementation and future authorized setup; they are not permission to change billing or proof of a complete working payment flow.

The existing code targets monthly and annual Price IDs and a public site URL. The pricing modal reads amounts and currency from Stripe; it does not assume an annual discount. Only Pro has a Checkout path in the existing code. The Free plan needs no card. These implementation details do not settle the intended offer.

Forward these events to `/api/stripe/webhook`, with the corresponding signing secret:

- `checkout.session.completed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`
- `invoice.paid`, `invoice.payment_failed`
- `charge.dispute.created`, `charge.refunded`, `radar.early_fraud_warning.created`

The server uses Stripe API `2026-10-28.endive` and accepts current and older invoice snapshot shapes. Configure trial reminder emails and the Billing Portal in Stripe. Tax registration and collection settings require a separate launch review; automatic tax is not enabled by this change.

Checkout uses a database reservation and Stripe idempotency keys. Repeated attempts reuse an open session. An in-progress checkout holds its selected billing cycle for about 30 minutes; finish it or wait for expiry before switching cycles. Returning subscribers do not receive another trial.

## Current plan limits

These are the current application entitlements, not a reconciled or approved currency/pricing offer. The Stripe coordination hold still applies.

| Capability | Free | Pro and active trial |
| --- | --- | --- |
| Applications | 5 | Unlimited |
| Résumé vault entries | 1 | 3 |
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
- `components/JobWorkspace.tsx` loads the selected job's saved materials on demand; `lib/jobWorkspace.ts` handles identity matching, input snapshots, and mapping. Workspace saves share the ordered queue and verify that the account has not changed.
- Material and submission rows are append-only for app users. Atomic database functions save complete analysis bundles and submission references; ownership constraints reject references to another account or job.
- `app/api/analyze/route.ts` validates bounded input, reserves usage atomically, calls Claude, records every completed model call, and validates the result.
- `lib/server/postingFetch.ts` checks DNS answers and redirects, pins connections to validated public IPs, and bounds response size and duration.
- DOCX previews sanitize converted HTML and use a sandbox policy.
- Subscription rows are writable only by the server. Webhook write failures return an error so Stripe retries.

`npm run seed:premium` is an explicit test utility. It requires a unique `SEED_TEST_PASSWORD`, Stripe test mode, and opt-in for a remote test database. Never use a shared seeded account in production.

## Preview and validation

No existing ApplyIQ hosting project was found in the connected Vercel account/team. The user confirmed it may not be connected yet. Local production verification is documented in [Preview and database maintenance](docs/PREVIEW_AND_DATABASE_MAINTENANCE.md); a hosted preview remains a separate setup step. The [job-seeker walkthrough](docs/JOB_SEEKER_WALKTHROUGH.md) is ready for voluntary testing and has not been sent to anyone.

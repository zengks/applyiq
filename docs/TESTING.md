# ApplyIQ testing and verification

**Stripe billing work remains on hold.** Follow [Stripe coordination](STRIPE_COORDINATION.md): direct chat coordination is authorized, while new billing changes and payment-flow experiments require explicit user authorization to resume. Preserve existing experimental records. Existing code, mocked calls, and test-mode price lookups do not establish a complete working payment flow.

## Local checks

```sh
npm ci
npm run typecheck
npm run lint
npm run test:run
npm audit --omit=dev
npm run build -- --webpack
```

Vitest configuration lives in `vitest.config.mts`. Tests cover state transitions, returned database errors, ordered save recovery, AI validation/accounting, URL classification and connection guards, Stripe checkout/webhook behavior, and DOCX preview sanitization. Paid external API calls are mocked.

The GitHub Actions workflow uses placeholder credentials and does not access a real Supabase project or spend AI tokens.

## Disposable backend verification

After applying migrations, point `.env.local` at the intended test database and run:

```sh
RUN_BACKEND_VERIFICATION=yes node --env-file=.env.local scripts/verify-backend.mjs
```

The script creates two uniquely named disposable accounts and synthetic records. It tests:

1. Signup profile creation after restricting trigger-function permissions.
2. Free application limits and repeated saves using the same record ID.
3. Cross-account read and write isolation.
4. Pro résumé limits and an atomic, owned default-résumé change.
5. Concurrent Free AI quota reservations and server-only reservation access.
6. Checkout reservation reuse and denied client access to billing coordination.
7. Private file ownership and the storage bucket upload-size limit.
8. Immutable job résumé snapshots, including later vault edits and idempotent saves.
9. Concurrent analysis retries that save one linked analysis/letter bundle.
10. Atomic rollback when any part of a bundle fails.
11. Cross-account and cross-application material references.
12. Reopened posting text, next action, submission history, and actual status events.
13. Application deletion cascading through disposable workspace records.

Its `finally` block removes the generated files and accounts. It never updates existing accounts or creates Stripe subscriptions. Resolve any failed cleanup before treating the run as complete.

## Browser workspace smoke test

`scripts/verify-workspace-browser.mjs` supports a disposable browser walkthrough. Every command requires `RUN_BACKEND_VERIFICATION=yes` and the intended `.env.local`. Use `create` to make the fixture. Credentials are stored with restricted permissions in the OS temporary directory; never copy them into repository files.

Sign in locally with that fixture, add **Northstar Studio (synthetic)** / **Product Engineer**, paste a synthetic description containing “accessible React,” and save the next action **Follow up with recruiting** with due date **2026-11-10**. Attach the fixture's vault résumé. Run the helper with `seed-analysis` to insert a clearly synthetic analysis and letter through the authenticated RPC. This avoids a paid AI call.

In the UI, open the generated letter and save an edited version containing **Edited version for a later application**. Record a submission using the original résumé and original letter. Run `verify` to check the database and change only the disposable vault résumé. Reload the app and reopen the submitted materials: their original text must remain unchanged. Check a 390px viewport and duplicate-creation confirmation. Sign out, then run `cleanup` to remove the fixture and temporary credentials.

This walkthrough passed on November 2 2026, including the due-date save and subsequent reload. Unit tests also cover native date controls that update without a React change event. Physical-device keyboard behavior remains a launch check.

## Verified on November 2 2026

- The original Supabase project was restored and its app credentials connected successfully.
- The hardening and job-workspace migrations were applied. All 13 backend verification groups passed, and cleanup completed. The separate browser fixture was also removed.
- Hosted Auth now requires at least 12 password characters and rejects known leaked passwords. The security advisor reports no warnings or errors; its three informational notices concern service-only tables that deliberately deny client access.
- Existing Stripe prices were read successfully in test mode. Anthropic authentication and availability of `claude-sonnet-4-6` were checked without generating content.
- The production dependency audit reported zero vulnerabilities. Development tooling retains moderate upstream findings; see `DEPENDENCIES.md`.
- TypeScript, ESLint, the unit suite, and the Webpack production build passed during implementation.
- The workspace milestone passed 172 tests. Coverage includes the saved résumé used for analysis, original submitted versions after edits, failed saves, input snapshots, duplicate detection, native date submission, and navigation warnings during analysis.
- Timestamped migration filenames were aligned with hosted history after verifying identical SQL checksums. The legacy SQL Editor baseline still requires reconciliation before a future CLI push.

## Launch checks

The Stripe items below are future checks, not instructions to resume billing. After the user explicitly lifts the hold, reconcile the CAD subscription Payment Link and USD Pro checkout with Stripe Manage before changing billing or executing the agreed sandbox payment-flow tests. Do not activate live payments under this coordination authorization.

- Walk registration, confirmation, login, and password recovery with a test account. Verify hosted Auth redirects and password policy.
- Exercise Checkout, renewal, failed payment, cancellation, and webhook retries in Stripe test mode. Unit tests and a price lookup do not replace complete checkout/webhook delivery tests.
- Configure Stripe trial reminder emails and confirm a test reminder arrives.
- Review Stripe Tax registration and collection settings before accepting real payments.
- Preserve the configured 12-character minimum and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) when changing hosted Auth settings. Three internal tables intentionally have RLS with no client policies or client grants.
- Review previously seeded remote test accounts for reused credentials. The seed utility no longer supplies or logs a shared password; existing credentials were not changed in this work.
- Test mobile navigation, dialogs, keyboard scrolling, uploads, retry notices, and slow/offline saves on a phone.
- Measure dashboard load, interaction latency, bundle requests, and AI cost with representative data before claiming performance improvements.

## Today and draft recovery verification

The initial Today slice and opt-in device recovery were verified on November 2, 2026 (Vancouver local date). All 207 tests, TypeScript, ESLint, the Webpack production build, and the production dependency audit passed. Unit tests cover grouping and valid calendar dates, local midnight/focus refresh, action completion/reopening, native date rescheduling, visible failed saves, owner-filtered persistence, metadata-only form guards, explicit note saves, draft expiry/corruption/quota, three-way restore, existing-letter reuse, and sign-out/opt-out cleanup without recreating private drafts.

Run the isolated non-billing helper with the intended `.env.local`:

```sh
RUN_BACKEND_VERIFICATION=yes node --env-file=.env.local scripts/verify-today.mjs create
# Complete the browser walkthrough below.
RUN_BACKEND_VERIFICATION=yes node --env-file=.env.local scripts/verify-today.mjs verify-browser
RUN_BACKEND_VERIFICATION=yes node --env-file=.env.local scripts/verify-today.mjs cleanup
```

`create` makes two uniquely named disposable accounts, three synthetic jobs, one résumé, and synthetic analysis/letter/submission snapshots. It checks profile/application/résumé isolation, denied ownership reassignment, quick action persistence, and cross-account denial of materials. It never calls Stripe or creates/changes subscriptions or billing records. Credentials stay in a restricted OS temporary file; the measurement report contains no credentials. Cleanup verifies the generated email before deleting only those disposable accounts. Never use a general experimental-record purge.

In the browser, sign in as the first fixture account. Complete Cedar's **Prepare interview examples** action. Reschedule Harbor's **Review the role requirements** to the fixture's `rescheduledDate`. Open Northstar, opt into recovery, replace notes with **Notes recovered after reload.**, and write a new letter **Recovered draft letter for review.** Close while keeping the draft, reload the dashboard, reopen Northstar, and choose **Restore draft**. Confirm edits are offered for review and have not automatically saved. Save job details and save the letter as a new version. Reopen the original submitted materials; the first résumé and letter must remain unchanged. `verify-browser` checks these results in Supabase. Sign out, then reopen after signing in to confirm device recovery is off and no stored candidate appears. Clear test text from the device and run scoped cleanup.

Live results: all five non-billing backend check groups passed; UI completion/rescheduling, notes/letter recovery after reload, and unchanged original submission references were verified in Supabase. A 390×844 browser viewport covered Today, navigation, and workspace controls. This is not a physical-phone or real-user test. Returned-error/queue retry behavior is covered by component and persistence tests; no claim of an offline durable operation queue is made.

The synthetic payload comparison used three jobs with 60,000-character postings: full rows were 188,756 JSON bytes; metadata rows were 1,629 bytes (99.14% smaller). Three GET samples per query shape had medians 94 ms / 98 ms respectively. This establishes a smaller response body for that dataset, not improved LCP, phone latency, or production p75 performance. Full posting and notes text remained available on workspace open.

The four-policy RLS migration is applied and its SQL checksum matches hosted history. Advisors now show zero security warnings/errors and three performance warnings in unchanged billing/usage policies, down from seven. Postgres upgrade readiness and hosting status are recorded in [the maintenance runbook](PREVIEW_AND_DATABASE_MAINTENANCE.md). Payment-flow verification remains on hold.

## Hosted maintenance verification

The [November 2 maintenance record](MAINTENANCE_2026-11-02.md) documents the verified private backup, completed upgrade to `17.11.0.011`, unchanged existing-data fingerprints, and completed provider physical backups. The five non-billing backend groups and the Today/workspace browser walkthrough also passed against the protected Vercel Preview. A one-time test-account confirmation callback established a hosted session without email delivery. No paid AI generation, real email-delivery, or payment-flow validation is claimed. Disposable accounts and local verification credentials are removed after the final smoke check.

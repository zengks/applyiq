# ApplyIQ testing and verification

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

Its `finally` block removes the generated files and accounts. It never updates existing accounts or creates Stripe subscriptions. Resolve any failed cleanup before treating the run as complete.

## Verified on November 2 2026

- The original Supabase project was restored and its app credentials connected successfully.
- The hardening migration was applied. All seven backend verification groups passed, and cleanup completed.
- Hosted Auth now requires at least 12 password characters and rejects known leaked passwords. The security advisor reports no warnings or errors; its three informational notices concern service-only tables that deliberately deny client access.
- Existing Stripe prices were read successfully in test mode. Anthropic authentication and availability of `claude-sonnet-4-6` were checked without generating content.
- The production dependency audit reported zero vulnerabilities. Development tooling retains moderate upstream findings; see `DEPENDENCIES.md`.
- TypeScript, ESLint, the unit suite, and the Webpack production build passed during implementation.

## Launch checks

- Walk registration, confirmation, login, and password recovery with a test account. Verify hosted Auth redirects and password policy.
- Exercise Checkout, renewal, failed payment, cancellation, and webhook retries in Stripe test mode. Unit tests and a price lookup do not replace complete checkout/webhook delivery tests.
- Configure Stripe trial reminder emails and confirm a test reminder arrives.
- Review Stripe Tax registration and collection settings before accepting real payments.
- Preserve the configured 12-character minimum and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) when changing hosted Auth settings. Three internal tables intentionally have RLS with no client policies or client grants.
- Review previously seeded remote test accounts for reused credentials. The seed utility no longer supplies or logs a shared password; existing credentials were not changed in this work.
- Test mobile navigation, dialogs, keyboard scrolling, uploads, retry notices, and slow/offline saves on a phone.
- Measure dashboard load, interaction latency, bundle requests, and AI cost with representative data before claiming performance improvements.

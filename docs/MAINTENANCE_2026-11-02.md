# ApplyIQ maintenance — November 2, 2026

## Fresh backup

A private pre-upgrade backup was completed at **22:00 Vancouver time** (November 3, 05:00 UTC). It contains roles, application schema, managed Auth/Storage schema for recovery, table data, migration history, and both private résumé uploads. It is stored locally at `.local-backups/supabase/2026-11-02-pre-upgrade/`; the directory is excluded from Git and Vercel uploads. Files have restricted local permissions. The SQL contains private account/application data and must not be published.

Verification restored the schema, data, and migrations into an isolated local Supabase Postgres `17.11.0.011` database with no network or host ports. All 17 captured application/account/storage/migration tables matched the live row counts and fingerprints. Both uploads (54,096 bytes total) passed SHA-256 checks. A private manifest records artifact sizes, checksums, and verification results. The verification container and its throwaway password were removed; the backup remains available.

The initial restore attempt used the image's existing Auth schema and stopped on a schema-version conflict. Repeating the restore in an empty database succeeded. Recovery requires the captured managed schema or a compatible managed baseline, plus the dump's trigger-disable/replica settings for circular application/material references. Do not restore into the live project as a verification step.

## Database upgrade

The existing project is `fbqqjlrshphxhpripysl`. The pre-upgrade build was `17.6.1.166`; eligibility offered GA build `17.11.0.011` with an estimated maintenance window of up to one hour. Preflight found no replication slots, unsupported extensions, custom operators, affected application index types, legacy PGP function references, or stored Vault secrets. No experimental records were removed.

The user authorized the backup and upgrade, and separately authorized official CLI sign-in. The signed-in CLI credential remains local and was used only with Supabase. The dashboard session subsequently required MFA; the documented Management API was used for maintenance. The upgrade completed successfully from 22:05 to 22:12 Vancouver time. Supabase reports `ACTIVE_HEALTHY` on build `17.11.0.011`, and SQL reports PostgreSQL 17.11. All 17 pre-upgrade table counts/fingerprints are unchanged, including billing records. No invalid indexes were found. Converting `2026-11-02 12:00:00+00` to `America/Vancouver` now returns 05:00 rather than the old 04:00. The upgrade status also confirms completion of its post-upgrade physical-backup stage. The provider backup list includes a completed physical backup from 22:06:47 Vancouver time, plus a newer completed backup at 22:14:57; the verified local pre-upgrade backup remains retained. No data restore was performed on the hosted project.

## Protected hosted preview

Created `applyiq-preview` in the existing Vercel team `zengksoutlookcoms-projects`, project ID `prj_8ZHhJUYkcCT2HH5eKsdGmeLzZrUI`, linked to `zengks/applyiq`. All deployments require Vercel authentication. It uses the existing active Pro team, Node 26, and the Webpack build command; no hosting plan or spend setting was changed. Automatic Git deployments are disabled in repository configuration; previews are deployed explicitly. Vercel classified the first automatic feature-branch build as production, so it was canceled before release. All deployments remained protected, and no Production secrets were configured. A project-level ignored-build command also skips automatic builds; explicit preview deployments must force a build.

Public Supabase settings and the existing Supabase service-role / Anthropic keys are configured for Preview only. The user explicitly authorized the two server-only Secret transfers after automatic review rejected the original request. The values were passed through stdin and were not displayed or committed. Fork deployment protection is enabled. Bulk environment download was also review-rejected; verification used variable names/types and reads of the two public variables instead. No real Stripe secret, signing secret, publishable key, or Price ID is configured on this preview. The placeholder Stripe string permits SDK module initialization and cannot authenticate to Stripe. Production credentials and Stripe account settings remain unchanged.

Post-upgrade non-billing verification passed all five backend check groups using newly created disposable accounts. The security advisor reports no warnings/errors. Three RLS performance warnings remain in unchanged billing/usage policies.

### Verified preview access and workflow

Preview: [ApplyIQ protected preview](https://applyiq-preview-git-feat-mobi-2eca61-zengksoutlookcoms-projects.vercel.app). Sign in to Vercel with the owning account, then sign in to ApplyIQ. Vercel's API calls this target `staging`; it is the standard Preview environment. It is not a production release.

- The Preview build completed with Node 26 / Next.js 16.4.4. All 207 tests, type checks, lint, production audit, and GitHub CI passed.
- Unauthenticated requests redirect to Vercel sign-in; the existing signed-in account reaches the app. All deployments remain protected. No shareable bypass link was created. A CLI HTTP check automatically created an automation bypass, which was subsequently revoked; browser verification used account authentication.
- Hosted browser checks covered login/sign-out, Today completion and date rescheduling, full workspace loading, explicit notes saves, opt-in draft restoration after reload, a new cover-letter version, and reopening the original submitted résumé/letter. The backend helper verified persisted values and unchanged submission references. A 390×844 browser viewport was checked; no physical-phone claim is made.
- A one-time confirmation link for the disposable account reached the hosted dashboard through `/auth/confirm`, without sending email. Supabase accepted the preview redirect. Only the exact controlled preview origins were added to the redirect allowlist; localhost, the 12-character minimum, and leaked-password protection were preserved. Real email delivery, OAuth providers, and password recovery still need separate launch validation.
- The preview shares the existing upgraded Supabase project, with account isolation enforced by RLS. It is not a separate database or production-data clone. The browser checks used newly generated synthetic accounts, not existing customer records.
- The two real server keys were explicitly authorized and stored as Preview-only Vercel Secrets. No paid AI generation or Stripe payment-flow test was performed. Provider configuration does not establish that those complete flows work.

## Billing hold

The [Stripe coordination agreement](STRIPE_COORDINATION.md) remains in effect. This maintenance does not reconcile product offers, test payment flows, alter Stripe records, create accounts, or activate live payments. Any future authorized billing work must go through Stripe Manage first.

## Repeating the backup

The backup commands were run with Supabase CLI `3.0.0` after checking its current help. This release uses `--remote=<project-ref>`; older `--linked` examples should not be copied unchanged. With a new private, ignored destination and restrictive `umask`, capture:

```sh
npx --yes supabase@3.0.0 db dump --remote=fbqqjlrshphxhpripysl --role-only --file roles.sql
npx --yes supabase@3.0.0 db dump --remote=fbqqjlrshphxhpripysl --file schema.sql
npx --yes supabase@3.0.0 db dump --remote=fbqqjlrshphxhpripysl --data-only --use-copy --file data.sql
npx --yes supabase@3.0.0 db dump --remote=fbqqjlrshphxhpripysl --schema public,auth,storage,supabase_migrations --file recovery-schema.sql
npx --yes supabase@3.0.0 db dump --remote=fbqqjlrshphxhpripysl --data-only --use-copy --schema supabase_migrations --file migration-data.sql
```

Run these from the private backup directory, not the repository root. Storage uploads are a separate capture through the existing Storage API; the SQL contains only object metadata. Verify artifact hashes and a local restore before treating a new backup as recoverable. No offsite copy or recurring backup job was created by this task.

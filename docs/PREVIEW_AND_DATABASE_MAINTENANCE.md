# Preview and database maintenance

## Current maintenance status

The user subsequently authorized the backup, database upgrade, and hosted preview. A verified private backup is retained locally and Supabase is now healthy on `17.11.0.011`. A protected Vercel project is linked. See [the November 2 execution record](MAINTENANCE_2026-11-02.md) for current evidence and deployment status. The older observations below are the pre-maintenance baseline.

## Hosting baseline before this maintenance

Checked November 2, 2026: no ApplyIQ project matched the connected Vercel personal account or team. The checkout has no `.vercel` link. The user indicated the app may not yet have a hosting provider. No hosting project was created, no domain configured, and no deployment published.

Use a local production preview for review:

```sh
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build -- --webpack
npm run start -- --hostname 127.0.0.1 --port 3107
```

Use the existing private `.env.local` only on the intended machine. Never commit secrets, copy them into screenshots, or print them in logs. The public Supabase URL/anon key are distinct from the privileged server key.

For a hosted preview, first select the intended account/project and approved environment. Link this repository/branch, configure protected server variables from a secure source, and use an appropriate non-production Supabase dataset. Set the app URL and approved Auth callback/recovery redirects for that environment, verify registration and recovery there, then repeat the non-billing browser walkthrough. GitHub CI uses placeholders and proves build/test compatibility, not a hosted connection.

Keep the [Stripe hold](STRIPE_COORDINATION.md) throughout hosting setup. Do not create payment links/accounts, change products/prices/webhooks, run payment-flow tests, or enable live payments as part of preview setup. Preserve existing experimental records. A public launch and a verified payment flow remain separate work.

## Postgres upgrade readiness

Observed directly in the existing ApplyIQ Supabase dashboard:

| Item | Observed state |
| --- | --- |
| Project | `fbqqjlrshphxhpripysl` |
| Current Postgres build | `17.6.1.166` |
| Offered target | `17.11.0.011` |
| Database size | Approximately 12 MB during this verification |
| Visible scheduled backup | Physical backup, November 2, 2026 at 21:39:05 UTC |
| Upgrade / restore executed | Neither |

The available backup predates this feature's migration and verification. Its presence is not proof of a successful restore or protection of later writes. Supabase's backup page explicitly excludes Storage objects; database metadata does not restore deleted uploads.

[Supabase's October 30 time-zone advisory](https://supabase.com/changelog/tzdata-local-time-vancouver-edmonton-casablanca) identifies affected builds below `17.11.0.003` and incorrect local conversions for Vancouver, Edmonton, and Casablanca. Stored data/timestamps remain intact. The offered build is above that minimum. The Today view uses browser calendar dates, which does not repair the database's time-zone data.

The [official upgrade procedure](https://supabase.com/docs/guides/platform/upgrading) takes the database and associated services offline, may update other services, and requires application-level checks afterward. No downtime estimate was verified in this pass. Do not promise a duration from the small database size alone.

### Concrete execution gates

1. Agree on a maintenance window with the user, including login/save unavailability and post-upgrade verification time. Confirm the offered version again immediately before executing.
2. Ensure a fresh recoverable database backup includes the current migrations and recent writes. For this small database, follow the official recommendation for a logical backup using approved credential custody. Keep any dump private and outside Git; avoid exporting customer data unnecessarily. Record backup timestamp and recovery procedure without secret values. Check upload protection separately if files must be recoverable.
3. In General settings, inspect the upgrade dialog's downtime estimate and prerequisites. Review extensions, replicas, replication slots, unsupported types, and relevant release notes. If a prerequisite requires dropping records or changing access, stop for a concrete review; do not delete experimental records or remove indexes solely because they have an unused notice.
4. Review time-zone-dependent expression indexes per the advisory. A read-only scan found no public-schema index definitions containing `timezone(` or `AT TIME ZONE`; this is not exhaustive for custom functions or other schemas. Rebuild only those that are actually affected, using a reviewed migration. Do not assume every timestamp index is affected.
5. Execute only after these checks and the agreed window. If the upgrade fails, follow Supabase's documented recovery path; do not improvise a data restore or create another account/project.
6. Verify project health and actual service versions, login, account isolation, posting/notes saves, Today date controls, draft restore, résumé/letter snapshots, and submission references. Run `verify-today.mjs` with disposable fixtures, then remove only those fixtures. Recheck advisors and compare Vancouver conversions. Preserve billing's hold: do not test payments or change Stripe configuration.

## RLS optimization applied

`20261103043313_optimize_workspace_owner_policies.sql` is recorded in hosted migration history. SQL checksum matched the local file (`441eb486292150ae285ba2cd1457a294`). It changes only cached `auth.uid()` evaluation in application/résumé ownership and profile select/insert policies; roles, predicates, and `WITH CHECK` constraints are preserved.

The hosted advisor now reports three initialization-plan warnings, down from seven. Subscription and usage policies remain untouched under the billing hold. Security has no warnings/errors; three informational no-policy notices concern service-only tables that intentionally deny client access. Six unused-index notices and the Auth connection-allocation informational notice remain for evidence-based review.

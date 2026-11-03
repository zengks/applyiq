# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run start   # Serve the production build (run after `npm run build`)
npm run lint    # ESLint
npm run test:run # Vitest (single run); `npm test` for watch mode
```

**Requires** a `.env.local` file with `ANTHROPIC_API_KEY=sk-...` (copy from `.env.local.example`). The API route constructs `new Anthropic()` with no arguments, so it reads the key implicitly from this env var.

**Version / changelog:** `next.config.ts` injects `NEXT_PUBLIC_APP_VERSION` (from `package.json`) and `NEXT_PUBLIC_GIT_SHA` (git short SHA) at build time; the sidebar footer shows `VERSION_LABEL` and opens the "What's new" modal. The changelog reads GitHub Releases for `GITHUB_REPO` (default `zengks/applyiq`), falling back to recent commits; set `GITHUB_TOKEN` (PAT with repo read) so a **private** repo's data is visible — otherwise the feed is empty.

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Anthropic SDK, Recharts.

**Routes:** `app/page.tsx` is the public landing page; `/login` and `/register` handle accounts; `/dashboard` renders the authenticated workspace. Dashboard navigation uses `activeView` state. Its analytics view is loaded with `next/dynamic`. Server APIs cover analysis, saved-posting checks, résumé parsing/previews, Stripe billing, changelog, and admin usage reporting.

Imports use the `@/*` path alias mapped to the repo root (see `tsconfig.json`), e.g. `@/lib/store`, `@/components/Sidebar`.

### State management (`lib/store.tsx`)
Account data hydrates from Supabase into a React reducer/context. There is no localStorage demo dataset. Database-mutating actions use `PersistenceQueue`: writes run in order, returned Supabase errors propagate, failed writes remain queued, and the shell displays pending/error/retry state. `dispatch` returns `Promise<boolean>`; callers must wait before showing a saved confirmation or querying a newly inserted row. Retrying an insert uses the same record UUID. Queue contents live in memory; leaving with pending changes triggers a warning.

Hydration errors do not silently become empty account data. Default résumé changes use the `set_default_resume` RPC so the selected flag and profile text update together. UI state, active view, and generated analysis remain session-only.

### AI analysis flow
`components/views/AIAnalysis.tsx` → `POST /api/analyze` (body: **`jobUrl` (required)**, optional `jobDescription` excerpt, `resumeText`) → `app/api/analyze/route.ts` → Anthropic `claude-sonnet-4-6`. The route gives Claude the **`web_fetch_20260209` server tool** so the model fetches and reads the posting URL itself (Sonnet 4.6+ is required for that tool variant's dynamic filtering — this is why the model is no longer Haiku). It handles `pause_turn` by re-sending (bounded), records each completed model call, then validates the returned JSON with the schema in `lib/ai.ts`. Usage is reserved atomically before the first model call; a failed reservation blocks spending. Failed fetches still consume the accepted request allowance. The API route is the only place that touches the Anthropic SDK, keeping the key server-side. The prompt instructs the model to return raw JSON matching the `AIResult` shape; `parseAIResponse` (in `lib/ai.ts`) strips fences and falls back to extracting the first `{...}` block. The pasted `jobDescription` is an optional fallback (used to supplement when a page can't be fetched). **If you change the response fields, update both the prompt's JSON template in `route.ts` and the `AIResult` interface in `lib/types.ts` together.**

### Saved-posting expiry detection
Saved jobs are re-checked against their source so a dead link can't sit unnoticed on the board. `components/views/Applications.tsx` "Check links" (and a background sweep fired once per session from `StoreProvider`) → `POST /api/posting-status` with the ids to check → the route reads those rows' URLs **from the caller's own `applications` rows** (never a client-supplied URL — that would make it an open fetch proxy), fetches each through `lib/server/postingFetch.ts` with public DNS/IP validation, pinned connections, redirect checks, a size cap, and a 12s budget, and classifies via `lib/postingCheck.ts`:

- `removed` — 404/410, or a soft-404 page ("job not found") served with a 200.
- `expired` — closed-role wording ("no longer accepting applications", "position has been filled"), or a schema.org `validThrough` date in the past.
- `unknown` — blocked (401/403/429), 5xx, timeout, or a non-fetchable URL. **Inconclusive checks never turn into a warning** — a bot-blocking board must not look like a deleted job.
- `active` — otherwise.

`safeFetchUrl` rejects loopback/private/metadata hosts (SSRF guard). Page contents stay server-side; only the verdict is returned. Results land on `Application.postingStatus` / `postingCheckedAt` / `postingNote` via `POSTING_CHECK_DONE`, are written back to Supabase, and drive the indicators: an amber sidebar badge, a dismissible dashboard alert, a Kanban card badge, and a full explanation plus "Re-check" in the detail drawer. `deriveStoreValues` hides all of it for `offer`/`rejected` jobs — a settled job's dead link is just noise. Re-checks are due after `CHECK_TTL_MS` (24h), max `MAX_URLS_PER_CHECK` (25) per request.

**Requires database migrations.** The hardening migration includes posting-status columns for older installations that missed `0003`. Do not ignore persistence errors or claim that a missing schema still saves data correctly.

### Key files
| File | Purpose |
|------|---------|
| `lib/types.ts` | All TypeScript interfaces |
| `lib/store.tsx` | Reducer, hydration, queued writes, and account context |
| `lib/persistenceQueue.ts` | Ordered writes, retained failures, and retry status |
| `lib/jobWorkspace.ts` | Duplicate detection, immutable analysis inputs, job/workspace hydration |
| `components/JobWorkspace.tsx` | Job text, résumé snapshots, analyses, letter versions, submissions, next action |
| `lib/utils.ts` | Color helpers, status maps, date formatters |
| `app/api/analyze/route.ts` | Claude API proxy (POST) |
| `lib/postingCheck.ts` | Pure link-check classification (expiry phrases, SSRF guard, TTL) |
| `app/api/posting-status/route.ts` | Fetches saved postings and returns their verdicts (POST) |
| `components/Sidebar.tsx` | 240px nav sidebar with dark mode toggle |
| `components/TrialBanner.tsx` | Sticky top banner (trial active / expired) |
| `components/views/` | Dashboard, Applications (Kanban), AIAnalysis, ResumeVault, Analytics |
| `components/modals/` | OnboardingWizard, DetailDrawer, AddJobModal, PricingModal, WhatsNewModal |
| `lib/version.ts` | Build-time app version/SHA (`VERSION_LABEL`) + GitHub changelog normalizers |
| `app/api/changelog/route.ts` | "What's new" feed — GitHub Releases (falls back to commits) |

### Styling
Tailwind CSS v4 (CSS-first config — no `tailwind.config.ts`). Design tokens in `app/globals.css` under `@theme`. Dark mode toggles the `dark` class on `<body>` and uses CSS custom properties. Components use **inline styles** matching the pixel-precise design spec, not Tailwind utility classes.

### Design tokens
- Primary accent: `#ec4899` (pink), hover `#be185d`
- Page bg light: `#f5f3f0` / dark: `#0f0e0d`; Card bg light: `#ffffff` / dark: `#1c1b19`
- Font: Plus Jakarta Sans (400/500/600/700/800)
- Card border-radius: 14px; button: 9px; badge: 20px

## Billing and security invariants

Read `README.md`, `docs/TESTING.md`, and `docs/DEPENDENCIES.md` before maintenance. Read the installed Next.js docs before changing framework code.

- Subscription rows, AI reservations, checkout reservations, and webhook event records are server-controlled. Never authorize users with editable user metadata.
- Checkout reads current Stripe subscription history, prevents duplicate subscriptions/repeated trials, and uses a stable database reservation plus Stripe idempotency keys.
- Stripe API version is pinned in `lib/stripe/server.ts`. Billing-period dates come from subscription items. Invoice webhook parsing supports current `parent.subscription_details` and older snapshots.
- Webhook database errors must return a failure so Stripe retries. Refund/dispute/fraud events are recorded for review.
- DOCX HTML must remain sanitized and sandboxed. Never serve raw converted documents under the app origin.
- URL checks must cover resolved addresses and every redirect, including IPv4-mapped IPv6. Do not replace the pinned connection with a second uncontrolled DNS lookup.
- Do not manufacture ATS scores, chart values, trial state, discounts, or saved confirmations.
- Never run the seed utility against production or restore a shared hardcoded test password.
- Job materials and submission records are immutable to app users. Save a new version with fixed request IDs rather than updating a previous version. Keep the exact analysis inputs and submitted résumé/letter references.
- Workspace writes use the shared queue. Check returned Supabase errors and account identity. Database bundle functions must remain atomic and use caller permissions with ownership constraints.
- Native date controls and autofill may not emit React changes. Read submitted control values when saving dates; preserve locally edited fields when refreshing saved workspace data.

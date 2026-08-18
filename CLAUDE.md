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

**Single-page app** — the entire app lives in `app/page.tsx`, which renders one layout with a persistent sidebar and swaps views based on `activeView` state. There is no routing; navigation is purely state-driven. `page.tsx` (and the whole component tree) is a `'use client'` component — the only server-side code is `app/api/analyze/route.ts`. There is no SSR data fetching.

Imports use the `@/*` path alias mapped to the repo root (see `tsconfig.json`), e.g. `@/lib/store`, `@/components/Sidebar`.

### State management (`lib/store.tsx`)
All app state lives in a single React context (`StoreProvider`) powered by `useReducer`, mutated exclusively through dispatched actions (the `Action` union type is the full list of allowed mutations). The store lazy-initializes from `localStorage` and persists slices back via separate `useEffect`s — keys are prefixed `applyiq_` (`applyiq_apps`, `applyiq_resumes`, `applyiq_dark`, `applyiq_pro`, profile fields, and `applyiq_onboarded` which gates the onboarding wizard). Not all state persists (modal/drawer flags, AI results, and the active view are session-only). `SEED_APPS` / `SEED_RESUMES` are the fallback demo data on first load. Exposes derived (non-persisted, recomputed each render) values: `trialDaysLeft`, `showTrialBanner`, `showExpiredBanner`, `urgentCount` (deadlines within 3 days), `selectedApp`. Every component calls `useStore()` — no prop chains.

### AI analysis flow
`components/views/AIAnalysis.tsx` → `POST /api/analyze` (body: **`jobUrl` (required)**, optional `jobDescription` excerpt, `resumeText`) → `app/api/analyze/route.ts` → Anthropic `claude-sonnet-4-6`. The route gives Claude the **`web_fetch_20260209` server tool** so the model fetches and reads the posting URL itself (Sonnet 4.6+ is required for that tool variant's dynamic filtering — this is why the model is no longer Haiku). It handles `pause_turn` by re-sending (bounded), then concatenates the response's text blocks and parses the JSON. The API route is the only place that touches the Anthropic SDK, keeping the key server-side. The prompt instructs the model to return raw JSON matching the `AIResult` shape; `parseAIResponse` (in `lib/ai.ts`) strips fences and falls back to extracting the first `{...}` block. The pasted `jobDescription` is an optional fallback (used to supplement when a page can't be fetched). **If you change the response fields, update both the prompt's JSON template in `route.ts` and the `AIResult` interface in `lib/types.ts` together.**

### Saved-posting expiry detection
Saved jobs are re-checked against their source so a dead link can't sit unnoticed on the board. `components/views/Applications.tsx` "Check links" (and a background sweep fired once per session from `StoreProvider`) → `POST /api/posting-status` with the ids to check → the route reads those rows' URLs **from the caller's own `applications` rows** (never a client-supplied URL — that would make it an open fetch proxy), fetches each with a browser UA and a 12s timeout, and classifies via `lib/postingCheck.ts`:

- `removed` — 404/410, or a soft-404 page ("job not found") served with a 200.
- `expired` — closed-role wording ("no longer accepting applications", "position has been filled"), or a schema.org `validThrough` date in the past.
- `unknown` — blocked (401/403/429), 5xx, timeout, or a non-fetchable URL. **Inconclusive checks never turn into a warning** — a bot-blocking board must not look like a deleted job.
- `active` — otherwise.

`safeFetchUrl` rejects loopback/private/metadata hosts (SSRF guard). Page contents stay server-side; only the verdict is returned. Results land on `Application.postingStatus` / `postingCheckedAt` / `postingNote` via `POSTING_CHECK_DONE`, are written back to Supabase, and drive the indicators: an amber sidebar badge, a dismissible dashboard alert, a Kanban card badge, and a full explanation plus "Re-check" in the detail drawer. `deriveStoreValues` hides all of it for `offer`/`rejected` jobs — a settled job's dead link is just noise. Re-checks are due after `CHECK_TTL_MS` (24h), max `MAX_URLS_PER_CHECK` (25) per request.

**Requires migration `supabase/migrations/0003_posting_status.sql`.** Until it's applied the app still works — postings hydrate as `unknown` and the write-back fails silently.

### Key files
| File | Purpose |
|------|---------|
| `lib/types.ts` | All TypeScript interfaces |
| `lib/store.tsx` | Full state reducer + `StoreProvider` + `useStore` hook |
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

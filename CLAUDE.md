# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run start   # Serve the production build (run after `npm run build`)
npm run lint    # ESLint
```

There is no test suite.

**Requires** a `.env.local` file with `ANTHROPIC_API_KEY=sk-...` (copy from `.env.local.example`). The API route constructs `new Anthropic()` with no arguments, so it reads the key implicitly from this env var.

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Anthropic SDK, Recharts.

**Single-page app** — the entire app lives in `app/page.tsx`, which renders one layout with a persistent sidebar and swaps views based on `activeView` state. There is no routing; navigation is purely state-driven. `page.tsx` (and the whole component tree) is a `'use client'` component — the only server-side code is `app/api/analyze/route.ts`. There is no SSR data fetching.

Imports use the `@/*` path alias mapped to the repo root (see `tsconfig.json`), e.g. `@/lib/store`, `@/components/Sidebar`.

### State management (`lib/store.tsx`)
All app state lives in a single React context (`StoreProvider`) powered by `useReducer`, mutated exclusively through dispatched actions (the `Action` union type is the full list of allowed mutations). The store lazy-initializes from `localStorage` and persists slices back via separate `useEffect`s — keys are prefixed `applyiq_` (`applyiq_apps`, `applyiq_resumes`, `applyiq_dark`, `applyiq_pro`, profile fields, and `applyiq_onboarded` which gates the onboarding wizard). Not all state persists (modal/drawer flags, AI results, and the active view are session-only). `SEED_APPS` / `SEED_RESUMES` are the fallback demo data on first load. Exposes derived (non-persisted, recomputed each render) values: `trialDaysLeft`, `showTrialBanner`, `showExpiredBanner`, `urgentCount` (deadlines within 3 days), `selectedApp`. Every component calls `useStore()` — no prop chains.

### AI analysis flow
`components/views/AIAnalysis.tsx` → `POST /api/analyze` (body: **`jobUrl` (required)**, optional `jobDescription` excerpt, `resumeText`) → `app/api/analyze/route.ts` → Anthropic `claude-sonnet-4-6`. The route gives Claude the **`web_fetch_20260209` server tool** so the model fetches and reads the posting URL itself (Sonnet 4.6+ is required for that tool variant's dynamic filtering — this is why the model is no longer Haiku). It handles `pause_turn` by re-sending (bounded), then concatenates the response's text blocks and parses the JSON. The API route is the only place that touches the Anthropic SDK, keeping the key server-side. The prompt instructs the model to return raw JSON matching the `AIResult` shape; `parseAIResponse` (in `lib/ai.ts`) strips fences and falls back to extracting the first `{...}` block. The pasted `jobDescription` is an optional fallback (used to supplement when a page can't be fetched). **If you change the response fields, update both the prompt's JSON template in `route.ts` and the `AIResult` interface in `lib/types.ts` together.**

### Key files
| File | Purpose |
|------|---------|
| `lib/types.ts` | All TypeScript interfaces |
| `lib/store.tsx` | Full state reducer + `StoreProvider` + `useStore` hook |
| `lib/utils.ts` | Color helpers, status maps, date formatters |
| `app/api/analyze/route.ts` | Claude API proxy (POST) |
| `components/Sidebar.tsx` | 240px nav sidebar with dark mode toggle |
| `components/TrialBanner.tsx` | Sticky top banner (trial active / expired) |
| `components/views/` | Dashboard, Applications (Kanban), AIAnalysis, ResumeVault, Analytics |
| `components/modals/` | OnboardingWizard, DetailDrawer, AddJobModal, PricingModal |

### Styling
Tailwind CSS v4 (CSS-first config — no `tailwind.config.ts`). Design tokens in `app/globals.css` under `@theme`. Dark mode toggles the `dark` class on `<body>` and uses CSS custom properties. Components use **inline styles** matching the pixel-precise design spec, not Tailwind utility classes.

### Design tokens
- Primary accent: `#ec4899` (pink), hover `#be185d`
- Page bg light: `#f5f3f0` / dark: `#0f0e0d`; Card bg light: `#ffffff` / dark: `#1c1b19`
- Font: Plus Jakarta Sans (400/500/600/700/800)
- Card border-radius: 14px; button: 9px; badge: 20px

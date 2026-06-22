# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run lint    # ESLint
```

**Requires** a `.env.local` file with `ANTHROPIC_API_KEY=sk-...` (copy from `.env.local.example`).

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Anthropic SDK, Recharts.

**Single-page app** — the entire app lives in `app/page.tsx`, which renders one layout with a persistent sidebar and swaps views based on `activeView` state. There is no routing; navigation is purely state-driven.

### State management (`lib/store.tsx`)
All app state lives in a single React context (`StoreProvider`) powered by `useReducer`. The store initializes from `localStorage` and persists key slices back to it. Exposes derived values: `trialDaysLeft`, `showTrialBanner`, `showExpiredBanner`, `urgentCount`, `selectedApp`. Every component calls `useStore()` — no prop chains.

### AI analysis flow
`components/views/AIAnalysis.tsx` → `POST /api/analyze` → `app/api/analyze/route.ts` → Anthropic `claude-haiku-4-5`. The API route is the only place that touches the Anthropic SDK, keeping the key server-side.

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

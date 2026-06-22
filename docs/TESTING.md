# ApplyIQ — Unit Test Plan

A complete inventory of the unit tests this project needs.

## Status
**Implemented (52 tests passing):** Vitest is set up (`npm test` / `npm run test:run`). Done so far:
sections **1** (utils), **2** (reducer), **3** (deriveStoreValues), **4** (persistAction),
**5** (parseAIResponse + analyze route), **7** (priceIdForPlan + mapStripeSubscription).
Testability refactors applied: `reducer`/`INITIAL`/`State`/`Action`/`persistAction`/`deriveStoreValues`
exported from `lib/store.tsx`; `parseAIResponse` → `lib/ai.ts`; `mapStripeSubscription` → `lib/stripe/sync.ts`.
**Still TODO:** section **6** (resume parsing — needs `extractText` extraction), **8** (middleware),
**9** (components), **10** (provider integration).

## Setup (installed)
- **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **jsdom** + **@vitejs/plugin-react**.
- Config: `vitest.config.ts` (jsdom env, `@/` alias), `vitest.setup.ts` (jest-dom matchers). Tests live in `test/`.
- Mock the network with `vi.fn()` on `fetch` (or add **msw**) and stub the Supabase / Anthropic / Stripe SDKs.
- Scripts: `npm test` (watch), `npm run test:run` (CI). Add `--coverage` for coverage.

## Testability refactors needed first
These are currently not exported / not isolated, so tests can't reach them:
- [ ] Export `reducer`, `INITIAL`, and `persistAction` from `lib/store.tsx` (reducer is the highest-value unit under test).
- [ ] Extract the analyze-route JSON extraction (fence-strip + brace fallback) into a pure `parseAIResponse(raw): AIResult` helper in `lib/ai.ts` so it can be tested without a network call.
- [ ] Extract resume text extraction (`extractText(bytes, filename)`) from `app/api/resume/parse/route.ts` into `lib/resume.ts` (pure, no Supabase) for unit testing.
- [ ] Extract subscription mapping (`mapStripeSubscription(sub)` → row) from the webhook into `lib/stripe/sync.ts`.

---

## 1. `lib/utils.ts` — pure functions (highest ROI, do first)
- [ ] `getLogoColor` — deterministic: same company string → same color; different strings can differ; returns a value from `LOGO_COLORS`.
- [ ] `getInitial` — first letter uppercased; empty string → safe fallback; non-letter/emoji first char.
- [ ] `getMatchColors` — boundary thresholds (e.g. 0, 64/65, 79/80, 100) return the expected text/bg pair.
- [ ] `daysUntil` — `null` → `null`; today → 0; future date → positive; past date → negative. Use a fixed clock (`vi.setSystemTime`).
- [ ] `formatDeadline` — `null` → placeholder; today/tomorrow phrasing; far-future formatting.
- [ ] `deadlineColor` — overdue vs urgent (≤3 days) vs normal vs null map to correct colors.
- [ ] `todayString` — returns `YYYY-MM-DD` for a fixed clock.
- [ ] `greetingPrefix` — morning/afternoon/evening branches via `vi.setSystemTime`.
- [ ] `STATUS_LABELS` / `STATUS_COLORS` — every `AppStatus` key present and mapped.

## 2. `lib/store.tsx` — reducer (pure) — core business logic
For each action, assert it returns the right next state and **does not mutate** the input:
- [ ] `HYDRATE` — maps payload into state; `loading` → false; `showOnboarding === !onboarded`.
- [ ] `ADD_APP` — prepends to `applications`.
- [ ] `UPDATE_APP_STATUS` / `UPDATE_APP_NOTES` — updates only the matching id, leaves others untouched.
- [ ] `DELETE_APP` — removes by id; closes drawer; clears `selectedAppId`.
- [ ] `OPEN_DETAIL` / `CLOSE_DETAIL` — drawer + `selectedAppId` toggling.
- [ ] `OPEN_ADD_JOB` resets `newJob`; `SET_NEW_JOB` updates one field.
- [ ] `SET_ONBOARDING` / `CLOSE_ONBOARDING`.
- [ ] `AI_START` / `AI_SUCCESS` / `AI_ERROR` (with & without `message`) / `AI_RESET` — flag transitions + `aiErrorMsg` set/cleared; `AI_SUCCESS` sets `activeTab='keywords'`.
- [ ] `SAVE_AI_TO_BOARD` — no-op when `aiResult` null; otherwise prepends a new app built from `aiResult`, sets `activeView='applications'`, generates a UUID id (mock `crypto.randomUUID`).
- [ ] `SET_DEFAULT_RESUME` — exactly one resume ends up `isDefault`.
- [ ] `ADD_RESUME` — prepends.
- [ ] `SET_DARK` / `SET_VIEW` / `SET_BILLING` / `SET_PROFILE` / `SET_TAB` / `SET_COVER_COPIED`.
- [ ] `default` — unknown action returns same reference.

## 3. `lib/store.tsx` — derived values (extract into pure helpers, then test)
Refactor the derivation block into `deriveStoreValues(state, now)` and test:
- [ ] `isPro` true only when subscription status `active`.
- [ ] `trialDaysLeft` from `trialEndsAt` with a fixed `now`; clamps at 0; null subscription → 0.
- [ ] `showTrialBanner` only while trialing with days left.
- [ ] `showExpiredBanner` when not loading, not pro, not trialing.
- [ ] `urgentCount` counts deadlines within 0–3 days inclusive; ignores null/past/far deadlines.
- [ ] `selectedApp` resolves by id; null when not found.

## 4. `lib/store.tsx` — `persistAction` (write-through)
With a mocked Supabase client (assert `.from(table).insert/update/delete/upsert` calls + args):
- [ ] `ADD_APP` / `SAVE_AI_TO_BOARD` → `applications.insert` with snake_cased row from `state.applications[0]`.
- [ ] `UPDATE_APP_STATUS` / `UPDATE_APP_NOTES` → `update(...).eq('id', id)`.
- [ ] `DELETE_APP` → `delete().eq('id', id)`.
- [ ] `ADD_RESUME` → `resumes.insert` with mapped row (incl. `file_path`).
- [ ] `SET_DEFAULT_RESUME` → unset-all then set-one (two updates, correct order).
- [ ] `SET_PROFILE` → `profiles.upsert` with `full_name/job_title/resume_text`.
- [ ] `SET_DARK` / `SET_BILLING` / `CLOSE_ONBOARDING` → profile updates.
- [ ] UI-only actions (`OPEN_DETAIL`, `SET_TAB`, …) → no DB calls.
- [ ] Swallows/logs errors without throwing.

## 5. AI route — `lib/ai.ts` (after extraction) + `app/api/analyze/route.ts`
- [ ] `parseAIResponse` parses clean JSON.
- [ ] strips ```json … ``` fences (regression: the model wraps output in fences).
- [ ] brace-fallback extracts the first `{…}` block from chatty output.
- [ ] throws on unparseable text.
- [ ] route returns 400 when `jobDescription` empty/whitespace.
- [ ] route returns 422 when `stop_reason === 'max_tokens'` (regression: 1024 truncation bug — now 4096).
- [ ] route maps SDK errors → 500 with generic message (SDK mocked).
- [ ] uses default resume text when `resumeText` blank.

## 6. Resume parsing — `lib/resume.ts` (after extraction) + route
- [ ] `.pdf` → uses PDFParse, returns text (mock `pdf-parse`).
- [ ] `.docx` → uses mammoth (mock).
- [ ] `.txt` / `.md` → decodes bytes.
- [ ] unsupported extension → 400.
- [ ] route: unauthenticated → 401; oversize (>10 MB) → 413; storage upload failure → 500; success returns `{ text, filePath, name }` with path prefixed by user id.

## 7. Stripe
- [ ] `lib/stripe/config.ts` `priceIdForPlan('monthly'|'annual')` returns the right env id.
- [ ] checkout route: invalid plan → 400; unauthenticated → 401; reuses existing `stripe_customer_id`; creates customer when missing; session params include `trial_period_days` and `payment_method_collection:'always'` (Stripe mocked).
- [ ] webhook `mapStripeSubscription` → correct snake_case row incl. epoch→ISO conversion for `trial_end`/`current_period_end`, `price_id` from first item.
- [ ] webhook: bad signature → 400; resolves `user_id` from metadata, else from customer lookup; handler error → 500.
- [ ] portal route: unauthenticated → 401; no customer → 400; returns portal url.

## 8. Auth middleware — `lib/supabase/middleware.ts`
- [ ] unauthenticated + protected path → redirect `/login`.
- [ ] unauthenticated + public path (`/`, `/login`, `/register`, `/auth/*`, `/api/stripe/webhook`) → passes through.
- [ ] authenticated on `/login` or `/register` → redirect `/`.
- [ ] authenticated on protected path → passes through.
(Mock `createServerClient().auth.getUser()`.)

## 9. Components (React Testing Library)
- [ ] **LoginPage** — submit calls `signInWithPassword`; error renders; success navigates to `/dashboard` (mock supabase browser client + router).
- [ ] **RegisterPage** — submit calls `signUp` with `emailRedirectTo`; shows "check your email" state on success; renders the pre-charge trial notice; error path.
- [ ] **AddJobModal** — Add disabled until company+role filled; submit dispatches `ADD_APP` (UUID id) + `CLOSE_ADD_JOB`.
- [ ] **AIAnalysis** — Analyze disabled when description empty; success path renders match ring + tabs; error path shows `aiErrorMsg`; "Try Again" re-invokes analyze; tab switching; copy-cover-letter uses clipboard (mocked).
- [ ] **ResumeVault** — upload posts to `/api/resume/parse`, dispatches `ADD_RESUME` on success, shows error on failure; first resume becomes default; Set-as-Default wiring.
- [ ] **OnboardingWizard** — step navigation; "Upload" fills the textarea from parse response; finish dispatches `SET_PROFILE` + `CLOSE_ONBOARDING`.
- [ ] **PricingModal** — selecting a paid plan POSTs `/api/stripe/checkout` with `billingCycle` and redirects to returned url; billing toggle updates state; free plan disabled.
- [ ] **TrialBanner** — renders trial vs expired vs nothing based on store flags.
- [ ] **Sidebar** — renders nav items, highlights `activeView`, dark-mode toggle dispatches `SET_DARK`, upgrade opens pricing.

## 10. Store integration (Provider)
- [ ] `StoreProvider` hydrates from mocked Supabase on mount (profile/apps/resumes/subscription) and exposes them via `useStore`.
- [ ] `useStore` throws when used outside the provider.
- [ ] dispatching a data action triggers both reducer update and a `persistAction` write (spy).
- [ ] `?checkout=success` re-fetches the subscription after the delay (fake timers).

---

### Priority order
1. Sections **1–3** (pure functions + reducer + derivations) — fastest, catch the most regressions, no mocking.
2. Section **5** (AI parsing/truncation — the bug just fixed) and **7** (billing correctness — money).
3. Sections **4, 6, 8**.
4. Section **9–10** (component/integration).

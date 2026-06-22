-- ApplyIQ — Claude API usage + cost tracking (Phase 4)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Until this is applied, the cost tracker fails open (analysis still works, tracking no-ops).

-- ─────────────────────────────────────────────────────────────────────────────
-- api_usage  (one row per completed Claude API call)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.api_usage (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  feature            text not null,
  model              text not null,
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cost_usd           numeric(12,6) not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists api_usage_user_created_idx on public.api_usage(user_id, created_at);
create index if not exists api_usage_created_idx       on public.api_usage(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- api_rate_limit_hits  (one row each time a user is blocked by a limit)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.api_rate_limit_hits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  feature    text,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists api_rate_limit_hits_user_created_idx on public.api_rate_limit_hits(user_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: users may read their own usage; all writes go through the service-role
-- client (the cost tracker), which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.api_usage           enable row level security;
alter table public.api_rate_limit_hits enable row level security;

drop policy if exists "api_usage_select_own" on public.api_usage;
create policy "api_usage_select_own" on public.api_usage for select using (auth.uid() = user_id);

drop policy if exists "api_rate_limit_hits_select_own" on public.api_rate_limit_hits;
create policy "api_rate_limit_hits_select_own" on public.api_rate_limit_hits for select using (auth.uid() = user_id);

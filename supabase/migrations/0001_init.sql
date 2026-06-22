-- ApplyIQ initial schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type app_status as enum ('saved', 'applied', 'interview', 'offer', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_status as enum (
    'trialing', 'active', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  );
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles  (one row per auth user)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  job_title    text not null default '',
  resume_text  text not null default '',
  dark_mode    boolean not null default false,
  onboarded    boolean not null default false,
  billing_cycle text not null default 'annual',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- applications
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company     text not null default '',
  role        text not null default '',
  status      app_status not null default 'saved',
  match       integer not null default 0 check (match between 0 and 100),
  deadline    date,
  url         text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists applications_user_id_idx on public.applications(user_id);

drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- resumes
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.resumes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default '',
  file_path    text,                         -- path in the 'resumes' storage bucket (nullable: text-only resumes)
  text         text not null default '',     -- extracted/pasted resume text
  jobs_matched integer not null default 0,
  ats_score    integer not null default 0,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists resumes_user_id_idx on public.resumes(user_id);

drop trigger if exists resumes_updated_at on public.resumes;
create trigger resumes_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- subscriptions  (Stripe state mirror; populated by webhooks in Phase 3)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  price_id               text,
  status                 sub_status,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create a profile row when a new auth user signs up
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security: a user can only touch their own rows
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.applications  enable row level security;
alter table public.resumes       enable row level security;
alter table public.subscriptions enable row level security;

-- profiles (keyed by id = auth.uid())
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- applications
drop policy if exists "applications_all_own" on public.applications;
create policy "applications_all_own" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- resumes
drop policy if exists "resumes_all_own" on public.resumes;
create policy "resumes_all_own" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subscriptions: users may read their own; only service role writes (via webhooks)
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for resume files (private). Users access only their own folder,
-- where the first path segment is their user id, e.g. "<uid>/my-resume.pdf".
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resumes_storage_select_own" on storage.objects;
create policy "resumes_storage_select_own" on storage.objects for select
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "resumes_storage_insert_own" on storage.objects;
create policy "resumes_storage_insert_own" on storage.objects for insert
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "resumes_storage_update_own" on storage.objects;
create policy "resumes_storage_update_own" on storage.objects for update
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "resumes_storage_delete_own" on storage.objects;
create policy "resumes_storage_delete_own" on storage.objects for delete
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

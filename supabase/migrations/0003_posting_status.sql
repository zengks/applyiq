-- ApplyIQ — saved-posting health (expired / removed detection)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Until this is applied, the app still works: postings hydrate as 'unknown' and
-- the write-back from a link check fails silently (persistAction logs it).

do $$ begin
  create type posting_status as enum ('active', 'expired', 'removed', 'unknown');
exception when duplicate_object then null; end $$;

alter table public.applications
  add column if not exists posting_status     posting_status not null default 'unknown',
  add column if not exists posting_checked_at timestamptz,
  add column if not exists posting_note       text not null default '';

comment on column public.applications.posting_status is
  'Result of the last link check against the source posting (see lib/postingCheck.ts).';
comment on column public.applications.posting_checked_at is
  'When the posting URL was last checked; null means never.';
comment on column public.applications.posting_note is
  'Human-readable reason behind posting_status, shown in the UI.';

-- Lets the background sweep find the postings that are due for a re-check.
create index if not exists applications_posting_checked_idx
  on public.applications(user_id, posting_checked_at);

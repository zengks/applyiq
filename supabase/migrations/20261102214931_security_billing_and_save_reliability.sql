-- Apply after 0001/0002. Includes 0003 for installations that missed it.
do $$ begin
  create type public.posting_status as enum ('active', 'expired', 'removed', 'unknown');
exception when duplicate_object then null; end $$;
alter table public.applications
  add column if not exists posting_status public.posting_status not null default 'unknown',
  add column if not exists posting_checked_at timestamptz,
  add column if not exists posting_note text not null default '';
create index if not exists applications_posting_checked_idx on public.applications(user_id, posting_checked_at);

alter function public.set_updated_at() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter policy profiles_update_own on public.profiles to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy profiles_insert_own on public.profiles to authenticated;
alter policy profiles_select_own on public.profiles to authenticated;
alter policy applications_all_own on public.applications to authenticated;
alter policy resumes_all_own on public.resumes to authenticated;
alter policy subscriptions_select_own on public.subscriptions to authenticated;
alter policy api_usage_select_own on public.api_usage to authenticated;
alter policy api_rate_limit_hits_select_own on public.api_rate_limit_hits to authenticated;
alter policy resumes_storage_select_own on storage.objects to authenticated;
alter policy resumes_storage_insert_own on storage.objects to authenticated;
alter policy resumes_storage_delete_own on storage.objects to authenticated;
alter policy resumes_storage_update_own on storage.objects to authenticated
  using (bucket_id = 'resumes' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'resumes' and (select auth.uid())::text = (storage.foldername(name))[1]);
update storage.buckets set file_size_limit = 10485760 where id = 'resumes';

-- RLS applies to this invoker function just as it does to direct table reads.
create or replace function public.has_pro_access(account_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.subscriptions where user_id = account_id
    and (status = 'active' or (status = 'trialing' and trial_ends_at > now())));
$$;
revoke all on function public.has_pro_access(uuid) from public, anon;
grant execute on function public.has_pro_access(uuid) to authenticated, service_role;

create or replace function public.enforce_record_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare total integer; paid boolean;
begin
  if auth.uid() is null then return new; end if;
  if auth.uid() <> new.user_id then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  paid := public.has_pro_access(new.user_id);
  if tg_table_name = 'applications' then
    if exists(select 1 from public.applications where id = new.id and user_id = new.user_id) then return new; end if;
    select count(*) into total from public.applications where user_id = new.user_id;
    if not paid and total >= 5 then raise exception 'Plan limit: Free includes 5 applications. Upgrade or remove a saved application.'; end if;
  else
    if exists(select 1 from public.resumes where id = new.id and user_id = new.user_id) then return new; end if;
    select count(*) into total from public.resumes where user_id = new.user_id;
    if total >= (case when paid then 3 else 1 end) then raise exception 'Plan limit: Free includes 1 resume and Pro includes 3. Remove a resume or upgrade.'; end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_record_limit() from public, anon;
drop trigger if exists applications_plan_limit on public.applications;
create trigger applications_plan_limit before insert on public.applications for each row execute function public.enforce_record_limit();
drop trigger if exists resumes_plan_limit on public.resumes;
create trigger resumes_plan_limit before insert on public.resumes for each row execute function public.enforce_record_limit();

-- One transaction, with ownership checked before changing the old default.
create or replace function public.set_default_resume(resume_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare selected_text text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select text into selected_text from public.resumes where id = resume_id and user_id = auth.uid();
  if not found then raise exception 'Resume not found'; end if;
  update public.resumes set is_default = false where user_id = auth.uid() and is_default;
  update public.resumes set is_default = true where id = resume_id and user_id = auth.uid();
  update public.profiles set resume_text = selected_text where id = auth.uid();
end $$;
revoke all on function public.set_default_resume(uuid) from public, anon;
grant execute on function public.set_default_resume(uuid) to authenticated;

create table if not exists public.api_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);
create index if not exists api_analysis_requests_user_created_idx on public.api_analysis_requests(user_id, created_at);
alter table public.api_analysis_requests enable row level security;
revoke all on public.api_analysis_requests from anon, authenticated;
grant all on public.api_analysis_requests to service_role;

-- Only the server can reserve usage. Advisory locks make parallel requests count.
create or replace function public.reserve_ai_analysis(account_id uuid, feature_name text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare paid boolean; hourly integer; monthly integer; spend numeric; reservation uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  paid := public.has_pro_access(account_id);
  select count(*) into hourly from public.api_analysis_requests where user_id = account_id and created_at >= now() - interval '1 hour';
  if hourly >= (case when paid then 30 else 5 end) then raise exception 'Usage limit: Too many analyses this hour. Please wait and try again.'; end if;
  select count(*) into monthly from public.api_analysis_requests where user_id = account_id and created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  if not paid and monthly >= 3 then raise exception 'Usage limit: Free includes 3 AI requests per calendar month. Upgrade for more.'; end if;
  select coalesce(sum(cost_usd),0) into spend from public.api_usage where user_id = account_id and created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  if spend >= 50 then raise exception 'Usage limit: Your monthly AI fair-use budget has been reached.'; end if;
  insert into public.api_analysis_requests(user_id, feature) values(account_id, feature_name) returning id into reservation;
  return reservation;
end $$;
revoke all on function public.reserve_ai_analysis(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis(uuid, text) to service_role;

create table if not exists public.billing_checkouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request_id uuid not null default gen_random_uuid(),
  plan text not null check (plan in ('monthly', 'annual')),
  expires_at timestamptz not null
);
alter table public.billing_checkouts enable row level security;
revoke all on public.billing_checkouts from anon, authenticated;
grant all on public.billing_checkouts to service_role;

create or replace function public.begin_billing_checkout(account_id uuid, selected_plan text)
returns setof public.billing_checkouts language plpgsql security invoker set search_path = '' as $$
declare checkout public.billing_checkouts;
begin
  if selected_plan not in ('monthly','annual') then raise exception 'Invalid plan'; end if;
  perform pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  select * into checkout from public.billing_checkouts where user_id = account_id;
  if found and checkout.expires_at > now() + interval '1 minute' then
    if checkout.plan <> selected_plan then raise exception 'Checkout already started for another billing cycle. Finish it or wait 30 minutes before switching.'; end if;
    return next checkout;
    return;
  end if;
  insert into public.billing_checkouts(user_id,plan,expires_at) values(account_id,selected_plan,date_trunc('second',now()) + interval '31 minutes')
    on conflict (user_id) do update set plan = excluded.plan, expires_at = excluded.expires_at, request_id = gen_random_uuid()
    returning * into checkout;
  return next checkout;
end $$;
revoke all on function public.begin_billing_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_billing_checkout(uuid, text) to service_role;

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  requires_review boolean not null default false,
  processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

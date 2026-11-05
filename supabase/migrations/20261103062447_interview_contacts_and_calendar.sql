-- Additive scheduling/contact records. No billing, usage, or existing records change.
create table public.application_contacts (
  id uuid primary key,
  application_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  role text not null default '' check (length(role) <= 200),
  email text not null default '' check (length(email) <= 320 and (email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text not null default '' check (length(phone) <= 100),
  profile_url text not null default '' check (length(profile_url) <= 2048 and (profile_url = '' or profile_url ~ '^https?://[^[:space:][:cntrl:]]+$')),
  notes text not null default '' check (length(notes) <= 10000),
  archived boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id,user_id) references public.applications(id,user_id) on delete cascade,
  unique (id,application_id,user_id)
);
create index application_contacts_owner_job_idx on public.application_contacts(user_id,application_id,created_at);
create index application_contacts_job_idx on public.application_contacts(application_id,user_id);
create table public.application_interviews (
  id uuid primary key,
  application_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null check (length(time_zone) between 1 and 100),
  local_start text not null,
  local_end text not null,
  utc_offset_seconds integer not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  location text not null default '' check (length(location) <= 500),
  meeting_url text not null default '' check (length(meeting_url) <= 2048 and (meeting_url = '' or meeting_url ~ '^https?://[^[:space:][:cntrl:]]+$')),
  notes text not null default '' check (length(notes) <= 10000),
  contact_id uuid,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id,user_id) references public.applications(id,user_id) on delete cascade,
  foreign key (contact_id,application_id,user_id) references public.application_contacts(id,application_id,user_id) on delete set null (contact_id),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  check (starts_at >= timestamptz '1900-01-01 00:00:00+00' and ends_at < timestamptz '10000-01-01 00:00:00+00')
);
create index application_interviews_owner_start_idx on public.application_interviews(user_id,starts_at);
create index application_interviews_job_idx on public.application_interviews(application_id,user_id);
create index application_interviews_contact_idx on public.application_interviews(contact_id,application_id,user_id);

alter table public.application_contacts enable row level security;
alter table public.application_interviews enable row level security;
revoke all on public.application_contacts,public.application_interviews from anon,authenticated;
grant select,insert,update,delete on public.application_contacts,public.application_interviews to authenticated;
grant all on public.application_contacts,public.application_interviews to service_role;
create policy contacts_owner on public.application_contacts for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy interviews_owner on public.application_interviews for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Parent lock bounds records to 100 of each kind per job, including concurrent inserts.
-- Identity is immutable; timestamps/revisions are server maintained. Identical retry
-- payloads retain their revision, avoiding extra calendar updates after a lost response.
create function public.guard_application_planning() returns trigger language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
  if tg_op='UPDATE' then
    if (new.id,new.application_id,new.user_id) is distinct from (old.id,old.application_id,old.user_id) then
      raise exception 'Record ownership cannot change';
    end if;
    new.created_at:=old.created_at;
    if (to_jsonb(new)-'revision'-'updated_at'-'created_at'-'local_start'-'local_end'-'utc_offset_seconds') is distinct from (to_jsonb(old)-'revision'-'updated_at'-'created_at'-'local_start'-'local_end'-'utc_offset_seconds') then
      new.revision:=old.revision+1; new.updated_at:=clock_timestamp();
    else new.revision:=old.revision; new.updated_at:=old.updated_at;
    end if;
  else
    perform 1 from public.applications where id=new.application_id and user_id=new.user_id for update;
    if not found then raise exception 'Application not found'; end if;
    if tg_table_name='application_contacts' then
      select count(*) into total from public.application_contacts where application_id=new.application_id;
    else
      select count(*) into total from public.application_interviews where application_id=new.application_id;
    end if;
    if total>=100 then raise exception 'This job has reached its limit of 100 records of this kind'; end if;
    new.revision:=0; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at;
  end if;
  if tg_table_name='application_interviews' then
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.time_zone) then raise exception 'Choose a valid IANA time zone'; end if;
    new.local_start:=to_char(new.starts_at at time zone new.time_zone,'YYYY-MM-DD"T"HH24:MI');
    new.local_end:=to_char(new.ends_at at time zone new.time_zone,'YYYY-MM-DD"T"HH24:MI');
    new.utc_offset_seconds:=extract(epoch from ((new.starts_at at time zone new.time_zone)-(new.starts_at at time zone 'UTC')))::integer;
  end if;
  return new;
end;
$$;
create trigger contacts_guard before insert or update on public.application_contacts for each row execute function public.guard_application_planning();
create trigger interviews_guard before insert or update on public.application_interviews for each row execute function public.guard_application_planning();
revoke all on function public.guard_application_planning() from public,anon,authenticated;

-- Optimistic concurrency plus idempotent retries, with caller RLS throughout.
create function public.save_job_contact(record_id uuid,job_id uuid,details jsonb,expected_revision integer default null)
returns public.application_contacts language plpgsql security invoker set search_path='' as $$
declare existing public.application_contacts; wanted public.application_contacts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(details) is distinct from 'object' then raise exception 'Invalid record'; end if;
  perform 1 from public.applications where id=job_id and user_id=auth.uid() for update;
  if not found then raise exception 'Application not found'; end if;
  wanted.name:=details->>'name';
  wanted.role:=coalesce(details->>'role','');
  wanted.email:=coalesce(details->>'email','');
  wanted.phone:=coalesce(details->>'phone','');
  wanted.profile_url:=coalesce(details->>'profile_url','');
  wanted.notes:=coalesce(details->>'notes','');
  wanted.archived:=coalesce((details->>'archived')::boolean,false);
  select * into existing from public.application_contacts where id=record_id for update;
  if found then
    if existing.application_id<>job_id or existing.user_id<>auth.uid() then raise exception 'Record does not belong to this job'; end if;
    if existing.name is not distinct from wanted.name and existing.role is not distinct from wanted.role and existing.email is not distinct from wanted.email and existing.phone is not distinct from wanted.phone and existing.profile_url is not distinct from wanted.profile_url and existing.notes is not distinct from wanted.notes and existing.archived is not distinct from wanted.archived then return existing; end if;
    if expected_revision is null or existing.revision<>expected_revision then
      raise exception 'Record changed elsewhere. Reload saved data and review your edits.';
    end if;
    update public.application_contacts set name=wanted.name, role=wanted.role, email=wanted.email, phone=wanted.phone, profile_url=wanted.profile_url, notes=wanted.notes, archived=wanted.archived where id=record_id returning * into wanted;
  else
    if expected_revision is not null then raise exception 'Record removed elsewhere. Reload saved data.'; end if;
    insert into public.application_contacts (id,application_id,user_id,name, role, email, phone, profile_url, notes, archived)
      values (record_id,job_id,auth.uid(),details->>'name', coalesce(details->>'role',''), coalesce(details->>'email',''), coalesce(details->>'phone',''), coalesce(details->>'profile_url',''), coalesce(details->>'notes',''), coalesce((details->>'archived')::boolean,false)) returning * into wanted;
  end if;
  return wanted;
end;
$$;
revoke all on function public.save_job_contact(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_job_contact(uuid,uuid,jsonb,integer) to authenticated;

-- Optimistic concurrency plus idempotent retries, with caller RLS throughout.
create function public.save_job_interview(record_id uuid,job_id uuid,details jsonb,expected_revision integer default null)
returns public.application_interviews language plpgsql security invoker set search_path='' as $$
declare existing public.application_interviews; wanted public.application_interviews;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(details) is distinct from 'object' then raise exception 'Invalid record'; end if;
  perform 1 from public.applications where id=job_id and user_id=auth.uid() for update;
  if not found then raise exception 'Application not found'; end if;
  wanted.title:=details->>'title';
  wanted.starts_at:=(details->>'starts_at')::timestamptz;
  wanted.ends_at:=(details->>'ends_at')::timestamptz;
  wanted.time_zone:=details->>'time_zone';
  wanted.status:=coalesce(details->>'status','scheduled');
  wanted.location:=coalesce(details->>'location','');
  wanted.meeting_url:=coalesce(details->>'meeting_url','');
  wanted.notes:=coalesce(details->>'notes','');
  wanted.contact_id:=nullif(details->>'contact_id','')::uuid;
  select * into existing from public.application_interviews where id=record_id for update;
  if found then
    if existing.application_id<>job_id or existing.user_id<>auth.uid() then raise exception 'Record does not belong to this job'; end if;
    if existing.title is not distinct from wanted.title and existing.starts_at is not distinct from wanted.starts_at and existing.ends_at is not distinct from wanted.ends_at and existing.time_zone is not distinct from wanted.time_zone and existing.status is not distinct from wanted.status and existing.location is not distinct from wanted.location and existing.meeting_url is not distinct from wanted.meeting_url and existing.notes is not distinct from wanted.notes and existing.contact_id is not distinct from wanted.contact_id then return existing; end if;
    if expected_revision is null or existing.revision<>expected_revision then
      raise exception 'Record changed elsewhere. Reload saved data and review your edits.';
    end if;
    update public.application_interviews set title=wanted.title, starts_at=wanted.starts_at, ends_at=wanted.ends_at, time_zone=wanted.time_zone, status=wanted.status, location=wanted.location, meeting_url=wanted.meeting_url, notes=wanted.notes, contact_id=wanted.contact_id where id=record_id returning * into wanted;
  else
    if expected_revision is not null then raise exception 'Record removed elsewhere. Reload saved data.'; end if;
    insert into public.application_interviews (id,application_id,user_id,title, starts_at, ends_at, time_zone, status, location, meeting_url, notes, contact_id)
      values (record_id,job_id,auth.uid(),details->>'title', (details->>'starts_at')::timestamptz, (details->>'ends_at')::timestamptz, details->>'time_zone', coalesce(details->>'status','scheduled'), coalesce(details->>'location',''), coalesce(details->>'meeting_url',''), coalesce(details->>'notes',''), nullif(details->>'contact_id','')::uuid) returning * into wanted;
  end if;
  return wanted;
end;
$$;
revoke all on function public.save_job_interview(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_job_interview(uuid,uuid,jsonb,integer) to authenticated;

-- Use the upgraded database's tzdata, rather than a browser/OS's stale rules.
-- Candidate offsets on either side of a transition expose gaps and repeated times.
create function public.resolve_interview_time(local_time text,zone_name text,occurrence text default 'reject')
returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare wall timestamp; guess timestamptz; candidates timestamptz[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if local_time !~ '^([1-9][0-9]{3})-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' or local_time<'1900' then raise exception 'Choose a valid interview date and time'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone_name) then raise exception 'Choose a valid IANA time zone'; end if;
  if occurrence not in ('reject','earlier','later') or occurrence is null then raise exception 'Invalid repeated-time choice'; end if;
  wall:=local_time::timestamp;
  guess:=wall at time zone zone_name;
  select array_agg(distinct candidate order by candidate) into candidates from (
    select (wall-((probe at time zone zone_name)-(probe at time zone 'UTC'))) at time zone 'UTC' as candidate
    from (values(guess-interval '2 days'),(guess),(guess+interval '2 days')) offsets(probe)
  ) choices where candidate at time zone zone_name=wall;
  if coalesce(array_length(candidates,1),0)=0 then raise exception 'That local time does not exist because the clocks move forward. Choose another time.'; end if;
  if array_length(candidates,1)>1 and occurrence='reject' then raise exception 'That time occurs twice when the clocks move back. Choose the earlier or later occurrence.'; end if;
  return candidates[case when occurrence='later' then array_length(candidates,1) else 1 end];
end;
$$;
revoke all on function public.resolve_interview_time(text,text,text) from public,anon;
grant execute on function public.resolve_interview_time(text,text,text) to authenticated;

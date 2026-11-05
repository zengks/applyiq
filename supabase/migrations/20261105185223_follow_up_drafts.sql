-- Both optional links must belong to the same job and account as the draft.
alter table public.application_interviews add constraint application_interviews_id_job_owner_key
  unique (id, application_id, user_id);

create table public.application_follow_up_drafts (
  id uuid primary key,
  application_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('thank_you', 'check_in')),
  contact_id uuid,
  interview_id uuid,
  subject text not null check (length(btrim(subject)) between 1 and 200 and subject !~ '[[:cntrl:]]'),
  body text not null check (length(body) <= 10000 and body ~ '[^[:space:]]'),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  foreign key (contact_id, application_id, user_id) references public.application_contacts(id, application_id, user_id) on delete set null (contact_id),
  foreign key (interview_id, application_id, user_id) references public.application_interviews(id, application_id, user_id) on delete set null (interview_id)
);

create index application_follow_up_drafts_job_idx on public.application_follow_up_drafts(application_id, user_id, updated_at desc, id);
create index application_follow_up_drafts_contact_idx on public.application_follow_up_drafts(contact_id, application_id, user_id) where contact_id is not null;
create index application_follow_up_drafts_interview_idx on public.application_follow_up_drafts(interview_id, application_id, user_id) where interview_id is not null;

alter table public.application_follow_up_drafts enable row level security;
revoke all on public.application_follow_up_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.application_follow_up_drafts to authenticated;
grant all on public.application_follow_up_drafts to service_role;
create policy follow_up_drafts_owner on public.application_follow_up_drafts
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.guard_application_follow_up_draft() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- Serialize per-job inserts, including direct authenticated Data API writes.
    perform 1 from public.applications where id = new.application_id and user_id = new.user_id for update;
    if not found then raise exception 'Application not found'; end if;
    if (select count(*) from public.application_follow_up_drafts where application_id = new.application_id and user_id = new.user_id) >= 100 then
      raise exception 'This job has reached its limit of 100 follow-up drafts';
    end if;
    new.revision := 0;
    new.updated_at := clock_timestamp();
  else
    if (new.id, new.application_id, new.user_id) is distinct from (old.id, old.application_id, old.user_id) then
      raise exception 'Draft ownership cannot change';
    end if;
    if (new.kind, new.contact_id, new.interview_id, new.subject, new.body)
      is distinct from (old.kind, old.contact_id, old.interview_id, old.subject, old.body) then
      new.revision := old.revision + 1;
      new.updated_at := clock_timestamp();
    else
      new.revision := old.revision;
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger follow_up_drafts_guard before insert or update on public.application_follow_up_drafts
  for each row execute function public.guard_application_follow_up_draft();
revoke all on function public.guard_application_follow_up_draft() from public, anon, authenticated;

-- Preserve the same draft after a network retry and reject edits based on stale text.
create function public.save_job_follow_up_draft(record_id uuid, job_id uuid, details jsonb, expected_revision integer default null)
returns public.application_follow_up_drafts language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  existing public.application_follow_up_drafts;
  wanted public.application_follow_up_drafts;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(details) is distinct from 'object' then raise exception 'Invalid draft'; end if;
  perform 1 from public.applications where id = job_id and user_id = owner_id for update;
  if not found then raise exception 'Application not found'; end if;

  wanted.kind := details->>'kind';
  wanted.contact_id := (details->>'contact_id')::uuid;
  wanted.interview_id := (details->>'interview_id')::uuid;
  wanted.subject := details->>'subject';
  wanted.body := details->>'body';

  select * into existing from public.application_follow_up_drafts where id = record_id and application_id = job_id and user_id = owner_id for update;
  if found then
    if (existing.kind, existing.contact_id, existing.interview_id, existing.subject, existing.body)
      is not distinct from (wanted.kind, wanted.contact_id, wanted.interview_id, wanted.subject, wanted.body) then
      return existing;
    end if;
    if existing.revision is distinct from expected_revision then
      raise exception 'Draft changed elsewhere. Reload saved data and review your edits.';
    end if;
    update public.application_follow_up_drafts
      set kind = wanted.kind, contact_id = wanted.contact_id, interview_id = wanted.interview_id, subject = wanted.subject, body = wanted.body
      where id = record_id returning * into wanted;
  else
    if expected_revision is not null then raise exception 'Draft removed elsewhere. Reload saved data.'; end if;
    insert into public.application_follow_up_drafts(id, application_id, user_id, kind, contact_id, interview_id, subject, body)
      values (record_id, job_id, owner_id, wanted.kind, wanted.contact_id, wanted.interview_id, wanted.subject, wanted.body)
      returning * into wanted;
  end if;
  return wanted;
end;
$$;
revoke all on function public.save_job_follow_up_draft(uuid, uuid, jsonb, integer) from public, anon;
grant execute on function public.save_job_follow_up_draft(uuid, uuid, jsonb, integer) to authenticated;

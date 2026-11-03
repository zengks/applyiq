-- Additive application workspaces. Existing postings remain uncaptured until
-- the user saves text; historical status changes are not fabricated.
alter table public.applications
  add column description text not null default '' check (length(description) <= 60000),
  add column captured_at timestamptz,
  add column applied_at date,
  add column next_action text not null default '' check (length(next_action) <= 500),
  add column next_action_due date,
  add column next_action_done boolean not null default false,
  add column selected_resume_id uuid,
  add constraint applications_id_owner_key unique (id, user_id);

create table public.application_materials (
  id uuid primary key,
  application_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('resume', 'analysis', 'cover_letter')),
  title text not null check (length(title) between 1 and 200),
  body jsonb not null check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 600000),
  created_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  unique (id, application_id, user_id),
  check (case kind
    when 'resume' then jsonb_typeof(body->'text') = 'string' and length(body->>'text') between 1 and 60000 and jsonb_typeof(body->'name') = 'string'
    when 'cover_letter' then jsonb_typeof(body->'text') = 'string' and length(body->>'text') between 1 and 30000
    when 'analysis' then jsonb_typeof(body->'result') = 'object'
    else false end is true)
);
create index application_materials_owner_job_idx on public.application_materials(user_id, application_id, created_at desc);
create index application_materials_job_idx on public.application_materials(application_id, user_id);

alter table public.applications add constraint application_selected_resume_fk
  foreign key (selected_resume_id, id, user_id) references public.application_materials(id, application_id, user_id)
  deferrable initially deferred;

create table public.application_submissions (
  id uuid primary key,
  application_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_version_id uuid not null,
  cover_letter_version_id uuid,
  submitted_on date not null,
  created_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  foreign key (resume_version_id, application_id, user_id) references public.application_materials(id, application_id, user_id),
  foreign key (cover_letter_version_id, application_id, user_id) references public.application_materials(id, application_id, user_id)
);
create index application_submissions_owner_job_idx on public.application_submissions(user_id, application_id, created_at desc);
create index application_submissions_resume_idx on public.application_submissions(resume_version_id, application_id, user_id);
create index application_submissions_letter_idx on public.application_submissions(cover_letter_version_id, application_id, user_id);
create index application_submissions_job_idx on public.application_submissions(application_id, user_id);
create index applications_selected_resume_idx on public.applications(selected_resume_id, id, user_id);

create table public.application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.app_status not null,
  created_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade
);
create index application_status_events_owner_job_idx on public.application_status_events(user_id, application_id, created_at desc);
create index application_status_events_job_idx on public.application_status_events(application_id, user_id);

alter table public.application_materials enable row level security;
alter table public.application_submissions enable row level security;
alter table public.application_status_events enable row level security;
revoke all on public.application_materials, public.application_submissions, public.application_status_events from anon, authenticated;
grant select, insert on public.application_materials, public.application_submissions, public.application_status_events to authenticated;
grant all on public.application_materials, public.application_submissions, public.application_status_events to service_role;

create policy materials_read on public.application_materials for select to authenticated using ((select auth.uid()) = user_id);
create policy materials_insert on public.application_materials for insert to authenticated with check ((select auth.uid()) = user_id);
create policy submissions_read on public.application_submissions for select to authenticated using ((select auth.uid()) = user_id);
create policy submissions_insert on public.application_submissions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy events_read on public.application_status_events for select to authenticated using ((select auth.uid()) = user_id);
create policy events_insert on public.application_status_events for insert to authenticated with check ((select auth.uid()) = user_id);

-- All insert paths take the parent lock, bounding storage and making RPC retries safe.
create function public.guard_application_material() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.applications where id = new.application_id and user_id = new.user_id for update;
  if not found then raise exception 'Application not found'; end if;
  if (select count(*) from public.application_materials where application_id = new.application_id) >= 200
    and not exists (select 1 from public.application_materials where id = new.id) then
    raise exception 'This workspace has reached its 200 saved-version limit';
  end if;
  return new;
end $$;
create trigger guard_application_material before insert on public.application_materials for each row execute function public.guard_application_material();

create function public.guard_application_submission() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.application_materials where id = new.resume_version_id and application_id = new.application_id and user_id = new.user_id and kind = 'resume') then
    raise exception 'Choose a resume version from this application';
  end if;
  if new.cover_letter_version_id is not null and not exists (select 1 from public.application_materials where id = new.cover_letter_version_id and application_id = new.application_id and user_id = new.user_id and kind = 'cover_letter') then
    raise exception 'Choose a cover letter from this application';
  end if;
  return new;
end $$;
create trigger guard_application_submission before insert on public.application_submissions for each row execute function public.guard_application_submission();

create function public.track_application_status() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_status_events(application_id,user_id,status) values (new.id,new.user_id,new.status);
  end if;
  return new;
end $$;
create trigger track_application_status after insert or update of status on public.applications for each row execute function public.track_application_status();

create function public.save_application_material(record_id uuid, job_id uuid, material_kind text, material_title text, material_body jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare existing public.application_materials;
begin
  perform 1 from public.applications where id = job_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Application not found'; end if;
  select * into existing from public.application_materials where id = record_id;
  if found then
    if existing.application_id <> job_id or existing.kind <> material_kind or existing.title <> material_title or existing.body <> material_body then raise exception 'Saved versions cannot be overwritten'; end if;
    return;
  end if;
  insert into public.application_materials(id,application_id,user_id,kind,title,body)
    values(record_id,job_id,(select auth.uid()),material_kind,material_title,material_body);
  if material_kind = 'resume' then
    update public.applications set selected_resume_id = record_id where id = job_id;
  end if;
end $$;

create function public.save_application_analysis(job_id uuid, resume_record uuid, analysis_record uuid, letter_record uuid, resume_snapshot jsonb, analysis_result jsonb, posting_text text, source_url text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.applications where id = job_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Application not found'; end if;
  if resume_snapshot is not null then
    perform public.save_application_material(resume_record,job_id,'resume',left(resume_snapshot->>'name',200),resume_snapshot);
  end if;
  if resume_record is not null and not exists (select 1 from public.application_materials where id=resume_record and application_id=job_id and kind='resume') then raise exception 'Resume version does not belong to this application'; end if;
  perform public.save_application_material(analysis_record,job_id,'analysis','AI analysis',jsonb_build_object('result',analysis_result,'resumeVersionId',resume_record,'jobDescription',posting_text,'jobUrl',source_url));
  if length(coalesce(analysis_result->>'coverLetter','')) > 0 then
    perform public.save_application_material(letter_record,job_id,'cover_letter','AI cover letter',jsonb_build_object('text',analysis_result->>'coverLetter','analysisVersionId',analysis_record));
  end if;
  update public.applications set
    match = coalesce((analysis_result->>'matchScore')::integer,match),
    description = case when description = '' then left(posting_text,60000) else description end,
    captured_at = case when description = '' and length(posting_text)>0 then now() else captured_at end,
    selected_resume_id = coalesce(resume_record,selected_resume_id)
  where id=job_id;
end $$;

create function public.record_application_submission(record_id uuid, job_id uuid, resume_version uuid, cover_version uuid, submission_date date)
returns void language plpgsql security invoker set search_path = '' as $$
declare existing public.application_submissions;
begin
  perform 1 from public.applications where id = job_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Application not found'; end if;
  select * into existing from public.application_submissions where id=record_id;
  if found then
    if existing.application_id <> job_id or existing.resume_version_id <> resume_version or existing.cover_letter_version_id is distinct from cover_version or existing.submitted_on <> submission_date then raise exception 'Submission records cannot be overwritten'; end if;
    return;
  end if;
  insert into public.application_submissions(id,application_id,user_id,resume_version_id,cover_letter_version_id,submitted_on)
    values(record_id,job_id,(select auth.uid()),resume_version,cover_version,submission_date);
  update public.applications set applied_at=coalesce(applied_at,submission_date),status=case when status='saved' then 'applied'::public.app_status else status end where id=job_id;
end $$;

revoke execute on function public.guard_application_material(), public.guard_application_submission(), public.track_application_status() from public, anon, authenticated;
revoke execute on function public.save_application_material(uuid,uuid,text,text,jsonb), public.save_application_analysis(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text), public.record_application_submission(uuid,uuid,uuid,uuid,date) from public, anon;
grant execute on function public.save_application_material(uuid,uuid,text,text,jsonb), public.save_application_analysis(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text), public.record_application_submission(uuid,uuid,uuid,uuid,date) to authenticated;

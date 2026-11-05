-- Isolated schema-only PostgreSQL verification. Never run against a hosted project.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','planning-a@example.invalid'),('10000000-0000-4000-8000-000000000002','planning-b@example.invalid');
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
insert into public.applications(id,user_id,company,role) values
('20000000-0000-4000-8000-000000000001',auth.uid(),'Synthetic one','Test'),
('20000000-0000-4000-8000-000000000002',auth.uid(),'Synthetic two','Test');
do $$
declare c public.application_contacts; i public.application_interviews; value timestamptz; failed boolean;
begin
  c:=public.save_job_contact('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"name":"Test recruiter","email":"test@example.invalid","notes":"Private"}');
  assert c.revision=0;
  c:=public.save_job_contact(c.id,c.application_id,'{"name":"Test recruiter","email":"test@example.invalid","notes":"Private"}');
  assert c.revision=0;
  c:=public.save_job_contact(c.id,c.application_id,'{"name":"Updated recruiter","email":"test@example.invalid","notes":"Private"}',0);
  assert c.revision=1;
  failed:=false; begin perform public.save_job_contact(c.id,c.application_id,'{"name":"Stale edit"}',0); exception when others then failed:=true; end; assert failed,'Stale edit accepted';
  assert public.resolve_interview_time('2026-11-05T10:00','America/Vancouver')=timestamptz '2026-11-05 17:00+00','Stale Vancouver rules';
  failed:=false; begin perform public.resolve_interview_time('2027-03-14T02:30','America/New_York'); exception when others then failed:=true; end; assert failed,'DST gap accepted';
  failed:=false; begin perform public.resolve_interview_time('2027-11-07T01:30','America/New_York'); exception when others then failed:=true; end; assert failed,'Repeated hour accepted silently';
  assert public.resolve_interview_time('2027-11-07T01:30','America/New_York','later')-public.resolve_interview_time('2027-11-07T01:30','America/New_York','earlier')=interval '1 hour';
  i:=public.save_job_interview('40000000-0000-4000-8000-000000000001',c.application_id,jsonb_build_object('title','Technical interview','starts_at','2026-11-05T17:00:00Z','ends_at','2026-11-05T18:00:00Z','time_zone','America/Vancouver','contact_id',c.id,'notes','Preparation'));
  assert i.local_start='2026-11-05T10:00' and i.local_end='2026-11-05T11:00' and i.utc_offset_seconds=-25200;
  failed:=false; begin perform public.save_job_interview('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',jsonb_build_object('title','Bad cross-job contact','starts_at',i.starts_at,'ends_at',i.ends_at,'time_zone',i.time_zone,'contact_id',c.id)); exception when foreign_key_violation then failed:=true; end; assert failed,'Cross-job contact accepted';
  failed:=false; begin update public.application_interviews set time_zone='Wrong/Zone' where id=i.id; exception when others then failed:=true; end; assert failed,'Bad time zone accepted';
  failed:=false; begin update public.application_interviews set ends_at=starts_at where id=i.id; exception when check_violation then failed:=true; end; assert failed,'Zero duration accepted';
  failed:=false; begin update public.application_contacts set application_id='20000000-0000-4000-8000-000000000002' where id=c.id; exception when others then failed:=true; end; assert failed,'Contact moved to another job';
end $$;
do $$
declare
  draft_id uuid := '50000000-0000-4000-8000-000000000001';
  job_id uuid := '20000000-0000-4000-8000-000000000001';
  other_job uuid := '20000000-0000-4000-8000-000000000002';
  payload jsonb := '{"kind":"thank_you","contact_id":"30000000-0000-4000-8000-000000000001","interview_id":"40000000-0000-4000-8000-000000000001","subject":"Thank you","body":"Test draft"}';
  draft public.application_follow_up_drafts;
  failed boolean;
begin
  assert not has_table_privilege('anon', 'public.application_follow_up_drafts', 'select');
  assert not has_function_privilege('anon', 'public.save_job_follow_up_draft(uuid,uuid,jsonb,integer)', 'execute');
  draft := public.save_job_follow_up_draft(draft_id, job_id, payload);
  assert draft.revision = 0;
  draft := public.save_job_follow_up_draft(draft_id, job_id, payload || '{"body":"Personalized draft"}', 0);
  assert draft.revision = 1 and draft.body = 'Personalized draft';
  draft := public.save_job_follow_up_draft(draft_id, job_id, payload || '{"body":"Personalized draft"}', 0);
  assert draft.revision = 1, 'An exact replay created a new revision';
  failed := false;
  begin
    perform public.save_job_follow_up_draft(draft_id, job_id, payload, 0);
  exception when raise_exception then failed := sqlerrm like 'Draft changed elsewhere%'; end;
  assert failed, 'Stale draft edit accepted';
  failed := false;
  begin
    perform public.save_job_follow_up_draft(gen_random_uuid(), other_job, payload - 'contact_id');
  exception when foreign_key_violation then failed := true; end;
  assert failed, 'Foreign-job interview accepted';
  failed := false;
  begin
    perform public.save_job_follow_up_draft(gen_random_uuid(), other_job, payload - 'interview_id');
  exception when foreign_key_violation then failed := true; end;
  assert failed, 'Foreign-job contact accepted';
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$ declare failed boolean:=false; begin
  assert (select count(*)=0 from public.application_contacts),'Foreign contact visible';
  assert (select count(*)=0 from public.application_interviews),'Foreign interview visible';
  assert (select count(*)=0 from public.application_follow_up_drafts),'Foreign draft visible';
  update public.application_follow_up_drafts set body = 'Unauthorized';
  assert not found, 'Foreign draft was edited';
  begin perform public.save_job_contact('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','{"name":"Foreign insert"}'); exception when others then failed:=true; end; assert failed,'Foreign save accepted';
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
-- Removing an appointment clears the link and keeps the draft. Job removal cascades it.
delete from public.application_interviews where id='40000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select interview_id is null and body = 'Personalized draft' and revision = 2 from public.application_follow_up_drafts);
end $$;

delete from public.applications where id='20000000-0000-4000-8000-000000000001';
do $$ begin assert (select count(*)=0 from public.application_contacts); assert (select count(*)=0 from public.application_interviews); assert (select count(*)=0 from public.application_follow_up_drafts); end $$;
rollback;
\echo 'Planning schema checks passed (rolled back).'

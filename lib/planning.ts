import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobContact, JobInterview } from './types';
import { checked } from './jobWorkspace';

export const INTERVIEW_LIST_FIELDS =
  'id,application_id,user_id,title,starts_at,ends_at,time_zone,local_start,local_end,utc_offset_seconds,status,revision,created_at,updated_at';
export function safePlanningUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => !value || !!safePlanningUrl(value),
    'Use an http or https URL without embedded credentials.',
  );
export const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a contact name.').max(200),
  role: z.string().trim().max(200),
  email: z.union([z.literal(''), z.email()]).pipe(z.string().max(320)),
  phone: z.string().trim().max(100),
  profile_url: optionalUrl,
  notes: z.string().max(10000),
  archived: z.boolean(),
});
export type ContactInput = z.infer<typeof contactInputSchema>;
export function validTimeZone(value: string) {
  if (!value || value.length > 100 || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export const interviewInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter an interview title.').max(200),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    time_zone: z.string().refine(validTimeZone, 'Choose a valid IANA time zone.'),
    status: z.enum(['scheduled', 'completed', 'cancelled']),
    location: z.string().trim().max(500),
    meeting_url: optionalUrl,
    notes: z.string().max(10000),
    contact_id: z.uuid().nullable(),
  })
  .refine((value) => {
    const start = Date.parse(value.starts_at),
      end = Date.parse(value.ends_at);
    return (
      end > start &&
      end - start <= 86400_000 &&
      start >= Date.parse('1900-01-01T00:00:00Z') &&
      end < Date.parse('9999-12-31T23:59:59Z')
    );
  }, 'Choose a duration between 1 minute and 24 hours within years 1900–9999.');
export type InterviewInput = z.infer<typeof interviewInputSchema>;

export function mapContact(row: Record<string, unknown>): JobContact {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    ownerId: row.user_id as string,
    name: row.name as string,
    role: row.role as string,
    email: row.email as string,
    phone: row.phone as string,
    profileUrl: row.profile_url as string,
    notes: row.notes as string,
    archived: row.archived as boolean,
    revision: row.revision as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
export function mapInterview(row: Record<string, unknown>): JobInterview {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    ownerId: row.user_id as string,
    title: row.title as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    localStart: row.local_start as string,
    localEnd: row.local_end as string,
    utcOffsetSeconds: row.utc_offset_seconds as number,
    timeZone: row.time_zone as string,
    status: row.status as JobInterview['status'],
    revision: row.revision as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    ...(row.contact_id !== undefined
      ? {
          contactId: row.contact_id as string | null,
          location: row.location as string,
          meetingUrl: row.meeting_url as string,
          notes: row.notes as string,
        }
      : {}),
  };
}
export function contactInput(row: JobContact): ContactInput {
  return {
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    profile_url: row.profileUrl,
    notes: row.notes,
    archived: row.archived,
  };
}
export function interviewInput(row: JobInterview): InterviewInput {
  return {
    title: row.title,
    starts_at: row.startsAt,
    ends_at: row.endsAt,
    time_zone: row.timeZone,
    status: row.status,
    location: row.location ?? '',
    meeting_url: row.meetingUrl ?? '',
    notes: row.notes ?? '',
    contact_id: row.contactId ?? null,
  };
}
export async function loadInterviews(client: SupabaseClient, ownerId: string) {
  const rows: JobInterview[] = [];
  // Supabase's response-size limit must not silently truncate an account's agenda.
  for (let offset = 0; ; offset += 500) {
    const result = checked(
      await client
        .from('application_interviews')
        .select(INTERVIEW_LIST_FIELDS)
        .eq('user_id', ownerId)
        .order('starts_at')
        .order('id')
        .range(offset, offset + 499),
    );
    rows.push(...(result.data ?? []).map(mapInterview));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
export async function loadJobPlanning(client: SupabaseClient, jobId: string, ownerId: string) {
  const [contacts, interviews] = await Promise.all([
    client
      .from('application_contacts')
      .select('*')
      .eq('application_id', jobId)
      .eq('user_id', ownerId)
      .order('created_at')
      .order('id'),
    client
      .from('application_interviews')
      .select('*')
      .eq('application_id', jobId)
      .eq('user_id', ownerId)
      .order('starts_at')
      .order('id'),
  ]);
  return {
    contacts: (checked(contacts).data ?? []).map(mapContact),
    interviews: (checked(interviews).data ?? []).map(mapInterview),
  };
}
export async function updateInterviewStatus(
  client: SupabaseClient,
  id: string,
  ownerId: string,
  status: JobInterview['status'],
) {
  const row = checked(
    await client
      .from('application_interviews')
      .select('*')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single(),
  );
  const interview = mapInterview(row.data);
  checked(
    await client.rpc('save_job_interview', {
      record_id: id,
      job_id: interview.applicationId,
      details: { ...interviewInput(interview), status },
      expected_revision: interview.revision,
    }),
  );
  const result = checked(
    await client
      .from('application_interviews')
      .select(INTERVIEW_LIST_FIELDS)
      .eq('application_id', interview.applicationId)
      .eq('user_id', ownerId)
      .order('starts_at')
      .order('id'),
  );
  return {
    applicationId: interview.applicationId,
    interviews: (result.data ?? []).map(mapInterview),
  };
}
export function interviewLabel(interview: JobInterview) {
  // These wall-clock values come from PostgreSQL's maintained tzdata. Intl on
  // an older OS can silently apply outdated rules (e.g. Vancouver after 2026).
  const offset = Math.trunc(interview.utcOffsetSeconds / 60);
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const sign = offset < 0 ? '−' : '+';
  const end = interview.localEnd.startsWith(interview.localStart.slice(0, 10))
    ? interview.localEnd.slice(11)
    : interview.localEnd.replace('T', ' ');
  return `${interview.localStart.replace('T', ' ')} – ${end} · ${interview.timeZone} (start UTC${sign}${hours}:${minutes})`;
}

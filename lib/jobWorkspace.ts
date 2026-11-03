import type { AIResult, AnalysisInput, Application, JobMaterial, JobWorkspaceData } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { analysisSchema, normalizeJobUrl } from './ai';
import { z } from 'zod';

// Large posting and notes bodies are loaded only when their workspace opens.
export const APPLICATION_LIST_FIELDS = 'id,user_id,company,role,status,match,deadline,url,created_at,posting_status,posting_checked_at,posting_note,captured_at,applied_at,next_action,next_action_due,next_action_done,selected_resume_id';

const materialSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('resume'),
    body: z.object({
      name: z.string(),
      text: z.string(),
      filePath: z.string().nullable().default(null),
      sourceResumeId: z.string().nullable().default(null),
    }),
  }),
  z.object({
    kind: z.literal('analysis'),
    body: z.object({
      result: analysisSchema,
      resumeVersionId: z.string().nullable(),
      jobDescription: z.string(),
      jobUrl: z.string(),
    }),
  }),
  z.object({
    kind: z.literal('cover_letter'),
    body: z.object({ text: z.string(), analysisVersionId: z.string().nullable().default(null) }),
  }),
]);

export function normalizedJobIdentity(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function canonicalJobUrl(raw: string) {
  if (!raw.trim()) return '';
  try {
    const url = new URL(normalizeJobUrl(raw.trim()));
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    url.searchParams.sort();
    return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return '';
  }
}

export function duplicateJobs(apps: Application[], candidate: Pick<Application, 'url' | 'company' | 'role'>) {
  const url = canonicalJobUrl(candidate.url);
  const company = normalizedJobIdentity(candidate.company);
  const role = normalizedJobIdentity(candidate.role);
  return apps.filter(
    (app) =>
      (url && canonicalJobUrl(app.url) === url) ||
      (company &&
        role &&
        normalizedJobIdentity(app.company) === company &&
        normalizedJobIdentity(app.role) === role),
  );
}

export function mapApplicationRow(a: Record<string, unknown>): Application {
  return {
    id: a.id as string,
    ownerId: a.user_id as string | undefined,
    createdAt: a.created_at as string,
    company: a.company as string,
    role: a.role as string,
    status: a.status as Application['status'],
    match: a.match as number,
    deadline: a.deadline as string | null,
    url: a.url as string,
    notes: (a.notes ?? '') as string,
    postingStatus: (a.posting_status ?? 'unknown') as Application['postingStatus'],
    postingCheckedAt: a.posting_checked_at as string | null,
    postingNote: (a.posting_note ?? '') as string,
    description: (a.description ?? '') as string,
    capturedAt: (a.captured_at ?? null) as string | null,
    appliedAt: (a.applied_at ?? null) as string | null,
    nextAction: (a.next_action ?? '') as string,
    nextActionDue: (a.next_action_due ?? null) as string | null,
    nextActionDone: Boolean(a.next_action_done),
    selectedResumeId: (a.selected_resume_id ?? null) as string | null,
  };
}

export function checked<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

export async function loadJobWorkspace(
  client: SupabaseClient,
  applicationId: string,
): Promise<JobWorkspaceData & { application: Application }> {
  const [job, materials, submissions, events] = await Promise.all([
    client.from('applications').select('*').eq('id', applicationId).single(),
    client
      .from('application_materials')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .order('id')
      .limit(200),
    client
      .from('application_submissions')
      .select('*')
      .eq('application_id', applicationId)
      .order('submitted_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('application_status_events')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  [job, materials, submissions, events].forEach(checked);
  return {
    application: mapApplicationRow(job.data),
    materials: (materials.data ?? []).map((row) => ({
      id: row.id,
      applicationId: row.application_id,
      title: row.title,
      createdAt: row.created_at,
      ...materialSchema.parse(row),
    })) as JobMaterial[],
    submissions: (submissions.data ?? []).map((row) => ({
      id: row.id,
      applicationId: row.application_id,
      resumeVersionId: row.resume_version_id,
      coverLetterVersionId: row.cover_letter_version_id,
      submittedOn: row.submitted_on,
      createdAt: row.created_at,
    })),
    events: (events.data ?? []).map((row) => ({ id: row.id, status: row.status, createdAt: row.created_at })),
  };
}

/** Generate these IDs once before enqueueing, so retries cannot create extra versions. */
export function analysisSaveParams(
  applicationId: string,
  result: AIResult,
  input: AnalysisInput,
  resumeVersionId: string | null = null,
) {
  const hasResume = Boolean(input.resumeText.trim());
  const { jobPostingText, ...savedResult } = result;
  return {
    job_id: applicationId,
    resume_record: hasResume ? (resumeVersionId ?? crypto.randomUUID()) : null,
    analysis_record: crypto.randomUUID(),
    letter_record: crypto.randomUUID(),
    resume_snapshot:
      hasResume && !resumeVersionId
        ? {
            name: input.resumeName || 'Analysis résumé',
            text: input.resumeText,
            filePath: input.filePath,
            sourceResumeId: input.sourceResumeId,
          }
        : null,
    analysis_result: { ...structuredClone(savedResult), matchScore: Math.round(savedResult.matchScore) },
    posting_text: (input.jobDescription.trim() || jobPostingText || '').slice(0, 60000),
    source_url: input.jobUrl,
  };
}

export function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Refresh saved fields while preserving edits made since the previous load. */
export function mergeSavedFields<T extends object>(draft: T, baseline: T, incoming: T): T {
  const merged = { ...draft };
  for (const key of Object.keys(incoming) as Array<keyof T>) {
    if (draft[key] === baseline[key]) merged[key] = incoming[key];
  }
  return merged;
}

export function sameFields<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as Array<keyof T>;
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}

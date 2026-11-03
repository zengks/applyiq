import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Application, JobMaterial, JobWorkspaceData } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({ useStore: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/store', () => ({ useStore: mocks.useStore }));
vi.mock('@/lib/jobWorkspace', async (original) => ({
  ...(await original<typeof import('@/lib/jobWorkspace')>()),
  loadJobWorkspace: mocks.load,
}));
import JobWorkspace from '@/components/JobWorkspace';
afterEach(() => vi.unstubAllGlobals());

const application: Application = {
  id: 'job',
  company: 'Acme',
  role: 'Engineer',
  status: 'applied',
  match: 82,
  deadline: null,
  url: '',
  notes: '',
  description: 'Preserved job description',
  selectedResumeId: 'resume-v1',
  postingStatus: 'removed',
  postingCheckedAt: null,
  postingNote: '',
};
const date = '2026-11-02T22:00:00Z';
let data: JobWorkspaceData;
let rpc: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let saveWorkspace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  data = {
    materials: [
      {
        id: 'resume-v1',
        applicationId: 'job',
        kind: 'resume',
        title: 'Original résumé',
        createdAt: date,
        body: {
          text: 'Exact submitted résumé',
          name: 'Original résumé',
          filePath: null,
          sourceResumeId: null,
        },
      },
      {
        id: 'letter-v2',
        applicationId: 'job',
        kind: 'cover_letter',
        title: 'Newer draft',
        createdAt: date,
        body: { text: 'Newer unsubmitted letter', analysisVersionId: null },
      },
      {
        id: 'letter-v1',
        applicationId: 'job',
        kind: 'cover_letter',
        title: 'Original letter',
        createdAt: date,
        body: { text: 'Exact submitted letter', analysisVersionId: null },
      },
    ],
    submissions: [
      {
        id: 'submission',
        applicationId: 'job',
        resumeVersionId: 'resume-v1',
        coverLetterVersionId: 'letter-v1',
        submittedOn: '2026-11-02',
        createdAt: date,
      },
    ],
    events: [{ id: 'event', status: 'applied', createdAt: date }],
  };
  mocks.load.mockReset().mockImplementation(async () => ({ ...structuredClone(data), application }));
  rpc = vi.fn().mockImplementation(async (name, params) => {
    if (name === 'save_application_material')
      data.materials.unshift({
        id: params.record_id,
        applicationId: 'job',
        kind: params.material_kind,
        title: params.material_title,
        body: params.material_body,
        createdAt: date,
      } as JobMaterial);
    return { error: null };
  });
  update = vi
    .fn()
    .mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ error: null }) }) }) });
  const client = { rpc, from: () => ({ update }) } as unknown as SupabaseClient;
  saveWorkspace = vi.fn(async (run: (client: SupabaseClient) => Promise<void>) => {
    try {
      await run(client);
      return true;
    } catch {
      return false;
    }
  });
  mocks.useStore.mockReturnValue({
    darkMode: false,
    dispatch: vi.fn(),
    workspaceClient: client,
    saveWorkspace,
    syncStatus: { pending: 0, saving: false, error: '' },
    retrySave: vi.fn(),
    resumes: [],
    checkPostings: vi.fn(),
    checkingPostingIds: [],
  });
});

async function openMaterials() {
  fireEvent.click(screen.getByRole('button', { name: 'Résumés & materials' }));
  await screen.findByLabelText('Open a saved letter');
}

describe('complete application workspace', () => {
  it('records the native submission date shown to the user', async () => {
    render(<JobWorkspace application={application} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submissions & timeline' }));
    const input = (await screen.findByLabelText('Date submitted')) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '2026-10-31');
    fireEvent.click(screen.getByRole('button', { name: 'Record submission' }));
    await screen.findByText('Submission recorded with the exact selected materials.');
    expect(rpc).toHaveBeenCalledWith(
      'record_application_submission',
      expect.objectContaining({ resume_version: 'resume-v1', submission_date: '2026-10-31' }),
    );
  });
  it('analyzes the saved posting with the chosen résumé and queues the linked bundle', async () => {
    const result = {
      matchScore: 82,
      company: 'Acme',
      role: 'Engineer',
      matchedKeywords: ['React'],
      missingKeywords: [],
      aiSuggestion: 'Use evidence',
      coverLetter: 'Generated draft',
      interviewQuestions: [],
      salaryRange: 'Unknown',
      industry: 'Software',
      seniority: 'Mid',
      culture: [],
    };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal('fetch', fetch);
    render(<JobWorkspace application={application} />);
    await openMaterials();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze selected résumé' }));
    await screen.findByText('Analysis and generated cover letter saved as new versions.');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      jobUrl: '',
      jobDescription: 'Preserved job description',
      resumeText: 'Exact submitted résumé',
    });
    expect(rpc).toHaveBeenCalledWith(
      'save_application_analysis',
      expect.objectContaining({
        job_id: 'job',
        resume_record: 'resume-v1',
        resume_snapshot: null,
        analysis_result: result,
        posting_text: 'Preserved job description',
      }),
    );
  });
  it('reopens the exact submitted versions, then preserves them after editing a new letter version', async () => {
    render(<JobWorkspace application={application} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submissions & timeline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View submitted materials' }));
    expect(screen.getByLabelText('Saved résumé for this job')).toHaveValue('resume-v1');
    expect(screen.getByLabelText('Open a saved letter')).toHaveValue('letter-v1');
    expect(screen.getByLabelText('Cover letter')).toHaveValue('Exact submitted letter');
    fireEvent.change(screen.getByLabelText('Cover letter'), { target: { value: 'Edited future letter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new version' }));
    await screen.findByText('Cover letter saved as a new version. Earlier versions remain unchanged.');
    expect(rpc).toHaveBeenCalledWith(
      'save_application_material',
      expect.objectContaining({
        job_id: 'job',
        material_kind: 'cover_letter',
        material_body: { text: 'Edited future letter', analysisVersionId: null },
      }),
    );
    expect(data.materials.find((item) => item.id === 'letter-v1')?.body).toMatchObject({
      text: 'Exact submitted letter',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submissions & timeline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View submitted materials' }));
    expect(screen.getByLabelText('Cover letter')).toHaveValue('Exact submitted letter');
  });

  it('preserves a removed posting and saves the next action with its due date', async () => {
    render(<JobWorkspace application={application} />);
    expect(screen.getByLabelText('Posting description')).toHaveValue('Preserved job description');
    fireEvent.change(screen.getByLabelText('What will you do next?'), { target: { value: 'Follow up' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-09' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save job details' }));
    await screen.findByText('Job details and next action saved.');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Preserved job description',
        next_action: 'Follow up',
        next_action_due: '2026-11-09',
        next_action_done: false,
      }),
    );
  });

  it('keeps failed writes visible instead of claiming a cover letter was saved', async () => {
    rpc.mockResolvedValue({ error: { message: 'offline' } });
    render(<JobWorkspace application={application} />);
    await openMaterials();
    fireEvent.change(screen.getByLabelText('Cover letter'), { target: { value: 'Unsaved letter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new version' }));
    await screen.findByText('This change is queued. Keep the page open and use Retry save above.');
    expect(
      screen.queryByText('Cover letter saved as a new version. Earlier versions remain unchanged.'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cover letter')).toHaveValue('Unsaved letter');
  });

  it('saves an autofilled native date even when it did not emit a React change event', async () => {
    render(<JobWorkspace application={application} />);
    const input = screen.getByLabelText('Due date') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '2026-11-10');
    fireEvent.click(screen.getByRole('button', { name: 'Save job details' }));
    await screen.findByText('Job details and next action saved.');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ next_action_due: '2026-11-10' }));
  });

  it('shows no letter for a submission that did not include one', async () => {
    data.submissions[0].coverLetterVersionId = null;
    render(<JobWorkspace application={application} />);
    await openMaterials();
    fireEvent.change(screen.getByLabelText('Open a saved letter'), { target: { value: 'letter-v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submissions & timeline' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View submitted materials' }));
    expect(screen.getByLabelText('Open a saved letter')).toHaveValue('');
    expect(screen.getByLabelText('Cover letter')).toHaveValue('');
  });

  it('reports failed workspace hydration without replacing it with an empty success', async () => {
    mocks.load.mockRejectedValue(new Error('Database unavailable'));
    render(<JobWorkspace application={application} />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Retry loading' })).toBeInTheDocument();
    mocks.load.mockResolvedValue({ ...data, application });
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

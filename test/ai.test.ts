import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAIResponse, normalizeJobUrl } from '@/lib/ai';

const sample = {
  matchScore: 88, role: 'FE', company: 'Linear', matchedKeywords: ['react'], missingKeywords: ['go'],
  aiSuggestion: 'tip', coverLetter: 'Dear...', interviewQuestions: [{ q: 'q', hint: 'h' }],
  salaryRange: '$100k', industry: 'tech', seniority: 'Senior', culture: ['remote'],
};

describe('parseAIResponse', () => {
  it('normalizes advisory scores for the integer application column', () => {
    expect(parseAIResponse(JSON.stringify({ ...sample, matchScore: 84.6 })).matchScore).toBe(85);
  });
  it('parses clean JSON', () => {
    expect(parseAIResponse(JSON.stringify(sample))).toEqual(sample);
  });

  it('strips ```json fences', () => {
    const fenced = '```json\n' + JSON.stringify(sample) + '\n```';
    expect(parseAIResponse(fenced)).toEqual(sample);
  });

  it('extracts the JSON object from chatty output', () => {
    const chatty = `Sure! Here is your analysis:\n${JSON.stringify(sample)}\nHope it helps!`;
    expect(parseAIResponse(chatty)).toEqual(sample);
  });

  it('throws when there is no JSON', () => {
    expect(() => parseAIResponse('no json here')).toThrow();
  });
});

describe('normalizeJobUrl', () => {
  it('strips Indeed tracking params but keeps the job key, shrinking the URL', () => {
    const full = 'https://ca.indeed.com/viewjob?jk=248c853ce5d569d2&l=vancouver%2C+bc&tk=1jronkg8&from=web&ad=' + 'x'.repeat(700) + '&xkcb=abc&xpse=def&xfps=ghi&vjs=3';
    const out = normalizeJobUrl(full);
    expect(out).toContain('jk=248c853ce5d569d2');
    expect(out).not.toContain('tk=');
    expect(out).not.toContain('xkcb=');
    expect(out).not.toMatch(/[?&]ad=/);
    expect(out.length).toBeLessThan(120);
    expect(full.length).toBeGreaterThan(700);
  });

  it('drops any param with a very long value (catch-all tracker)', () => {
    const out = normalizeJobUrl('https://x.com/job?id=42&blob=' + 'y'.repeat(200));
    expect(out).toContain('id=42');
    expect(out).not.toContain('blob=');
  });

  it('leaves clean URLs and non-URLs unchanged', () => {
    expect(normalizeJobUrl('https://jobs.lever.co/acme/123')).toBe('https://jobs.lever.co/acme/123');
    expect(normalizeJobUrl('not a url')).toBe('not a url');
  });
});

// ── analyze route ──
const { create, getUser, enforceRateLimits, logUsage } = vi.hoisted(() => ({
  create: vi.fn(),
  getUser: vi.fn(),
  enforceRateLimits: vi.fn(),
  logUsage: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
  createAdminClient: () => ({}),
}));
vi.mock('@/lib/costTracker', () => {
  class RateLimitError extends Error {
    constructor(m: string) { super(m); this.name = 'RateLimitError'; }
  }
  return { enforceRateLimits, logUsage, RateLimitError };
});

import { POST } from '@/app/api/analyze/route';
import { RateLimitError } from '@/lib/costTracker';

const COST = {
  feature: 'ai_analysis', model: 'claude-sonnet-4-6', costUsd: 0.01, monthSpendUsd: 0.01,
  softLimitAlert: false, inputTokens: 10, outputTokens: 5, cacheWriteTokens: 0, cacheReadTokens: 0,
};

function req(body: unknown) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const ok = () => ({ stop_reason: 'end_turn', content: [
  { type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: 'https://jobs.example.com/1', content: { source: { type: 'text', data: 'Original job posting content' } } } },
  { type: 'text', text: JSON.stringify(sample) },
] });

describe('POST /api/analyze', () => {
  beforeEach(() => {
    create.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    enforceRateLimits.mockReset().mockResolvedValue(undefined);
    logUsage.mockReset().mockResolvedValue(COST);
  });

  it('returns 400 when jobUrl is missing', async () => {
    const res = await POST(req({ jobDescription: 'pasted text' }) as never);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('analyzes saved text without a URL or network fetch tool', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(sample) }] });
    const res = await POST(req({ jobUrl: '', jobDescription: 'Preserved closed posting', resumeText: 'Candidate experience' }) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).jobPostingText).toBe('Preserved closed posting');
    expect(create.mock.calls[0][0].tools).toBeUndefined();
  });

  it('returns a text snapshot of the fetched posting for the workspace', async () => {
    create.mockResolvedValue(ok());
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1' }) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).jobPostingText).toBe('Original job posting content');
  });

  it('returns 400 when jobUrl is not http(s)', async () => {
    const res = await POST(req({ jobUrl: 'ftp://example.com/job' }) as never);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1' }) as never);
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 429 (without calling Claude) when rate limited', async () => {
    enforceRateLimits.mockRejectedValue(new RateLimitError('max 5 per hour'));
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1' }) as never);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/max 5 per hour/);
    expect(create).not.toHaveBeenCalled();
  });

  it('blocks spending if the usage database is unavailable', async () => {
    enforceRateLimits.mockRejectedValue(new Error('relation "api_usage" does not exist'));
    create.mockResolvedValue(ok());
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1' }) as never);
    expect(res.status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the analysis + cost, and uses web_fetch on Sonnet', async () => {
    create.mockResolvedValue(ok());
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1', resumeText: 'cv' }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject(sample);
    expect(body.cost).toEqual(COST);
    expect(logUsage).toHaveBeenCalledWith('ai_analysis', 'u1', expect.anything());
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-4-6');
    expect(args.tools[0]).toMatchObject({ type: 'web_fetch_20260209', name: 'web_fetch' });
  });

  it('resumes on pause_turn then succeeds', async () => {
    create
      .mockResolvedValueOnce({ stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 't' }] })
      .mockResolvedValueOnce(ok());
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1' }) as never);
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);
  });

  const failedFetch = {
    stop_reason: 'end_turn',
    content: [
      { type: 'web_fetch_tool_result', content: { type: 'web_fetch_tool_result_error', error_code: 'url_too_long' } },
      { type: 'text', text: JSON.stringify(sample) }, // fabricated fallback
    ],
  };

  it('returns 422 but records consumed tokens when the fetch failed', async () => {
    create.mockResolvedValue(failedFetch);
    const res = await POST(req({ jobUrl: 'https://blocked.example.com/1' }) as never);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/block automated access/);
    expect(logUsage).toHaveBeenCalledTimes(1);
  });

  it('still analyzes when the fetch failed but a description was pasted', async () => {
    create.mockResolvedValue(failedFetch);
    const res = await POST(req({ jobUrl: 'https://blocked.example.com/1', jobDescription: 'pasted JD text' }) as never);
    expect(res.status).toBe(200);
    expect(logUsage).toHaveBeenCalled();
  });

  it('returns 422 when the response is truncated (max_tokens)', async () => {
    create.mockResolvedValue({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{ "partial":' }] });
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1' }) as never);
    expect(res.status).toBe(422);
  });

  it('returns 500 when the response cannot be parsed', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'totally not json' }] });
    const res = await POST(req({ jobUrl: 'https://jobs.example.com/1', jobDescription: 'A real pasted posting' }) as never);
    expect(res.status).toBe(500);
  });
});

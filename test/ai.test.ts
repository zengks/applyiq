import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAIResponse } from '@/lib/ai';

const sample = {
  matchScore: 88, role: 'FE', company: 'Linear', matchedKeywords: ['react'], missingKeywords: ['go'],
  aiSuggestion: 'tip', coverLetter: 'Dear...', interviewQuestions: [{ q: 'q', hint: 'h' }],
  salaryRange: '$100k', industry: 'tech', seniority: 'Senior', culture: ['remote'],
};

describe('parseAIResponse', () => {
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

// ── analyze route ──
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

import { POST } from '@/app/api/analyze/route';

function req(body: unknown) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analyze', () => {
  beforeEach(() => create.mockReset());

  it('returns 400 when jobDescription is empty', async () => {
    const res = await POST(req({ jobDescription: '  ' }) as never);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the parsed analysis on success', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(sample) }] });
    const res = await POST(req({ jobDescription: 'Senior FE role', resumeText: 'cv' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(sample);
  });

  it('returns 422 when the response is truncated (max_tokens)', async () => {
    create.mockResolvedValue({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{ "partial":' }] });
    const res = await POST(req({ jobDescription: 'a very long job post' }) as never);
    expect(res.status).toBe(422);
  });

  it('returns 500 when the response cannot be parsed', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'totally not json' }] });
    const res = await POST(req({ jobDescription: 'role' }) as never);
    expect(res.status).toBe(500);
  });
});

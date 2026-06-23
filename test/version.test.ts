import { describe, expect, it } from 'vitest';
import { normalizeReleases, normalizeCommits, VERSION_LABEL } from '@/lib/version';

describe('VERSION_LABEL', () => {
  it('looks like "vX.Y.Z (sha)"', () => {
    expect(VERSION_LABEL).toMatch(/^v.+ \(.+\)$/);
  });
});

describe('normalizeReleases', () => {
  it('maps releases and prefers name over tag', () => {
    const out = normalizeReleases([
      { id: 1, tag_name: 'v0.2.0', name: 'Cost tracking', body: '  notes  ', html_url: 'u', published_at: '2026-06-22T00:00:00Z' },
    ]);
    expect(out[0]).toEqual({
      id: '1', title: 'Cost tracking', date: '2026-06-22T00:00:00Z', body: 'notes', url: 'u', kind: 'release',
    });
  });

  it('falls back to the tag when name is empty, and skips drafts', () => {
    const out = normalizeReleases([
      { id: 2, tag_name: 'v0.1.0', name: '', body: '', html_url: 'u' },
      { id: 3, tag_name: 'v0.3.0-draft', name: 'WIP', draft: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('v0.1.0');
  });

  it('handles an empty list', () => {
    expect(normalizeReleases([])).toEqual([]);
  });
});

describe('normalizeCommits', () => {
  it('splits the subject (title) from the body', () => {
    const out = normalizeCommits([
      { sha: 'abc1234def', html_url: 'u', commit: { message: 'Fix bug\n\nDetailed explanation\nmore', author: { date: '2026-06-22T00:00:00Z' } } },
    ]);
    expect(out[0].title).toBe('Fix bug');
    expect(out[0].body).toBe('Detailed explanation\nmore');
    expect(out[0].kind).toBe('commit');
    expect(out[0].id).toBe('abc1234def');
  });

  it('falls back to the short SHA when the message is empty', () => {
    const out = normalizeCommits([{ sha: 'abc1234def', commit: { message: '' } }]);
    expect(out[0].title).toBe('abc1234');
  });
});

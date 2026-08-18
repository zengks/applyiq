import { describe, expect, it } from 'vitest';
import {
  classifyResponse, extractText, needsCheck, networkFailureOutcome,
  safeFetchUrl, validThroughDate, CHECK_TTL_MS,
} from '@/lib/postingCheck';

const NOW = new Date('2026-06-22T12:00:00Z').getTime();
const page = (body: string) => `<html><head><title>Job</title></head><body>${body}</body></html>`;

describe('safeFetchUrl', () => {
  it('accepts ordinary http(s) job URLs', () => {
    expect(safeFetchUrl('https://boards.greenhouse.io/acme/jobs/123')?.hostname).toBe('boards.greenhouse.io');
    expect(safeFetchUrl('  http://example.com/job  ')?.protocol).toBe('http:');
  });

  it('rejects unparseable input and non-http schemes', () => {
    for (const bad of ['', 'not a url', 'javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com']) {
      expect(safeFetchUrl(bad)).toBeNull();
    }
  });

  it('rejects loopback, private and metadata addresses', () => {
    for (const bad of [
      'http://localhost:3000/job', 'http://127.0.0.1/job', 'http://10.1.2.3/job',
      'http://192.168.0.5/job', 'http://172.16.4.1/job', 'http://169.254.169.254/latest/meta-data',
      'http://printer.local/job', 'http://svc.internal/job', 'http://[::1]/job',
    ]) {
      expect(safeFetchUrl(bad), bad).toBeNull();
    }
  });

  it('allows public addresses in ranges that only look private', () => {
    expect(safeFetchUrl('http://172.32.0.1/job')).not.toBeNull();
    expect(safeFetchUrl('http://11.0.0.1/job')).not.toBeNull();
  });
});

describe('extractText', () => {
  it('drops scripts, styles and tags', () => {
    const html = '<script>var x = "no longer available";</script><style>a{}</style><p>Apply <b>Now</b></p>';
    expect(extractText(html)).toBe(' apply now ');
  });

  it('decodes the entities that show up in expiry copy', () => {
    expect(extractText('<p>this&nbsp;job&rsquo;s gone</p>')).toContain("this job's gone");
  });
});

describe('validThroughDate', () => {
  it('reads schema.org JobPosting validThrough', () => {
    const d = validThroughDate('{"@type":"JobPosting","validThrough":"2026-01-31T23:59:00Z"}');
    expect(d?.toISOString().slice(0, 10)).toBe('2026-01-31');
  });
  it('returns null when absent or unparseable', () => {
    expect(validThroughDate('<html></html>')).toBeNull();
    expect(validThroughDate('"validThrough":"soonish"')).toBeNull();
  });
});

describe('classifyResponse', () => {
  it('treats 404 / 410 as removed', () => {
    expect(classifyResponse(404, '', NOW).status).toBe('removed');
    expect(classifyResponse(410, '', NOW).status).toBe('removed');
  });

  it('treats blocks, rate limits and server errors as unknown', () => {
    for (const code of [401, 403, 429, 500, 503]) {
      expect(classifyResponse(code, '', NOW).status, String(code)).toBe('unknown');
    }
  });

  it('detects soft 404s served with a 200', () => {
    const out = classifyResponse(200, page('<h1>Job not found</h1>'), NOW);
    expect(out.status).toBe('removed');
    expect(out.note).toContain('job not found');
  });

  it('detects closed-role wording as expired', () => {
    for (const copy of [
      'This job is no longer accepting applications.',
      'Sorry — this posting has expired.',
      'The position has been filled.',
      'Applications are closed for this role.',
    ]) {
      expect(classifyResponse(200, page(copy), NOW).status, copy).toBe('expired');
    }
  });

  it('prefers the removed verdict when a page carries both signals', () => {
    expect(classifyResponse(200, page('Job not found. This posting has expired.'), NOW).status).toBe('removed');
  });

  it('uses validThrough only when it is in the past', () => {
    const past = page('<script type="application/ld+json">{"validThrough":"2026-01-01"}</script>Great role!');
    expect(classifyResponse(200, past, NOW).status).toBe('expired');
    const future = page('<script type="application/ld+json">{"validThrough":"2026-12-01"}</script>Great role!');
    expect(classifyResponse(200, future, NOW).status).toBe('active');
  });

  it('calls a healthy posting active', () => {
    const out = classifyResponse(200, page('<h1>Senior Engineer</h1><p>Apply now — we are hiring.</p>'), NOW);
    expect(out.status).toBe('active');
    expect(out.note).toBeTruthy();
  });

  it('never mistakes an empty body for a dead posting', () => {
    expect(classifyResponse(200, '', NOW).status).toBe('active');
  });
});

describe('networkFailureOutcome', () => {
  it('is always inconclusive rather than a false alarm', () => {
    for (const reason of ['timeout', 'unreachable', 'blocked'] as const) {
      const out = networkFailureOutcome(reason);
      expect(out.status).toBe('unknown');
      expect(out.note.length).toBeGreaterThan(0);
    }
  });
});

describe('needsCheck', () => {
  it('is true when never checked or the timestamp is garbage', () => {
    expect(needsCheck(null, NOW)).toBe(true);
    expect(needsCheck('not-a-date', NOW)).toBe(true);
  });
  it('is false inside the TTL and true past it', () => {
    expect(needsCheck(new Date(NOW - CHECK_TTL_MS + 60_000).toISOString(), NOW)).toBe(false);
    expect(needsCheck(new Date(NOW - CHECK_TTL_MS - 60_000).toISOString(), NOW)).toBe(true);
  });
});

import { PostingStatus } from './types';
import ipaddr from 'ipaddr.js';

/** How long a check result stays fresh before the app re-checks in the background. */
export const CHECK_TTL_MS = 24 * 60 * 60 * 1000;

/** Cap on how many postings one check request may cover. */
export const MAX_URLS_PER_CHECK = 25;

/** Bytes of HTML read per posting before we stop and classify. */
export const MAX_BODY_BYTES = 400_000;

export interface CheckOutcome {
  status: PostingStatus;
  note: string;
}

// Wording that means the page loaded but the opening is closed. Kept lowercase;
// matched against the page's stripped text.
const EXPIRED_PHRASES = [
  'no longer accepting applications',
  'not accepting applications',
  'no longer available',
  'no longer open',
  'no longer active',
  'no longer being accepted',
  'this job has expired',
  'this posting has expired',
  'job posting has expired',
  'posting has expired',
  'this listing has expired',
  'applications are closed',
  'applications have closed',
  'closed for applications',
  'this job is closed',
  'this position is closed',
  'position has been filled',
  'role has been filled',
  'vacancy has been filled',
  'position is no longer',
  'expired job',
];

// Wording that means the posting is gone entirely — a "soft 404" served with a
// 200 status, which is how most job boards handle deleted listings.
const REMOVED_PHRASES = [
  'job not found',
  'position not found',
  'page not found',
  'posting not found',
  'this job has been removed',
  'this posting has been removed',
  'listing has been removed',
  'job you are looking for',
  "job you're looking for",
  'we could not find that job',
  "we couldn't find that job",
  'job id is invalid',
];

/** Hosts we refuse to fetch — loopback, link-local, and private ranges (SSRF guard). */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // process() normalizes IPv4-mapped IPv6 before checking reserved ranges.
  return ipaddr.isValid(h) && ipaddr.process(h).range() !== 'unicast';
}

/**
 * Returns the URL to fetch, or null when it must not be fetched server-side
 * (not http(s), unparseable, or pointing at a private/loopback address).
 */
export function safeFetchUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  if (isPrivateHost(u.hostname)) return null;
  return u;
}

/** Strips scripts, styles and tags so phrase matching sees only visible copy. */
export function extractText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Reads the `validThrough` date out of a schema.org JobPosting block. Most major
 * boards emit it, and it is the one unambiguous machine-readable expiry signal.
 * Returns null when absent or unparseable.
 */
export function validThroughDate(html: string): Date | null {
  const m = html.match(/"validThrough"\s*:\s*"([^"]+)"/i);
  if (!m) return null;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Decides a posting's health from the HTTP response. `html` may be empty (e.g.
 * a HEAD-only or error response); `now` is injected for testability.
 */
export function classifyResponse(httpStatus: number, html: string, now: number = Date.now()): CheckOutcome {
  if (httpStatus === 404 || httpStatus === 410) {
    return { status: 'removed', note: `The posting URL returns ${httpStatus} — it has been taken down.` };
  }
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) {
    return { status: 'unknown', note: `The site blocked our check (${httpStatus}). Open the link to confirm it yourself.` };
  }
  if (httpStatus >= 500) {
    return { status: 'unknown', note: `The site returned ${httpStatus} — it may be temporarily down. We'll try again later.` };
  }
  if (httpStatus < 200 || httpStatus >= 400) {
    return { status: 'unknown', note: `Unexpected response (${httpStatus}). Open the link to confirm it yourself.` };
  }

  if (!html.trim()) return { status: 'unknown', note: 'No readable posting page was returned. Open the link to confirm it yourself.' };

  const text = extractText(html);

  const removedHit = REMOVED_PHRASES.find(p => text.includes(p));
  if (removedHit) {
    return { status: 'removed', note: `The page says "${removedHit}" — the posting looks deleted.` };
  }

  const expiredHit = EXPIRED_PHRASES.find(p => text.includes(p));
  if (expiredHit) {
    return { status: 'expired', note: `The page says "${expiredHit}" — this role is closed.` };
  }

  const validThrough = validThroughDate(html);
  if (validThrough && validThrough.getTime() < now) {
    return {
      status: 'expired',
      note: `The posting's listed close date (${validThrough.toISOString().slice(0, 10)}) has passed.`,
    };
  }

  return { status: 'active', note: 'The posting was still live at the last check.' };
}

/** Outcome for a URL we never got a response for. */
export function networkFailureOutcome(reason: 'timeout' | 'unreachable' | 'blocked'): CheckOutcome {
  if (reason === 'timeout') return { status: 'unknown', note: "The posting didn't respond in time. We'll try again later." };
  if (reason === 'blocked') return { status: 'unknown', note: "That link can't be checked automatically. Open it to confirm it yourself." };
  return { status: 'unknown', note: "Couldn't reach the posting. It may be offline, or the site may block automated checks." };
}

/** True when a posting is due for a background re-check. */
export function needsCheck(checkedAt: string | null, now: number = Date.now()): boolean {
  if (!checkedAt) return true;
  const t = new Date(checkedAt).getTime();
  if (Number.isNaN(t)) return true;
  return now - t > CHECK_TTL_MS;
}

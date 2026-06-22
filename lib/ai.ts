import { AIResult } from './types';

/** Tracking / analytics query params that bloat job-board URLs (esp. Indeed,
 *  LinkedIn). Stripped before fetching so the URL doesn't exceed web_fetch's
 *  length limit (long URLs fail with `url_too_long`). */
const TRACKING_PARAMS = new Set([
  'tk', 'from', 'advn', 'adid', 'ad', 'pub', 'camk', 'xkcb', 'xpse', 'xfps', 'vjs',
  'trk', 'refid', 'origintoken', 'ref', 'source', 'gclid', 'fbclid', 'igshid', '_ga',
  'mc_cid', 'mc_eid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
]);

/**
 * Strips tracking params (and any param with a very long value) from a job URL,
 * keeping the essential identifier (e.g. Indeed's `jk`). Returns the original
 * string unchanged if it isn't a parseable URL.
 */
export function normalizeJobUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  for (const [key, value] of [...u.searchParams.entries()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || value.length > 64) {
      u.searchParams.delete(key);
    }
  }
  return u.toString();
}

/**
 * Extracts the JSON object from a model response. The model is asked for raw
 * JSON but sometimes wraps it in ```json fences or adds prose, so we strip
 * fences first and fall back to the first {...} block.
 */
export function parseAIResponse(raw: string): AIResult {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned) as AIResult;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AIResult;
    throw new Error('Could not parse AI response');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeJobUrl } from '@/lib/ai';
import {
  classifyResponse, networkFailureOutcome, safeFetchUrl,
  MAX_BODY_BYTES, MAX_URLS_PER_CHECK,
} from '@/lib/postingCheck';
import type { PostingCheckResult } from '@/lib/types';

/** Per-URL budget. Job boards are slow; anything past this counts as unknown. */
const FETCH_TIMEOUT_MS = 12_000;

/** How many postings we fetch at once. */
const CONCURRENCY = 5;

// A normal browser UA — many boards serve a bot-block page to unknown agents,
// which we would otherwise misread as the posting being gone.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

interface Target { id: string; url: string }

/** Reads at most `MAX_BODY_BYTES` of the response so a huge page can't blow up memory. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let out = '';
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (bytes >= MAX_BODY_BYTES) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out;
}

async function checkOne(target: Target): Promise<PostingCheckResult> {
  const checkedAt = new Date().toISOString();
  const url = safeFetchUrl(normalizeJobUrl(target.url));
  if (!url) return { id: target.id, ...networkFailureOutcome('blocked'), checkedAt };

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const isHtml = (res.headers.get('content-type') ?? '').includes('html');
    let html = '';
    if (res.ok && isHtml) html = await readCapped(res);
    else await res.body?.cancel().catch(() => {});
    return { id: target.id, ...classifyResponse(res.status, html), checkedAt };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { id: target.id, ...networkFailureOutcome(timedOut ? 'timeout' : 'unreachable'), checkedAt };
  }
}

/**
 * Checks whether saved job postings are still live. The client sends the ids it
 * wants re-checked; the URLs are read back from the caller's own rows, and the
 * verdicts come from `lib/postingCheck.ts`. Page contents never leave the server.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: { ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const ids = (body.ids ?? []).filter(id => typeof id === 'string' && id).slice(0, MAX_URLS_PER_CHECK);
  if (ids.length === 0) return NextResponse.json({ results: [] });

  // Read the URLs from the caller's own rows — never trust a client-supplied URL,
  // which would turn this route into an open fetch proxy.
  const { data: owned, error } = await supabase
    .from('applications')
    .select('id, url')
    .eq('user_id', user.id)
    .in('id', ids);

  if (error) {
    console.error('[posting-status] lookup failed:', error);
    return NextResponse.json({ error: 'Could not load your saved postings.' }, { status: 500 });
  }

  const targets: Target[] = (owned ?? [])
    .filter((row): row is Target => typeof row.url === 'string' && row.url.trim().length > 0);

  const results: PostingCheckResult[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    results.push(...await Promise.all(targets.slice(i, i + CONCURRENCY).map(checkOne)));
  }

  return NextResponse.json({ results });
}

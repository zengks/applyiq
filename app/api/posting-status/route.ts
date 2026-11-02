import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeJobUrl } from '@/lib/ai';
import {
  classifyResponse, networkFailureOutcome, safeFetchUrl,
  MAX_URLS_PER_CHECK,
} from '@/lib/postingCheck';
import type { PostingCheckResult } from '@/lib/types';
import { fetchPosting, UnsafePostingUrl } from '@/lib/server/postingFetch';
import { readJsonBody } from '@/lib/server/requestBody';

interface Target { id: string; url: string }

async function checkOne(target: Target): Promise<PostingCheckResult> {
  const checkedAt = new Date().toISOString();
  const url = safeFetchUrl(normalizeJobUrl(target.url));
  if (!url) return { id: target.id, ...networkFailureOutcome('blocked'), checkedAt };

  try {
    const response = await fetchPosting(url.href);
    return { id: target.id, ...classifyResponse(response.status, response.html), checkedAt };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { id: target.id, ...networkFailureOutcome(err instanceof UnsafePostingUrl ? 'blocked' : timedOut ? 'timeout' : 'unreachable'), checkedAt };
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
    body = await readJsonBody(req, 4096) as { ids?: string[] };
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body || !Array.isArray(body.ids)) return NextResponse.json({ error: 'ids must be an array.' }, { status: 400 });
  const ids = body.ids.filter(id => typeof id === 'string' && id).slice(0, MAX_URLS_PER_CHECK);
  if (!ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: 'Invalid application IDs.' }, { status: 400 });
  }
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
  for (let i = 0; i < targets.length; i += 5) {
    results.push(...await Promise.all(targets.slice(i, i + 5).map(checkOne)));
  }

  return NextResponse.json({ results });
}

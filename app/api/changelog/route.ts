import { NextResponse } from 'next/server';
import { normalizeReleases, normalizeCommits, type ChangelogEntry } from '@/lib/version';

const REPO = process.env.GITHUB_REPO ?? 'zengks/applyiq';

/**
 * "What's new" feed. Sources GitHub Releases; if the repo has none yet, falls
 * back to recent commits so the panel isn't empty. Cached for 1 hour.
 * Set GITHUB_TOKEN to raise the unauthenticated rate limit (optional).
 */
export async function GET() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'applyiq',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    let entries: ChangelogEntry[] = [];
    let source: 'releases' | 'commits' = 'releases';

    const rel = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers, next: { revalidate: 3600 },
    });
    if (rel.ok) entries = normalizeReleases(await rel.json());

    if (entries.length === 0) {
      const com = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=20`, {
        headers, next: { revalidate: 3600 },
      });
      if (com.ok) {
        entries = normalizeCommits(await com.json());
        source = 'commits';
      }
    }

    return NextResponse.json({ source, entries });
  } catch (err) {
    console.error('[changelog] fetch failed:', err);
    return NextResponse.json(
      { source: 'releases', entries: [], error: 'Could not load the changelog right now.' },
      { status: 502 },
    );
  }
}

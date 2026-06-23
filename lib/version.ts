// App version + changelog helpers. Version values are injected at build time by
// next.config.ts (NEXT_PUBLIC_APP_VERSION / NEXT_PUBLIC_GIT_SHA).

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? 'dev';
export const VERSION_LABEL = `v${APP_VERSION} (${GIT_SHA})`;

export interface ChangelogEntry {
  id: string;
  title: string;
  date: string | null;
  body: string;
  url: string;
  kind: 'release' | 'commit';
}

interface GhRelease {
  id?: number;
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  html_url?: string;
  published_at?: string | null;
  created_at?: string | null;
  draft?: boolean;
}

interface GhCommit {
  sha: string;
  html_url?: string;
  commit?: { message?: string; author?: { date?: string }; committer?: { date?: string } };
}

/** Normalize the GitHub Releases API response into changelog entries (skips drafts). */
export function normalizeReleases(releases: GhRelease[]): ChangelogEntry[] {
  return (releases ?? [])
    .filter((r) => !r.draft)
    .map((r) => ({
      id: String(r.id ?? r.tag_name ?? ''),
      title: r.name?.trim() || r.tag_name || 'Release',
      date: r.published_at ?? r.created_at ?? null,
      body: (r.body ?? '').trim(),
      url: r.html_url ?? '',
      kind: 'release' as const,
    }));
}

/** Fallback: turn recent commits into changelog entries (subject = title, rest = body). */
export function normalizeCommits(commits: GhCommit[]): ChangelogEntry[] {
  return (commits ?? []).map((c) => {
    const message = c.commit?.message ?? '';
    const [subject, ...rest] = message.split('\n');
    return {
      id: c.sha,
      title: subject.trim() || c.sha.slice(0, 7),
      date: c.commit?.author?.date ?? c.commit?.committer?.date ?? null,
      body: rest.join('\n').trim(),
      url: c.html_url ?? '',
      kind: 'commit' as const,
    };
  });
}

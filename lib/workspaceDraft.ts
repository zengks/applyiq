import { z } from 'zod';
import { sameFields } from './jobWorkspace';

export const DRAFT_TTL_MS = 7 * 86400_000;
const PREFIX = 'applyiq:workspace-drafts:v1:';
const blockedWriters = new Set<string>();
export function blockDraftWrites(ownerId: string) {
  blockedWriters.add(ownerId);
}
export function draftWritesAllowed(ownerId: string) {
  return !blockedWriters.has(ownerId);
}
const accountSchema = z.uuid();
export const detailsSchema = z.object({
  description: z.string().max(60000),
  nextAction: z.string().max(500),
  nextActionDue: z.string().max(10),
  nextActionDone: z.boolean(),
  appliedAt: z.string().max(10),
  notes: z.string().max(60000),
});
export const workspaceDraftSchema = z.object({
  details: detailsSchema,
  baseline: detailsSchema,
  resumeName: z.string().max(200),
  resumeText: z.string().max(60000),
  letterId: z.string().max(100),
  letterTitle: z.string().max(200),
  letterText: z.string().max(30000),
  letterSource: z.string().max(100).nullable(),
  savedLetterText: z.string().max(30000),
  savedLetterTitle: z.string().max(200),
});
export type WorkspaceDraft = z.infer<typeof workspaceDraftSchema>;
const envelopeSchema = z.object({
  version: z.literal(1),
  ownerId: z.uuid(),
  jobId: z.uuid(),
  updatedAt: z.number().finite(),
  data: workspaceDraftSchema,
});
export interface StoredWorkspaceDraft {
  updatedAt: number;
  data: WorkspaceDraft;
}

function ownerPrefix(ownerId: string) {
  if (!accountSchema.safeParse(ownerId).success)
    throw new Error('A verified account is required for draft recovery.');
  return `${PREFIX}${ownerId}:`;
}
function key(ownerId: string, jobId: string) {
  if (!accountSchema.safeParse(jobId).success) throw new Error('Invalid draft workspace.');
  return `${ownerPrefix(ownerId)}${jobId}`;
}
export function draftsEnabled(storage: Storage, ownerId: string) {
  return storage.getItem(`${ownerPrefix(ownerId)}enabled`) === 'yes';
}
export function setDraftsEnabled(storage: Storage, ownerId: string, enabled: boolean) {
  if (!enabled) clearAccountDrafts(storage, ownerId);
  else {
    storage.setItem(`${ownerPrefix(ownerId)}enabled`, 'yes');
    blockedWriters.delete(ownerId);
  }
}
export function clearAccountDrafts(storage: Storage, ownerId: string) {
  const prefix = ownerPrefix(ownerId);
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (name): name is string => !!name && name.startsWith(prefix),
  );
  keys.forEach((name) => storage.removeItem(name));
}
export function removeWorkspaceDraft(storage: Storage, ownerId: string, jobId: string) {
  storage.removeItem(key(ownerId, jobId));
}

export function readWorkspaceDraft(
  storage: Storage,
  ownerId: string,
  jobId: string,
  now = Date.now(),
): StoredWorkspaceDraft | null {
  const name = key(ownerId, jobId);
  const raw = storage.getItem(name);
  if (!raw) return null;
  try {
    const value = envelopeSchema.parse(JSON.parse(raw));
    if (
      value.ownerId !== ownerId ||
      value.jobId !== jobId ||
      now - value.updatedAt >= DRAFT_TTL_MS ||
      value.updatedAt > now + 60_000
    )
      throw new Error('Stale draft');
    return { updatedAt: value.updatedAt, data: value.data };
  } catch {
    storage.removeItem(name);
    return null;
  }
}

export function writeWorkspaceDraft(
  storage: Storage,
  ownerId: string,
  jobId: string,
  data: WorkspaceDraft,
  now = Date.now(),
) {
  const name = key(ownerId, jobId);
  const value = envelopeSchema.parse({
    version: 1,
    ownerId,
    jobId,
    updatedAt: now,
    data,
  });
  // Bound local storage use; preserve the newest drafts for this account only.
  const prefix = ownerPrefix(ownerId);
  const drafts: Array<{ name: string; updatedAt: number }> = [];
  for (const item of Array.from({ length: storage.length }, (_, index) => storage.key(index))) {
    if (!item?.startsWith(prefix) || item.endsWith(':enabled') || item === name) continue;
    const candidateId = item.slice(prefix.length);
    if (!accountSchema.safeParse(candidateId).success) continue;
    const existing = readWorkspaceDraft(storage, ownerId, candidateId, now);
    if (existing) drafts.push({ name: item, updatedAt: existing.updatedAt });
  }
  storage.setItem(name, JSON.stringify(value));
  // A quota failure must leave existing drafts intact.
  drafts
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(9)
    .forEach((item) => storage.removeItem(item.name));
}

export function detailsChanged(draft: WorkspaceDraft) {
  return !sameFields(draft.details, draft.baseline);
}
export function hasDraftEdits(draft: WorkspaceDraft) {
  return (
    detailsChanged(draft) ||
    !!draft.resumeName.trim() ||
    !!draft.resumeText.trim() ||
    draft.letterText !== draft.savedLetterText ||
    draft.letterTitle !== draft.savedLetterTitle
  );
}
/** Only recover locally edited fields. The current saved baseline stays authoritative. */
export function recoverDetails(saved: WorkspaceDraft['details'], draft: WorkspaceDraft) {
  const restored = { ...saved };
  let conflicts = 0;
  for (const field of Object.keys(saved) as Array<keyof typeof saved>) {
    if (draft.details[field] === draft.baseline[field]) continue;
    if (saved[field] !== draft.baseline[field] && saved[field] !== draft.details[field])
      conflicts++;
    // Assign through a shared value record while retaining the validated details type.
    (restored as Record<string, string | boolean>)[field] = draft.details[field];
  }
  return { details: restored, conflicts };
}

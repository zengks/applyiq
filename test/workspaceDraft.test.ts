import { beforeEach, describe, expect, it } from 'vitest';
import {
  DRAFT_TTL_MS,
  clearAccountDrafts,
  draftsEnabled,
  setDraftsEnabled,
  readWorkspaceDraft,
  writeWorkspaceDraft,
  hasDraftEdits,
  recoverDetails,
  type WorkspaceDraft,
} from '@/lib/workspaceDraft';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const job = '33333333-3333-4333-8333-333333333333';
const baseline = {
  description: 'Original posting',
  nextAction: 'Prepare',
  nextActionDue: '',
  nextActionDone: false,
  appliedAt: '',
  notes: '',
};
const draft = (): WorkspaceDraft => ({
  details: { ...baseline, nextAction: 'My draft follow-up' },
  baseline: { ...baseline },
  resumeName: '',
  resumeText: '',
  letterId: '',
  letterTitle: 'Cover letter',
  letterText: '',
  letterSource: null,
  savedLetterText: '',
  savedLetterTitle: 'Cover letter',
});
beforeEach(() => localStorage.clear());

describe('private device draft storage', () => {
  it('is opt-in and separates owners even when a job identifier is the same', () => {
    expect(draftsEnabled(localStorage, owner)).toBe(false);
    setDraftsEnabled(localStorage, owner, true);
    writeWorkspaceDraft(localStorage, owner, job, draft(), 1000);
    expect(readWorkspaceDraft(localStorage, owner, job, 2000)?.data.details.nextAction).toBe(
      'My draft follow-up',
    );
    expect(draftsEnabled(localStorage, other)).toBe(false);
    expect(readWorkspaceDraft(localStorage, other, job, 2000)).toBeNull();
  });
  it('clears only the signed-in account, including its opt-in preference', () => {
    for (const id of [owner, other]) {
      setDraftsEnabled(localStorage, id, true);
      writeWorkspaceDraft(localStorage, id, job, draft(), 1000);
    }
    clearAccountDrafts(localStorage, owner);
    expect(readWorkspaceDraft(localStorage, owner, job, 2000)).toBeNull();
    expect(draftsEnabled(localStorage, owner)).toBe(false);
    expect(readWorkspaceDraft(localStorage, other, job, 2000)).not.toBeNull();
    expect(draftsEnabled(localStorage, other)).toBe(true);
  });
  it('expires at seven days and rejects future or corrupt records', () => {
    writeWorkspaceDraft(localStorage, owner, job, draft(), 1000);
    expect(readWorkspaceDraft(localStorage, owner, job, 1000 + DRAFT_TTL_MS)).toBeNull();
    writeWorkspaceDraft(localStorage, owner, job, draft(), 1000000);
    expect(readWorkspaceDraft(localStorage, owner, job, 0)).toBeNull();
    localStorage.setItem(`applyiq:workspace-drafts:v1:${owner}:${job}`, '{bad');
    expect(readWorkspaceDraft(localStorage, owner, job)).toBeNull();
  });
  it('does not trust a forged owner embedded in browser storage', () => {
    writeWorkspaceDraft(localStorage, other, job, draft(), 1000);
    localStorage.setItem(
      `applyiq:workspace-drafts:v1:${owner}:${job}`,
      localStorage.getItem(`applyiq:workspace-drafts:v1:${other}:${job}`)!,
    );
    expect(readWorkspaceDraft(localStorage, owner, job, 2000)).toBeNull();
  });
  it('keeps at most ten recovery drafts for one account', () => {
    for (let i = 0; i < 12; i++)
      writeWorkspaceDraft(
        localStorage,
        owner,
        `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`,
        draft(),
        1000 + i,
      );
    expect(localStorage.length).toBe(10);
    expect(
      readWorkspaceDraft(localStorage, owner, '33333333-3333-4333-8333-000000000000', 2000),
    ).toBeNull();
  });
  it('does not mistake object-key order for unsaved changes', () => {
    const value = draft();
    value.details = {
      notes: '',
      appliedAt: '',
      nextActionDone: false,
      nextActionDue: '',
      nextAction: 'Prepare',
      description: 'Original posting',
    };
    expect(hasDraftEdits(value)).toBe(false);
  });
  it('restores only edited fields and flags conflicts against newer saved data', () => {
    const saved = {
      ...baseline,
      description: 'Newer saved posting',
      nextAction: 'Server follow-up',
    };
    expect(recoverDetails(saved, draft())).toEqual({
      details: { ...saved, nextAction: 'My draft follow-up' },
      conflicts: 1,
    });
  });
  it('surfaces storage failure rather than pretending a recovery copy exists', () => {
    const blocked = {
      ...localStorage,
      length: 0,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
    } as Storage;
    expect(() => writeWorkspaceDraft(blocked, owner, job, draft())).toThrow();
  });
});

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  draftsEnabled,
  draftWritesAllowed,
  setDraftsEnabled,
  readWorkspaceDraft,
  writeWorkspaceDraft,
  removeWorkspaceDraft,
  hasDraftEdits,
  type WorkspaceDraft,
  type StoredWorkspaceDraft,
} from './workspaceDraft';

export function useWorkspaceDraft(
  ownerId: string | null | undefined,
  jobId: string,
  data: WorkspaceDraft,
  ready: boolean,
  capture?: () => WorkspaceDraft,
) {
  const [enabled, setEnabled] = useState(false);
  const [candidate, setCandidate] = useState<StoredWorkspaceDraft | null>(null);
  const [error, setError] = useState('');
  const [checkedOwner, setCheckedOwner] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const latest = useRef(data);
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  /* eslint-disable react-hooks/set-state-in-effect -- Read the verified account's external browser storage only after mount; React batches this initialization. */
  useEffect(() => {
    if (!ownerId) return;
    setEnabled(false);
    setCandidate(null);
    setLastSaved(null);
    try {
      const allowed = draftsEnabled(localStorage, ownerId);
      setEnabled(allowed);
      setCandidate(allowed ? readWorkspaceDraft(localStorage, ownerId, jobId) : null);
      setError('');
    } catch {
      setError(
        'This browser cannot store recovery drafts. Keep the page open until your changes are saved.',
      );
    }
    setCheckedOwner(ownerId);
  }, [ownerId, jobId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = useCallback(() => {
    if (!ownerId || checkedOwner !== ownerId || !enabled || candidate || !ready) return;
    try {
      // Sign-out/opt-out removes this preference. Cleanup must not recreate it.
      if (!draftWritesAllowed(ownerId) || !draftsEnabled(localStorage, ownerId)) return;
      const snapshot = captureRef.current?.() ?? latest.current;
      if (hasDraftEdits(snapshot)) {
        writeWorkspaceDraft(localStorage, ownerId, jobId, snapshot);
        setLastSaved(Date.now());
      } else {
        removeWorkspaceDraft(localStorage, ownerId, jobId);
        setLastSaved(null);
      }
      setError('');
    } catch {
      setError(
        'The recovery draft could not be stored on this device. Your database saves are separate; keep this page open until they finish.',
      );
    }
  }, [ownerId, checkedOwner, enabled, candidate, ready, jobId]);

  useEffect(() => {
    if (!enabled || !ready || candidate) return;
    const timer = window.setTimeout(persist, 400);
    return () => clearTimeout(timer);
  }, [data, enabled, ready, candidate, persist]);
  useEffect(() => {
    const flush = () => persist();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      persist();
    };
  }, [persist]);

  function toggle(allowed: boolean) {
    if (!ownerId) return;
    try {
      setDraftsEnabled(localStorage, ownerId, allowed);
      setEnabled(allowed);
      setError('');
      if (!allowed) {
        setCandidate(null);
        setLastSaved(null);
      }
    } catch {
      setError('Draft recovery could not be changed on this browser.');
    }
  }
  function dismiss() {
    if (!ownerId) return;
    try {
      removeWorkspaceDraft(localStorage, ownerId, jobId);
      setCandidate(null);
      setLastSaved(null);
      setError('');
    } catch {
      setError('Could not remove the recovery draft from this browser.');
    }
  }
  return {
    enabled: checkedOwner === ownerId && enabled,
    candidate: checkedOwner === ownerId ? candidate : null,
    error,
    lastSaved,
    toggle,
    dismiss,
    flush: persist,
  };
}

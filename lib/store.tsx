'use client';

import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import {
  Application, AIResult, Resume, ActiveView, ActiveTab, BillingCycle,
  NewJobForm, AppStatus, Subscription, SubStatus, PostingStatus, PostingCheckResult,
} from './types';
import { needsCheck, MAX_URLS_PER_CHECK } from './postingCheck';

export interface State {
  loading: boolean;
  darkMode: boolean;
  activeView: ActiveView;
  email: string;
  profileName: string;
  profileTitle: string;
  resumeText: string;
  billingCycle: BillingCycle;
  applications: Application[];
  showOnboarding: boolean;
  onboardingStep: 1 | 2 | 3;
  showAddJobModal: boolean;
  showDetailDrawer: boolean;
  selectedAppId: string | null;
  newJob: NewJobForm;
  jobUrl: string;
  jobDescription: string;
  aiLoading: boolean;
  analysisShown: boolean;
  aiResult: AIResult | null;
  aiError: boolean;
  aiErrorMsg: string;
  activeTab: ActiveTab;
  resumes: Resume[];
  coverCopied: boolean;
  subscription: Subscription | null;
  /** Ids of postings whose link check is currently in flight. */
  checkingPostingIds: string[];
  /** Set when the last link check couldn't run at all (network/server error). */
  postingCheckError: string;
}

interface HydratePayload {
  email: string;
  profileName: string;
  profileTitle: string;
  resumeText: string;
  darkMode: boolean;
  billingCycle: BillingCycle;
  onboarded: boolean;
  applications: Application[];
  resumes: Resume[];
  subscription: Subscription | null;
}

export type Action =
  | { type: 'HYDRATE'; payload: HydratePayload }
  | { type: 'SET_DARK'; value: boolean }
  | { type: 'SET_VIEW'; view: ActiveView }
  | { type: 'SET_PROFILE'; name: string; title: string; resume: string }
  | { type: 'OPEN_PRICING' }
  | { type: 'CLOSE_PRICING' }
  | { type: 'SET_BILLING'; cycle: BillingCycle }
  | { type: 'ADD_APP'; app: Application }
  | { type: 'UPDATE_APP_STATUS'; id: string; status: AppStatus }
  | { type: 'UPDATE_APP_NOTES'; id: string; notes: string }
  | { type: 'DELETE_APP'; id: string }
  | { type: 'OPEN_DETAIL'; id: string }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'OPEN_ADD_JOB' }
  | { type: 'CLOSE_ADD_JOB' }
  | { type: 'SET_NEW_JOB'; field: keyof NewJobForm; value: string }
  | { type: 'SET_ONBOARDING'; step: 1 | 2 | 3 }
  | { type: 'CLOSE_ONBOARDING' }
  | { type: 'SET_JOB_URL'; value: string }
  | { type: 'SET_JOB_DESC'; value: string }
  | { type: 'AI_START' }
  | { type: 'AI_SUCCESS'; result: AIResult }
  | { type: 'AI_ERROR'; message?: string }
  | { type: 'AI_RESET' }
  | { type: 'SET_TAB'; tab: ActiveTab }
  | { type: 'SAVE_AI_TO_BOARD' }
  | { type: 'SET_COVER_COPIED'; value: boolean }
  | { type: 'SET_DEFAULT_RESUME'; id: string }
  | { type: 'ADD_RESUME'; resume: Resume }
  | { type: 'POSTING_CHECK_START'; ids: string[] }
  | { type: 'POSTING_CHECK_DONE'; results: PostingCheckResult[] }
  | { type: 'POSTING_CHECK_FAIL'; ids: string[]; message: string };

function emptyNewJob(): NewJobForm {
  return { company: '', role: '', url: '', status: 'saved', deadline: '', notes: '' };
}

export const INITIAL: State = {
  loading: true,
  darkMode: false,
  activeView: 'dashboard',
  email: '',
  profileName: '',
  profileTitle: '',
  resumeText: '',
  billingCycle: 'annual',
  applications: [],
  showOnboarding: false,
  onboardingStep: 1,
  showAddJobModal: false,
  showDetailDrawer: false,
  selectedAppId: null,
  newJob: emptyNewJob(),
  jobUrl: '',
  jobDescription: '',
  aiLoading: false,
  analysisShown: false,
  aiResult: null,
  aiError: false,
  aiErrorMsg: '',
  activeTab: 'keywords',
  resumes: [],
  coverCopied: false,
  subscription: null,
  checkingPostingIds: [],
  postingCheckError: '',
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE': {
      const p = action.payload;
      return {
        ...state,
        loading: false,
        darkMode: p.darkMode,
        email: p.email,
        profileName: p.profileName,
        profileTitle: p.profileTitle,
        resumeText: p.resumeText,
        billingCycle: p.billingCycle,
        applications: p.applications,
        resumes: p.resumes,
        subscription: p.subscription,
        showOnboarding: !p.onboarded,
      };
    }
    case 'SET_DARK': return { ...state, darkMode: action.value };
    case 'SET_VIEW': return { ...state, activeView: action.view };
    case 'SET_PROFILE': return { ...state, profileName: action.name, profileTitle: action.title, resumeText: action.resume };
    // OPEN_PRICING / CLOSE_PRICING are handled in the dispatch wrapper (separate useState).
    case 'SET_BILLING': return { ...state, billingCycle: action.cycle };
    case 'ADD_APP': return { ...state, applications: [action.app, ...state.applications] };
    case 'UPDATE_APP_STATUS': return { ...state, applications: state.applications.map(a => a.id === action.id ? { ...a, status: action.status } : a) };
    case 'UPDATE_APP_NOTES': return { ...state, applications: state.applications.map(a => a.id === action.id ? { ...a, notes: action.notes } : a) };
    case 'DELETE_APP': return { ...state, applications: state.applications.filter(a => a.id !== action.id), showDetailDrawer: false, selectedAppId: null };
    case 'OPEN_DETAIL': return { ...state, showDetailDrawer: true, selectedAppId: action.id };
    case 'CLOSE_DETAIL': return { ...state, showDetailDrawer: false, selectedAppId: null };
    case 'OPEN_ADD_JOB': return { ...state, showAddJobModal: true, newJob: emptyNewJob() };
    case 'CLOSE_ADD_JOB': return { ...state, showAddJobModal: false };
    case 'SET_NEW_JOB': return { ...state, newJob: { ...state.newJob, [action.field]: action.value } };
    case 'SET_ONBOARDING': return { ...state, onboardingStep: action.step };
    case 'CLOSE_ONBOARDING': return { ...state, showOnboarding: false };
    case 'SET_JOB_URL': return { ...state, jobUrl: action.value };
    case 'SET_JOB_DESC': return { ...state, jobDescription: action.value };
    case 'AI_START': return { ...state, aiLoading: true, aiError: false, aiErrorMsg: '', analysisShown: false };
    case 'AI_SUCCESS': return { ...state, aiLoading: false, analysisShown: true, aiResult: action.result, activeTab: 'keywords' };
    case 'AI_ERROR': return { ...state, aiLoading: false, aiError: true, aiErrorMsg: action.message ?? '' };
    case 'AI_RESET': return { ...state, aiLoading: false, aiError: false, aiErrorMsg: '', analysisShown: false, aiResult: null, jobDescription: '', jobUrl: '' };
    case 'SET_TAB': return { ...state, activeTab: action.tab };
    case 'SAVE_AI_TO_BOARD': {
      if (!state.aiResult) return state;
      const newApp: Application = {
        id: crypto.randomUUID(),
        company: state.aiResult.company || 'Unknown',
        role: state.aiResult.role || 'Unknown',
        status: 'saved',
        match: state.aiResult.matchScore,
        deadline: null,
        url: state.jobUrl,
        notes: '',
        postingStatus: 'unknown',
        postingCheckedAt: null,
        postingNote: '',
      };
      return { ...state, applications: [newApp, ...state.applications], activeView: 'applications' };
    }
    case 'SET_COVER_COPIED': return { ...state, coverCopied: action.value };
    case 'SET_DEFAULT_RESUME': return { ...state, resumes: state.resumes.map(r => ({ ...r, isDefault: r.id === action.id })) };
    case 'ADD_RESUME': return { ...state, resumes: [action.resume, ...state.resumes] };
    case 'POSTING_CHECK_START':
      return {
        ...state,
        postingCheckError: '',
        checkingPostingIds: [...new Set([...state.checkingPostingIds, ...action.ids])],
      };
    case 'POSTING_CHECK_DONE': {
      const byId = new Map(action.results.map(r => [r.id, r]));
      return {
        ...state,
        checkingPostingIds: state.checkingPostingIds.filter(id => !byId.has(id)),
        applications: state.applications.map(a => {
          const r = byId.get(a.id);
          return r ? { ...a, postingStatus: r.status, postingNote: r.note, postingCheckedAt: r.checkedAt } : a;
        }),
      };
    }
    case 'POSTING_CHECK_FAIL':
      return {
        ...state,
        checkingPostingIds: state.checkingPostingIds.filter(id => !action.ids.includes(id)),
        postingCheckError: action.message,
      };
    default: return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase write-through: mirror data-mutating actions to the database.
// `state` is the state *after* the reducer ran, so freshly-created rows are present.
// ─────────────────────────────────────────────────────────────────────────────
function appRow(a: Application, userId: string) {
  return {
    id: a.id, user_id: userId, company: a.company, role: a.role,
    status: a.status, match: a.match, deadline: a.deadline, url: a.url, notes: a.notes,
    posting_status: a.postingStatus, posting_checked_at: a.postingCheckedAt, posting_note: a.postingNote,
  };
}
function resumeRow(r: Resume, userId: string) {
  return {
    id: r.id, user_id: userId, name: r.name, file_path: r.filePath, text: r.text,
    jobs_matched: r.jobsMatched, ats_score: r.atsScore, is_default: r.isDefault,
  };
}

export async function persistAction(action: Action, state: State, supabase: SupabaseClient, userId: string) {
  try {
    switch (action.type) {
      case 'ADD_APP':
      case 'SAVE_AI_TO_BOARD': {
        const app = state.applications[0];
        if (app) await supabase.from('applications').insert(appRow(app, userId));
        break;
      }
      case 'UPDATE_APP_STATUS':
        await supabase.from('applications').update({ status: action.status }).eq('id', action.id);
        break;
      case 'UPDATE_APP_NOTES':
        await supabase.from('applications').update({ notes: action.notes }).eq('id', action.id);
        break;
      case 'DELETE_APP':
        await supabase.from('applications').delete().eq('id', action.id);
        break;
      case 'POSTING_CHECK_DONE':
        await Promise.all(action.results.map(r =>
          supabase.from('applications')
            .update({ posting_status: r.status, posting_checked_at: r.checkedAt, posting_note: r.note })
            .eq('id', r.id)
        ));
        break;
      case 'ADD_RESUME': {
        const r = state.resumes[0];
        if (r) await supabase.from('resumes').insert(resumeRow(r, userId));
        break;
      }
      case 'SET_DEFAULT_RESUME':
        await supabase.from('resumes').update({ is_default: false }).eq('user_id', userId);
        await supabase.from('resumes').update({ is_default: true }).eq('id', action.id);
        break;
      case 'SET_PROFILE':
        await supabase.from('profiles').upsert({
          id: userId, full_name: state.profileName, job_title: state.profileTitle, resume_text: state.resumeText,
        });
        break;
      case 'SET_DARK':
        await supabase.from('profiles').update({ dark_mode: action.value }).eq('id', userId);
        break;
      case 'SET_BILLING':
        await supabase.from('profiles').update({ billing_cycle: action.cycle }).eq('id', userId);
        break;
      case 'CLOSE_ONBOARDING':
        await supabase.from('profiles').update({ onboarded: true }).eq('id', userId);
        break;
    }
  } catch (err) {
    console.error(`Persist failed for ${action.type}:`, err);
  }
}

export interface DerivedValues {
  isPro: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  trialDaysTotal: number;
  showTrialBanner: boolean;
  showExpiredBanner: boolean;
  urgentCount: number;
  selectedApp: Application | null;
  /** Saved jobs whose posting is gone or closed, newest-added first. */
  stalePostings: Application[];
  staleCount: number;
  /** True while any link check is in flight. */
  checkingPostings: boolean;
}

/** Pure derivation of subscription/trial/urgency values. `now` is injected for testability. */
export function deriveStoreValues(state: State, now: number): DerivedValues {
  const sub = state.subscription;
  const isPro = sub?.status === 'active';
  const isTrialing = sub?.status === 'trialing';
  const trialDaysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now) / 86400000))
    : 0;
  const urgentCount = state.applications.filter(a => {
    if (!a.deadline) return false;
    const d = Math.ceil((new Date(a.deadline).getTime() - now) / 86400000);
    return d >= 0 && d <= 3;
  }).length;
  // A closed posting only matters while the user might still act on it — once a
  // job is an offer or a rejection, the dead link is just noise.
  const stalePostings = state.applications.filter(
    a => (a.postingStatus === 'expired' || a.postingStatus === 'removed')
      && a.status !== 'offer' && a.status !== 'rejected',
  );
  return {
    isPro,
    isTrialing,
    trialDaysLeft,
    trialDaysTotal: 14,
    showTrialBanner: isTrialing && trialDaysLeft > 0,
    showExpiredBanner: !state.loading && !isPro && !isTrialing,
    urgentCount,
    selectedApp: state.selectedAppId ? state.applications.find(a => a.id === state.selectedAppId) ?? null : null,
    stalePostings,
    staleCount: stalePostings.length,
    checkingPostings: state.checkingPostingIds.length > 0,
  };
}

/**
 * Which saved postings are worth re-checking right now: they have a URL, aren't
 * already settled (offer / rejection), and haven't been checked in a day.
 * Capped to what one request may carry.
 */
export function postingsDueForCheck(apps: Application[], now: number = Date.now()): string[] {
  return apps
    .filter(a => a.url?.trim() && a.status !== 'offer' && a.status !== 'rejected' && needsCheck(a.postingCheckedAt, now))
    .slice(0, MAX_URLS_PER_CHECK)
    .map(a => a.id);
}

interface Ctx extends State, DerivedValues {
  showPricingModal: boolean;
  dispatch: (action: Action) => void;
  /** Re-checks the given postings (all due ones when omitted) against their source. */
  checkPostings: (ids?: string[]) => Promise<void>;
}

const StoreCtx = createContext<Ctx | null>(null);

function mapSubscription(row: Record<string, unknown> | null): Subscription | null {
  if (!row) return null;
  return {
    status: (row.status as SubStatus) ?? null,
    trialEndsAt: (row.trial_ends_at as string) ?? null,
    currentPeriodEnd: (row.current_period_end as string) ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    priceId: (row.price_id as string) ?? null,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [state, rawDispatch] = useReducer(reducer, INITIAL);
  // showPricingModal is tracked separately to avoid widening the persisted State type.
  const [showPricingModal, setShowPricingModal] = useState(false);

  const stateRef = useRef(state);
  const userIdRef = useRef<string | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Load everything for the signed-in user.
  const hydrate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { rawDispatch({ type: 'HYDRATE', payload: emptyHydrate() }); return; }
    userIdRef.current = user.id;

    const [profileRes, appsRes, resumesRes, subRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('resumes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const profile = profileRes.data;
    rawDispatch({
      type: 'HYDRATE',
      payload: {
        email: user.email ?? '',
        profileName: profile?.full_name ?? '',
        profileTitle: profile?.job_title ?? '',
        resumeText: profile?.resume_text ?? '',
        darkMode: Boolean(profile?.dark_mode),
        billingCycle: (profile?.billing_cycle as BillingCycle) ?? 'annual',
        onboarded: Boolean(profile?.onboarded),
        applications: (appsRes.data ?? []).map((a): Application => ({
          id: a.id, company: a.company, role: a.role, status: a.status,
          match: a.match, deadline: a.deadline, url: a.url, notes: a.notes,
          // Defaults keep the app working before the posting_status migration is applied.
          postingStatus: (a.posting_status as PostingStatus) ?? 'unknown',
          postingCheckedAt: a.posting_checked_at ?? null,
          postingNote: a.posting_note ?? '',
        })),
        resumes: (resumesRes.data ?? []).map((r): Resume => ({
          id: r.id, name: r.name, updatedAt: (r.updated_at ?? '').slice(0, 10),
          jobsMatched: r.jobs_matched, atsScore: r.ats_score, isDefault: r.is_default,
          text: r.text, filePath: r.file_path,
        })),
        subscription: mapSubscription(subRes.data),
      },
    });
  }, [supabase]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  // Re-fetch the subscription after returning from Stripe Checkout (webhook may lag).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
      const t = setTimeout(() => { void hydrate(); }, 2500);
      return () => clearTimeout(t);
    }
  }, [hydrate]);

  // Reflect dark mode on <body>.
  useEffect(() => { document.body.classList.toggle('dark', state.darkMode); }, [state.darkMode]);

  const dispatch = useCallback((action: Action) => {
    if (action.type === 'OPEN_PRICING') { setShowPricingModal(true); return; }
    if (action.type === 'CLOSE_PRICING') { setShowPricingModal(false); return; }
    const next = reducer(stateRef.current, action);
    stateRef.current = next;
    rawDispatch(action);
    if (userIdRef.current) void persistAction(action, next, supabase, userIdRef.current);
  }, [supabase]);

  // Ask the server whether saved postings are still live. With no ids, checks
  // everything that's due; skips anything already in flight.
  const checkPostings = useCallback(async (ids?: string[]) => {
    const current = stateRef.current;
    if (!userIdRef.current) return;
    const inFlight = new Set(current.checkingPostingIds);
    const targets = (ids ?? postingsDueForCheck(current.applications))
      .filter(id => !inFlight.has(id))
      .slice(0, MAX_URLS_PER_CHECK);
    if (targets.length === 0) return;

    dispatch({ type: 'POSTING_CHECK_START', ids: targets });
    try {
      const res = await fetch('/api/posting-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Check failed.');
      dispatch({ type: 'POSTING_CHECK_DONE', results: data.results ?? [] });
    } catch (err) {
      console.error('Posting check failed:', err);
      dispatch({
        type: 'POSTING_CHECK_FAIL',
        ids: targets,
        message: "Couldn't check your job links just now. Try again in a moment.",
      });
    }
  }, [dispatch]);

  // Sweep stale postings once the user's data has loaded.
  const swept = useRef(false);
  useEffect(() => {
    if (state.loading || swept.current) return;
    swept.current = true;
    void checkPostings();
  }, [state.loading, checkPostings]);

  // eslint-disable-next-line react-hooks/purity -- time-based derived values, recomputed each render by design
  const derived = deriveStoreValues(state, Date.now());

  return (
    <StoreCtx.Provider value={{ ...state, showPricingModal, dispatch, checkPostings, ...derived }}>
      {children}
    </StoreCtx.Provider>
  );
}

function emptyHydrate(): HydratePayload {
  return {
    email: '', profileName: '', profileTitle: '', resumeText: '', darkMode: false,
    billingCycle: 'annual', onboarded: true, applications: [], resumes: [], subscription: null,
  };
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

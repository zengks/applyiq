'use client';

import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import {
  Application, AIResult, Resume, ActiveView, ActiveTab, BillingCycle,
  NewJobForm, AppStatus, Subscription, SubStatus,
} from './types';

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
  | { type: 'ADD_RESUME'; resume: Resume };

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
      };
      return { ...state, applications: [newApp, ...state.applications], activeView: 'applications' };
    }
    case 'SET_COVER_COPIED': return { ...state, coverCopied: action.value };
    case 'SET_DEFAULT_RESUME': return { ...state, resumes: state.resumes.map(r => ({ ...r, isDefault: r.id === action.id })) };
    case 'ADD_RESUME': return { ...state, resumes: [action.resume, ...state.resumes] };
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
  return {
    isPro,
    isTrialing,
    trialDaysLeft,
    trialDaysTotal: 14,
    showTrialBanner: isTrialing && trialDaysLeft > 0,
    showExpiredBanner: !state.loading && !isPro && !isTrialing,
    urgentCount,
    selectedApp: state.selectedAppId ? state.applications.find(a => a.id === state.selectedAppId) ?? null : null,
  };
}

interface Ctx extends State, DerivedValues {
  showPricingModal: boolean;
  dispatch: (action: Action) => void;
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

  // eslint-disable-next-line react-hooks/purity -- time-based derived values, recomputed each render by design
  const derived = deriveStoreValues(state, Date.now());

  return (
    <StoreCtx.Provider value={{ ...state, showPricingModal, dispatch, ...derived }}>
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

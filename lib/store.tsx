'use client';

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { Application, AIResult, Resume, ActiveView, ActiveTab, BillingCycle, NewJobForm, AppStatus } from './types';

const SEED_APPS: Application[] = [
  { id: 1, company: 'Stripe', role: 'Senior Frontend Engineer', status: 'interview', match: 91, deadline: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], url: '', notes: '' },
  { id: 2, company: 'Linear', role: 'Product Designer', status: 'applied', match: 78, deadline: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0], url: '', notes: '' },
  { id: 3, company: 'Vercel', role: 'DevRel Engineer', status: 'saved', match: 65, deadline: null, url: '', notes: '' },
  { id: 4, company: 'Notion', role: 'Full-Stack Developer', status: 'offer', match: 88, deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], url: '', notes: '' },
  { id: 5, company: 'Figma', role: 'UX Engineer', status: 'applied', match: 72, deadline: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0], url: '', notes: '' },
  { id: 6, company: 'GitHub', role: 'Platform Engineer', status: 'rejected', match: 55, deadline: null, url: '', notes: '' },
  { id: 7, company: 'Anthropic', role: 'ML Engineer', status: 'saved', match: 83, deadline: null, url: '', notes: '' },
];

const SEED_RESUMES: Resume[] = [
  { id: 1, name: 'Resume — Senior Engineer', updatedAt: '2026-06-15', jobsMatched: 12, atsScore: 87, isDefault: true, text: '' },
  { id: 2, name: 'Resume — Product Focus', updatedAt: '2026-05-22', jobsMatched: 7, atsScore: 74, isDefault: false, text: '' },
  { id: 3, name: 'Resume — General Tech', updatedAt: '2026-04-10', jobsMatched: 19, atsScore: 68, isDefault: false, text: '' },
];

interface State {
  darkMode: boolean;
  activeView: ActiveView;
  profileName: string;
  profileTitle: string;
  resumeText: string;
  isPro: boolean;
  trialDaysUsed: number;
  trialDaysTotal: number;
  showPricingModal: boolean;
  billingCycle: BillingCycle;
  applications: Application[];
  showOnboarding: boolean;
  onboardingStep: 1 | 2 | 3;
  showAddJobModal: boolean;
  showDetailDrawer: boolean;
  selectedAppId: number | null;
  newJob: NewJobForm;
  jobUrl: string;
  jobDescription: string;
  aiLoading: boolean;
  analysisShown: boolean;
  aiResult: AIResult | null;
  aiError: boolean;
  activeTab: ActiveTab;
  resumes: Resume[];
  coverCopied: boolean;
}

type Action =
  | { type: 'SET_DARK'; value: boolean }
  | { type: 'SET_VIEW'; view: ActiveView }
  | { type: 'SET_PROFILE'; name: string; title: string; resume: string }
  | { type: 'SET_PRO'; value: boolean }
  | { type: 'OPEN_PRICING' }
  | { type: 'CLOSE_PRICING' }
  | { type: 'SET_BILLING'; cycle: BillingCycle }
  | { type: 'ADD_APP'; app: Application }
  | { type: 'UPDATE_APP_STATUS'; id: number; status: AppStatus }
  | { type: 'UPDATE_APP_NOTES'; id: number; notes: string }
  | { type: 'DELETE_APP'; id: number }
  | { type: 'OPEN_DETAIL'; id: number }
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
  | { type: 'AI_ERROR' }
  | { type: 'AI_RESET' }
  | { type: 'SET_TAB'; tab: ActiveTab }
  | { type: 'SAVE_AI_TO_BOARD' }
  | { type: 'SET_COVER_COPIED'; value: boolean }
  | { type: 'SET_DEFAULT_RESUME'; id: number }
  | { type: 'ADD_RESUME'; resume: Resume };

function emptyNewJob(): NewJobForm {
  return { company: '', role: '', url: '', status: 'saved', deadline: '', notes: '' };
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DARK': return { ...state, darkMode: action.value };
    case 'SET_VIEW': return { ...state, activeView: action.view };
    case 'SET_PROFILE': return { ...state, profileName: action.name, profileTitle: action.title, resumeText: action.resume };
    case 'SET_PRO': return { ...state, isPro: action.value };
    case 'OPEN_PRICING': return { ...state, showPricingModal: true };
    case 'CLOSE_PRICING': return { ...state, showPricingModal: false };
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
    case 'AI_START': return { ...state, aiLoading: true, aiError: false, analysisShown: false };
    case 'AI_SUCCESS': return { ...state, aiLoading: false, analysisShown: true, aiResult: action.result, activeTab: 'keywords' };
    case 'AI_ERROR': return { ...state, aiLoading: false, aiError: true };
    case 'AI_RESET': return { ...state, aiLoading: false, aiError: false, analysisShown: false, aiResult: null, jobDescription: '', jobUrl: '' };
    case 'SET_TAB': return { ...state, activeTab: action.tab };
    case 'SAVE_AI_TO_BOARD': {
      if (!state.aiResult) return state;
      const newApp: Application = {
        id: Date.now(),
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

interface Ctx extends State {
  dispatch: React.Dispatch<Action>;
  selectedApp: Application | null;
  trialDaysLeft: number;
  showTrialBanner: boolean;
  showExpiredBanner: boolean;
  urgentCount: number;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const onboarded = load<string>('applyiq_onboarded', '');
    return {
      darkMode: load<boolean>('applyiq_dark', false),
      activeView: 'dashboard' as ActiveView,
      profileName: load<string>('applyiq_name', ''),
      profileTitle: load<string>('applyiq_title', ''),
      resumeText: load<string>('applyiq_resume', ''),
      isPro: load<string>('applyiq_pro', '') === '1',
      trialDaysUsed: load<number>('applyiq_trial_used', 0),
      trialDaysTotal: 14,
      showPricingModal: false,
      billingCycle: 'annual' as BillingCycle,
      applications: load<Application[]>('applyiq_apps', SEED_APPS),
      showOnboarding: onboarded !== '1',
      onboardingStep: 1 as const,
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
      activeTab: 'keywords' as ActiveTab,
      resumes: load<Resume[]>('applyiq_resumes', SEED_RESUMES),
      coverCopied: false,
    };
  });

  // Persist key state to localStorage
  useEffect(() => {
    localStorage.setItem('applyiq_dark', JSON.stringify(state.darkMode));
    document.body.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  useEffect(() => { localStorage.setItem('applyiq_apps', JSON.stringify(state.applications)); }, [state.applications]);
  useEffect(() => { localStorage.setItem('applyiq_resumes', JSON.stringify(state.resumes)); }, [state.resumes]);
  useEffect(() => { if (state.isPro) { localStorage.setItem('applyiq_pro', '1'); } }, [state.isPro]);
  useEffect(() => {
    if (!state.showOnboarding && state.profileName) {
      localStorage.setItem('applyiq_onboarded', '1');
      localStorage.setItem('applyiq_name', state.profileName);
      localStorage.setItem('applyiq_title', state.profileTitle);
      localStorage.setItem('applyiq_resume', state.resumeText);
    }
  }, [state.showOnboarding, state.profileName, state.profileTitle, state.resumeText]);

  const trialDaysLeft = Math.max(0, state.trialDaysTotal - state.trialDaysUsed);
  const showTrialBanner = !state.isPro && trialDaysLeft > 0;
  const showExpiredBanner = !state.isPro && trialDaysLeft === 0;
  const urgentCount = state.applications.filter(a => {
    if (!a.deadline) return false;
    const d = Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 3;
  }).length;
  const selectedApp = state.selectedAppId ? state.applications.find(a => a.id === state.selectedAppId) ?? null : null;

  return (
    <StoreCtx.Provider value={{ ...state, dispatch, selectedApp, trialDaysLeft, showTrialBanner, showExpiredBanner, urgentCount }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

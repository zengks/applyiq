export type AppStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

/**
 * Health of a saved job posting's URL, as of the last link check.
 * - `active`  — the posting still loads and shows no expiry wording.
 * - `expired` — the page is up but says the role is closed/filled/expired.
 * - `removed` — the page is gone (404/410 or a soft "job not found" page).
 * - `unknown` — never checked, or the check was inconclusive (blocked, timeout).
 */
export type PostingStatus = 'active' | 'expired' | 'removed' | 'unknown';

export interface Application {
  id: string;
  company: string;
  role: string;
  status: AppStatus;
  match: number;
  deadline: string | null;
  url: string;
  notes: string;
  /** Result of the last posting-link check. */
  postingStatus: PostingStatus;
  /** ISO timestamp of the last check, or null if never checked. */
  postingCheckedAt: string | null;
  /** Human-readable reason for `postingStatus`, shown in the UI. */
  postingNote: string;
}

/** One posting-check outcome, as returned by `POST /api/posting-status`. */
export interface PostingCheckResult {
  id: string;
  status: PostingStatus;
  note: string;
  checkedAt: string;
}

/** Cost metadata attached to an analysis response by the server (not the model). */
export interface AnalysisCost {
  model: string;
  costUsd: number;
  monthSpendUsd: number;
  softLimitAlert: boolean;
}

export interface AIResult {
  matchScore: number;
  role: string;
  company: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  aiSuggestion: string;
  coverLetter: string;
  interviewQuestions: Array<{ q: string; hint: string }>;
  salaryRange: string;
  industry: string;
  seniority: string;
  culture: string[];
  /** Populated server-side by the cost tracker; absent before the migration is run. */
  cost?: AnalysisCost;
}

export interface Resume {
  id: string;
  name: string;
  updatedAt: string;
  jobsMatched: number;
  atsScore: number;
  isDefault: boolean;
  text: string;
  filePath: string | null;
}

export type SubStatus =
  | 'trialing' | 'active' | 'past_due' | 'canceled'
  | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused';

export interface Subscription {
  status: SubStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
}

export type ActiveView = 'dashboard' | 'applications' | 'ai' | 'resume' | 'stats' | 'profile';
export type ActiveTab = 'keywords' | 'cover' | 'interview' | 'insights';
export type BillingCycle = 'monthly' | 'annual';

export interface NewJobForm {
  company: string;
  role: string;
  url: string;
  status: AppStatus;
  deadline: string;
  notes: string;
}

export type AppStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface Application {
  id: string;
  company: string;
  role: string;
  status: AppStatus;
  match: number;
  deadline: string | null;
  url: string;
  notes: string;
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

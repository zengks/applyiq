export type AppStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface Application {
  id: number;
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
  id: number;
  name: string;
  updatedAt: string;
  jobsMatched: number;
  atsScore: number;
  isDefault: boolean;
  text: string;
}

export type ActiveView = 'dashboard' | 'applications' | 'ai' | 'resume' | 'stats';
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

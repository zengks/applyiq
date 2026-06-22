import { AppStatus } from './types';

export const LOGO_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

export function getLogoColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = company.charCodeAt(i) + ((hash << 5) - hash);
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
}

export function getInitial(name: string): string {
  return (name?.trim()?.[0] ?? '?').toUpperCase();
}

export const STATUS_LABELS: Record<AppStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Not Selected',
};

export const STATUS_COLORS: Record<AppStatus, { text: string; bg: string }> = {
  saved:     { text: '#9ca3af', bg: '#f3f4f6' },
  applied:   { text: '#3b82f6', bg: '#eff6ff' },
  interview: { text: '#f59e0b', bg: '#fffbeb' },
  offer:     { text: '#059669', bg: '#ecfdf5' },
  rejected:  { text: '#ef4444', bg: '#fef2f2' },
};

export function getMatchColors(score: number): { text: string; bg: string } {
  if (score >= 85) return { text: '#059669', bg: '#ecfdf5' };
  if (score >= 70) return { text: '#d97706', bg: '#fffbeb' };
  return { text: '#ef4444', bg: '#fef2f2' };
}

export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  const days = daysUntil(deadline);
  if (days === null) return '';
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d left`;
}

export function deadlineColor(deadline: string | null): string {
  const d = daysUntil(deadline);
  if (d === null) return '#9ca3af';
  if (d <= 1) return '#ef4444';
  if (d <= 3) return '#f59e0b';
  return '#059669';
}

export function todayString(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

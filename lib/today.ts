import type { Application, JobInterview } from './types';

export type AgendaGroup = 'overdue' | 'today' | 'upcoming' | 'unscheduled' | 'completed';
export interface AgendaItem {
  id: string;
  kind: 'action' | 'deadline' | 'interview';
  application: Application;
  title: string;
  date: string | null;
  group: AgendaGroup;
  interview?: JobInterview;
}
export const AGENDA_GROUPS: AgendaGroup[] = [
  'overdue',
  'today',
  'upcoming',
  'unscheduled',
  'completed',
];
export const AGENDA_LABELS: Record<AgendaGroup, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  unscheduled: 'No date yet',
  completed: 'Completed',
};

export function validCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calendarDateFormatter(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'iso8601',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return (instant: string) => {
    const date = new Date(instant);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')!.value.padStart(4, '0');
    const month = parts.find((part) => part.type === 'month')!.value;
    const day = parts.find((part) => part.type === 'day')!.value;
    return `${year}-${month}-${day}`;
  };
}

/** Calendar strings stay date-only: midnight UTC must not shift a deadline. */
export function buildAgenda(
  applications: Application[],
  today: string,
  interviews: JobInterview[] = [],
  timeZone = 'UTC',
): AgendaItem[] {
  if (!validCalendarDate(today)) throw new Error('Invalid agenda date');
  const items: AgendaItem[] = [];
  const bucket = (date: string | null): AgendaGroup =>
    !date ? 'unscheduled' : date < today ? 'overdue' : date === today ? 'today' : 'upcoming';
  for (const application of applications) {
    const settled = application.status === 'offer' || application.status === 'rejected';
    if (application.nextAction?.trim()) {
      const date = validCalendarDate(application.nextActionDue) ? application.nextActionDue : null;
      // An explicit user action remains useful on settled jobs (e.g. reviewing an offer).
      items.push({
        id: `${application.id}:action`,
        kind: 'action',
        application,
        title: application.nextAction,
        date,
        group: application.nextActionDone ? 'completed' : bucket(date),
      });
    }
    if (
      !settled &&
      application.status === 'saved' &&
      !validCalendarDate(application.appliedAt) &&
      validCalendarDate(application.deadline)
    ) {
      items.push({
        id: `${application.id}:deadline`,
        kind: 'deadline',
        application,
        title: 'Application deadline',
        date: application.deadline,
        group: bucket(application.deadline),
      });
    }
  }
  const jobs = new Map(applications.map((job) => [job.id, job]));
  const dateInViewerZone = calendarDateFormatter(timeZone);
  for (const interview of interviews) {
    const application = jobs.get(interview.applicationId);
    if (!application || interview.status === 'cancelled') continue;
    const date = dateInViewerZone(interview.startsAt);
    items.push({
      id: interview.id,
      kind: 'interview',
      application,
      title: interview.title,
      date,
      group: interview.status === 'completed' ? 'completed' : bucket(date),
      interview,
    });
  }
  return items.sort(
    (a, b) =>
      AGENDA_GROUPS.indexOf(a.group) - AGENDA_GROUPS.indexOf(b.group) ||
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      (a.interview?.startsAt ?? '').localeCompare(b.interview?.startsAt ?? '') ||
      a.application.company.localeCompare(b.application.company) ||
      a.id.localeCompare(b.id),
  );
}

export function calendarLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

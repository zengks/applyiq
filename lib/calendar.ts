import type { Application, JobInterview } from './types';
import { safePlanningUrl } from './planning';
import { buildAgenda, validCalendarDate } from './today';

export interface CalendarEvent {
  uid: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  status?: 'CONFIRMED' | 'CANCELLED';
  revision?: number;
  updatedAt?: string;
  description?: string;
  location?: string;
}
function textValue(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
/** RFC 5545 folds content lines at 75 octets, without splitting UTF-8 characters. */
function fold(value: string) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let result = '';
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}
const utc = (value: string) => {
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 9999
  )
    throw new Error('Invalid calendar time.');
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
};
export function serializeCalendar(events: CalendarEvent[], generatedAt = new Date().toISOString()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ApplyIQ//Job workspace calendar//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${textValue(event.uid)}`,
      `DTSTAMP:${utc(event.updatedAt ?? generatedAt)}`,
      `SUMMARY:${textValue(event.title)}`,
      'CLASS:PRIVATE',
    );
    if (event.allDay) {
      if (!validCalendarDate(event.start)) throw new Error('Invalid calendar date.');
      const next = new Date(`${event.start}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      if (next.getUTCFullYear() > 9999) throw new Error('Invalid calendar end date.');
      lines.push(
        `DTSTART;VALUE=DATE:${event.start.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
        'TRANSP:TRANSPARENT',
      );
    } else {
      if (!event.end || Date.parse(event.end) <= Date.parse(event.start))
        throw new Error('Calendar end must follow start.');
      lines.push(`DTSTART:${utc(event.start)}`, `DTEND:${utc(event.end)}`, 'TRANSP:OPAQUE');
    }
    if (event.revision !== undefined)
      lines.push(`SEQUENCE:${Math.max(0, Math.trunc(event.revision))}`);
    if (event.updatedAt) lines.push(`LAST-MODIFIED:${utc(event.updatedAt)}`);
    lines.push(`STATUS:${event.status ?? 'CONFIRMED'}`);
    if (event.description) lines.push(`DESCRIPTION:${textValue(event.description)}`);
    if (event.location) lines.push(`LOCATION:${textValue(event.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function interviewCalendarEvent(
  interview: JobInterview,
  job: Application,
  includePrivate = false,
): CalendarEvent {
  return {
    uid: `urn:uuid:${interview.id}`,
    title: `${interview.title} · ${job.role} · ${job.company}`,
    start: interview.startsAt,
    end: interview.endsAt,
    revision: interview.revision,
    updatedAt: interview.updatedAt,
    status: interview.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
    description: [
      `Interview time zone: ${interview.timeZone}`,
      ...(includePrivate
        ? [safePlanningUrl(interview.meetingUrl ?? '') ?? '', interview.notes ?? '']
        : []),
    ]
      .filter(Boolean)
      .join('\n'),
    location: includePrivate ? interview.location : undefined,
  };
}
export function downloadCalendar(events: CalendarEvent[], filename = 'applyiq-calendar.ics') {
  const data = serializeCalendar(events);
  const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export saved appointments plus dated, incomplete actions/deadlines. */
export function agendaCalendarEvents(
  jobs: Application[],
  interviews: JobInterview[],
  today: string,
): CalendarEvent[] {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return [
    ...interviews
      .filter(
        (item) =>
          item.status === 'scheduled' &&
          item.localEnd.slice(0, 10) >= today &&
          byId.has(item.applicationId),
      )
      .map((item) => interviewCalendarEvent(item, byId.get(item.applicationId)!)),
    ...buildAgenda(jobs, today)
      .filter((item) => item.group !== 'completed' && item.date)
      .map((item) => ({
        uid: `${item.id}@applyiq`,
        title: `${item.title} · ${item.application.role} · ${item.application.company}`,
        start: item.date!,
        allDay: true,
      })),
  ];
}

import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import type { Application, JobInterview } from '@/lib/types';
import { agendaCalendarEvents, interviewCalendarEvent, serializeCalendar } from '@/lib/calendar';
import { buildAgenda } from '@/lib/today';
import {
  contactInputSchema,
  interviewInputSchema,
  interviewLabel,
  safePlanningUrl,
} from '@/lib/planning';
const job: Application = {
  id: 'job',
  company: 'Acme',
  role: 'Engineer',
  status: 'saved',
  match: 0,
  deadline: '2026-11-05',
  url: '',
  notes: '',
  postingStatus: 'unknown',
  postingCheckedAt: null,
  postingNote: '',
  nextAction: 'Prepare',
  nextActionDue: '2026-11-03',
};
const interview: JobInterview = {
  id: 'interview',
  applicationId: 'job',
  ownerId: 'owner',
  title: 'Technical; interview, résumé 🚀'.repeat(8),
  startsAt: '2026-11-05T17:00:00Z',
  endsAt: '2026-11-05T18:00:00Z',
  timeZone: 'America/Vancouver',
  localStart: '2026-11-05T10:00',
  localEnd: '2026-11-05T11:00',
  utcOffsetSeconds: -25200,
  status: 'scheduled',
  revision: 2,
  createdAt: '2026-11-02T01:00:00Z',
  updatedAt: '2026-11-02T02:00:00Z',
  meetingUrl: 'https://example.invalid/private',
  notes: 'Sensitive prep\nsecond line',
  location: 'Room 2; north, floor 3',
};
const parsed = (text: string) =>
  new ICAL.Component(ICAL.parse(text))
    .getAllSubcomponents('vevent')
    .map((component) => new ICAL.Event(component));
describe('calendar interoperability and privacy', () => {
  it('round-trips Unicode, escaped text and correct UTC instants through an independent parser', () => {
    const text = serializeCalendar([interviewCalendarEvent(interview, job, true)]);
    for (const line of text.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text.endsWith('\r\n')).toBe(true);
    const [event] = parsed(text);
    expect(event.summary).toContain(interview.title);
    expect(event.startDate.toJSDate().toISOString()).toBe(
      interview.startsAt.replace('00Z', '00.000Z'),
    );
    expect(event.location).toBe(interview.location);
    expect(event.description).toContain(interview.notes);
  });
  it('defaults to minimal exports, never adding attendees or invitation methods', () => {
    const text = serializeCalendar([interviewCalendarEvent(interview, job)]);
    expect(text).not.toContain('Sensitive');
    expect(text).not.toContain('https://');
    expect(text).not.toMatch(/ATTENDEE|ORGANIZER|METHOD:/);
    expect(text).toContain('CLASS:PRIVATE');
  });
  it('keeps event identity and increments cancellation sequence', () => {
    const first = parsed(serializeCalendar([interviewCalendarEvent(interview, job)]))[0];
    const cancelled = parsed(
      serializeCalendar([
        interviewCalendarEvent({ ...interview, status: 'cancelled', revision: 3 }, job),
      ]),
    )[0];
    expect(cancelled.uid).toBe(first.uid);
    expect(cancelled.component.getFirstPropertyValue('status')).toBe('CANCELLED');
    expect(cancelled.sequence).toBe(3);
  });
  it('exports independent dated actions and deadlines as exclusive-end all-day events', () => {
    const rows = parsed(serializeCalendar(agendaCalendarEvents([job], [interview], '2026-11-02')));
    expect(rows).toHaveLength(3);
    const action = rows.find((row) => row.uid === 'job:action@applyiq')!;
    expect(action.startDate.isDate).toBe(true);
    expect(action.startDate.toString()).toBe('2026-11-03');
    expect(action.endDate.toString()).toBe('2026-11-04');
    expect(
      agendaCalendarEvents(
        [{ ...job, nextActionDone: true, status: 'applied' }],
        [{ ...interview, status: 'cancelled' }],
        '2026-11-02',
      ),
    ).toEqual([]);
  });
  it('escapes injected newlines as text rather than calendar properties', () => {
    const text = serializeCalendar([
      {
        uid: 'safe',
        title: 'Title\r\nATTENDEE:bad@example.invalid',
        start: '2026-11-03',
        allDay: true,
      },
    ]);
    const [event] = parsed(text);
    expect(event.component.getAllProperties('attendee')).toHaveLength(0);
    expect(event.summary).toContain('\nATTENDEE:');
  });
  it('rejects impossible dates and negative durations', () => {
    expect(() =>
      serializeCalendar([{ uid: 'bad', title: 'bad', start: '2026-02-30', allDay: true }]),
    ).toThrow();
    expect(() =>
      serializeCalendar([
        { uid: 'bad', title: 'bad', start: interview.endsAt, end: interview.startsAt },
      ]),
    ).toThrow();
  });
});
describe('planning inputs and agenda', () => {
  it('groups saved interview wall dates and excludes cancellations and orphaned jobs', () => {
    const rows = buildAgenda([job], '2026-11-05', [
      interview,
      { ...interview, id: 'cancelled', status: 'cancelled' },
      { ...interview, id: 'orphan', applicationId: 'missing' },
      { ...interview, id: 'done', status: 'completed' },
    ]);
    expect(
      rows.filter((row) => row.kind === 'interview').map((row) => [row.id, row.group]),
    ).toEqual([
      ['interview', 'today'],
      ['done', 'completed'],
    ]);
    expect(interviewLabel(interview)).toContain('10:00');
  });
  it('rejects unsafe links, invalid email, and invalid meeting intervals', () => {
    expect(safePlanningUrl('javascript:alert(1)')).toBeNull();
    expect(safePlanningUrl('https://user:password@example.invalid')).toBeNull();
    expect(
      contactInputSchema.safeParse({
        name: 'Recruiter',
        role: '',
        email: 'wrong',
        phone: '',
        profile_url: '',
        notes: '',
        archived: false,
      }).success,
    ).toBe(false);
    expect(
      interviewInputSchema.safeParse({
        title: 'Interview',
        starts_at: interview.startsAt,
        ends_at: interview.startsAt,
        time_zone: 'America/Vancouver',
        status: 'scheduled',
        location: '',
        meeting_url: '',
        notes: '',
        contact_id: null,
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { Application } from '@/lib/types';
import { buildAgenda, calendarLabel, validCalendarDate } from '@/lib/today';
const app = (id: string, values: Partial<Application> = {}): Application => ({
  id,
  company: 'Acme',
  role: 'Engineer',
  status: 'saved',
  match: 0,
  deadline: null,
  url: '',
  notes: '',
  postingStatus: 'unknown',
  postingCheckedAt: null,
  postingNote: '',
  ...values,
});

describe('date-only daily agenda', () => {
  it('groups and orders overdue, today, future, undated and completed actions', () => {
    const items = buildAgenda(
      [
        app('later', { nextAction: 'Later', nextActionDue: '2026-11-04' }),
        app('no-date', { nextAction: 'Prepare' }),
        app('done', {
          nextAction: 'Finished',
          nextActionDone: true,
          nextActionDue: '2026-11-01',
        }),
        app('today', { nextAction: 'Today', nextActionDue: '2026-11-02' }),
        app('late', { nextAction: 'Overdue', nextActionDue: '2026-11-01' }),
      ],
      '2026-11-02',
    );
    expect(items.map((item) => item.group)).toEqual([
      'overdue',
      'today',
      'upcoming',
      'unscheduled',
      'completed',
    ]);
    expect(items.map((item) => item.application.id)).toEqual([
      'late',
      'today',
      'later',
      'no-date',
      'done',
    ]);
  });
  it('keeps an action and its independent application deadline', () => {
    const items = buildAgenda(
      [
        app('a', {
          nextAction: 'Polish résumé',
          nextActionDue: '2026-11-02',
          deadline: '2026-11-03',
        }),
      ],
      '2026-11-02',
    );
    expect(items.map((item) => item.kind)).toEqual(['action', 'deadline']);
    expect(new Set(items.map((item) => item.id)).size).toBe(2);
  });
  it.each(['applied', 'interview', 'offer', 'rejected'] as const)(
    'hides an application deadline after status %s',
    (status) => {
      expect(buildAgenda([app('a', { deadline: '2026-11-02', status })], '2026-11-02')).toEqual([]);
    },
  );
  it('also hides deadlines when an application date is already recorded', () => {
    expect(
      buildAgenda([app('a', { deadline: '2026-11-03', appliedAt: '2026-11-01' })], '2026-11-02'),
    ).toEqual([]);
  });
  it('preserves explicit actions on an offer and does not invent dated interviews', () => {
    const items = buildAgenda(
      [
        app('offer', {
          status: 'offer',
          nextAction: 'Review offer',
          nextActionDue: '2026-11-02',
        }),
        app('interview', { status: 'interview' }),
      ],
      '2026-11-02',
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Review offer');
  });
  it('rejects invalid calendar days and treats malformed stored action dates as undated', () => {
    expect(validCalendarDate('2026-02-29')).toBe(false);
    expect(validCalendarDate('0000-01-01')).toBe(false);
    expect(validCalendarDate('2028-02-29')).toBe(true);
    expect(
      buildAgenda(
        [app('a', { nextAction: 'Follow up', nextActionDue: 'not-a-date' })],
        '2026-11-02',
      )[0].group,
    ).toBe('unscheduled');
    expect(() => buildAgenda([], '2026-13-01')).toThrow();
  });
  it('formats the same calendar day without a UTC-midnight date shift', () => {
    expect(calendarLabel('2026-11-02')).toContain('2');
    expect(buildAgenda([app('a', { deadline: '2026-11-02' })], '2026-11-02')[0]).toMatchObject({
      date: '2026-11-02',
      group: 'today',
    });
  });
});

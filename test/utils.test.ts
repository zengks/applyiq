import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOGO_COLORS, getLogoColor, getInitial, getMatchColors, daysUntil,
  formatDeadline, deadlineColor, todayString, greetingPrefix,
  STATUS_LABELS, STATUS_COLORS,
} from '@/lib/utils';
import type { AppStatus } from '@/lib/types';

// 2026-06-22T12:00:00Z — a stable clock for date-based functions.
const FIXED = new Date('2026-06-22T12:00:00Z').getTime();

afterEach(() => vi.useRealTimers());

describe('getLogoColor', () => {
  it('is deterministic for the same input', () => {
    expect(getLogoColor('Stripe')).toBe(getLogoColor('Stripe'));
  });
  it('always returns a color from the palette', () => {
    for (const c of ['Stripe', 'Linear', 'A', '', 'Anthropic 🚀']) {
      expect(LOGO_COLORS).toContain(getLogoColor(c));
    }
  });
});

describe('getInitial', () => {
  it('uppercases the first letter', () => {
    expect(getInitial('stripe')).toBe('S');
    expect(getInitial('  acme')).toBe('A');
  });
  it('falls back to ? for empty input', () => {
    expect(getInitial('')).toBe('?');
    expect(getInitial('   ')).toBe('?');
  });
});

describe('getMatchColors', () => {
  it('maps score bands to colors', () => {
    expect(getMatchColors(85).text).toBe('#059669'); // >= 85 green
    expect(getMatchColors(100).text).toBe('#059669');
    expect(getMatchColors(84).text).toBe('#d97706'); // 70-84 amber
    expect(getMatchColors(70).text).toBe('#d97706');
    expect(getMatchColors(69).text).toBe('#ef4444'); // < 70 red
    expect(getMatchColors(0).text).toBe('#ef4444');
  });
});

describe('daysUntil', () => {
  it('returns null for null', () => {
    expect(daysUntil(null)).toBeNull();
  });
  it('computes ceil days to the deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    expect(daysUntil('2026-06-22')).toBeLessThanOrEqual(0); // already past noon today
    expect(daysUntil('2026-06-25')).toBe(3);
    expect(daysUntil('2026-06-19')).toBeLessThan(0);
  });
});

describe('formatDeadline', () => {
  it('handles null and bands', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    expect(formatDeadline(null)).toBe('');
    expect(formatDeadline('2026-06-10')).toBe('Overdue');
    expect(formatDeadline('2026-06-25')).toBe('3d left');
  });
});

describe('deadlineColor', () => {
  it('maps urgency to colors', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    expect(deadlineColor(null)).toBe('#9ca3af');
    expect(deadlineColor('2026-06-22')).toBe('#ef4444'); // <= 1 red
    expect(deadlineColor('2026-06-24')).toBe('#f59e0b'); // <= 3 amber
    expect(deadlineColor('2026-07-30')).toBe('#059669'); // far green
  });
});

describe('todayString', () => {
  it('formats the current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T12:00:00'));
    expect(todayString()).toContain('June');
    expect(todayString()).toContain('22');
  });
});

describe('greetingPrefix', () => {
  it('picks the right greeting by hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T08:00:00'));
    expect(greetingPrefix()).toBe('Good morning');
    vi.setSystemTime(new Date('2026-06-22T14:00:00'));
    expect(greetingPrefix()).toBe('Good afternoon');
    vi.setSystemTime(new Date('2026-06-22T20:00:00'));
    expect(greetingPrefix()).toBe('Good evening');
  });
});

describe('status maps', () => {
  const statuses: AppStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];
  it('has a label and color for every status', () => {
    for (const s of statuses) {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_COLORS[s].text).toMatch(/^#/);
      expect(STATUS_COLORS[s].bg).toMatch(/^#/);
    }
  });
});

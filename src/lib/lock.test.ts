import { describe, it, expect } from 'vitest';
import { weekLockTime, isWeekOpen } from './lock';

describe('weekLockTime', () => {
  // Thu 8:15 PM ET (EDT, UTC-4) -> 2026-09-11T00:15Z; ET date is 2026-09-10.
  const septWeek = [
    new Date('2026-09-11T00:15:00Z'),
    new Date('2026-09-13T17:00:00Z'),
  ];
  // Thu 8:15 PM ET (EST, UTC-5) -> 2026-12-11T01:15Z; ET date is 2026-12-10.
  const decWeek = [
    new Date('2026-12-11T01:15:00Z'),
    new Date('2026-12-13T18:00:00Z'),
  ];

  it('locks at 9:00 AM ET on the date of the week’s first game (EDT)', () => {
    expect(weekLockTime(septWeek)!.toISOString()).toBe('2026-09-10T13:00:00.000Z');
  });

  it('handles standard time (EST) too', () => {
    expect(weekLockTime(decWeek)!.toISOString()).toBe('2026-12-10T14:00:00.000Z');
  });

  it('returns null when the week has no games', () => {
    expect(weekLockTime([])).toBeNull();
  });
});

describe('isWeekOpen', () => {
  const septWeek = [new Date('2026-09-11T00:15:00Z'), new Date('2026-09-13T17:00:00Z')];

  it('is open before the week lock', () => {
    expect(isWeekOpen(new Date('2026-09-09T12:00:00Z'), septWeek)).toBe(true);
  });
  it('is closed at/after the week lock', () => {
    expect(isWeekOpen(new Date('2026-09-10T13:00:00Z'), septWeek)).toBe(false);
    expect(isWeekOpen(new Date('2026-09-10T20:00:00Z'), septWeek)).toBe(false);
  });
  it('is closed when the week has no games', () => {
    expect(isWeekOpen(new Date('2026-09-09T12:00:00Z'), [])).toBe(false);
  });
});

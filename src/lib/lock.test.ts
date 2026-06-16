import { describe, it, expect } from 'vitest';
import { weekLockTime, isWeekOpen } from './lock';

describe('weekLockTime', () => {
  // First kickoff Thu 8:15 PM ET (EDT) -> 2026-09-11T00:15Z. Lock = 4h earlier.
  const septWeek = [
    new Date('2026-09-11T00:15:00Z'),
    new Date('2026-09-13T17:00:00Z'),
  ];

  it("locks 4 hours before the week's earliest kickoff", () => {
    expect(weekLockTime(septWeek)!.toISOString()).toBe('2026-09-10T20:15:00.000Z');
  });

  it('uses the earliest kickoff regardless of game order', () => {
    const reordered = [
      new Date('2026-09-13T17:00:00Z'),
      new Date('2026-09-11T00:15:00Z'),
    ];
    expect(weekLockTime(reordered)!.toISOString()).toBe('2026-09-10T20:15:00.000Z');
  });

  it('returns null when the week has no games', () => {
    expect(weekLockTime([])).toBeNull();
  });
});

describe('isWeekOpen', () => {
  const septWeek = [new Date('2026-09-11T00:15:00Z'), new Date('2026-09-13T17:00:00Z')];

  it('is open before the lock', () => {
    expect(isWeekOpen(new Date('2026-09-10T20:14:00Z'), septWeek)).toBe(true);
  });
  it('is closed at/after the lock', () => {
    expect(isWeekOpen(new Date('2026-09-10T20:15:00Z'), septWeek)).toBe(false);
    expect(isWeekOpen(new Date('2026-09-11T00:00:00Z'), septWeek)).toBe(false);
  });
  it('is closed when the week has no games', () => {
    expect(isWeekOpen(new Date('2026-09-10T12:00:00Z'), [])).toBe(false);
  });
});

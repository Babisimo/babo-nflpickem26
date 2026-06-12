import { describe, it, expect } from 'vitest';
import { seasonLockTime, arePicksOpen, LOCK_OFFSET_MS } from './lock';

const kickoffs = [
  new Date('2026-09-13T17:00:00Z'),
  new Date('2026-09-10T00:20:00Z'), // earliest
  new Date('2026-09-14T00:20:00Z'),
];

describe('seasonLockTime', () => {
  it('is 48h before the earliest kickoff', () => {
    const lock = seasonLockTime(kickoffs)!;
    expect(lock.toISOString()).toBe('2026-09-08T00:20:00.000Z');
    expect(LOCK_OFFSET_MS).toBe(48 * 60 * 60 * 1000);
  });

  it('returns null when there are no games', () => {
    expect(seasonLockTime([])).toBeNull();
  });
});

describe('arePicksOpen', () => {
  it('is open well before lock', () => {
    expect(arePicksOpen(new Date('2026-09-01T00:00:00Z'), kickoffs)).toBe(true);
  });
  it('is closed at/after lock', () => {
    expect(arePicksOpen(new Date('2026-09-08T00:20:00Z'), kickoffs)).toBe(false);
    expect(arePicksOpen(new Date('2026-09-09T00:00:00Z'), kickoffs)).toBe(false);
  });
  it('is closed when no games exist (nothing to pick)', () => {
    expect(arePicksOpen(new Date('2026-09-01T00:00:00Z'), [])).toBe(false);
  });
});

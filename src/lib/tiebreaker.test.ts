import { describe, it, expect } from 'vitest';
import { finalGameOfWeek, tiebreakErrorByUser, MISSING_PENALTY } from './tiebreaker';

describe('finalGameOfWeek', () => {
  it('returns the game with the latest kickoff', () => {
    const games = [
      { id: 'a', kickoffAt: new Date('2026-09-13T17:00:00Z') },
      { id: 'b', kickoffAt: new Date('2026-09-15T00:15:00Z') }, // Monday night
      { id: 'c', kickoffAt: new Date('2026-09-13T20:00:00Z') },
    ];
    expect(finalGameOfWeek(games)!.id).toBe('b');
  });

  it('breaks kickoff ties by id (descending) for determinism', () => {
    const t = new Date('2026-09-15T00:15:00Z');
    const games = [
      { id: 'a', kickoffAt: t },
      { id: 'z', kickoffAt: t },
    ];
    expect(finalGameOfWeek(games)!.id).toBe('z');
  });

  it('returns null for an empty week', () => {
    expect(finalGameOfWeek([])).toBeNull();
  });
});

describe('tiebreakErrorByUser', () => {
  const userIds = ['u1', 'u2', 'u3'];
  const completedWeeks = [
    { week: 1, actualTotal: 45 },
    { week: 2, actualTotal: 30 },
  ];
  const predictions = [
    { userId: 'u1', week: 1, predictedTotal: 44 }, // |44-45| = 1
    { userId: 'u1', week: 2, predictedTotal: 35 }, // |35-30| = 5  -> u1 total 6
    { userId: 'u2', week: 1, predictedTotal: 50 }, // |50-45| = 5, week 2 missing
    // u3 has no predictions at all
  ];

  it('sums absolute error across completed weeks', () => {
    const m = tiebreakErrorByUser(userIds, completedWeeks, predictions);
    expect(m.get('u1')).toBe(6);
  });

  it('penalizes missing predictions for completed weeks', () => {
    const m = tiebreakErrorByUser(userIds, completedWeeks, predictions);
    expect(m.get('u2')).toBe(5 + MISSING_PENALTY);
    expect(m.get('u3')).toBe(2 * MISSING_PENALTY);
  });

  it('gives zero error when no weeks are completed yet', () => {
    const m = tiebreakErrorByUser(userIds, [], predictions);
    expect(m.get('u1')).toBe(0);
    expect(m.get('u3')).toBe(0);
  });
});

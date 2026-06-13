import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeScoreboard } from './results-source';

const fixture = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../fixtures/espn-scoreboard.json'), 'utf8'),
);

describe('normalizeScoreboard', () => {
  it('normalizes a final game with home/away, scores, and winner', () => {
    const games = normalizeScoreboard(fixture);
    const final = games.find((g) => g.sourceId === '401872656')!;
    expect(final).toEqual({
      sourceId: '401872656',
      week: 1,
      kickoffAt: '2026-09-10T00:20Z',
      homeAbbr: 'SEA',
      awayAbbr: 'NE',
      homeScore: 20,
      awayScore: 23,
      status: 'FINAL',
      winnerAbbr: 'NE',
    });
  });

  it('normalizes a scheduled game with null scores and null winner', () => {
    const games = normalizeScoreboard(fixture);
    const sched = games.find((g) => g.sourceId === '401872657')!;
    expect(sched.status).toBe('SCHEDULED');
    expect(sched.homeScore).toBeNull();
    expect(sched.awayScore).toBeNull();
    expect(sched.winnerAbbr).toBeNull();
    expect(sched.homeAbbr).toBe('GB');
    expect(sched.awayAbbr).toBe('DET');
  });

  it('returns one entry per event', () => {
    expect(normalizeScoreboard(fixture)).toHaveLength(2);
  });
});

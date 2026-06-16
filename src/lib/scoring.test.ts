import { describe, it, expect } from 'vitest';
import { computeStandings } from './scoring';

const users = [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }, { id: 'u3', name: 'Cara' }];

// g1 winner = TeamA, g2 winner = TeamB, g3 not final (winner null)
const results = [
  { gameId: 'g1', winnerTeamId: 'A' },
  { gameId: 'g2', winnerTeamId: 'B' },
  { gameId: 'g3', winnerTeamId: null },
];

const picks = [
  // Alice: g1 right, g2 right, g3 (no winner yet) => 2
  { userId: 'u1', gameId: 'g1', pickedTeamId: 'A' },
  { userId: 'u1', gameId: 'g2', pickedTeamId: 'B' },
  { userId: 'u1', gameId: 'g3', pickedTeamId: 'X' },
  // Bob: g1 right, g2 wrong => 1
  { userId: 'u2', gameId: 'g1', pickedTeamId: 'A' },
  { userId: 'u2', gameId: 'g2', pickedTeamId: 'A' },
  // Cara: g1 right, g2 right => 2 (ties Alice)
  { userId: 'u3', gameId: 'g1', pickedTeamId: 'A' },
  { userId: 'u3', gameId: 'g2', pickedTeamId: 'B' },
];

describe('computeStandings', () => {
  it('awards 1 point per correct winner pick and ignores unfinished games', () => {
    const s = computeStandings(users, picks, results);
    expect(s.find((r) => r.userId === 'u1')!.correct).toBe(2);
    expect(s.find((r) => r.userId === 'u2')!.correct).toBe(1);
    expect(s.find((r) => r.userId === 'u3')!.correct).toBe(2);
  });

  it('ranks by points descending with ties sharing rank (1,1,3)', () => {
    const s = computeStandings(users, picks, results);
    // u1 and u3 tie at 2 -> both rank 1; u2 at 1 -> rank 3
    const byUser = Object.fromEntries(s.map((r) => [r.userId, r.rank]));
    expect(byUser['u1']).toBe(1);
    expect(byUser['u3']).toBe(1);
    expect(byUser['u2']).toBe(3);
  });

  it('includes users with no picks at 0 points', () => {
    const s = computeStandings([{ id: 'u9', name: 'Zed' }], [], results);
    expect(s[0]).toMatchObject({ userId: 'u9', correct: 0, rank: 1 });
  });

  it('breaks ties by smaller tiebreak error and ranks them apart', () => {
    // u1 and u3 both have 2 correct. u3 is more accurate (lower error).
    const errors = new Map<string, number>([
      ['u1', 10],
      ['u3', 3],
    ]);
    const s = computeStandings(users, picks, results, errors);
    const byUser = Object.fromEntries(s.map((r) => [r.userId, r.rank]));
    expect(byUser['u3']).toBe(1); // most accurate of the tied pair
    expect(byUser['u1']).toBe(2);
    expect(byUser['u2']).toBe(3); // only 1 correct
  });

  it('keeps a shared rank when correct AND tiebreak error are equal', () => {
    const errors = new Map<string, number>([
      ['u1', 7],
      ['u3', 7],
    ]);
    const s = computeStandings(users, picks, results, errors);
    const byUser = Object.fromEntries(s.map((r) => [r.userId, r.rank]));
    expect(byUser['u1']).toBe(1);
    expect(byUser['u3']).toBe(1);
    expect(byUser['u2']).toBe(3);
  });
});

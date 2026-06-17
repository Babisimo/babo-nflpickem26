import { describe, it, expect } from 'vitest';
import { weeklyCorrectByUser } from './league-picks';

const winners = new Map<string, string | null>([
  ['g1', 'A'],
  ['g2', 'B'],
  ['g3', null], // not final yet
]);

const picks = [
  { userId: 'u1', gameId: 'g1', pickedTeamId: 'A' }, // correct
  { userId: 'u1', gameId: 'g2', pickedTeamId: 'A' }, // wrong
  { userId: 'u1', gameId: 'g3', pickedTeamId: 'A' }, // no winner -> ignored
  { userId: 'u2', gameId: 'g1', pickedTeamId: 'A' }, // correct
  { userId: 'u2', gameId: 'g2', pickedTeamId: 'B' }, // correct
];

describe('weeklyCorrectByUser', () => {
  it('counts correct picks per user', () => {
    const c = weeklyCorrectByUser(picks, winners);
    expect(c.get('u1')).toBe(1);
    expect(c.get('u2')).toBe(2);
  });

  it('ignores games with no winner yet', () => {
    const c = weeklyCorrectByUser(
      [{ userId: 'u9', gameId: 'g3', pickedTeamId: 'A' }],
      winners,
    );
    expect(c.get('u9')).toBeUndefined();
  });

  it('omits users with zero correct picks', () => {
    const c = weeklyCorrectByUser(
      [{ userId: 'u5', gameId: 'g1', pickedTeamId: 'B' }],
      winners,
    );
    expect(c.get('u5')).toBeUndefined();
  });
});

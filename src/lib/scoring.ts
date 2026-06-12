export interface ScoringUser {
  id: string;
  name: string;
}
export interface GameResult {
  gameId: string;
  winnerTeamId: string | null;
}
export interface UserPick {
  userId: string;
  gameId: string;
  pickedTeamId: string;
}
export interface RankedUser {
  userId: string;
  name: string;
  correct: number;
  rank: number;
}

export function computeStandings(
  users: ScoringUser[],
  picks: UserPick[],
  results: GameResult[],
): RankedUser[] {
  const winnerByGame = new Map<string, string | null>();
  for (const r of results) winnerByGame.set(r.gameId, r.winnerTeamId);

  const correctByUser = new Map<string, number>();
  for (const u of users) correctByUser.set(u.id, 0);

  for (const p of picks) {
    const winner = winnerByGame.get(p.gameId);
    if (winner && p.pickedTeamId === winner) {
      correctByUser.set(p.userId, (correctByUser.get(p.userId) ?? 0) + 1);
    }
  }

  const scored = users
    .map((u) => ({ userId: u.id, name: u.name, correct: correctByUser.get(u.id) ?? 0 }))
    .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));

  // Standard competition ranking (1, 1, 3, ...).
  const ranked: RankedUser[] = [];
  scored.forEach((row, i) => {
    const rank = i > 0 && scored[i - 1].correct === row.correct ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}

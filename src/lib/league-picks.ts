/** Count, per user, picks whose team won (games with no winner yet are ignored).
 *  Users with zero correct picks are simply absent from the returned map. */
export function weeklyCorrectByUser(
  picks: { userId: string; gameId: string; pickedTeamId: string }[],
  winnerByGame: Map<string, string | null>,
): Map<string, number> {
  const correct = new Map<string, number>();
  for (const p of picks) {
    const winner = winnerByGame.get(p.gameId);
    if (winner && p.pickedTeamId === winner) {
      correct.set(p.userId, (correct.get(p.userId) ?? 0) + 1);
    }
  }
  return correct;
}

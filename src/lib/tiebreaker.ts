/** Per-completed-week penalty when a user submitted no prediction. Larger than
 *  any realistic single-game error, so predicting always beats not predicting. */
export const MISSING_PENALTY = 1000;

/** The week's final game: latest kickoff, ties broken by id (descending) so the
 *  choice is deterministic. Null if the week has no games. */
export function finalGameOfWeek<T extends { id: string; kickoffAt: Date }>(games: T[]): T | null {
  if (games.length === 0) return null;
  return games.reduce((best, g) => {
    const bt = best.kickoffAt.getTime();
    const gt = g.kickoffAt.getTime();
    if (gt > bt) return g;
    if (gt === bt && g.id > best.id) return g;
    return best;
  });
}

export interface TiebreakWeekActual {
  week: number;
  actualTotal: number;
}
export interface TiebreakPrediction {
  userId: string;
  week: number;
  predictedTotal: number;
}

/** For each user, sum |predicted − actual| over completed tiebreaker weeks,
 *  charging MISSING_PENALTY for any completed week the user did not predict. */
export function tiebreakErrorByUser(
  userIds: string[],
  completedWeeks: TiebreakWeekActual[],
  predictions: TiebreakPrediction[],
): Map<string, number> {
  const predByUserWeek = new Map<string, number>();
  for (const p of predictions) predByUserWeek.set(`${p.userId}:${p.week}`, p.predictedTotal);

  const errors = new Map<string, number>();
  for (const userId of userIds) {
    let total = 0;
    for (const w of completedWeeks) {
      const pred = predByUserWeek.get(`${userId}:${w.week}`);
      total += pred === undefined ? MISSING_PENALTY : Math.abs(pred - w.actualTotal);
    }
    errors.set(userId, total);
  }
  return errors;
}

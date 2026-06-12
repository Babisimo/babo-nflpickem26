import { db } from '@/lib/db';
import { fetchWeek, type NormalizedGame } from '@/lib/results-source';

const SEASON = 2026;
const WEEKS = 18;

/** Fetch all weeks from ESPN and update Game scores/status/winner. Returns count updated. */
export async function applyAllResults(): Promise<number> {
  const teams = await db.team.findMany({ select: { id: true, abbr: true } });
  const teamByAbbr = new Map(teams.map((t) => [t.abbr, t.id]));
  let updated = 0;

  for (let week = 1; week <= WEEKS; week++) {
    let games: NormalizedGame[];
    try {
      games = await fetchWeek(SEASON, week);
    } catch {
      continue; // skip a transiently failing week
    }
    for (const g of games) {
      const winnerTeamId = g.winnerAbbr ? teamByAbbr.get(g.winnerAbbr) ?? null : null;
      const res = await db.game.updateMany({
        where: { espnId: g.espnId },
        data: {
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          status: g.status,
          winnerTeamId,
        },
      });
      updated += res.count;
    }
  }
  return updated;
}

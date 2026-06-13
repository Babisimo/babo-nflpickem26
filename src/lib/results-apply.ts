import { db } from '@/lib/db';
import { fetchNflverseSeason } from '@/lib/nflverse-source';

const SEASON = 2026;

/** Fetch the season from nflverse and update Game scores/status/winner. Returns count updated. */
export async function applyAllResults(): Promise<number> {
  const teams = await db.team.findMany({ select: { id: true, abbr: true } });
  const teamByAbbr = new Map(teams.map((t) => [t.abbr, t.id]));

  let games;
  try {
    games = await fetchNflverseSeason(SEASON);
  } catch (err) {
    console.error('[applyAllResults] Failed to fetch season from nflverse:', err);
    return 0;
  }

  let updated = 0;
  for (const g of games) {
    const winnerTeamId = g.winnerAbbr ? teamByAbbr.get(g.winnerAbbr) ?? null : null;
    const res = await db.game.updateMany({
      where: { sourceId: g.sourceId },
      data: {
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status: g.status,
        winnerTeamId,
      },
    });
    updated += res.count;
  }
  return updated;
}

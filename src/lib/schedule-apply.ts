import { db } from '@/lib/db';
import { fetchNflverseSeason } from '@/lib/nflverse-source';

const SEASON = 2026;

export interface ScheduleRefreshResult {
  changed: number; // existing games whose date/week moved
  created: number; // brand-new games added
  skipped: number; // rows whose teams couldn't be matched
  error?: string;
}

/**
 * Pull the latest schedule from nflverse and apply date/week changes.
 * Upserts by sourceId so picks (keyed by gameId) are preserved. Matchups
 * (home/away) are left untouched — they don't change once the NFL releases
 * the schedule; only kickoff dates/times shift via flex scheduling.
 */
export async function refreshSchedule(): Promise<ScheduleRefreshResult> {
  const teams = await db.team.findMany({ select: { id: true, abbr: true } });
  const teamByAbbr = new Map(teams.map((t) => [t.abbr, t.id]));

  let games;
  try {
    games = await fetchNflverseSeason(SEASON);
  } catch (err) {
    console.error('[refreshSchedule] nflverse fetch failed:', err);
    return { changed: 0, created: 0, skipped: 0, error: 'Could not reach nflverse.' };
  }

  let changed = 0;
  let created = 0;
  let skipped = 0;

  for (const g of games) {
    const homeId = teamByAbbr.get(g.homeAbbr);
    const awayId = teamByAbbr.get(g.awayAbbr);
    if (!homeId || !awayId) {
      skipped++;
      continue;
    }

    const existing = await db.game.findUnique({
      where: { sourceId: g.sourceId },
      select: { kickoffAt: true, week: true },
    });
    const kickoff = new Date(g.kickoffAt);

    if (!existing) {
      await db.game.create({
        data: { sourceId: g.sourceId, week: g.week, kickoffAt: kickoff, homeTeamId: homeId, awayTeamId: awayId },
      });
      created++;
    } else if (existing.kickoffAt.getTime() !== kickoff.getTime() || existing.week !== g.week) {
      await db.game.update({
        where: { sourceId: g.sourceId },
        data: { kickoffAt: kickoff, week: g.week },
      });
      changed++;
    }
  }

  return { changed, created, skipped };
}

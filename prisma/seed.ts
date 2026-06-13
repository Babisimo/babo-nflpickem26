import { PrismaClient } from '@prisma/client';
import { TEAM_DIVISIONS } from '../src/lib/teams-data';
import { fetchNflverseTeams, fetchNflverseSeason } from '../src/lib/nflverse-source';

const db = new PrismaClient();
const SEASON = 2026;

async function seedTeams() {
  const teams = await fetchNflverseTeams();
  let count = 0;
  for (const t of teams) {
    const div = TEAM_DIVISIONS[t.abbr];
    if (!div) continue; // skip defunct/relocated abbreviations not in the league
    await db.team.upsert({
      where: { abbr: t.abbr },
      create: {
        sourceId: t.sourceId,
        abbr: t.abbr,
        name: t.name,
        conference: div.conference,
        division: div.division,
        color: t.color,
        logoUrl: t.logoUrl,
      },
      update: {
        sourceId: t.sourceId,
        name: t.name,
        color: t.color,
        logoUrl: t.logoUrl,
      },
    });
    count++;
  }
  console.log(`Seeded ${count} teams`);
}

async function seedSchedule() {
  const teamByAbbr = new Map(
    (await db.team.findMany()).map((t) => [t.abbr, t.id]),
  );
  const games = await fetchNflverseSeason(SEASON);
  let count = 0;
  for (const g of games) {
    const homeId = teamByAbbr.get(g.homeAbbr);
    const awayId = teamByAbbr.get(g.awayAbbr);
    if (!homeId || !awayId) {
      console.warn(`Skipping ${g.sourceId}: unknown team ${g.homeAbbr}/${g.awayAbbr}`);
      continue;
    }
    await db.game.upsert({
      where: { sourceId: g.sourceId },
      create: {
        sourceId: g.sourceId,
        week: g.week,
        kickoffAt: new Date(g.kickoffAt),
        homeTeamId: homeId,
        awayTeamId: awayId,
      },
      update: { kickoffAt: new Date(g.kickoffAt), week: g.week },
    });
    count++;
  }
  console.log(`Seeded ${count} games`);
}

async function main() {
  await seedTeams();
  await seedSchedule();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

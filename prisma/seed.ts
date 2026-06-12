import { PrismaClient } from '@prisma/client';
import { TEAM_DIVISIONS } from '../src/lib/teams-data';
import { fetchWeek } from '../src/lib/results-source';

const db = new PrismaClient();
const TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
const SEASON = 2026;
const WEEKS = 18;

async function seedTeams() {
  const res = await fetch(TEAMS_URL);
  if (!res.ok) throw new Error(`teams fetch failed: ${res.status}`);
  const json: any = await res.json();
  const teams = json.sports[0].leagues[0].teams.map((t: any) => t.team);

  for (const t of teams) {
    const div = TEAM_DIVISIONS[t.abbreviation];
    if (!div) throw new Error(`No division mapping for ${t.abbreviation}`);
    await db.team.upsert({
      where: { abbr: t.abbreviation },
      create: {
        espnId: String(t.id),
        abbr: t.abbreviation,
        name: t.displayName,
        conference: div.conference,
        division: div.division,
        color: `#${t.color}`,
      },
      update: { name: t.displayName, color: `#${t.color}`, espnId: String(t.id) },
    });
  }
  console.log(`Seeded ${teams.length} teams`);
}

async function seedSchedule() {
  const teamByAbbr = new Map(
    (await db.team.findMany()).map((t) => [t.abbr, t.id]),
  );
  let count = 0;
  for (let week = 1; week <= WEEKS; week++) {
    const games = await fetchWeek(SEASON, week);
    for (const g of games) {
      const homeId = teamByAbbr.get(g.homeAbbr);
      const awayId = teamByAbbr.get(g.awayAbbr);
      if (!homeId || !awayId) {
        console.warn(`Skipping ${g.espnId}: unknown team ${g.homeAbbr}/${g.awayAbbr}`);
        continue;
      }
      await db.game.upsert({
        where: { espnId: g.espnId },
        create: {
          espnId: g.espnId,
          week: g.week,
          kickoffAt: new Date(g.kickoffAt),
          homeTeamId: homeId,
          awayTeamId: awayId,
        },
        update: { kickoffAt: new Date(g.kickoffAt), week: g.week },
      });
      count++;
    }
    console.log(`Week ${week}: ${games.length} games`);
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

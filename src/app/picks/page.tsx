import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isWeekOpen, weekLockTime } from '@/lib/lock';
import { finalGameOfWeek } from '@/lib/tiebreaker';
import { isProfileComplete, fullName } from '@/lib/profile';
import { PicksClient } from './PicksClient';

export default async function PicksPage() {
  const session = await auth() as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, firstName: true, lastName: true },
  });
  if (me && !isProfileComplete(me)) redirect('/complete-profile');

  const games = await db.game.findMany({
    orderBy: [{ week: 'asc' }, { kickoffAt: 'asc' }],
    include: { homeTeam: true, awayTeam: true },
  });
  const picks = await db.pick.findMany({ where: { userId } });
  const predictions = await db.weekPrediction.findMany({ where: { userId } });
  const allUsers = await db.user.findMany({
    select: { id: true, name: true, username: true, firstName: true, lastName: true },
  });
  const allPicks = await db.pick.findMany({ select: { userId: true, gameId: true, pickedTeamId: true } });
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  const gamesByWeek: Record<number, typeof games> = {};
  for (const g of games) (gamesByWeek[g.week] ??= []).push(g);

  const now = new Date();
  const data = Object.entries(gamesByWeek).map(([week, gs]) => {
    const kickoffs = gs.map((g) => g.kickoffAt);
    const fg = finalGameOfWeek(gs);
    const fgFinal = !!fg && fg.status === 'FINAL' && fg.homeScore != null && fg.awayScore != null;
    const open = isWeekOpen(now, kickoffs);
    const weekGameIds = new Set(gs.map((g) => g.id));
    const weekPicks = open ? [] : allPicks.filter((p) => weekGameIds.has(p.gameId));
    const playerIds = open ? [] : [...new Set(weekPicks.map((p) => p.userId))];
    const league = open
      ? null
      : {
          players: playerIds
            .map((id) => userById.get(id)!)
            .filter(Boolean)
            .map((u) => ({
              id: u.id,
              handle: u.username ? `@${u.username}` : fullName(u),
              fullName: fullName(u),
            }))
            .sort((a, b) => a.handle.toLowerCase().localeCompare(b.handle.toLowerCase())),
          picks: weekPicks,
        };
    return {
      week: Number(week),
      open,
      lockAt: weekLockTime(kickoffs)?.toISOString() ?? null,
      tiebreaker: fg
        ? {
            gameId: fg.id,
            label: `${fg.awayTeam.abbr} @ ${fg.homeTeam.abbr}`,
            final: fgFinal,
            actualTotal: fgFinal ? (fg.homeScore as number) + (fg.awayScore as number) : null,
          }
        : null,
      league,
      games: gs.map((g) => ({
        id: g.id,
        home: { id: g.homeTeamId, abbr: g.homeTeam.abbr, name: g.homeTeam.name, color: g.homeTeam.color, logoUrl: g.homeTeam.logoUrl },
        away: { id: g.awayTeamId, abbr: g.awayTeam.abbr, name: g.awayTeam.name, color: g.awayTeam.color, logoUrl: g.awayTeam.logoUrl },
        kickoffAt: g.kickoffAt.toISOString(),
        winnerTeamId: g.winnerTeamId,
        status: g.status,
      })),
    };
  });

  const initialPicks = Object.fromEntries(picks.map((p) => [p.gameId, p.pickedTeamId]));
  const initialPredictions = Object.fromEntries(predictions.map((p) => [p.week, p.predictedTotal]));

  return (
    <PicksClient
      weeks={data}
      initialPicks={initialPicks}
      initialPredictions={initialPredictions}
      totalGames={games.length}
    />
  );
}

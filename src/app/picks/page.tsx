import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isWeekOpen, weekLockTime } from '@/lib/lock';
import { finalGameOfWeek } from '@/lib/tiebreaker';
import { PicksClient } from './PicksClient';

export default async function PicksPage() {
  const session = await auth() as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const games = await db.game.findMany({
    orderBy: [{ week: 'asc' }, { kickoffAt: 'asc' }],
    include: { homeTeam: true, awayTeam: true },
  });
  const picks = await db.pick.findMany({ where: { userId } });
  const predictions = await db.weekPrediction.findMany({ where: { userId } });

  const gamesByWeek: Record<number, typeof games> = {};
  for (const g of games) (gamesByWeek[g.week] ??= []).push(g);

  const now = new Date();
  const data = Object.entries(gamesByWeek).map(([week, gs]) => {
    const kickoffs = gs.map((g) => g.kickoffAt);
    const fg = finalGameOfWeek(gs);
    const fgFinal = !!fg && fg.status === 'FINAL' && fg.homeScore != null && fg.awayScore != null;
    return {
      week: Number(week),
      open: isWeekOpen(now, kickoffs),
      lockAt: weekLockTime(kickoffs)?.toISOString() ?? null,
      tiebreaker: fg
        ? {
            gameId: fg.id,
            label: `${fg.awayTeam.abbr} @ ${fg.homeTeam.abbr}`,
            final: fgFinal,
            actualTotal: fgFinal ? (fg.homeScore as number) + (fg.awayScore as number) : null,
          }
        : null,
      games: gs.map((g) => ({
        id: g.id,
        home: { id: g.homeTeamId, abbr: g.homeTeam.abbr, name: g.homeTeam.name, color: g.homeTeam.color, logoUrl: g.homeTeam.logoUrl },
        away: { id: g.awayTeamId, abbr: g.awayTeam.abbr, name: g.awayTeam.name, color: g.awayTeam.color, logoUrl: g.awayTeam.logoUrl },
        kickoffAt: g.kickoffAt.toISOString(),
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

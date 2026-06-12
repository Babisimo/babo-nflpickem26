import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { arePicksOpen } from '@/lib/lock';
import { PicksClient } from './PicksClient';

export default async function PicksPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect('/login');

  const games = await db.game.findMany({
    orderBy: [{ week: 'asc' }, { kickoffAt: 'asc' }],
    include: { homeTeam: true, awayTeam: true },
  });
  const picks = await db.pick.findMany({ where: { userId } });
  const open = arePicksOpen(new Date(), games.map((g) => g.kickoffAt));

  const gamesByWeek: Record<number, typeof games> = {};
  for (const g of games) (gamesByWeek[g.week] ??= []).push(g);

  const data = Object.entries(gamesByWeek).map(([week, gs]) => ({
    week: Number(week),
    games: gs.map((g) => ({
      id: g.id,
      home: { id: g.homeTeamId, abbr: g.homeTeam.abbr, name: g.homeTeam.name, color: g.homeTeam.color },
      away: { id: g.awayTeamId, abbr: g.awayTeam.abbr, name: g.awayTeam.name, color: g.awayTeam.color },
      kickoffAt: g.kickoffAt.toISOString(),
    })),
  }));

  const initialPicks = Object.fromEntries(picks.map((p) => [p.gameId, p.pickedTeamId]));

  return (
    <PicksClient
      weeks={data}
      initialPicks={initialPicks}
      open={open}
      totalGames={games.length}
    />
  );
}

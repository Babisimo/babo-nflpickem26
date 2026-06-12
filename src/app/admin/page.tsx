import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) redirect('/');

  const games = await db.game.findMany({
    orderBy: [{ week: 'asc' }, { kickoffAt: 'asc' }],
    include: { homeTeam: true, awayTeam: true },
  });
  const rows = games.map((g) => ({
    id: g.id,
    week: g.week,
    label: `${g.awayTeam.abbr} @ ${g.homeTeam.abbr}`,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeAbbr: g.homeTeam.abbr,
    awayAbbr: g.awayTeam.abbr,
    status: g.status,
    winnerTeamId: g.winnerTeamId,
  }));
  return <AdminClient games={rows} />;
}

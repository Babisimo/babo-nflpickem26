import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth() as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

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

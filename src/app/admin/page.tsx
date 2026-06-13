import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) redirect('/');

  const [games, users] = await Promise.all([
    db.game.findMany({
      orderBy: [{ week: 'asc' }, { kickoffAt: 'asc' }],
      include: { homeTeam: true, awayTeam: true },
    }),
    db.user.findMany({
      orderBy: [{ isAdmin: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, isAdmin: true, _count: { select: { picks: true } } },
    }),
  ]);

  const gameRows = games.map((g) => ({
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

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    picks: u._count.picks,
  }));

  return <AdminClient games={gameRows} users={userRows} currentUserId={session.user.id} />;
}

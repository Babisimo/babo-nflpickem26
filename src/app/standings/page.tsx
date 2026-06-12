import { db } from '@/lib/db';
import { computeStandings } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  const users = await db.user.findMany({ select: { id: true, name: true } });
  const picks = await db.pick.findMany({ select: { userId: true, gameId: true, pickedTeamId: true } });
  const games = await db.game.findMany({ select: { id: true, winnerTeamId: true, status: true } });

  const results = games.map((g) => ({ gameId: g.id, winnerTeamId: g.winnerTeamId }));
  const standings = computeStandings(users, picks, results);
  const finals = games.filter((g) => g.status === 'FINAL').length;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Standings</h1>
      <p className="mb-4 text-sm text-slate-600">{finals} games final</p>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b text-sm text-slate-500">
            <th className="py-2">#</th><th>Player</th><th className="text-right">Correct</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((r) => (
            <tr key={r.userId} className="border-b">
              <td className="py-2">{r.rank}</td>
              <td>{r.name}</td>
              <td className="text-right font-medium">{r.correct}</td>
            </tr>
          ))}
          {standings.length === 0 && (
            <tr><td colSpan={3} className="py-4 text-slate-500">No players yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

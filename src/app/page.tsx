import Link from 'next/link';
import { db } from '@/lib/db';
import { seasonLockTime, arePicksOpen } from '@/lib/lock';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const games = await db.game.findMany({ select: { kickoffAt: true } });
  const kickoffs = games.map((g) => g.kickoffAt);
  const lock = seasonLockTime(kickoffs);
  const open = arePicksOpen(new Date(), kickoffs);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">NFL 2026 Pick&rsquo;em</h1>
      <p className="text-slate-600">
        Pick the winner of every regular-season game. Highest number of correct picks wins.
      </p>
      {lock && (
        <p className="text-sm text-slate-600">
          {open
            ? `Picks lock ${lock.toLocaleString()}.`
            : 'Picks are locked for the season.'}
        </p>
      )}
      <div className="flex gap-3">
        <Link href="/picks" className="rounded bg-slate-900 px-4 py-2 text-white">Make picks</Link>
        <Link href="/standings" className="rounded border px-4 py-2">View standings</Link>
      </div>
    </div>
  );
}

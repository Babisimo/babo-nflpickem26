'use client';

import { useMemo, useState } from 'react';
import { savePick } from '@/app/actions/picks';

type Team = { id: string; abbr: string; name: string; color: string };
type Game = { id: string; home: Team; away: Team; kickoffAt: string };
type Week = { week: number; games: Game[] };

export function PicksClient({
  weeks,
  initialPicks,
  open,
  totalGames,
}: {
  weeks: Week[];
  initialPicks: Record<string, string>;
  open: boolean;
  totalGames: number;
}) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [activeWeek, setActiveWeek] = useState(weeks[0]?.week ?? 1);
  const [saving, setSaving] = useState<string | null>(null);

  const pickedCount = useMemo(() => Object.keys(picks).length, [picks]);
  const current = weeks.find((w) => w.week === activeWeek);

  async function choose(gameId: string, teamId: string) {
    if (!open) return;
    const prev = picks[gameId];
    setPicks((p) => ({ ...p, [gameId]: teamId }));
    setSaving(gameId);
    const res = await savePick(gameId, teamId);
    setSaving(null);
    if (!res.ok) {
      setPicks((p) => ({ ...p, [gameId]: prev })); // revert
      alert(res.error);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Picks</h1>
        <span className="text-sm text-slate-600">{pickedCount} of {totalGames} picked</span>
      </div>
      {!open && (
        <p className="mb-4 rounded bg-amber-100 px-3 py-2 text-sm text-amber-800">
          Picks are locked for the season — viewing only.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-1">
        {weeks.map((w) => (
          <button
            key={w.week}
            onClick={() => setActiveWeek(w.week)}
            className={`rounded px-2 py-1 text-sm ${w.week === activeWeek ? 'bg-slate-900 text-white' : 'bg-white border'}`}
          >
            Wk {w.week}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {current?.games.map((g) => (
          <li key={g.id} className="rounded border bg-white p-3">
            <div className="mb-2 text-xs text-slate-500">
              {new Date(g.kickoffAt).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[g.away, g.home].map((t) => {
                const selected = picks[g.id] === t.id;
                return (
                  <button
                    key={t.id}
                    disabled={!open || saving === g.id}
                    onClick={() => choose(g.id, t.id)}
                    className={`flex items-center justify-between rounded border px-3 py-2 text-left disabled:opacity-60 ${selected ? 'ring-2 ring-offset-1' : ''}`}
                    style={selected ? { borderColor: t.color, boxShadow: `0 0 0 2px ${t.color}` } : {}}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-slate-500">{t === g.home ? 'HOME' : 'AWAY'}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

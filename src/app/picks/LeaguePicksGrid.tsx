'use client';

import { useMemo } from 'react';
import { weeklyCorrectByUser } from '@/lib/league-picks';

type GridTeam = { id: string; abbr: string };
type GridGame = { id: string; home: GridTeam; away: GridTeam; winnerTeamId: string | null; status: string };
type GridPlayer = { id: string; handle: string; fullName: string };
type GridPick = { userId: string; gameId: string; pickedTeamId: string };

export function LeaguePicksGrid({
  games,
  players,
  picks,
}: {
  games: GridGame[];
  players: GridPlayer[];
  picks: GridPick[];
}) {
  const pickMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of picks) m.set(`${p.userId}:${p.gameId}`, p.pickedTeamId);
    return m;
  }, [picks]);

  const winnerByGame = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const g of games) m.set(g.id, g.winnerTeamId);
    return m;
  }, [games]);

  const correct = useMemo(() => weeklyCorrectByUser(picks, winnerByGame), [picks, winnerByGame]);

  if (players.length === 0) {
    return <p className="card px-4 py-6 text-center text-sm text-faint">No picks were made this week.</p>;
  }

  return (
    <div className="card no-scrollbar overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-ink-800 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              Game
            </th>
            {players.map((p) => (
              <th
                key={p.id}
                title={p.fullName}
                className="whitespace-nowrap px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-chalk"
              >
                {p.handle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} className="border-t border-line">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-ink-800 px-3 py-2 font-display uppercase tracking-wide text-chalk">
                {g.away.abbr} @ {g.home.abbr}
              </td>
              {players.map((p) => {
                const picked = pickMap.get(`${p.id}:${g.id}`);
                const team = picked === g.home.id ? g.home : picked === g.away.id ? g.away : null;
                const final = g.status === 'FINAL' && g.winnerTeamId != null;
                const isCorrect = final && picked != null && picked === g.winnerTeamId;
                const isWrong = final && picked != null && picked !== g.winnerTeamId;
                return (
                  <td
                    key={p.id}
                    className={`px-3 py-2 text-center font-mono text-[12px] font-semibold ${
                      isCorrect
                        ? 'bg-accent/15 text-accent'
                        : isWrong
                          ? 'bg-red-500/10 text-red-300'
                          : 'text-muted'
                    }`}
                  >
                    {team ? team.abbr : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-line bg-ink-900/40">
            <td className="sticky left-0 z-10 bg-ink-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              Correct
            </td>
            {players.map((p) => (
              <td key={p.id} className="stat-num px-3 py-2 text-center text-lg text-chalk">
                {correct.get(p.id) ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

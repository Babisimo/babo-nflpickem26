'use client';

import { useState } from 'react';

type Row = {
  id: string; week: number; label: string;
  homeTeamId: string; awayTeamId: string; homeAbbr: string; awayAbbr: string;
  status: string; winnerTeamId: string | null;
};

export function AdminClient({ games }: { games: Row[] }) {
  const [msg, setMsg] = useState('');

  async function refresh() {
    setMsg('Refreshing…');
    const res = await fetch('/api/admin/refresh', { method: 'POST' });
    const json = await res.json();
    setMsg(res.ok ? `Updated ${json.updated} games.` : `Error: ${json.error}`);
  }

  async function override(gameId: string, winnerTeamId: string) {
    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId, winnerTeamId }),
    });
    setMsg(res.ok ? 'Override saved.' : 'Override failed.');
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Admin</h1>
        <button onClick={refresh} className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
          Force refresh results
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-slate-500"><th>Wk</th><th>Game</th><th>Status</th><th>Set winner</th></tr></thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} className="border-b">
              <td className="py-1">{g.week}</td>
              <td>{g.label}</td>
              <td>{g.status}{g.winnerTeamId === g.homeTeamId ? ` (${g.homeAbbr})` : g.winnerTeamId === g.awayTeamId ? ` (${g.awayAbbr})` : ''}</td>
              <td className="space-x-2">
                <button onClick={() => override(g.id, g.awayTeamId)} className="rounded border px-2 py-0.5">{g.awayAbbr}</button>
                <button onClick={() => override(g.id, g.homeTeamId)} className="rounded border px-2 py-0.5">{g.homeAbbr}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

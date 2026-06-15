'use client';

import { useState, useTransition } from 'react';
import { removeUser, setAdmin } from '@/app/actions/admin';

type GameRow = {
  id: string;
  week: number;
  label: string;
  homeTeamId: string;
  awayTeamId: string;
  homeAbbr: string;
  awayAbbr: string;
  status: string;
  winnerTeamId: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  picks: number;
};

export function AdminClient({
  games,
  users,
  currentUserId,
}: {
  games: GameRow[];
  users: UserRow[];
  currentUserId: string;
}) {
  const [msg, setMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [schedBusy, setSchedBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    setRefreshing(true);
    setMsg('Refreshing results…');
    const res = await fetch('/api/admin/refresh', { method: 'POST' });
    const json = await res.json();
    setRefreshing(false);
    setMsg(res.ok ? `Updated ${json.updated} games.` : `Error: ${json.error}`);
  }

  async function refreshScheduleNow() {
    if (!confirm('Pull the latest schedule from nflverse? This updates game dates/times (flex changes) and adds any new games. Your players’ picks are kept.')) return;
    setSchedBusy(true);
    setMsg('Refreshing schedule…');
    const res = await fetch('/api/admin/refresh-schedule', { method: 'POST' });
    const json = await res.json();
    setSchedBusy(false);
    setMsg(
      res.ok
        ? `Schedule synced — ${json.changed} rescheduled, ${json.created} added${json.skipped ? `, ${json.skipped} skipped` : ''}.`
        : `Error: ${json.error}`,
    );
  }

  async function override(gameId: string, winnerTeamId: string) {
    setMsg('Saving…');
    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId, winnerTeamId }),
    });
    setMsg(res.ok ? 'Override saved.' : 'Override failed.');
  }

  function onRemove(u: UserRow) {
    if (!confirm(`Remove ${u.name}? This deletes their account and ${u.picks} pick(s).`)) return;
    startTransition(async () => {
      const res = await removeUser(u.id);
      setMsg(res.ok ? `Removed ${u.name}.` : res.error);
    });
  }

  function onToggleAdmin(u: UserRow) {
    startTransition(async () => {
      const res = await setAdmin(u.id, !u.isAdmin);
      setMsg(res.ok ? `${u.name} is ${!u.isAdmin ? 'now an admin' : 'no longer an admin'}.` : res.error);
    });
  }

  const adminCount = users.filter((u) => u.isAdmin).length;

  return (
    <div className="space-y-10">
      <div className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk sm:text-5xl">
            Admin
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {msg && (
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{msg}</span>
          )}
          <button onClick={refreshScheduleNow} disabled={schedBusy} className="btn-ghost">
            {schedBusy ? 'Syncing…' : 'Refresh schedule'}
          </button>
          <button onClick={refresh} disabled={refreshing} className="btn-accent">
            {refreshing ? 'Refreshing…' : 'Force refresh results'}
          </button>
        </div>
      </div>

      {/* Users */}
      <section className="reveal" style={{ animationDelay: '80ms' }}>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide text-chalk">Players</h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            {users.length} total &middot; {adminCount} admin
          </span>
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const lastAdmin = u.isAdmin && adminCount <= 1;
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-chalk">
                    {u.name}
                    {u.isAdmin && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                        Admin
                      </span>
                    )}
                    {isSelf && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="truncate font-mono text-[11px] tracking-[0.04em] text-faint">
                    {u.email} &middot; {u.picks} picks
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleAdmin(u)}
                    disabled={pending || isSelf || lastAdmin}
                    title={isSelf ? "You can't change your own status" : lastAdmin ? 'Last admin' : ''}
                    className="btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-30"
                  >
                    {u.isAdmin ? 'Demote' : 'Make admin'}
                  </button>
                  <button
                    onClick={() => onRemove(u)}
                    disabled={pending || isSelf || lastAdmin}
                    title={isSelf ? "You can't remove yourself" : lastAdmin ? 'Last admin' : ''}
                    className="rounded-full border border-red-500/30 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-red-300 transition-colors hover:border-red-500/60 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Games */}
      <section className="reveal" style={{ animationDelay: '140ms' }}>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide text-chalk">Games</h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Set winner to override
          </span>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                <th className="px-4 py-3 font-medium">Wk</th>
                <th className="px-2 py-3 font-medium">Game</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Set winner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {games.map((g) => {
                const winAbbr =
                  g.winnerTeamId === g.homeTeamId
                    ? g.homeAbbr
                    : g.winnerTeamId === g.awayTeamId
                      ? g.awayAbbr
                      : null;
                return (
                  <tr key={g.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-faint">{g.week}</td>
                    <td className="px-2 py-2.5 font-display uppercase tracking-wide text-chalk">
                      {g.label}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                        {g.status}
                        {winAbbr && <span className="ml-1 text-accent">({winAbbr})</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => override(g.id, g.awayTeamId)}
                          className="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] font-semibold uppercase text-muted transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          {g.awayAbbr}
                        </button>
                        <button
                          onClick={() => override(g.id, g.homeTeamId)}
                          className="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] font-semibold uppercase text-muted transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          {g.homeAbbr}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

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
  const [showHelp, setShowHelp] = useState(false);
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

      {/* Mobile-only help: what each admin button does */}
      <div className="reveal sm:hidden" style={{ animationDelay: '40ms' }}>
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-ink-800/60 px-4 py-3"
        >
          <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-chalk">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.5h.01" strokeLinecap="round" />
            </svg>
            What do these buttons do?
          </span>
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 text-faint transition-transform ${showHelp ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showHelp && (
          <ul className="mt-2 space-y-3 rounded-xl border border-line bg-ink-800/40 p-4">
            {[
              { term: 'Refresh schedule', desc: 'Pulls the latest 2026 schedule from nflverse — e.g. flex-scheduled date/time changes — and adds any new games. Players’ picks are kept.' },
              { term: 'Force refresh results', desc: 'Pulls the latest scores and winners and updates the standings. This also runs automatically once a day.' },
              { term: 'Make admin / Demote', desc: 'Give or remove admin access for a player. The last admin can’t be demoted.' },
              { term: 'Remove', desc: 'Deletes a player and all of their picks. You can’t remove yourself or the last admin.' },
              { term: 'Set winner (team buttons)', desc: 'In the Games list, tap a team to manually override who won that game if the auto result is wrong.' },
            ].map((h) => (
              <li key={h.term} className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                  {h.term}
                </span>
                <span className="text-sm text-muted">{h.desc}</span>
              </li>
            ))}
          </ul>
        )}
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

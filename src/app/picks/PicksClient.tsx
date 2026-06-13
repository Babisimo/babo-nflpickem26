'use client';

import { useMemo, useState } from 'react';
import { savePick } from '@/app/actions/picks';

type Team = { id: string; abbr: string; name: string; color: string; logoUrl: string | null };
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
  const [error, setError] = useState<string | null>(null);

  const pickedCount = useMemo(() => Object.keys(picks).length, [picks]);
  const current = weeks.find((w) => w.week === activeWeek);
  const weekPicked = current?.games.filter((g) => picks[g.id]).length ?? 0;
  const pct = totalGames ? Math.round((pickedCount / totalGames) * 100) : 0;

  async function choose(gameId: string, teamId: string) {
    if (!open) return;
    const prev = picks[gameId];
    setError(null);
    setPicks((p) => ({ ...p, [gameId]: teamId }));
    setSaving(gameId);
    const res = await savePick(gameId, teamId);
    setSaving(null);
    if (!res.ok) {
      setPicks((p) => {
        const next = { ...p };
        if (prev) next[gameId] = prev;
        else delete next[gameId];
        return next;
      });
      setError(res.error);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header + progress */}
      <div className="reveal flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">2026 Season</p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk sm:text-5xl">
            My Picks
          </h1>
        </div>
        <div className="w-full sm:w-64">
          <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            <span>Picked</span>
            <span className="text-chalk">
              {pickedCount}
              <span className="text-faint"> / {totalGames}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-line bg-ink-900">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {!open && (
        <p className="reveal rounded-xl border border-gold/30 bg-gold/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-gold">
          Picks are locked for the season &mdash; viewing only
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Week selector */}
      <div className="reveal -mx-1 flex flex-wrap gap-1.5" style={{ animationDelay: '80ms' }}>
        {weeks.map((w) => {
          const active = w.week === activeWeek;
          const done = w.games.every((g) => picks[g.id]);
          return (
            <button
              key={w.week}
              onClick={() => setActiveWeek(w.week)}
              className={`relative rounded-lg px-3 py-2 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                active
                  ? 'bg-accent text-ink'
                  : 'border border-line bg-ink-800/60 text-muted hover:border-white/20 hover:text-chalk'
              }`}
            >
              Wk {w.week}
              {done && !active && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Games */}
      <div className="reveal flex items-center justify-between" style={{ animationDelay: '120ms' }}>
        <h2 className="font-display text-2xl uppercase tracking-wide text-chalk">
          Week {activeWeek}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {weekPicked} / {current?.games.length ?? 0} set
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {current?.games.map((g, i) => (
          <li
            key={g.id}
            className="reveal card overflow-hidden"
            style={{ animationDelay: `${Math.min(i, 10) * 35 + 140}ms` }}
          >
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                {new Date(g.kickoffAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                {new Date(g.kickoffAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {[g.away, g.home].map((t) => {
                const selected = picks[g.id] === t.id;
                const isHome = t === g.home;
                return (
                  <button
                    key={t.id}
                    disabled={!open || saving === g.id}
                    onClick={() => choose(g.id, t.id)}
                    className={`group relative flex flex-col items-center gap-2.5 rounded-xl border px-3 py-4 transition-all duration-200 disabled:cursor-not-allowed ${
                      selected
                        ? 'border-transparent'
                        : 'border-line bg-ink-900/40 hover:border-white/20 hover:bg-ink-700/40'
                    } ${saving === g.id ? 'opacity-60' : ''}`}
                    style={
                      selected
                        ? {
                            background: `linear-gradient(160deg, ${t.color}33, ${t.color}0d)`,
                            boxShadow: `inset 0 0 0 1.5px ${t.color}`,
                          }
                        : {}
                    }
                  >
                    {selected && (
                      <span
                        className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-ink"
                        style={{ background: t.color }}
                      >
                        &#10003;
                      </span>
                    )}
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.logoUrl}
                        alt=""
                        className="h-11 w-11 object-contain transition-transform duration-200 group-hover:scale-110"
                        style={{ filter: selected ? 'none' : 'saturate(0.85)' }}
                      />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-ink-700 font-display text-sm">
                        {t.abbr}
                      </span>
                    )}
                    <div className="text-center">
                      <div className="font-display text-base uppercase leading-none tracking-wide text-chalk">
                        {t.abbr}
                      </div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                        {isHome ? 'Home' : 'Away'}
                      </div>
                    </div>
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

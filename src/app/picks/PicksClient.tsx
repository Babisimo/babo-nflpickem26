'use client';

import { useEffect, useMemo, useState } from 'react';
import { savePick } from '@/app/actions/picks';

type Team = { id: string; abbr: string; name: string; color: string; logoUrl: string | null };
type Game = { id: string; home: Team; away: Team; kickoffAt: string };
type Week = { week: number; open: boolean; lockAt: string | null; games: Game[] };

/** Live countdown to a week's lock time. Renders nothing meaningful until mounted (avoids hydration mismatch). */
function Countdown({ lockAt }: { lockAt: string }) {
  const target = useMemo(() => new Date(lockAt).getTime(), [lockAt]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return <span className="font-mono text-muted">&middot;&middot;&middot;</span>;
  }
  const ms = target - now;
  if (ms <= 0) return <span className="font-display text-2xl text-primary">LOCKED</span>;

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const seg = (n: number, label: string) => (
    <span className="flex flex-col items-center">
      <span className="stat-num text-2xl text-chalk sm:text-3xl">{String(n).padStart(2, '0')}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">{label}</span>
    </span>
  );

  return (
    <span className="flex items-center gap-2.5 sm:gap-3.5">
      {d > 0 && (
        <>
          {seg(d, 'days')}
          <span className="stat-num text-2xl text-faint sm:text-3xl">:</span>
        </>
      )}
      {seg(h, 'hrs')}
      <span className="stat-num text-2xl text-faint sm:text-3xl">:</span>
      {seg(m, 'min')}
      <span className="stat-num text-2xl text-faint sm:text-3xl">:</span>
      {seg(sec, 'sec')}
    </span>
  );
}

export function PicksClient({
  weeks,
  initialPicks,
  totalGames,
}: {
  weeks: Week[];
  initialPicks: Record<string, string>;
  totalGames: number;
}) {
  const firstOpen = weeks.find((w) => w.open);
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [activeWeek, setActiveWeek] = useState(firstOpen?.week ?? weeks[0]?.week ?? 1);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  const pickedCount = useMemo(() => Object.keys(picks).length, [picks]);
  const current = weeks.find((w) => w.week === activeWeek);
  const weekGames = current?.games ?? [];
  const weekPicked = weekGames.filter((g) => picks[g.id]).length;
  const weekRemaining = weekGames.length - weekPicked;
  const weekOpen = current?.open ?? false;
  const weekPct = weekGames.length ? Math.round((weekPicked / weekGames.length) * 100) : 0;

  const lockLabel = current?.lockAt
    ? new Date(current.lockAt).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null;

  // Warn before leaving if the active week is open and not fully picked.
  useEffect(() => {
    if (!weekOpen || weekRemaining <= 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [weekOpen, weekRemaining]);

  async function choose(gameId: string, teamId: string) {
    if (!weekOpen) return;
    const prev = picks[gameId];
    setError(null);
    setSaveMsg(null);
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

  function onSave() {
    if (weekRemaining > 0) {
      setSaveMsg({
        tone: 'warn',
        text: `Saved — Week ${activeWeek} still has ${weekRemaining} game${weekRemaining === 1 ? '' : 's'} to pick.`,
      });
    } else {
      setSaveMsg({ tone: 'ok', text: `Week ${activeWeek} is all set — good luck!` });
    }
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="reveal flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">2026 Season</p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk sm:text-5xl">
            My Picks
          </h1>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          <span className="text-chalk">{pickedCount}</span> / {totalGames} season
        </span>
      </div>

      {/* Active-week panel with countdown */}
      <div className="reveal card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              Week {activeWeek} {weekOpen ? '· picks due in' : '· status'}
            </p>
            <div className="mt-2">
              {weekOpen && current?.lockAt ? (
                <Countdown lockAt={current.lockAt} />
              ) : (
                <span className="font-display text-2xl uppercase text-primary">Locked</span>
              )}
            </div>
            {lockLabel && (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                {weekOpen ? 'Locks' : 'Locked'} {lockLabel}
              </p>
            )}
          </div>
          <div className="sm:w-56">
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              <span>Week {activeWeek}</span>
              <span className="text-chalk">
                {weekPicked}
                <span className="text-faint"> / {weekGames.length}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-line bg-ink-900">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${weekPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {!weekOpen && (
        <p className="reveal rounded-xl border border-primary/30 bg-primary/[0.08] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-primary">
          Week {activeWeek} is locked &mdash; viewing only
        </p>
      )}
      {weekOpen && weekRemaining > 0 && (
        <p className="reveal flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.08] px-4 py-3 text-sm text-gold">
          <span aria-hidden>&#9888;</span>
          You haven&rsquo;t finished Week {activeWeek} &mdash;{' '}
          <strong className="font-semibold">{weekRemaining}</strong> game
          {weekRemaining === 1 ? '' : 's'} still need a pick before it locks.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* Week selector */}
      <div
        className="reveal no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        style={{ animationDelay: '80ms' }}
      >
        {weeks.map((w) => {
          const active = w.week === activeWeek;
          const done = w.games.every((g) => picks[g.id]);
          return (
            <button
              key={w.week}
              onClick={() => setActiveWeek(w.week)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                active
                  ? 'bg-accent text-ink'
                  : w.open
                    ? 'border border-line bg-ink-800/60 text-muted hover:border-white/20 hover:text-chalk'
                    : 'border border-line bg-ink-900/60 text-faint'
              }`}
            >
              Wk {w.week}
              {!w.open && (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="5" y="11" width="14" height="9" rx="1.5" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              )}
              {w.open && done && !active && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Games */}
      <div className="reveal flex items-center justify-between" style={{ animationDelay: '120ms' }}>
        <h2 className="font-display text-2xl uppercase tracking-wide text-chalk">Week {activeWeek}</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {weekPicked} / {weekGames.length} set
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {weekGames.map((g, i) => (
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
                    disabled={!weekOpen || saving === g.id}
                    onClick={() => choose(g.id, t.id)}
                    className={`group relative flex flex-col items-center gap-2.5 rounded-xl border px-3 py-4 transition-all duration-200 disabled:cursor-not-allowed ${
                      selected
                        ? 'border-transparent'
                        : 'border-line bg-ink-900/40 hover:border-white/20 hover:bg-ink-700/40'
                    } ${saving === g.id ? 'opacity-60' : ''} ${!weekOpen && !selected ? 'opacity-50' : ''}`}
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
                        className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white"
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
                        style={{ filter: selected ? 'none' : 'saturate(0.9)' }}
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

      {/* Sticky save / status bar */}
      {weekOpen && (
        <div className="sticky bottom-3 z-30 mt-4">
          <div className="card flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              {saveMsg ? (
                <p className={`truncate text-sm ${saveMsg.tone === 'ok' ? 'text-accent' : 'text-gold'}`}>
                  {saveMsg.text}
                </p>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                  {weekRemaining > 0 ? (
                    <>
                      <span className="text-gold">{weekRemaining}</span> left in Week {activeWeek}
                    </>
                  ) : (
                    <span className="text-accent">Week {activeWeek} complete</span>
                  )}
                </p>
              )}
            </div>
            <button onClick={onSave} className="btn-accent shrink-0">
              {weekRemaining > 0 ? 'Save progress' : 'Save picks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

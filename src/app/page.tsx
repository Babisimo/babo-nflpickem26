import Link from 'next/link';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { computeStandings } from '@/lib/scoring';
import { fullName } from '@/lib/profile';
import { finalGameOfWeek, tiebreakErrorByUser } from '@/lib/tiebreaker';
import { weekLockTime, isWeekOpen } from '@/lib/lock';

export const dynamic = 'force-dynamic';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const RANK_ACCENT = ['text-gold', 'text-chalk', 'text-[#cd8b5e]'];

export default async function HomePage() {
  const session = (await auth()) as AppSession | null;

  const [users, picks, games, predictions] = await Promise.all([
    db.user.findMany({
      where: { isAdmin: false },
      select: { id: true, name: true, username: true, firstName: true, lastName: true },
    }),
    db.pick.findMany({ select: { userId: true, gameId: true, pickedTeamId: true } }),
    db.game.findMany({
      select: {
        id: true,
        winnerTeamId: true,
        status: true,
        kickoffAt: true,
        week: true,
        homeScore: true,
        awayScore: true,
      },
    }),
    db.weekPrediction.findMany({ select: { userId: true, week: true, predictedTotal: true } }),
  ]);

  const results = games.map((g) => ({ gameId: g.id, winnerTeamId: g.winnerTeamId }));

  // Completed tiebreaker weeks: the week's final game is FINAL with both scores.
  const tbByWeek = new Map<number, typeof games>();
  for (const g of games) {
    const arr = tbByWeek.get(g.week) ?? [];
    arr.push(g);
    tbByWeek.set(g.week, arr);
  }
  const completedWeeks: { week: number; actualTotal: number }[] = [];
  for (const [week, gs] of tbByWeek) {
    const fg = finalGameOfWeek(gs);
    if (fg && fg.status === 'FINAL' && fg.homeScore != null && fg.awayScore != null) {
      completedWeeks.push({ week, actualTotal: fg.homeScore + fg.awayScore });
    }
  }
  const errors = tiebreakErrorByUser(users.map((u) => u.id), completedWeeks, predictions);
  const usersForScoring = users.map((u) => ({ id: u.id, name: u.username ?? u.name }));
  const userById = new Map(users.map((u) => [u.id, u]));
  const standings = computeStandings(usersForScoring, picks, results, errors);
  const finals = games.filter((g) => g.status === 'FINAL').length;

  // Next weekly lock: the earliest still-open week's lock time.
  const now = new Date();
  const byWeek = new Map<number, Date[]>();
  for (const g of games) {
    const arr = byWeek.get(g.week) ?? [];
    arr.push(g.kickoffAt);
    byWeek.set(g.week, arr);
  }
  let nextLock: Date | null = null;
  let nextLockWeek: number | null = null;
  for (const [week, ks] of byWeek) {
    if (!isWeekOpen(now, ks)) continue;
    const lt = weekLockTime(ks);
    if (lt && (!nextLock || lt < nextLock)) {
      nextLock = lt;
      nextLockWeek = week;
    }
  }
  const leader = standings[0];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="reveal relative overflow-hidden rounded-3xl border border-line bg-ink-800/60 p-6 sm:p-12">
        <div className="field-lines pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl animate-pulseGlow" />
        <div className="relative">
          <p className="eyebrow">2026 Regular Season &middot; The Standings</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl uppercase leading-[0.92] tracking-tight text-chalk sm:text-7xl">
            Pick every game.
            <br />
            <span className="text-accent">Most points win.</span>
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/picks" className="btn-accent">
              Make your picks
            </Link>
            <span
              className={`inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 font-mono text-[12px] uppercase tracking-[0.14em] ${
                nextLock ? 'text-accent' : 'text-faint'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${nextLock ? 'bg-accent animate-pulseGlow' : 'bg-faint'}`} />
              {nextLock
                ? `Week ${nextLockWeek} locks ${nextLock.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
                : 'Season complete'}
            </span>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            <Stat label="Players" value={standings.length} />
            <Stat label="Games Final" value={finals} />
            <Stat label="Leader" value={leader ? leader.correct : 0} accent />
          </dl>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="reveal" style={{ animationDelay: '120ms' }}>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide text-chalk">Leaderboard</h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
            Correct picks
          </span>
        </div>

        {standings.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-display text-3xl uppercase text-muted">No players yet</p>
            <p className="max-w-sm text-sm text-faint">
              The board fills up as players join and games go final.{' '}
              <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
                Create an account
              </Link>{' '}
              to claim the top spot.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {standings.map((row, i) => {
              const isMe = row.userId === session?.user?.id;
              const top3 = row.rank <= 3;
              return (
                <li
                  key={row.userId}
                  className={`reveal group relative flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors sm:px-6 ${
                    isMe
                      ? 'border-accent/50 bg-accent/[0.06]'
                      : 'border-line bg-ink-800/60 hover:border-white/15'
                  }`}
                  style={{ animationDelay: `${Math.min(i, 12) * 45 + 160}ms` }}
                >
                  <div
                    className={`stat-num w-12 shrink-0 text-center text-3xl sm:w-16 sm:text-4xl ${
                      top3 ? RANK_ACCENT[row.rank - 1] ?? 'text-chalk' : 'text-faint'
                    }`}
                  >
                    {row.rank}
                  </div>

                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line font-mono text-[13px] font-semibold text-chalk sm:h-11 sm:w-11"
                    style={{
                      background:
                        'linear-gradient(140deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                    }}
                  >
                    {initials(fullName(userById.get(row.userId)!))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-base font-semibold text-chalk sm:text-lg">
                      {userById.get(row.userId)?.username ? `@${userById.get(row.userId)!.username}` : row.name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                      {fullName(userById.get(row.userId)!)}
                      {finals > 0 ? ` · ${Math.round((row.correct / finals) * 100)}% hit rate` : ''}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5 pl-2">
                    <span className="stat-num text-3xl text-chalk sm:text-4xl">{row.correct}</span>
                    <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-faint sm:inline">
                      / {finals}
                    </span>
                  </div>

                  {top3 && (
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-2xl"
                      style={{
                        background:
                          row.rank === 1
                            ? '#ffce4d'
                            : row.rank === 2
                              ? 'rgba(238,243,240,0.6)'
                              : '#cd8b5e',
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-ink-800 px-4 py-4">
      <div className={`stat-num text-3xl ${accent ? 'text-accent' : 'text-chalk'}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</div>
    </div>
  );
}

# Tiebreaker, Admin Password Reset & Lock-Time Change — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a season-long combined-score tiebreaker, an admin password-reset button with a self-service change-password page, and change the weekly lock to 4 hours before each week's first kickoff.

**Architecture:** Three mostly-independent slices. (1) `lock.ts` switches from "9 AM ET on game day" to a fixed "first kickoff − 4h" offset (everything downstream derives from `weekLockTime`, so the change ripples for free). (2) A new `WeekPrediction` Prisma model + a pure `tiebreaker.ts` module feed a new secondary sort key into `computeStandings`; players enter a per-week combined-score guess on the picks board (auto-saved, lock-enforced). (3) An admin server action resets a user's password to a generated temp string; a `/account` page lets users change their own.

**Tech Stack:** Next.js 15 (App Router, server actions), TypeScript, Prisma 6 + Postgres (Neon), next-auth v5, bcryptjs, Vitest, Tailwind v3.

Reference spec: `docs/superpowers/specs/2026-06-16-tiebreaker-password-reset-lock-change-design.md`

---

## Feature A — Week lock = 4 hours before first kickoff

### Task A1: Rewrite the lock rule and its tests

**Files:**
- Modify: `src/lib/lock.ts`
- Test: `src/lib/lock.test.ts`

- [ ] **Step 1: Replace the test file with the new rule**

Replace the entire contents of `src/lib/lock.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { weekLockTime, isWeekOpen } from './lock';

describe('weekLockTime', () => {
  // First kickoff Thu 8:15 PM ET (EDT) -> 2026-09-11T00:15Z. Lock = 4h earlier.
  const septWeek = [
    new Date('2026-09-11T00:15:00Z'),
    new Date('2026-09-13T17:00:00Z'),
  ];

  it('locks 4 hours before the week’s earliest kickoff', () => {
    expect(weekLockTime(septWeek)!.toISOString()).toBe('2026-09-10T20:15:00.000Z');
  });

  it('uses the earliest kickoff regardless of game order', () => {
    const reordered = [
      new Date('2026-09-13T17:00:00Z'),
      new Date('2026-09-11T00:15:00Z'),
    ];
    expect(weekLockTime(reordered)!.toISOString()).toBe('2026-09-10T20:15:00.000Z');
  });

  it('returns null when the week has no games', () => {
    expect(weekLockTime([])).toBeNull();
  });
});

describe('isWeekOpen', () => {
  const septWeek = [new Date('2026-09-11T00:15:00Z'), new Date('2026-09-13T17:00:00Z')];

  it('is open before the lock', () => {
    expect(isWeekOpen(new Date('2026-09-10T20:14:00Z'), septWeek)).toBe(true);
  });
  it('is closed at/after the lock', () => {
    expect(isWeekOpen(new Date('2026-09-10T20:15:00Z'), septWeek)).toBe(false);
    expect(isWeekOpen(new Date('2026-09-11T00:00:00Z'), septWeek)).toBe(false);
  });
  it('is closed when the week has no games', () => {
    expect(isWeekOpen(new Date('2026-09-10T12:00:00Z'), [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/lock.test.ts`
Expected: FAIL — current code locks at 9 AM ET (`2026-09-10T13:00:00.000Z`), not `...T20:15:00.000Z`.

- [ ] **Step 3: Rewrite `src/lib/lock.ts`**

Replace the entire contents of `src/lib/lock.ts` with:

```ts
/** How many hours before a week's first kickoff its picks lock. */
export const WEEK_LOCK_OFFSET_HOURS = 4;

/**
 * The instant a single week's picks lock: 4 hours before that week's earliest
 * kickoff. Null if the week has no games.
 */
export function weekLockTime(weekKickoffs: Date[]): Date | null {
  if (weekKickoffs.length === 0) return null;
  const earliest = Math.min(...weekKickoffs.map((d) => d.getTime()));
  return new Date(earliest - WEEK_LOCK_OFFSET_HOURS * 60 * 60 * 1000);
}

/** True only when the week has games AND now is strictly before its lock. */
export function isWeekOpen(now: Date, weekKickoffs: Date[]): boolean {
  const lock = weekLockTime(weekKickoffs);
  if (!lock) return false;
  return now.getTime() < lock.getTime();
}
```

(This deletes the now-unused `tzOffsetMs` helper and `WEEK_LOCK_HOUR_ET` constant.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/lock.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify nothing else imported the deleted symbols**

Run: `git grep -n "WEEK_LOCK_HOUR_ET\|tzOffsetMs"`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lock.ts src/lib/lock.test.ts
git commit -m "feat: lock each week 4h before its first kickoff"
```

---

## Feature B — Tiebreaker (combined score of each week's final game)

### Task B1: Add the `WeekPrediction` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model and the User relation**

In `prisma/schema.prisma`, add `weekPredictions WeekPrediction[]` to the `User` model (e.g. directly under its `picks Pick[]` line):

```prisma
  picks        Pick[]
  weekPredictions WeekPrediction[]
```

Then add this new model at the end of the file:

```prisma
model WeekPrediction {
  id             String   @id @default(cuid())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         String
  week           Int
  predictedTotal Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, week])
}
```

- [ ] **Step 2: Push the schema and regenerate the client**

Run: `npm run db:push`
Expected: Prisma reports the `WeekPrediction` table created and the client regenerated.

> Windows note: if `prisma generate` fails with `EPERM ... query_engine-windows.dll`, stop any running `next dev`/`next start` (it locks the DLL), then re-run.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add WeekPrediction model for weekly tiebreaker"
```

---

### Task B2: Pure tiebreaker module

**Files:**
- Create: `src/lib/tiebreaker.ts`
- Test: `src/lib/tiebreaker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tiebreaker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { finalGameOfWeek, tiebreakErrorByUser, MISSING_PENALTY } from './tiebreaker';

describe('finalGameOfWeek', () => {
  it('returns the game with the latest kickoff', () => {
    const games = [
      { id: 'a', kickoffAt: new Date('2026-09-13T17:00:00Z') },
      { id: 'b', kickoffAt: new Date('2026-09-15T00:15:00Z') }, // Monday night
      { id: 'c', kickoffAt: new Date('2026-09-13T20:00:00Z') },
    ];
    expect(finalGameOfWeek(games)!.id).toBe('b');
  });

  it('breaks kickoff ties by id (descending) for determinism', () => {
    const t = new Date('2026-09-15T00:15:00Z');
    const games = [
      { id: 'a', kickoffAt: t },
      { id: 'z', kickoffAt: t },
    ];
    expect(finalGameOfWeek(games)!.id).toBe('z');
  });

  it('returns null for an empty week', () => {
    expect(finalGameOfWeek([])).toBeNull();
  });
});

describe('tiebreakErrorByUser', () => {
  const userIds = ['u1', 'u2', 'u3'];
  const completedWeeks = [
    { week: 1, actualTotal: 45 },
    { week: 2, actualTotal: 30 },
  ];
  const predictions = [
    { userId: 'u1', week: 1, predictedTotal: 44 }, // |44-45| = 1
    { userId: 'u1', week: 2, predictedTotal: 35 }, // |35-30| = 5  -> u1 total 6
    { userId: 'u2', week: 1, predictedTotal: 50 }, // |50-45| = 5, week 2 missing
    // u3 has no predictions at all
  ];

  it('sums absolute error across completed weeks', () => {
    const m = tiebreakErrorByUser(userIds, completedWeeks, predictions);
    expect(m.get('u1')).toBe(6);
  });

  it('penalizes missing predictions for completed weeks', () => {
    const m = tiebreakErrorByUser(userIds, completedWeeks, predictions);
    expect(m.get('u2')).toBe(5 + MISSING_PENALTY);
    expect(m.get('u3')).toBe(2 * MISSING_PENALTY);
  });

  it('gives zero error when no weeks are completed yet', () => {
    const m = tiebreakErrorByUser(userIds, [], predictions);
    expect(m.get('u1')).toBe(0);
    expect(m.get('u3')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/tiebreaker.test.ts`
Expected: FAIL — `./tiebreaker` does not exist.

- [ ] **Step 3: Implement `src/lib/tiebreaker.ts`**

```ts
/** Per-completed-week penalty when a user submitted no prediction. Larger than
 *  any realistic single-game error, so predicting always beats not predicting. */
export const MISSING_PENALTY = 1000;

/** The week's final game: latest kickoff, ties broken by id (descending) so the
 *  choice is deterministic. Null if the week has no games. */
export function finalGameOfWeek<T extends { id: string; kickoffAt: Date }>(games: T[]): T | null {
  if (games.length === 0) return null;
  return games.reduce((best, g) => {
    const bt = best.kickoffAt.getTime();
    const gt = g.kickoffAt.getTime();
    if (gt > bt) return g;
    if (gt === bt && g.id > best.id) return g;
    return best;
  });
}

export interface TiebreakWeekActual {
  week: number;
  actualTotal: number;
}
export interface TiebreakPrediction {
  userId: string;
  week: number;
  predictedTotal: number;
}

/** For each user, sum |predicted − actual| over completed tiebreaker weeks,
 *  charging MISSING_PENALTY for any completed week the user did not predict. */
export function tiebreakErrorByUser(
  userIds: string[],
  completedWeeks: TiebreakWeekActual[],
  predictions: TiebreakPrediction[],
): Map<string, number> {
  const predByUserWeek = new Map<string, number>();
  for (const p of predictions) predByUserWeek.set(`${p.userId}:${p.week}`, p.predictedTotal);

  const errors = new Map<string, number>();
  for (const userId of userIds) {
    let total = 0;
    for (const w of completedWeeks) {
      const pred = predByUserWeek.get(`${userId}:${w.week}`);
      total += pred === undefined ? MISSING_PENALTY : Math.abs(pred - w.actualTotal);
    }
    errors.set(userId, total);
  }
  return errors;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/tiebreaker.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiebreaker.ts src/lib/tiebreaker.test.ts
git commit -m "feat: tiebreaker scoring helpers (final game + error aggregation)"
```

---

### Task B3: Break standings ties by tiebreaker error

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

- [ ] **Step 1: Add failing tests for the tiebreak path**

Append these tests inside the `describe('computeStandings', ...)` block in `src/lib/scoring.test.ts` (before its closing `});`):

```ts
  it('breaks ties by smaller tiebreak error and ranks them apart', () => {
    // u1 and u3 both have 2 correct. u3 is more accurate (lower error).
    const errors = new Map<string, number>([
      ['u1', 10],
      ['u3', 3],
    ]);
    const s = computeStandings(users, picks, results, errors);
    const byUser = Object.fromEntries(s.map((r) => [r.userId, r.rank]));
    expect(byUser['u3']).toBe(1); // most accurate of the tied pair
    expect(byUser['u1']).toBe(2);
    expect(byUser['u2']).toBe(3); // only 1 correct
  });

  it('keeps a shared rank when correct AND tiebreak error are equal', () => {
    const errors = new Map<string, number>([
      ['u1', 7],
      ['u3', 7],
    ]);
    const s = computeStandings(users, picks, results, errors);
    const byUser = Object.fromEntries(s.map((r) => [r.userId, r.rank]));
    expect(byUser['u1']).toBe(1);
    expect(byUser['u3']).toBe(1);
    expect(byUser['u2']).toBe(3);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/scoring.test.ts`
Expected: FAIL — `computeStandings` ignores the 4th argument; tied users still share rank in the first new test.

- [ ] **Step 3: Update `src/lib/scoring.ts`**

Add `tiebreakError` to `RankedUser`:

```ts
export interface RankedUser {
  userId: string;
  name: string;
  correct: number;
  tiebreakError: number;
  rank: number;
}
```

Replace the `computeStandings` function body with:

```ts
export function computeStandings(
  users: ScoringUser[],
  picks: UserPick[],
  results: GameResult[],
  tiebreakErrors: Map<string, number> = new Map(),
): RankedUser[] {
  const winnerByGame = new Map<string, string | null>();
  for (const r of results) winnerByGame.set(r.gameId, r.winnerTeamId);

  const correctByUser = new Map<string, number>();
  for (const u of users) correctByUser.set(u.id, 0);

  for (const p of picks) {
    const winner = winnerByGame.get(p.gameId);
    if (winner && p.pickedTeamId === winner) {
      correctByUser.set(p.userId, (correctByUser.get(p.userId) ?? 0) + 1);
    }
  }

  const scored = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      correct: correctByUser.get(u.id) ?? 0,
      tiebreakError: tiebreakErrors.get(u.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.correct - a.correct ||
        a.tiebreakError - b.tiebreakError ||
        a.name.localeCompare(b.name),
    );

  // Standard competition ranking (1, 1, 3, ...). Two rows share a rank only when
  // both correct count AND tiebreak error are equal.
  const ranked: RankedUser[] = [];
  scored.forEach((row, i) => {
    const prev = scored[i - 1];
    const tiedWithPrev =
      i > 0 && prev.correct === row.correct && prev.tiebreakError === row.tiebreakError;
    const rank = tiedWithPrev ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/scoring.test.ts`
Expected: PASS — both new tests and the three existing ones (the existing "ties share rank (1,1,3)" test passes because, with no errors map, both users get error 0).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat: break standings ties by tiebreaker error"
```

---

### Task B4: `saveWeekPrediction` server action

**Files:**
- Modify: `src/app/actions/picks.ts`

- [ ] **Step 1: Add the action**

Append to `src/app/actions/picks.ts` (the file already imports `db`, `auth`, `AppSession`, `isWeekOpen` and exports the `SaveResult` type):

```ts
export async function saveWeekPrediction(week: number, predictedTotal: number): Promise<SaveResult> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'Not signed in.' };

  if (!Number.isInteger(predictedTotal) || predictedTotal < 0 || predictedTotal > 150) {
    return { ok: false, error: 'Enter a whole number from 0 to 150.' };
  }

  const weekGames = await db.game.findMany({ where: { week }, select: { kickoffAt: true } });
  if (weekGames.length === 0) return { ok: false, error: 'Unknown week.' };
  if (!isWeekOpen(new Date(), weekGames.map((g) => g.kickoffAt))) {
    return { ok: false, error: `Week ${week} is locked.` };
  }

  await db.weekPrediction.upsert({
    where: { userId_week: { userId, week } },
    create: { userId, week, predictedTotal },
    update: { predictedTotal },
  });
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). This confirms the Prisma client exposes `weekPrediction` (from Task B1's `db:push`).

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/picks.ts
git commit -m "feat: saveWeekPrediction server action (lock-enforced)"
```

---

### Task B5: Tiebreaker input on the picks board

**Files:**
- Modify: `src/app/picks/page.tsx`
- Modify: `src/app/picks/PicksClient.tsx`

- [ ] **Step 1: Provide tiebreaker data from the server page**

In `src/app/picks/page.tsx`, add the import:

```ts
import { finalGameOfWeek } from '@/lib/tiebreaker';
```

Load the user's predictions — add after the existing `picks` query:

```ts
  const predictions = await db.weekPrediction.findMany({ where: { userId } });
```

In the `data` mapping, compute the week's tiebreaker game. Replace the `return { ... }` object inside `Object.entries(gamesByWeek).map(...)` with:

```ts
    const fg = finalGameOfWeek(gs);
    const fgFinal = !!fg && fg.status === 'FINAL' && fg.homeScore != null && fg.awayScore != null;
    return {
      week: Number(week),
      open: isWeekOpen(now, kickoffs),
      lockAt: weekLockTime(kickoffs)?.toISOString() ?? null,
      tiebreaker: fg
        ? {
            gameId: fg.id,
            label: `${fg.awayTeam.abbr} @ ${fg.homeTeam.abbr}`,
            final: fgFinal,
            actualTotal: fgFinal ? (fg.homeScore as number) + (fg.awayScore as number) : null,
          }
        : null,
      games: gs.map((g) => ({
        id: g.id,
        home: { id: g.homeTeamId, abbr: g.homeTeam.abbr, name: g.homeTeam.name, color: g.homeTeam.color, logoUrl: g.homeTeam.logoUrl },
        away: { id: g.awayTeamId, abbr: g.awayTeam.abbr, name: g.awayTeam.name, color: g.awayTeam.color, logoUrl: g.awayTeam.logoUrl },
        kickoffAt: g.kickoffAt.toISOString(),
      })),
    };
```

Build the initial predictions map and pass it as a prop — replace the `initialPicks`/return block at the bottom with:

```ts
  const initialPicks = Object.fromEntries(picks.map((p) => [p.gameId, p.pickedTeamId]));
  const initialPredictions = Object.fromEntries(predictions.map((p) => [p.week, p.predictedTotal]));

  return (
    <PicksClient
      weeks={data}
      initialPicks={initialPicks}
      initialPredictions={initialPredictions}
      totalGames={games.length}
    />
  );
```

- [ ] **Step 2: Consume it in `PicksClient.tsx` — types, prop, state, handler**

In `src/app/picks/PicksClient.tsx`:

Add the `saveWeekPrediction` import:

```ts
import { savePick, saveWeekPrediction } from '@/app/actions/picks';
```

Add the `Tiebreaker` type and extend `Week` (replace the existing `type Week = ...` line):

```ts
type Tiebreaker = { gameId: string; label: string; final: boolean; actualTotal: number | null };
type Week = { week: number; open: boolean; lockAt: string | null; games: Game[]; tiebreaker: Tiebreaker | null };
```

Add `initialPredictions` to the component's props (extend the destructured signature and its type):

```ts
export function PicksClient({
  weeks,
  initialPicks,
  initialPredictions,
  totalGames,
}: {
  weeks: Week[];
  initialPicks: Record<string, string>;
  initialPredictions: Record<number, number>;
  totalGames: number;
}) {
```

Add state next to the existing `useState` hooks:

```ts
  const [predictions, setPredictions] = useState<Record<number, string>>(() =>
    Object.fromEntries(Object.entries(initialPredictions).map(([w, v]) => [w, String(v)])),
  );
  const [tbSaving, setTbSaving] = useState(false);
```

Add the save handler next to `choose`:

```ts
  async function saveTiebreaker(week: number, value: string) {
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 150) {
      setError('Tiebreaker must be a whole number from 0 to 150.');
      return;
    }
    setError(null);
    setTbSaving(true);
    const res = await saveWeekPrediction(week, n);
    setTbSaving(false);
    if (!res.ok) setError(res.error);
  }
```

- [ ] **Step 3: Render the tiebreaker card**

In `PicksClient.tsx`, immediately after the games `</ul>` (the one closing the `weekGames.map(...)` list) and before the `{/* Sticky save / status bar */}` comment, insert:

```tsx
      {current?.tiebreaker && (
        <div className="reveal card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Week {activeWeek} Tiebreaker
          </p>
          <p className="mt-2 text-sm text-muted">
            Predict the <span className="text-chalk">combined final score</span> of the last game:{' '}
            <span className="font-display uppercase tracking-wide text-chalk">{current.tiebreaker.label}</span>
          </p>
          {weekOpen ? (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={150}
                placeholder="—"
                className="field-input w-28"
                value={predictions[activeWeek] ?? ''}
                onChange={(e) => setPredictions((p) => ({ ...p, [activeWeek]: e.target.value }))}
                onBlur={(e) => saveTiebreaker(activeWeek, e.target.value)}
                disabled={tbSaving}
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                total points
              </span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
                Your prediction: <span className="text-chalk">{predictions[activeWeek] ?? '—'}</span>
              </p>
              {current.tiebreaker.final && current.tiebreaker.actualTotal != null && (
                <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
                  Actual: <span className="text-accent">{current.tiebreaker.actualTotal}</span>
                  {predictions[activeWeek] != null && predictions[activeWeek] !== '' && (
                    <span className="ml-2 text-faint">
                      (off by {Math.abs(Number(predictions[activeWeek]) - current.tiebreaker.actualTotal)})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Typecheck and lint-build**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open `http://localhost:3000/picks`, sign in. On an open week, the tiebreaker card shows the last game; type a number and blur — it persists across a page refresh. On a locked week, it renders read-only.

- [ ] **Step 6: Commit**

```bash
git add src/app/picks/page.tsx src/app/picks/PicksClient.tsx
git commit -m "feat: weekly tiebreaker input on the picks board"
```

---

### Task B6: Feed tiebreaker errors into the leaderboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import the helpers**

In `src/app/page.tsx`, replace the scoring import line with:

```ts
import { computeStandings } from '@/lib/scoring';
import { finalGameOfWeek, tiebreakErrorByUser } from '@/lib/tiebreaker';
```

- [ ] **Step 2: Load scores + predictions and compute errors**

Update the `Promise.all` to fetch game scores and all predictions, then build the error map. Replace the existing destructuring + `const results = ...; const standings = ...;` lines with:

```ts
  const [users, picks, games, predictions] = await Promise.all([
    db.user.findMany({ where: { isAdmin: false }, select: { id: true, name: true } }),
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
  const standings = computeStandings(users, picks, results, errors);
```

(The existing `const finals = games.filter((g) => g.status === 'FINAL').length;` and the `byWeek`/`nextLock` block below stay unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: apply tiebreaker to leaderboard ordering"
```

---

### Task B7: Clean up predictions when a user is removed

**Files:**
- Modify: `src/app/actions/admin.ts`

- [ ] **Step 1: Delete predictions in `removeUser`**

In `src/app/actions/admin.ts`, inside `removeUser`, add a `deleteMany` for predictions before the user delete. The block becomes:

```ts
  await db.pick.deleteMany({ where: { userId: targetUserId } });
  await db.weekPrediction.deleteMany({ where: { userId: targetUserId } });
  await db.user.delete({ where: { id: targetUserId } });
```

(The `onDelete: Cascade` on `WeekPrediction` would also handle this, but the explicit delete matches the existing pick-cleanup pattern and is order-independent.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/admin.ts
git commit -m "fix: drop a removed user's week predictions"
```

---

## Feature C — Admin password reset + self-service change password

### Task C1: Temp-password generator

**Files:**
- Modify: `src/lib/auth-helpers.ts`
- Test: `src/lib/auth-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateTempPassword } from './auth-helpers';

describe('generateTempPassword', () => {
  it('matches the Word-XXXX shape and is at least 8 chars', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/^[A-Za-z]+-[A-HJ-NP-Z2-9]{4}$/);
      expect(pw.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('is not constant across calls', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(set.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/auth-helpers.test.ts`
Expected: FAIL — `generateTempPassword` is not exported.

- [ ] **Step 3: Implement it**

Append to `src/lib/auth-helpers.ts`:

```ts
import { randomInt } from 'node:crypto';

const TEMP_WORDS = [
  'Blitz', 'Bolt', 'Drive', 'Gridiron', 'Huddle', 'Punt', 'Rush', 'Sack',
  'Snap', 'Spike', 'Tackle', 'Touchdown', 'Audible', 'Flag', 'Field', 'Kickoff',
];
// Crockford-ish base32 without ambiguous characters (no I, L, O, 0, 1).
const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, human-readable single-use password, e.g. "Blitz-7Q4K". */
export function generateTempPassword(): string {
  const word = TEMP_WORDS[randomInt(TEMP_WORDS.length)];
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += TEMP_CHARS[randomInt(TEMP_CHARS.length)];
  return `${word}-${suffix}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/auth-helpers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-helpers.ts src/lib/auth-helpers.test.ts
git commit -m "feat: generateTempPassword helper"
```

---

### Task C2: `resetUserPassword` admin action + button

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/app/admin/AdminClient.tsx`

- [ ] **Step 1: Add the server action**

In `src/app/actions/admin.ts`, extend the imports to pull in the password helpers:

```ts
import { hashPassword, generateTempPassword } from '@/lib/auth-helpers';
```

Append the action:

```ts
/** Reset a user's password to a generated temp string. Admin-only.
 *  Returns the plaintext once so the admin can relay it. */
export async function resetUserPassword(
  targetUserId: string,
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Forbidden.' };

  const user = await db.user.findUnique({ where: { id: targetUserId } });
  if (!user) return { ok: false, error: 'User not found.' };

  const tempPassword = generateTempPassword();
  await db.user.update({
    where: { id: targetUserId },
    data: { passwordHash: await hashPassword(tempPassword) },
  });
  revalidatePath('/admin');
  return { ok: true, tempPassword };
}
```

- [ ] **Step 2: Wire the button in `AdminClient.tsx`**

In `src/app/admin/AdminClient.tsx`, extend the action import:

```ts
import { removeUser, setAdmin, resetUserPassword } from '@/app/actions/admin';
```

Add a handler next to `onRemove`:

```ts
  function onResetPassword(u: UserRow) {
    if (!confirm(`Reset ${u.name}'s password? They'll need the new temporary password to log in.`)) return;
    startTransition(async () => {
      const res = await resetUserPassword(u.id);
      setMsg(res.ok ? `Temp password for ${u.name}: ${res.tempPassword} — share it with them.` : res.error);
    });
  }
```

Add a "Reset password" button in the per-user action row, before the Demote button (inside `<div className="flex items-center gap-2">`):

```tsx
                  <button
                    onClick={() => onResetPassword(u)}
                    disabled={pending}
                    className="btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-30"
                  >
                    Reset password
                  </button>
```

Add a line to the mobile help list (the array inside the `{showHelp && ...}` block):

```tsx
              { term: 'Reset password', desc: 'Generates a new temporary password for a player who is locked out. Share it with them; they can change it from their Account page.' },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, go to `/admin` as an admin, click **Reset password** on a player, confirm, and verify the temp password appears in the status line. Log in as that player with the temp password to confirm it works.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/admin.ts src/app/admin/AdminClient.tsx
git commit -m "feat: admin reset-password button with one-time temp password"
```

---

### Task C3: `changePassword` action + `/account` page + nav link

**Files:**
- Modify: `src/app/actions/auth.ts`
- Create: `src/app/account/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/MobileMenu.tsx`

- [ ] **Step 1: Add the `changePassword` action**

In `src/app/actions/auth.ts`, extend the imports (it already imports `z`, `db`, `signOut`, `hashPassword`):

```ts
import { auth, signOut, type AppSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth-helpers';
```

(Replace the existing `import { signOut } from '@/lib/auth';` and `import { hashPassword } from '@/lib/auth-helpers';` lines accordingly.)

Append the action:

```ts
export type ChangePasswordState = { error?: string; ok?: boolean } | undefined;

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { error: 'Not signed in.' };

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (next.length < 8) return { error: 'New password must be at least 8 characters.' };
  if (next !== confirm) return { error: 'New passwords do not match.' };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'Account not found.' };
  if (!(await verifyPassword(current, user.passwordHash))) {
    return { error: 'Current password is incorrect.' };
  }

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true };
}
```

- [ ] **Step 2: Create the `/account` page**

Create `src/app/account/page.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { changePassword, type ChangePasswordState } from '@/app/actions/auth';

export default function AccountPage() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined,
  );

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Change password
        </h1>

        {state?.ok && (
          <p className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-accent">
            Password updated
          </p>
        )}
        {state?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-3">
          <input
            name="currentPassword"
            type="password"
            placeholder="Current password"
            className="field-input"
            required
          />
          <input
            name="newPassword"
            type="password"
            placeholder="New password (min 8 chars)"
            className="field-input"
            required
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            className="field-input"
            required
          />
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add an "Account" link to the desktop header**

In `src/app/layout.tsx`, inside the desktop links block, add an Account link for signed-in users. Replace the `<div className="ml-2 hidden items-center gap-6 sm:flex">...</div>` block with:

```tsx
            <div className="ml-2 hidden items-center gap-6 sm:flex">
              <NavLink href="/">Standings</NavLink>
              <NavLink href="/picks">My Picks</NavLink>
              {user?.isAdmin && <NavLink href="/admin">Admin</NavLink>}
              {user && <NavLink href="/account">Account</NavLink>}
            </div>
```

- [ ] **Step 4: Add "Account" to the mobile menu**

In `src/app/MobileMenu.tsx`, add Account to the `links` array:

```ts
  const links = [
    { href: '/', label: 'Standings' },
    { href: '/picks', label: 'My Picks' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
    { href: '/account', label: 'Account' },
  ];
```

- [ ] **Step 5: Typecheck and smoke test**

Run: `npm run typecheck`
Expected: PASS.

Then `npm run dev`: visit `/account`, enter a wrong current password (expect "Current password is incorrect."), then the correct one with a valid new/confirm pair (expect "Password updated"), and log out / back in with the new password.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/auth.ts src/app/account/page.tsx src/app/layout.tsx src/app/MobileMenu.tsx
git commit -m "feat: self-service change-password page + nav link"
```

---

## Wrap-up

### Task W1: Full suite, build, and docs

**Files:**
- Modify: `handoff.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all prior tests plus the new lock, tiebreaker, scoring, and auth-helpers tests (was 31; now ~41).

- [ ] **Step 2: Typecheck and production build**

Run: `npm run typecheck` then `npm run build`
Expected: both succeed.

- [ ] **Step 3: Update `handoff.md`**

Make these edits to `handoff.md`:
- §3 Data layer: add `src/lib/tiebreaker.ts` (final-game-of-week + tiebreak error aggregation) and note the `WeekPrediction` model in the schema bullet.
- §3 Logic: update the `src/lib/lock.ts` bullet to "**per-week locking, 4 hours before the week's first kickoff**" and update `scoring.ts` to mention the tiebreak secondary sort.
- §3 Pages/routes: add `/account` (change password) and note the picks board's tiebreaker input + the admin "Reset password" button.
- §7 Key behaviors: change the **Locking** bullet to "each week locks **4 hours before that week's first kickoff**"; add a **Tiebreaker** bullet (combined score of each week's final game; season-end ties broken by smallest total error) and a **Password reset** bullet (admin temp-password button + `/account` self-service).
- §8: remove the lock/tiebreaker items now that they're done; leave the schedule/secret items.

- [ ] **Step 4: Commit**

```bash
git add handoff.md
git commit -m "docs: update handoff for tiebreaker, password reset, 4h lock"
```

- [ ] **Step 5: Deploy (only when the user asks)**

Per project guidance, push only on the user's go-ahead:

```bash
git push origin master   # auto-deploys nfl-pickem26
```

Then verify by content (not chunk hashes): the picks board shows the tiebreaker card, the admin Players rows show "Reset password", and `/account` loads.

---

## Self-review notes

- **Spec coverage:** Lock change → A1. Tiebreaker model → B1; pure logic → B2; ranking → B3; save action → B4; picks UI → B5; leaderboard wiring → B6; user-deletion cleanup → B7. Admin reset → C1 (generator) + C2 (action/button). Change-password → C3. Docs/rollout → W1. All spec sections are covered.
- **Type consistency:** `RankedUser.tiebreakError` (B3) is read by ordering only; `computeStandings`' 4th arg is `Map<string, number>` everywhere (B3, B6). `saveWeekPrediction(week, predictedTotal)` signature matches between B4 (definition) and B5 (call). `finalGameOfWeek` generic constraint `{ id, kickoffAt }` is satisfied by both the picks-page game objects (B5) and the selected leaderboard game shape (B6). `ChangePasswordState` shared between action (C3 step 1) and page (C3 step 2). `resetUserPassword` return shape matches its consumer in `AdminClient` (C2).
- **No placeholders:** every code step shows the full code to add/replace.

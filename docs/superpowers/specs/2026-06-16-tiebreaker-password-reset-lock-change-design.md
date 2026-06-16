# Tiebreaker, Admin Password Reset & Lock-Time Change — Design

_Date: 2026-06-16_

Three changes to the NFL 2026 Pick'em app, suggested by a league member:

1. **Tiebreaker** — combined points of the final game of each week.
2. **Admin password reset** — a button to reset a player's login when they forget it.
3. **Lock-time change** — lock each week 4 hours before its first kickoff (was 9:00 AM ET on game day).

Each is independent and can be built/tested separately.

---

## 1. Week lock → 4 hours before first kickoff

### Current behavior
`src/lib/lock.ts` computes `weekLockTime` as **9:00 AM ET on the calendar date (ET) of the week's earliest kickoff**, using `Intl.DateTimeFormat` timezone math (`tzOffsetMs`, `WEEK_LOCK_HOUR_ET = 9`).

### New behavior
Lock each week **4 hours before its earliest kickoff** (a fixed offset — no timezone math needed).

```ts
export const WEEK_LOCK_OFFSET_HOURS = 4;

export function weekLockTime(weekKickoffs: Date[]): Date | null {
  if (weekKickoffs.length === 0) return null;
  const earliest = Math.min(...weekKickoffs.map((d) => d.getTime()));
  return new Date(earliest - WEEK_LOCK_OFFSET_HOURS * 60 * 60 * 1000);
}
```

- **Delete** `tzOffsetMs` and `WEEK_LOCK_HOUR_ET` — no longer used.
- `isWeekOpen(now, kickoffs)` is unchanged (still `now < weekLockTime`).

### Ripple
Everything downstream derives from `weekLockTime`, so no other logic changes:
- `src/app/actions/picks.ts` — server-side enforcement via `isWeekOpen`. Unchanged.
- `src/app/picks/PicksClient.tsx` — countdown + `lockLabel` (already renders exact time with `timeZoneName`). Unchanged.
- `src/app/page.tsx` — "next lock" hero badge (date only). Unchanged; optionally could show time, but out of scope.

### Tests
Update `src/lib/lock.test.ts` for the new rule (lock = first kickoff − 4h; weeks with no games → `null`; open/closed boundary).

---

## 2. Tiebreaker — aggregate closeness across all weeks

### Rule
Each week, every player predicts the **combined final score** (home + away) of that week's **final game** (the latest kickoff). At season end, when two players are tied on total correct picks, the player whose predictions were collectively **closest** wins the tiebreak:

```
tiebreakError(user) = Σ over completed tiebreaker weeks |predictedTotal − actualTotal|
```

- Only weeks whose **final game is FINAL** (actual total known) contribute.
- A player with **no prediction** for a completed week incurs a fixed per-week penalty (`MISSING_PENALTY = 1000`), larger than any realistic single-game error — so predicting always beats not predicting, and a blank can never *help* in a tie.
- Lower error wins. Because `correct` is the **primary** sort key and error only breaks ties, the penalty magnitude never disturbs the main ordering.

### Data model
New Prisma model (`prisma/schema.prisma`):

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

- Add `weekPredictions WeekPrediction[]` to `User`.
- `onDelete: Cascade` so removing a user drops their predictions. `removeUser` in `src/app/actions/admin.ts` also calls `db.weekPrediction.deleteMany` before `db.user.delete` (mirrors the existing pick cleanup; belt-and-suspenders).
- Apply via `npm run db:push`.

### New module: `src/lib/tiebreaker.ts`
Pure, unit-testable helpers (no DB/network):

- `finalGameOfWeek<T extends { kickoffAt: Date; id: string }>(games: T[]): T | null`
  — the game with the latest `kickoffAt`; ties broken by `id` (descending, deterministic). `null` if empty.
- `MISSING_PENALTY = 1000`.
- `tiebreakErrorByUser(input): Map<string, number>` — given, per completed tiebreaker week, the actual total and each user's prediction (or absence), returns each user's summed error including penalties. Exact input shape decided in the plan, but it is a pure function over plain data.

"Completed tiebreaker week" = a week whose `finalGameOfWeek` has `status === 'FINAL'` and non-null `homeScore`/`awayScore`.

### Scoring change: `src/lib/scoring.ts`
Extend `computeStandings` to break ties by tiebreak error:

- New optional parameter carrying each user's `tiebreakError` (number; `0` when no completed tiebreaker weeks yet — early season → no effect).
- `RankedUser` gains `tiebreakError: number`.
- Sort: `correct` desc, then `tiebreakError` asc, then `name` asc.
- Standard competition ranking: two rows share a rank **only when both `correct` and `tiebreakError` are equal** (so an unbroken tie is still possible if predictions are identically accurate).
- Backward-compatible: called without tiebreak data, every user's error is `0` and behavior matches today (ties fall through to name order).

### UI
**`src/app/picks/page.tsx`** (server):
- For each week, compute `finalGameOfWeek` and pass its id + matchup label (`AWAY @ HOME`), plus the game's `status` and (if FINAL) actual total.
- Load the user's `WeekPrediction[]` → `initialPredictions: Record<weekNumber, number>`.

**`src/app/picks/PicksClient.tsx`** (client):
- Below the games grid for the active week, a **Tiebreaker** card: "Predict the combined final score — Week N tiebreaker · {AWAY @ HOME}", with a number input (integer, 0–150 sane bounds).
- **Open week:** editable; auto-saves on change/blur (debounced or on-blur) via the new action, mirroring the per-pick auto-save UX (optimistic + revert on error).
- **Locked week:** read-only, shows the saved prediction. If the final game is FINAL, also show the actual total and the diff.
- **Soft requirement:** if the week is open and the tiebreaker is blank, show an unobtrusive hint ("Tiebreaker not set"); do **not** block saving picks.

**`src/app/actions/picks.ts`** — new server action:
```ts
saveWeekPrediction(week: number, predictedTotal: number): Promise<SaveResult>
```
- Auth required.
- Enforce the week lock server-side via `isWeekOpen` (same as `savePick`) — reject if locked.
- Validate `predictedTotal` is an integer within sane bounds (e.g. 0–150).
- Upsert on `@@unique([userId, week])`.

**`src/app/page.tsx`** (leaderboard): ordering already reflects the tiebreak through `computeStandings`. **No visual change** to the leaderboard in this iteration (no new column) — keep scope tight. (Surfacing tiebreak standing on the leaderboard is a possible future polish.)

### Tests
- `src/lib/tiebreaker.test.ts` — `finalGameOfWeek` (latest kickoff, id tiebreak, empty), `tiebreakErrorByUser` (summed abs error, missing-week penalty, ignores non-FINAL weeks).
- Extend `src/lib/scoring.test.ts` — ties broken by error; unbroken tie when errors equal; no-tiebreak-data path unchanged.

---

## 3. Admin password reset (+ self-service change password)

No email infrastructure exists, so reset is **admin-driven**.

### Admin reset
New server action in `src/app/actions/admin.ts`:

```ts
resetUserPassword(targetUserId: string): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }>
```

- Admin-only (`requireAdmin`).
- Generate a **readable temporary password** using Node `crypto` (e.g. a short word + random base32 suffix like `Bolt-7Q4K`) — helper lives next to the password utilities (e.g. `generateTempPassword()` in `src/lib/auth-helpers.ts`).
- Hash via existing `hashPassword`, update `user.passwordHash`.
- Return the plaintext **once** so the admin can relay it out-of-band. Never stored in plaintext.
- No special guardrail needed (admin may reset anyone, including self); allowed regardless of admin count.

**UI — `src/app/admin/AdminClient.tsx`:** a **"Reset password"** button on each player row (alongside Demote/Remove), behind a `confirm`. On success, surface the temp password prominently in the existing message area (e.g. `Temp password for {name}: Bolt-7Q4K — share it with them`). Add a line to the mobile help box.

### Self-service change password
A logged-in player who received a temp password can set their own:

- **Page** `src/app/account/page.tsx` (auth-gated) with a small form: current password, new password (min 8), confirm.
- **Action** `changePassword(currentPassword, newPassword)` (in `src/app/actions/auth.ts` or a new `account.ts`):
  - Auth required; load the user.
  - Verify `currentPassword` via `verifyPassword`; reject if wrong.
  - Validate new password (min 8, matches confirm — confirm checked client-side and/or server-side).
  - Hash and update.
- **Nav:** add an "Account" link in the header/`MobileMenu` for signed-in users.

### Tests
- Unit-test `generateTempPassword()` (length/charset/shape) and any pure validation in `auth-helpers`.
- `changePassword`/`resetUserPassword` are thin server actions over tested helpers (DB-bound), consistent with the repo's "glue is untested, pure logic is tested" convention.

---

## Out of scope
- Email-based self-service reset (no email provider; admin reset covers it).
- Leaderboard UI for tiebreaker standing (ordering is correct; surfacing it is future polish).
- Showing lock *time* (not just date) in the home hero badge.

## Rollout
- `npm run db:push` for the new `WeekPrediction` model.
- No seed change. Existing picks/users untouched.
- `npm test` + `npm run typecheck` green before commit; deploy is `git push origin master` (auto-deploys `nfl-pickem26`).
- Update `handoff.md` §7 (lock rule), §8 (tiebreaker/reset now built), and the file map.

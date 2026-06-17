# Usernames + Shared Picks After Lock — Design

_Date: 2026-06-17_

Two related additions:

1. **Usernames + real names.** Players get a public **username** (handle) plus a private
   **first / last name**. Signup collects all three; the 2 existing accounts are prompted to
   complete their profile on next login. Public views show `@username` prominently with
   `First Last` as a secondary line.
2. **Shared picks after lock (Splash-Sports style).** Once a week locks, the picks board shows
   **everyone's picks** for that week as a grid, with correct/wrong tinting once games go final.
   Open/future weeks still show only your own picks (others' picks are never sent early).

---

## A. Identity model

### Schema (`User`)
Keep the existing required `name` column (now the denormalized full name) and add three fields:

```prisma
model User {
  // ...existing fields...
  name      String   // denormalized "First Last" (kept for the session/header)
  username  String?  @unique
  firstName String?
  lastName  String?
  // ...relations...
}
```

- New fields are **nullable** so the 2 existing rows stay valid until those users complete
  their profile. New signups always set all of them, plus `name = "First Last"`.
- `username` is unique (Postgres `@unique` is case-sensitive; case-insensitive uniqueness is
  additionally enforced in the server actions — see below).
- Applied with `npm run db:push`.

### Pure helper module `src/lib/profile.ts` (unit-tested)
- `USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/`.
- `validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string }`
  — trims, checks `USERNAME_RE`; returns a normalized value (as-entered, trimmed). Does NOT
  check DB uniqueness (that's the action's job).
- `validateName(raw: string, label: string): { ok: true; value: string } | { ok: false; error: string }`
  — trims, requires length 1–50.
- `isProfileComplete(u: { username: string | null; firstName: string | null; lastName: string | null }): boolean`
  — all three present and non-empty.
- `fullName(u: { firstName: string | null; lastName: string | null; name: string }): string`
  — `\`${firstName} ${lastName}\`` when both present, else falls back to `name`.

### Public display rule
Leaderboard rows and shared-picks grid headers show **`@username`** as the primary identity and
**`First Last`** (via `fullName`) as a secondary line. The site header and mobile menu keep
showing the full name (`session.user.name`) — unchanged, so no session/JWT changes are needed.

---

## B. Signup + complete-profile flow

### Signup (`src/app/signup/page.tsx` + `signup` action in `src/app/actions/auth.ts`)
- Form gains **Username**, **First name**, **Last name** inputs (with the existing email +
  password).
- `signup` validates name/username via `profile.ts`, checks email **and** username uniqueness
  (username case-insensitively via `findFirst({ where: { username: { equals, mode: 'insensitive' } } })`),
  and creates the user with `username`, `firstName`, `lastName`, and `name = "First Last"`.
- Distinct error messages: "That email is already registered." / "That username is taken."

### Existing users → `/complete-profile`
- `isProfileComplete` is false for the 2 legacy rows (null username/first/last).
- The authenticated pages that already redirect when logged-out — `/picks`, `/account`,
  `/admin` — add a completeness guard: fetch the current user's `username/firstName/lastName`
  and `redirect('/complete-profile')` if incomplete. Login lands on `/picks`, so the prompt
  fires on next login. The guard reads the DB (not the JWT), so it's never stale after the
  profile is completed.
- **`src/app/complete-profile/page.tsx`** — client form (username + first/last), auth-gated;
  if the user is already complete it redirects to `/picks`.
- **`completeProfile` action** (in `src/app/actions/auth.ts`) — requires login, validates,
  enforces case-insensitive username uniqueness (excluding the current user), and updates
  `username/firstName/lastName` + `name = "First Last"`. Returns `{ ok }` / `{ error }`.

No change to `auth.ts` (next-auth config) or the session shape.

---

## C. Shared picks on the picks board (locked weeks)

### Behavior
- **Open / future week:** unchanged — the current selectable pick buttons, your picks only.
- **Locked week:** the board shows a **grid of every player's picks** for that week.
- Integrity: the server only includes other users' picks for **locked** weeks. Open-week picks
  of other users are never serialized to the client.

### Data (`src/app/picks/page.tsx`)
For each **locked** week, attach a `league` payload to the week object:
- `players: { id: string; username: string; fullName: string }[]` — every user who made ≥1 pick
  that week (admins included; this is a transparency view, distinct from the admin-excluded
  leaderboard). Sorted by username (case-insensitive).
- `picks: { userId: string; gameId: string; pickedTeamId: string }[]` — all picks for that week.
- The week's games already carry `id` + team abbrs; extend the locked-week game shape with
  `winnerTeamId: string | null` and `status` so the grid can tint correctness.

Open weeks get `league: null`. `initialPredictions`/tiebreaker behavior is unchanged.

### UI component `src/app/picks/LeaguePicksGrid.tsx` (new, client)
A horizontally-scrollable table:
- **Columns:** a sticky first column for the game matchup (`AWAY @ HOME`), then one column per
  player headed by `@username`.
- **Rows:** one per game (in kickoff order). Each cell shows the player's picked team abbr;
  blank if they didn't pick it. Once a game is `FINAL`: tint **green** if the pick matches
  `winnerTeamId`, **red** if not.
- **Footer row "Correct":** each player's weekly hit count, from a pure helper.
- Styled with existing tokens (`card`, `field-lines`, mono headers); `no-scrollbar` + overflow
  for mobile. Rendered by `PicksClient` in the locked-week branch instead of the view-only note.

### Pure helper `src/lib/league-picks.ts` (unit-tested)
- `weeklyCorrectByUser(picks, winnerByGame): Map<userId, number>` — counts, per user, picks whose
  `pickedTeamId === winnerByGame.get(gameId)` (ignores games with no winner yet).

---

## D. Files touched (summary)
- **New:** `src/lib/profile.ts` (+ test), `src/lib/league-picks.ts` (+ test);
  `src/app/complete-profile/page.tsx`; `src/app/picks/LeaguePicksGrid.tsx`.
- **Modified:** `prisma/schema.prisma`; `src/app/actions/auth.ts` (signup + completeProfile);
  `src/app/signup/page.tsx`; `src/app/page.tsx` (leaderboard shows username + full name);
  `src/app/picks/page.tsx` (locked-week league payload + completeness guard);
  `src/app/picks/PicksClient.tsx` (render the grid for locked weeks);
  `src/app/account/page.tsx` and `src/app/admin/page.tsx` (completeness guard).
- The leaderboard's `initials()` derives from the full name (fallback username).

## E. Testing
- `profile.ts`: `validateUsername` (good/short/long/bad chars), `validateName`,
  `isProfileComplete`, `fullName` fallback.
- `weeklyCorrectByUser`: counts correct picks, ignores no-winner games, per-user isolation.
- DB-bound glue (signup, completeProfile, picks-page queries) is left untested per repo
  convention.

## F. Out of scope
- Editing username after creation is allowed via `/complete-profile` only if still incomplete;
  a general "change username anytime" on `/account` is **not** included (could be added later).
- No avatars/profile pics. No per-game pick comments.

## G. Rollout
- `npm run db:push` for the three new `User` columns.
- `npm test` + `npm run typecheck` + `npm run build` green before commit.
- Deploy = `git push origin master` (auto-deploys). After deploy: existing users log in → land
  on `/complete-profile`; new signups set username/first/last; lock a week (or view an already
  locked one) to see the shared-picks grid.
- Update `handoff.md` (schema, pages/routes, key behaviors, §8).

# NFL 2026 Pick'em — Data Source Swap, Routing, Admin Tools & Redesign

**Date:** 2026-06-12
**Status:** Approved

## Goal

Four related changes to the NFL 2026 Pick'em app:

1. Swap the NFL data source from ESPN to **nflverse** (free, keyless).
2. Make **standings the home page** (`/`); keep picks at `/picks`.
3. **Exclude admins from standings**, and add admin tools to **remove any user** and **manage admins** (promote/demote).
4. **Redesign the entire UI** as a sleek, modern dark sports app using the frontend-design skill.

## 1. Data Source → nflverse

### Why
The app needs the full 2026 schedule *now* (June) plus final winners. Evaluated options:

| Source | Schedule months ahead | Final winners | Live in-progress | API key |
|---|---|---|---|---|
| **nflverse** (chosen) | ✅ full 2026 (verified, 272 games) | ✅ | ❌ post-game | None |
| api-sports.io | ✅ | ✅ | ✅ | Required + 100/day |
| The Odds API | ❌ | ✅ | partial | Required |
| ESPN (current) | ✅ | ✅ | ✅ | None |

**Decision:** nflverse. Keyless, full verified 2026 schedule, final results (scoring only needs winners; 3-hour cron picks up finals). Bonus: team colors + logos + betting spreads available. Accepted trade-off: no live in-progress scores.

### Data details
- **Games CSV:** `https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv`
  - Columns used: `game_id`, `season`, `game_type` (filter `REG`), `week`, `gameday`, `gametime` (ET), `away_team`, `home_team`, `away_score`, `home_score`, `result` (home_score − away_score).
  - Winner: `result > 0` → home, `result < 0` → away, `0` → tie (no winner), empty → not played.
  - Status: scores present → `FINAL`, else `SCHEDULED` (no `IN_PROGRESS` from this source).
  - Kickoff: combine `gameday` + `gametime` as `America/New_York`, convert to UTC ISO.
- **Team metadata + logos:** nflverse team colors/logos dataset (verify exact URL during implementation; fall back to existing ESPN teams API + hardcoded colors if unavailable). Provides `team_color`, `team_logo_espn`/wikipedia logo.

### Architecture — swappable provider
Refactor `src/lib/results-source.ts` into a provider interface returning the existing `NormalizedGame` shape:

```
interface NflDataProvider {
  fetchSchedule(season): Promise<NormalizedGame[]>   // all REG weeks
  fetchWeek(season, week): Promise<NormalizedGame[]>  // results for one week
}
```

- Keep the existing **ESPN provider** (preserves current tests) as a fallback.
- Add an **nflverse provider** (CSV parse + normalize) with its own unit tests (TDD, using a fixtures CSV sample).
- Default provider = nflverse. Consumers: `prisma/seed.ts`, `src/lib/results-apply.ts`, cron + admin refresh routes.

### Abbreviation mapping
nflverse abbreviations differ from ESPN in a few cases (e.g. `LA`→Rams=`LAR`, `WAS`→`WSH`). Add a `NFLVERSE_TO_CANONICAL` map in `src/lib/teams-data.ts`. Canonical abbr remains the existing ESPN-style abbr so the `Team` table key is stable.

## 2. Schema Changes (Prisma)

- `Game.espnId` → rename to `sourceId` (holds nflverse `game_id`), keep `@unique`.
- `Team.espnId` → rename to `sourceId`, keep `@unique`.
- `Team`: add `logoUrl String?`.
- Re-seed from nflverse (existing data is test-only; safe to wipe). Re-seed pulls logos.
- Apply via `prisma db push` (no migration history in use).

## 3. Standings + Routing

- **Standings query** filters out admins: `where: { isAdmin: false }` (or filter in the page before `computeStandings`). `computeStandings` itself is unchanged.
- **`/` renders the standings/leaderboard** (with a hero). Move logic from `src/app/standings/page.tsx` into `src/app/page.tsx`.
- `src/app/standings/page.tsx` → `redirect('/')` (preserve old links).
- `/picks` unchanged in routing.
- Update nav in `src/app/layout.tsx`: Standings (`/`), My Picks (`/picks`), plus auth state (login/logout, admin link when admin).

## 4. Admin Tools

New **Users** panel on the admin page (`src/app/admin`):

- **Remove user:** deletes a user and their picks (cascade or explicit delete of picks first).
- **Promote/demote admin:** toggles `isAdmin` on any user.
- `ADMIN_EMAIL` still auto-grants admin on signup (unchanged).

### Guardrails
- A user cannot remove or demote **their own** account.
- The **last remaining admin** cannot be removed or demoted.
- All actions require `session.user.isAdmin` (server-side check in the route/action).

### Implementation
- Server actions or API routes under `src/app/api/admin/users/` (follow existing `api/admin/*` route pattern): `removeUser`, `setAdmin`.
- Admin page loads the user list (id, name, email, isAdmin, pick count) and renders alongside the existing games table.

## 5. UI Redesign (frontend-design skill) — all pages

Dark, high-contrast premium sports aesthetic across **standings (home), picks, login, signup, admin**, and shared layout/nav.

- Team-color accents + real team logos (from nflverse).
- Gradient hero on the standings home.
- Polished leaderboard: rank medals for top 3, highlight the signed-in user's row, "N games final" status.
- Sharper picks board: week selector, per-game cards with logos, clear selected state, pick progress.
- Consistent header with auth state; admin link visible to admins only.
- Tailwind-based (existing stack); update `globals.css` and `tailwind.config.ts` as needed for the theme.

## Testing

- TDD for the nflverse provider (parse + normalize a fixture CSV → expected `NormalizedGame[]`, including winner/status/timezone logic).
- Keep existing tests green (ESPN provider, scoring, lock, auth-helpers).
- Add tests for admin guardrails (cannot remove self / last admin) at the logic level.
- Verify end-to-end: re-seed succeeds, standings excludes admins, redirects work, build + typecheck pass.

## Out of Scope

- Live in-progress scores (accepted trade-off).
- Betting-spread-based picks (data is available for a future feature, not built now).
- Migration history / multi-environment DB tooling.

## Rollout Steps (high level)

1. Provider refactor + nflverse provider (TDD).
2. Schema rename/add + re-seed from nflverse.
3. Standings → home, admin exclusion, `/standings` redirect.
4. Admin user-management tools + guardrails.
5. Full UI redesign (frontend-design).
6. Verify: tests, typecheck, build, manual smoke.

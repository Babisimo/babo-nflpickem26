# NFL 2026 Pick'em — Handoff

_Last updated: 2026-06-16_

A season-long NFL pick'em web app. Players sign up, pick the winner of every
regular-season game (locked per week), and the person with the most correct
picks at the end of the season wins. Points accumulate all season.

**Live:** https://nfl-pickem26.vercel.app
**Repo:** https://github.com/Babisimo/babo-nflpickem26 (branch `master`)

---

## 1. Tech stack

- **Next.js 15** (App Router, React 19, server components + server actions)
- **TypeScript**, **Tailwind CSS v3.4**
- **Prisma 6** + **PostgreSQL** (Neon, serverless)
- **Auth.js / next-auth v5 beta** (email + password, JWT sessions)
- **Vitest** for unit tests
- Data from **nflverse** (free, no API key)
- Hosted on **Vercel** (Hobby plan)

---

## 2. Run it locally

```bash
npm install
# .env must exist (gitignored) — see section 4 for the variables
npm run db:push      # sync schema to the DB
npm run db:seed      # seed 32 teams + the 272-game 2026 schedule from nflverse
npm run dev          # http://localhost:3000
```

Other scripts:
- `npm test` — run all Vitest tests (currently 31 passing)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — `prisma generate && next build`

> Windows note: if `prisma generate` fails with `EPERM ... query_engine-windows.dll`,
> a running `next dev`/`next start` has the DLL locked. Stop the dev server, regenerate.

---

## 3. Architecture / file map

### Data layer
- `src/lib/db.ts` — Prisma client singleton.
- `prisma/schema.prisma` — models: `User`, `Team`, `Game`, `Pick`, enum `GameStatus`.
  - `Team.sourceId` / `Game.sourceId` hold the **nflverse** id (renamed from `espnId`).
  - `Team.logoUrl` holds the ESPN-CDN team logo from nflverse.
- `prisma/seed.ts` — seeds teams (name/colors/logos) + the full season from nflverse.
- `src/lib/nflverse-source.ts` — **the data source.** Fetches/normalizes the nflverse
  games CSV (`normalizeNflverseGames`, `fetchNflverseSeason`) and the team colors/logos
  (`parseNflverseTeams`, `fetchNflverseTeams`). Tested in `nflverse-source.test.ts`.
- `src/lib/results-source.ts` — the source-neutral `NormalizedGame` type + the legacy
  **ESPN** normalizer, kept as a fallback provider. Tested.
- `src/lib/teams-data.ts` — `TEAM_DIVISIONS` (conf/division per team) + `canonicalAbbr`
  (maps nflverse abbreviations to our canonical ones, e.g. `LA→LAR`, `WAS→WSH`).
- `src/lib/results-apply.ts` — `applyAllResults()`: pulls the season from nflverse and
  writes scores/status/winners into `Game`. Used by the cron + admin "Force refresh".
- `src/lib/schedule-apply.ts` — `refreshSchedule()`: pulls the latest schedule, upserts
  games by `sourceId` (updates kickoff dates/weeks, adds new games), **preserves picks**.
  Used by the admin "Refresh schedule" button.

### Logic
- `src/lib/lock.ts` — **per-week locking.** `weekLockTime(weekKickoffs)` = 9:00 AM ET on
  the calendar date (ET) of that week's first game; `isWeekOpen(now, weekKickoffs)`.
  Tested in `lock.test.ts`.
- `src/lib/scoring.ts` — `computeStandings()`: pure scoring + standard-competition ranking.
  Counts correct picks across **all** games (points carry over the whole season). Tested.
- `src/lib/admin-guard.ts` — `canRemoveUser` / `canSetAdmin` guardrails (no self-action,
  no removing/demoting the last admin). Tested in `admin-guard.test.ts`.
- `src/lib/auth.ts` — next-auth config + the `AppSession` type (cast `auth()` results to it).
- `src/lib/auth-helpers.ts` — bcrypt hash/verify. Tested.

### Pages / routes (App Router)
- `src/app/layout.tsx` — root layout: session-aware header (desktop nav + `MobileMenu`),
  fonts (Anton / Hanken Grotesk / JetBrains Mono), footer.
- `src/app/page.tsx` — **home = the standings/leaderboard** (admins excluded). Hero shows
  the next week to lock.
- `src/app/standings/page.tsx` — redirects to `/` (kept for old links).
- `src/app/picks/page.tsx` + `PicksClient.tsx` — the weekly picks board: per-week open
  state, **live countdown timer**, locked-week view-only, Save button + unfinished warnings.
- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — auth forms.
- `src/app/admin/page.tsx` + `AdminClient.tsx` — admin: Players panel (remove / make-admin /
  demote), Games table (set-winner overrides), Refresh schedule, Force refresh results,
  and a **mobile-only help box** explaining each button.
- `src/app/MobileMenu.tsx` — mobile hamburger nav drawer.
- `src/app/actions/*` — server actions: `auth.ts` (signup, logout), `picks.ts` (savePick,
  enforces the week lock server-side), `admin.ts` (removeUser, setAdmin).
- `src/app/api/admin/refresh` — POST, admin-only, results refresh.
- `src/app/api/admin/refresh-schedule` — POST, admin-only, schedule refresh.
- `src/app/api/admin/override` — POST, admin-only, manual winner override.
- `src/app/api/cron/results` — GET, guarded by `CRON_SECRET`, runs daily (see `vercel.json`).
- `src/app/favicon.ico` — NFL shield.

### Theme ("Sunday Field")
- `tailwind.config.ts` — color tokens. `ink.*` = field-green shades (the dark base),
  `chalk`/`muted`/`faint` = light greens/white, `accent`/`gold` = gold highlights,
  `primary` = red CTAs, `line` = white-alpha. Fonts via CSS vars.
- `src/app/globals.css` — base styles, atmospheric glows, grain, yard-line texture
  (`.field-lines`), component classes (`.card`, `.btn-accent` [red], `.btn-ghost`,
  `.field-input`, `.eyebrow`, `.stat-num`), `.no-scrollbar`, reveal animation.

---

## 4. Environment & secrets

`.env` (gitignored — NOT in the repo). The same 5 vars are set on the Vercel project.

| Var | What |
|---|---|
| `DATABASE_URL` | **Pooled** Neon connection (`-pooler` host, `&pgbouncer=true`). App runtime. |
| `DIRECT_URL` | **Direct** Neon connection (non-pooler host). Migrations + seeding. |
| `AUTH_SECRET` | next-auth session signing secret. |
| `ADMIN_EMAIL` | Whoever signs up with this email becomes admin → `gondaniel852@gmail.com`. |
| `CRON_SECRET` | Authorizes `/api/cron/results` (Vercel sends it as `Authorization: Bearer`). |

> ⚠️ These secrets were shared in the chat that built this app. If that transcript
> is ever exposed, **rotate them**: new Neon password (update both URLs), and
> regenerate `AUTH_SECRET`/`CRON_SECRET` with `openssl rand -base64 32`.

---

## 5. Database (Neon) & current data

- Neon project **`nfl-pickem26`** (org `gondaniel35@yahoo.com`, region us-west-2),
  database `neondb`, Postgres 18. Free plan: **512 MB** storage cap.
- Current data: **32 teams, 272 games, 2 users** (~8 MB used, mostly Postgres baseline).
- Schedule verified structurally valid: every team plays 17 games, 18 weeks, each team
  has exactly 1 bye (weeks 5–14), no double-bookings. Source = nflverse (mirrors the
  official schedule); matchups final, but kickoff times can still flex (see §8).
- Capacity: storage fits **~5,000 fully-active players**; for any realistic league it's
  effectively unlimited. The real free-tier constraint is **compute** (auto-suspend /
  active hours), not storage or player count.

---

## 6. Deployment (Vercel)

- Single project **`nfl-pickem26`** (domain `nfl-pickem26.vercel.app`), **git-connected**
  to `Babisimo/babo-nflpickem26`, branch `master`. **A push to `master` auto-deploys.**
- A second project `babo-nflpickem26` existed earlier and was **deleted** — env vars live
  only on `nfl-pickem26`.
- **Verify a deploy by content, NOT by JS chunk hashes.** Vercel builds on Linux and a
  local Windows `next build` produce different chunk hashes for identical source, so a
  "stale-looking" hash is a false alarm. Instead:
  - Live commit: `vercel inspect nfl-pickem26.vercel.app --logs | grep -E "Commit:|build cache"`
  - Content: `curl` the page and grep for current copy; for theme, fetch the CSS bundle and
    grep the rgb triplet (Tailwind compiles `#0e3b24` → `14 59 36`, `#ffcb3d` → `255 203 61`).
- The Vercel CLI in the original dev environment couldn't `link`/`deploy` non-interactively
  (`missing_scope`); `vercel list`/`vercel inspect` work. If auto-deploy ever serves stale
  output, do a dashboard **Redeploy with "Use existing Build Cache" unchecked**.

---

## 7. Key behaviors

- **Locking:** each week locks at **9:00 AM ET on the day of that week's first game**
  (usually Thursday; the 2026 opener is a Wednesday, handled correctly). Future weeks stay
  open. Enforced both in the UI and server-side in `savePick`.
- **Scoring:** +1 per correct winner pick; ties (no winner) score nothing. Standings rank by
  total correct (cumulative all season). Standard competition ranking (1,1,3,…).
- **Results:** `/api/cron/results` runs **once daily at 12:00 UTC** (`vercel.json` —
  Hobby plan allows one cron/day). Admin can "Force refresh results" anytime.
- **Schedule:** seeded once; refreshed only via the admin **"Refresh schedule"** button
  (manual). Updates dates/weeks, adds games, keeps picks.
- **Admins** are excluded from the standings leaderboard but can play; admin is granted on
  signup via `ADMIN_EMAIL`, and any admin can promote/demote others.

---

## 8. Known issues / future work

**Should do before/early in the season**
- **Cross-check the schedule** against an official source (NFL.com) closer to kickoff, and
  use **Refresh schedule** to pull any flex/date changes. It does not auto-update.
- Consider **automating schedule refresh** — add `refreshSchedule()` to the daily cron (or a
  weekly cron) so flex changes flow in without a manual click.
- **Rotate the secrets** (see §4) if the build transcript was shared.

**Nice-to-haves / polish**
- The `<head>` meta description still says "Most correct wins" (hero now says "Most points
  win"). Update `metadata.description` in `src/app/layout.tsx` for consistency.
- Prisma warns that `package.json#prisma` is deprecated (removed in Prisma 7) — migrate to a
  `prisma.config.ts` eventually.
- No live in-progress scores (nflverse posts finals only) — accepted trade-off. If you want
  live scores, swap/add a provider behind the `NormalizedGame` interface (the ESPN provider
  in `results-source.ts` already does live scores).
- nflverse also carries **betting spreads/lines** (unused) — could power a spread-pick mode.
- Tiebreakers / weekly winners / pick reminders / email notifications are not built.
- Glue code (`results-apply`, `schedule-apply`, `seed`) is intentionally untested
  (network + DB); the pure logic it depends on is unit-tested. Could add integration tests.

**Operational**
- On Vercel Hobby, the DB auto-suspends when idle (first request after idle is slightly
  slower) and cron is limited to once/day. Upgrading Neon/Vercel removes these.

---

## 9. Quick reference — commands

```bash
npm run dev            # local dev
npm test               # vitest (31 tests)
npm run typecheck      # tsc --noEmit
npm run build          # prisma generate && next build
npm run db:push        # push schema to DB
npm run db:seed        # (re)seed teams + schedule from nflverse — preserves nothing, upserts

# deploy = git push origin master  (auto-deploys nfl-pickem26)

# check what's live:
vercel inspect nfl-pickem26.vercel.app --logs | grep -E "Commit:|build cache"
```

> The design spec for the big data-source/redesign change lives at
> `docs/superpowers/specs/2026-06-12-data-source-routing-admin-redesign-design.md`.

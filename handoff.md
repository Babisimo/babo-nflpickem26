# NFL 2026 Pick'em — Handoff

_Last updated: 2026-06-17_

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
- Notable libs: **nodemailer** (Gmail SMTP, password-reset email), **obscenity** (username
  profanity filter), **nextjs-toploader** (top navigation progress bar), **bcryptjs**, **zod**.

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
- `npm test` — run all Vitest tests (currently 68 passing)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — `prisma generate && next build`

> Windows note: if `prisma generate` fails with `EPERM ... query_engine-windows.dll`,
> a running `next dev`/`next start` has the DLL locked. Stop the dev server, regenerate.

---

## 3. Architecture / file map

### Data layer
- `src/lib/db.ts` — Prisma client singleton.
- `prisma/schema.prisma` — models: `User`, `Team`, `Game`, `Pick`, `WeekPrediction`, `PasswordResetToken`, enum `GameStatus`.
  - `User` has a public `username` (`@unique`, nullable) + `firstName`/`lastName` + `usernameChangeCount` (Int, default 0); `name` stays as the denormalized "First Last".
  - `WeekPrediction` holds each player's per-week combined-score guess for the tiebreaker (`@@unique([userId, week])`, cascade-deletes with the user).
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
- `src/lib/lock.ts` — **per-week locking.** `weekLockTime(weekKickoffs)` = 4 hours before
  that week's earliest kickoff; `isWeekOpen(now, weekKickoffs)`. Tested in `lock.test.ts`.
- `src/lib/scoring.ts` — `computeStandings()`: pure scoring + standard-competition ranking.
  Counts correct picks across **all** games (points carry over the whole season); ties are
  broken by the **tiebreaker error** (optional 4th arg). Tested.
- `src/lib/tiebreaker.ts` — `finalGameOfWeek()` (a week's last game by kickoff) +
  `tiebreakErrorByUser()` (Σ |predicted − actual| combined-score error across completed
  weeks, with a per-missing-week penalty). Pure, tested in `tiebreaker.test.ts`.
- `src/lib/admin-guard.ts` — `canRemoveUser` / `canSetAdmin` guardrails (no self-action,
  no removing/demoting the last admin). Tested in `admin-guard.test.ts`.
- `src/lib/auth.ts` — next-auth config + the `AppSession` type (cast `auth()` results to it).
- `src/lib/auth-helpers.ts` — bcrypt hash/verify + `generateTempPassword`. Tested.
- `src/lib/password-reset.ts` — reset-token logic: `hashResetToken` (SHA-256), `generateResetToken`,
  `isResetTokenValid`, `RESET_TOKEN_TTL_MS` (1h). Pure, tested in `password-reset.test.ts`.
- `src/lib/email.ts` — Nodemailer Gmail-SMTP transporter + `sendPasswordResetEmail`. Reads
  `GMAIL_USER`/`GMAIL_APP_PASSWORD` (see §4). `server-only`.
- `src/lib/profile.ts` — identity helpers: `validateUsername` (3–20 `[A-Za-z0-9_]`), `validateName`
  (1–50), `isProfileComplete`, `fullName`, `usernameChangesRemaining` / `MAX_USERNAME_CHANGES` (2).
  Pure, tested in `profile.test.ts`.
- `src/lib/username-filter.ts` — `checkUsernameAllowed`: blocks reserved handles (`admin`, `mod`, …)
  + profanity/slurs via the **`obscenity`** library (obfuscation-aware). Applied at every username
  entry point (signup, complete-profile, change). Tested in `username-filter.test.ts`.
- `src/lib/league-picks.ts` — `weeklyCorrectByUser(picks, winnerByGame)` for the shared-picks
  grid. Pure, tested in `league-picks.test.ts`.

### Pages / routes (App Router)
- `src/app/layout.tsx` — root layout: session-aware header (desktop nav + `MobileMenu`),
  fonts (Anton / Hanken Grotesk / JetBrains Mono), footer, and a top **navigation progress bar**
  (`nextjs-toploader`, gold, mounted at the top of `<body>`) for page-load feedback.
- `src/app/page.tsx` — **home = the standings/leaderboard** (admins excluded). Hero shows
  the next week to lock.
- `src/app/standings/page.tsx` — redirects to `/` (kept for old links).
- `src/app/picks/page.tsx` + `PicksClient.tsx` — the weekly picks board: open weeks show your
  pick buttons + **live countdown** + per-week **tiebreaker** input; **locked weeks show
  everyone's picks** as a grid (`LeaguePicksGrid.tsx`, users × games, green/red once final).
  Other players' picks are only sent for locked weeks. Redirects incomplete profiles to
  `/complete-profile`.
- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — auth forms; login has a **Forgot
  password?** link; signup collects **username + first/last name**.
- `src/app/complete-profile/page.tsx` (+ `CompleteProfileForm.tsx`) — one-time form for legacy
  users to set username + first/last; the authenticated pages (`/picks`, `/account`, `/admin`)
  redirect here until the profile is complete.
- `src/app/forgot-password/page.tsx` — request a reset link by email (generic response, no enumeration).
- `src/app/reset-password/page.tsx` — set a new password from the emailed `?token=` link.
- `src/app/account/page.tsx` (+ `AccountForm.tsx`) — signed-in users **change their username**
  (capped at 2, filtered) and their password (`changePassword`); server-guarded for auth +
  profile completeness.
- `src/app/admin/page.tsx` + `AdminClient.tsx` — admin: Players panel (remove / make-admin /
  demote / **reset password** → one-time temp string), Games table (set-winner overrides),
  Refresh schedule, Force refresh results, and a **mobile-only help box** explaining each button.
- `src/app/MobileMenu.tsx` — mobile hamburger nav drawer.
- `src/app/actions/*` — server actions: `auth.ts` (signup, logout, changePassword, completeProfile), `picks.ts`
  (savePick, saveWeekPrediction — both enforce the week lock server-side), `admin.ts`
  (removeUser, setAdmin, resetUserPassword), `password-reset.ts` (requestPasswordReset, resetPassword).
  `auth.ts` also exports `changeUsername` (2-change cap, filtered).
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

`.env` (gitignored — NOT in the repo). The same vars are set on the Vercel project.

| Var | What |
|---|---|
| `DATABASE_URL` | **Pooled** Neon connection (`-pooler` host, `&pgbouncer=true`). App runtime. |
| `DIRECT_URL` | **Direct** Neon connection (non-pooler host). Migrations + seeding. |
| `AUTH_SECRET` | next-auth session signing secret. |
| `ADMIN_EMAIL` | Whoever signs up with this email becomes admin → `gondaniel852@gmail.com`. |
| `CRON_SECRET` | Authorizes `/api/cron/results` (Vercel sends it as `Authorization: Bearer`). |
| `GMAIL_USER` | **Dedicated** Gmail that sends password-reset emails (Nodemailer SMTP) → `nflpickem.admin@gmail.com`. Kept separate from any personal account so it isn't exposed to recipients; must have 2-Step Verification on (App Passwords require it). Inbox shows the "NFL Pick'em" display name (hardcoded in `src/lib/email.ts`). |
| `GMAIL_APP_PASSWORD` | 16-char Google **App Password** (needs 2-Step Verification on that account) — NOT the normal password. |
| `APP_URL` | Canonical site origin (e.g. `https://nfl-pickem26.vercel.app`). Used to build reset links from a trusted base instead of the request `Host` header (host-header-injection safe). If unset in prod it falls back to `Host` and logs a warning; unset locally → `http://localhost:3000`. |

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

- **Locking:** each week locks **4 hours before that week's first kickoff**. Future weeks stay
  open. Enforced both in the UI and server-side in `savePick` / `saveWeekPrediction`.
- **Scoring:** +1 per correct winner pick; ties (no winner) score nothing. Standings rank by
  total correct (cumulative all season). Standard competition ranking (1,1,3,…).
- **Identity:** players have a public `@username` plus private first/last name (collected at
  signup; the leaderboard/grid show `@username` + full name). The 2 legacy accounts are sent to
  `/complete-profile` on next login until they set theirs. Username: 3–20 `[A-Za-z0-9_]`, unique
  case-insensitively, no profanity/slurs or reserved handles (`username-filter.ts`). Players can
  **change their username twice** (after signup) from `/account`; a no-op doesn't burn a change.
- **Shared picks:** once a week locks, the picks board shows **everyone's** picks for that week
  (grid, green/red once final, weekly correct tally). Open/future weeks show only your own — the
  server never sends others' open-week picks.
- **Tiebreaker:** each week, players predict the combined final score of that week's last game
  (`saveWeekPrediction`). Season-end ties are broken by the smallest total error
  (Σ |predicted − actual|) over completed weeks; a week with no prediction is penalized so a
  blank never helps. Pure logic in `tiebreaker.ts`; applied as `computeStandings`' 4th arg.
- **Password reset:** three paths. (1) **Self-service by email** — login → **Forgot password?**
  → `/forgot-password` emails a one-time link (1-hour, single-use, hashed token via Gmail SMTP)
  to `/reset-password`. (2) **Admin** resets any player's password to a one-time temp string
  (Players panel → **Reset password**). (3) Signed-in users change their own at **`/account`**.
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
- Weekly winners / pick reminders are not built. (The combined-score **tiebreaker**, **admin
  password reset**, **self-service email password reset**, **usernames**, and **shared picks
  after lock** are now built — see §7.)
- Username changes are capped at **2 per player** (after signup) and there's no admin override to
  grant more, nor a change-history/audit log — could be added later.
- The password-reset request endpoint is **not rate-limited** — acceptable for a small private
  league; add throttling if it's ever abused (also bounds Gmail's daily send quota).
- A password reset/change does **not** invalidate existing JWT sessions (stateless sessions
  stay valid until expiry). Fine for the forgot-password case; if you need to kill a
  compromised session immediately, add a `passwordChangedAt` check in the next-auth `jwt`/`session`
  callbacks.
- Outbound email goes through one Gmail account (Nodemailer SMTP), subject to Gmail's ~500/day
  send cap. Fine for resets; revisit if email volume grows.
- Glue code (`results-apply`, `schedule-apply`, `seed`) is intentionally untested
  (network + DB); the pure logic it depends on is unit-tested. Could add integration tests.

**Operational**
- On Vercel Hobby, the DB auto-suspends when idle (first request after idle is slightly
  slower) and cron is limited to once/day. Upgrading Neon/Vercel removes these.

---

## 9. Quick reference — commands

```bash
npm run dev            # local dev
npm test               # vitest (68 tests)
npm run typecheck      # tsc --noEmit
npm run build          # prisma generate && next build
npm run db:push        # push schema to DB
npm run db:seed        # (re)seed teams + schedule from nflverse — preserves nothing, upserts

# deploy = git push origin master  (auto-deploys nfl-pickem26)

# check what's live:
vercel inspect nfl-pickem26.vercel.app --logs | grep -E "Commit:|build cache"
```

> **Design docs:** every feature has a spec in `docs/superpowers/specs/` and (for the larger
> ones) an implementation plan in `docs/superpowers/plans/`. By date: `2026-06-12` data-source/
> admin redesign; `2026-06-16` tiebreaker + admin password reset + 4h lock; `2026-06-17`
> email password reset, usernames + shared picks, change-username, and the navigation progress bar.

# NFL 2026 Pick'em

Season-long NFL pick'em: sign up, pick every regular-season game before the
season locks (48h before the first kickoff), and climb the leaderboard.
Sleek, mobile-first dark UI; data pulled from [nflverse](https://github.com/nflverse/nfldata)
(free, no API key) for the schedule, results, team colors, and logos.

## Local dev
1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — **pooled** Postgres connection (Neon `-pooler` host, with
     `?sslmode=require&pgbouncer=true`). Used by the app at runtime.
   - `DIRECT_URL` — **direct** Postgres connection (non-pooler host). Used by
     `prisma db push`/migrations and seeding.
   - `AUTH_SECRET`, `CRON_SECRET` — generate with `openssl rand -base64 32`.
   - `ADMIN_EMAIL` — the account that signs up with this email becomes admin.
3. `npm run db:push` then `npm run db:seed` (seeds 32 teams + the full 2026
   schedule from nflverse).
4. `npm run dev` → http://localhost:3000

## Pages
- `/` — **Standings** (the home page). Admin accounts are excluded from the leaderboard.
- `/picks` — make/track your picks, week by week.
- `/admin` — admin only: force-refresh results, override a winner, and manage
  players (remove a user, or promote/demote admins). You can't remove or demote
  yourself or the last remaining admin.
- A bottom tab bar provides primary navigation on mobile.

## Deploy (Vercel)
1. Push this repo to GitHub and import it in Vercel.
2. Add a Postgres database (Neon) and set both `DATABASE_URL` (pooled) and
   `DIRECT_URL` (direct).
3. Set env vars: `AUTH_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET`.
4. After the first deploy, seed the production DB:
   `npm run db:seed` with prod `DATABASE_URL`/`DIRECT_URL` (or a one-off Vercel job).
5. The cron in `vercel.json` pulls results every 3 hours on production.

## Architecture
- `src/lib/nflverse-source.ts` — nflverse fetch + normalize (schedule, results, team colors/logos)
- `src/lib/results-source.ts` — source-neutral `NormalizedGame` shape + ESPN provider (fallback)
- `src/lib/results-apply.ts` — writes nflverse results into the DB
- `src/lib/scoring.ts` — pure scoring + ranking
- `src/lib/lock.ts` — season lock (48h before first kickoff)
- `src/lib/admin-guard.ts` — pure guardrails for removing/promoting users
- `src/app/actions/admin.ts` — admin-only server actions (remove user, set admin)
- Auth.js (email/password), Prisma + Postgres, Next.js App Router, Tailwind.

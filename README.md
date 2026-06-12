# NFL 2026 Pick'em

Season-long NFL pick'em: sign up, pick every regular-season game before the
season locks (48h before the first kickoff), and climb the leaderboard.

## Local dev
1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `AUTH_SECRET`,
   `ADMIN_EMAIL`, `CRON_SECRET`. Generate `AUTH_SECRET`/`CRON_SECRET` with
   `openssl rand -base64 32`.
3. `npm run db:push` then `npm run db:seed` (seeds 32 teams + the 2026 schedule from ESPN).
4. `npm run dev` → http://localhost:3000

## Deploy (Vercel)
1. Push this repo to GitHub and import it in Vercel.
2. Add a Postgres database (Vercel Postgres / Neon) and set `DATABASE_URL`.
3. Set env vars: `AUTH_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET`.
4. After the first deploy, run the seed against the production DB:
   `DATABASE_URL=<prod> npm run db:seed` (or a one-off Vercel job).
5. The cron in `vercel.json` pulls results every 3 hours on production.

## Architecture
- `src/lib/results-source.ts` — ESPN-only fetch + normalize
- `src/lib/scoring.ts` — pure scoring + ranking
- `src/lib/lock.ts` — season lock (48h before first kickoff)
- `src/lib/results-apply.ts` — writes ESPN results into the DB
- Auth.js (email/password), Prisma + Postgres, Next.js App Router.

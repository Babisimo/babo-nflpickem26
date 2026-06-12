# NFL 2026 Pick'em — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Summary

A season-long **NFL 2026 pick'em** web app. Users sign up, then — during a
pre-season picking window — pick the winner of **every** regular-season game
(all 18 weeks, ~272 games) up front. All picks **lock 48 hours before the first
kickoff** of the season. After lock, game results roll in week by week, scores
are computed automatically, and a global leaderboard updates. One shared pool;
straight pick'em scoring (1 point per correct winner).

Hosted on **Vercel**, built with **Next.js**.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Picks & identity | In-app picking with **full accounts** (email + password) |
| Scoring | **Straight pick'em** — 1 point per correct winner |
| Pool structure | **One global pool** / shared leaderboard |
| Game scope | **Regular season only** (18 weeks, ~272 games) |
| Pick locking | **Whole season locks 48h before the first kickoff**; picks made up front |
| Auth | **Email + password** (Auth.js Credentials, hashed passwords) |

## Stack

- **Next.js (App Router, TypeScript)** on Vercel
- **Tailwind CSS** for styling
- **PostgreSQL** (Vercel Postgres / Neon) via **Prisma** ORM
- **Auth.js (NextAuth v5)** — Credentials provider, bcrypt-hashed passwords, JWT sessions
- **ESPN scoreboard API** for schedule + results, isolated behind `lib/results-source.ts`

## Architecture

The system breaks into focused units with clear boundaries:

- **`lib/results-source.ts`** — the *only* module that knows about ESPN. Fetches the
  schedule (for seeding) and live scoreboard (for results). Returns normalized
  `{ espnId, week, kickoffAt, homeAbbr, awayAbbr, homeScore, awayScore, status,
  winnerAbbr }`. Swapping providers touches nothing else.
- **`lib/scoring.ts`** — pure functions. Given games (with winners) and picks,
  returns per-user totals and a ranked leaderboard. No I/O, fully unit-testable.
- **`lib/lock.ts`** — computes/enforces the season lock = (earliest kickoff − 48h).
  Single source of truth for "are picks open?".
- **Prisma data layer** — schema + typed queries.
- **Auth.js** — session/identity.
- **App Router pages + API routes** — UI and server actions.

## Data model (Prisma)

```
User    id, email (unique), name, passwordHash, isAdmin (bool), createdAt
Team    id, espnId, abbr (unique), name, conference, division, color
Game    id, espnId (unique), week (int), kickoffAt (datetime),
        homeTeamId, awayTeamId,
        homeScore (int?), awayScore (int?),
        status (enum: SCHEDULED | IN_PROGRESS | FINAL),
        winnerTeamId (?)          -- null until final; ties not possible in NFL regular play (OT decides; a tie is possible but rare → winnerTeamId null = no points for either pick)
Pick    id, userId, gameId, pickedTeamId, createdAt, updatedAt
        UNIQUE (userId, gameId)
```

- 32 **Team** rows seeded once.
- ~272 **Game** rows seeded from the ESPN 2026 schedule.
- Season lock derived from `min(Game.kickoffAt) − 48h` (computed in `lib/lock.ts`;
  no separate settings row needed for v1).

## Core flows

1. **Sign up / log in** — email + password (hashed with bcrypt).
2. **Make picks (before lock)** — `/picks` shows games grouped **week-by-week**
   (tabs or accordion) with a **"N of 272 picked"** progress indicator. Each pick
   **autosaves** via a server action. Editable any time until lock.
3. **Lock** — at (earliest kickoff − 48h), the server **rejects all pick writes**
   (`lib/lock.ts` guard in the server action). UI switches `/picks` to read-only.
4. **Results & scoring (during season)** — a **Vercel Cron** route
   (`/api/cron/results`, runs on game days) calls `lib/results-source.ts`, updates
   `Game` scores/status/winner, and standings recompute from `lib/scoring.ts` on read.
   **Admin** can **force-refresh** and **manually override** a game's result.
5. **Standings** — `/standings`: global leaderboard ranked by total correct picks.
   Drill into any user's full pick sheet (visible after lock). Per-week breakdown.

## Scoring rules

- **1 point** per correct winner pick (`pick.pickedTeamId === game.winnerTeamId`).
- Games not yet final contribute 0.
- A rare NFL tie (no winner) → `winnerTeamId` null → neither pick scores.
- Leaderboard ranks by total points; **ties share rank** (no tiebreaker in v1).

## Pages & routes

- `/` — landing + current standings snapshot
- `/signup`, `/login` — auth
- `/picks` — make/view your picks (locks read-only after deadline)
- `/standings` — leaderboard + per-user pick sheets (post-lock) + per-week view
- `/admin` — gated by `ADMIN_EMAIL` env; force-refresh + manual result override
- `/api/cron/results` — Vercel Cron target; pulls + persists results
- `/api/admin/*` — force-refresh, override (admin-gated)

## Admin / ops

- Admin identified by `ADMIN_EMAIL` env var (matches `User.isAdmin` on signup, or
  checked at request time).
- **Vercel Cron** scheduled for game windows (Thu/Sun/Mon during the season).
- Env: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET`.

## Edge cases

- **Schedule changes before lock** (flex scheduling): re-run the seed; games matched
  by `espnId`. After lock, kickoff-time moves are irrelevant (winner unchanged).
- **Bye weeks**: each team plays 17 games over 18 weeks — handled naturally by the
  seeded schedule.
- **User signs up after lock**: can view standings but cannot pick (no picks → 0 pts).
- **Cron auth**: `/api/cron/results` requires the `CRON_SECRET` header to prevent
  public triggering.

## Testing

- `lib/scoring.ts` — unit tests: correct totals, ranking, ties, unfinished games.
- `lib/results-source.ts` — parser tests against captured ESPN fixture JSON.
- `lib/lock.ts` — open/locked boundary tests.
- Pick server action — rejects writes after lock.

## Build steps (high level)

1. Verify the live ESPN endpoint shape and capture a 2026 schedule + scoreboard fixture.
2. Scaffold Next.js + Tailwind + Prisma + Auth.js; `git init` for Vercel deploy.
3. Implement data layer, seed teams + 2026 schedule.
4. Implement `results-source`, `scoring`, `lock` (with tests).
5. Build pages: auth, picks, standings, admin.
6. Wire Vercel Cron + admin routes.
7. Deploy to Vercel; configure env + Postgres.

## Out of scope (v1)

Multiple/private leagues, confidence points, survivor format, against-the-spread,
playoffs, tiebreakers, email notifications, mobile app.

# Roadmap & Future Work — NFL 2026 Pick'em

Forward-looking plans for a season-long **NFL pick'em** web app: one dashboard,
weekly winner picks, and running standings for the 2026 NFL season.

---

## Full-season NFL pick'em

**Goal:** A season-long pick'em for the 2026 NFL season — one dashboard, picks
per week, running standings.

### Scale & cadence
The NFL regular season is **≈272 games across 18 weeks** (plus playoffs), versus a
fixed, single-shot pool. This needs a **per-week grouping/UI** and a notion of the
**"current week"** so players pick the upcoming week's games and standings update as
results come in.

### Core pieces
| Piece | Role |
|---|---|
| Picks source | Users pick winners (per user, per week) |
| Results | ESPN scoreboard API (`site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`) |
| Scoring | configurable: straight wins (1 pt/correct), optional confidence points |
| Dashboard + admin | weekly picks UI, standings, admin override + force-refresh |

### Scoring rules (to confirm)
- Straight wins (1 pt/correct)? Confidence/weighted points? Survivor format? Tiebreakers?

### Reusable architecture
- **Results provider isolated** behind one module (ESPN NFL endpoint), so the data
  source can change without touching scoring or UI.
- **Pure scoring engine** (points per correct pick, ranking, reconciliation).
- **Team table + colors** for the 32 NFL teams.
- **Dashboard + admin** (force-refresh, manual overrides), login-gated `/admin`.
- **Next.js on Vercel**, Git-connected auto-deploy.

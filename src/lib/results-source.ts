export type GameStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL';

export interface NormalizedGame {
  sourceId: string;
  week: number;
  kickoffAt: string; // ISO 8601
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  winnerAbbr: string | null;
}

function mapStatus(state: string, completed: boolean): GameStatus {
  if (state === 'post' && completed) return 'FINAL';
  if (state === 'in') return 'IN_PROGRESS';
  return 'SCHEDULED';
}

export function normalizeScoreboard(json: any): NormalizedGame[] {
  const events: any[] = json?.events ?? [];
  return events.map((event) => {
    const comp = event.competitions[0];
    const home = comp.competitors.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors.find((c: any) => c.homeAway === 'away');
    const status = mapStatus(event.status.type.state, event.status.type.completed);
    const isFinal = status === 'FINAL';
    const isLive = status !== 'SCHEDULED';

    const winner = comp.competitors.find((c: any) => c.winner === true);

    return {
      sourceId: String(event.id),
      week: Number(event.week.number),
      kickoffAt: event.date,
      homeAbbr: home.team.abbreviation,
      awayAbbr: away.team.abbreviation,
      homeScore: isLive ? Number(home.score) : null,
      awayScore: isLive ? Number(away.score) : null,
      status,
      winnerAbbr: isFinal && winner ? winner.team.abbreviation : null,
    };
  });
}

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/** Fetch one regular-season week from ESPN and normalize it. */
export async function fetchWeek(season: number, week: number): Promise<NormalizedGame[]> {
  const url = `${SCOREBOARD_URL}?dates=${season}&seasontype=2&week=${week}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  return normalizeScoreboard(await res.json());
}

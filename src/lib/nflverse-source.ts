import { canonicalAbbr } from './teams-data';
import type { NormalizedGame } from './results-source';

/**
 * nflverse games dataset (CSV). Free, no API key, full schedule + final results.
 * https://github.com/nflverse/nfldata
 */
const NFLVERSE_GAMES_URL =
  'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === '24' ? '0' : map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/**
 * Interpret a wall-clock date/time in America/New_York (nflverse times are ET)
 * and return the equivalent UTC ISO string. Handles EDT/EST automatically.
 */
function etToUtcIso(gameday: string, gametime: string): string {
  const [y, m, d] = gameday.split('-').map(Number);
  const [hh, mm] = gametime.split(':').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMs('America/New_York', new Date(naiveUtc));
  return new Date(naiveUtc - offset).toISOString();
}

/** Parse CSV text into rows keyed by header name. */
function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

/** Normalize the nflverse games CSV into our source-neutral game shape. */
export function normalizeNflverseGames(csv: string): NormalizedGame[] {
  return parseCsv(csv)
    .filter((r) => r.game_type === 'REG')
    .map((r) => {
      const hasScores = r.home_score !== '' && r.away_score !== '';
      const status = hasScores ? 'FINAL' : 'SCHEDULED';
      const homeAbbr = canonicalAbbr(r.home_team);
      const awayAbbr = canonicalAbbr(r.away_team);

      let winnerAbbr: string | null = null;
      if (status === 'FINAL') {
        const result = Number(r.result);
        if (result > 0) winnerAbbr = homeAbbr;
        else if (result < 0) winnerAbbr = awayAbbr;
        // result === 0 is a tie: no winner.
      }

      return {
        sourceId: r.game_id,
        week: Number(r.week),
        kickoffAt: etToUtcIso(r.gameday, r.gametime),
        homeAbbr,
        awayAbbr,
        homeScore: hasScores ? Number(r.home_score) : null,
        awayScore: hasScores ? Number(r.away_score) : null,
        status,
        winnerAbbr,
      };
    });
}

/** Fetch and normalize the full nflverse games dataset for a season. */
export async function fetchNflverseSeason(season: number): Promise<NormalizedGame[]> {
  const res = await fetch(NFLVERSE_GAMES_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`nflverse fetch failed: ${res.status}`);
  const csv = await res.text();
  return normalizeNflverseGames(csv).filter((g) => g.sourceId.startsWith(`${season}_`));
}

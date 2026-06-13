import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeNflverseGames, parseNflverseTeams } from './nflverse-source';

const csv = readFileSync(
  path.resolve(__dirname, '../../fixtures/nflverse-games-sample.csv'),
  'utf8',
);
const teamsCsv = readFileSync(
  path.resolve(__dirname, '../../fixtures/nflverse-teams-sample.csv'),
  'utf8',
);

describe('normalizeNflverseGames', () => {
  it('only includes regular-season games', () => {
    const games = normalizeNflverseGames(csv);
    // 4 REG rows; the POST playoff row is excluded.
    expect(games).toHaveLength(4);
    expect(games.some((g) => g.sourceId === '2026_19_KC_BUF')).toBe(false);
  });

  it('skips rows without a kickoff date/time (e.g. historical rows)', () => {
    const games = normalizeNflverseGames(csv);
    expect(games.some((g) => g.sourceId === '1999_01_OLD_GAME')).toBe(false);
  });

  it('normalizes a final away win, converting EDT kickoff to UTC', () => {
    const games = normalizeNflverseGames(csv);
    const g = games.find((x) => x.sourceId === '2026_01_NE_SEA')!;
    expect(g).toEqual({
      sourceId: '2026_01_NE_SEA',
      week: 1,
      kickoffAt: '2026-09-10T00:20:00.000Z',
      homeAbbr: 'SEA',
      awayAbbr: 'NE',
      homeScore: 20,
      awayScore: 23,
      status: 'FINAL',
      winnerAbbr: 'NE',
    });
  });

  it('normalizes a final home win, mapping LA->LAR and converting EST kickoff to UTC', () => {
    const games = normalizeNflverseGames(csv);
    const g = games.find((x) => x.sourceId === '2026_15_DAL_LA')!;
    expect(g.homeAbbr).toBe('LAR');
    expect(g.awayAbbr).toBe('DAL');
    expect(g.status).toBe('FINAL');
    expect(g.winnerAbbr).toBe('LAR');
    expect(g.kickoffAt).toBe('2026-12-13T18:00:00.000Z');
  });

  it('normalizes a scheduled game with null scores/winner, mapping WAS->WSH', () => {
    const games = normalizeNflverseGames(csv);
    const g = games.find((x) => x.sourceId === '2026_02_WAS_GB')!;
    expect(g.awayAbbr).toBe('WSH');
    expect(g.homeAbbr).toBe('GB');
    expect(g.status).toBe('SCHEDULED');
    expect(g.homeScore).toBeNull();
    expect(g.awayScore).toBeNull();
    expect(g.winnerAbbr).toBeNull();
  });

  it('treats a tie (result 0) as final with no winner', () => {
    const games = normalizeNflverseGames(csv);
    const g = games.find((x) => x.sourceId === '2026_03_NYG_PHI')!;
    expect(g.status).toBe('FINAL');
    expect(g.winnerAbbr).toBeNull();
    expect(g.homeScore).toBe(20);
    expect(g.awayScore).toBe(20);
  });
});

describe('parseNflverseTeams', () => {
  it('collapses duplicate Rams rows (LA + LAR) into one canonical LAR', () => {
    const teams = parseNflverseTeams(teamsCsv);
    const rams = teams.filter((t) => t.abbr === 'LAR');
    expect(rams).toHaveLength(1);
    expect(teams.some((t) => t.abbr === 'LA')).toBe(false);
    expect(rams[0]).toEqual({
      sourceId: '2510',
      abbr: 'LAR',
      name: 'Los Angeles Rams',
      color: '#003594',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    });
  });

  it('maps WAS to canonical WSH with name, color, and logo', () => {
    const teams = parseNflverseTeams(teamsCsv);
    const wsh = teams.find((t) => t.abbr === 'WSH')!;
    expect(wsh.name).toBe('Washington Commanders');
    expect(wsh.color).toBe('#5A1414');
    expect(wsh.logoUrl).toBe('https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png');
  });
});

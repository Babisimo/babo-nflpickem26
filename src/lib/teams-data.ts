// nflverse uses a few team abbreviations that differ from our canonical
// (ESPN-style) ones. Map them so the Team table key stays stable.
const NFLVERSE_TO_CANONICAL: Record<string, string> = {
  LA: 'LAR', // Rams
  WAS: 'WSH', // Washington
};

/** Convert an nflverse team abbreviation to our canonical abbreviation. */
export function canonicalAbbr(nflverseAbbr: string): string {
  return NFLVERSE_TO_CANONICAL[nflverseAbbr] ?? nflverseAbbr;
}

// Conference + division by team abbreviation (ESPN abbreviations).
// Used at seed time to enrich the ESPN teams feed.
export const TEAM_DIVISIONS: Record<string, { conference: string; division: string }> = {
  BUF: { conference: 'AFC', division: 'East' },
  MIA: { conference: 'AFC', division: 'East' },
  NE:  { conference: 'AFC', division: 'East' },
  NYJ: { conference: 'AFC', division: 'East' },
  BAL: { conference: 'AFC', division: 'North' },
  CIN: { conference: 'AFC', division: 'North' },
  CLE: { conference: 'AFC', division: 'North' },
  PIT: { conference: 'AFC', division: 'North' },
  HOU: { conference: 'AFC', division: 'South' },
  IND: { conference: 'AFC', division: 'South' },
  JAX: { conference: 'AFC', division: 'South' },
  TEN: { conference: 'AFC', division: 'South' },
  DEN: { conference: 'AFC', division: 'West' },
  KC:  { conference: 'AFC', division: 'West' },
  LV:  { conference: 'AFC', division: 'West' },
  LAC: { conference: 'AFC', division: 'West' },
  DAL: { conference: 'NFC', division: 'East' },
  NYG: { conference: 'NFC', division: 'East' },
  PHI: { conference: 'NFC', division: 'East' },
  WSH: { conference: 'NFC', division: 'East' },
  CHI: { conference: 'NFC', division: 'North' },
  DET: { conference: 'NFC', division: 'North' },
  GB:  { conference: 'NFC', division: 'North' },
  MIN: { conference: 'NFC', division: 'North' },
  ATL: { conference: 'NFC', division: 'South' },
  CAR: { conference: 'NFC', division: 'South' },
  NO:  { conference: 'NFC', division: 'South' },
  TB:  { conference: 'NFC', division: 'South' },
  ARI: { conference: 'NFC', division: 'West' },
  LAR: { conference: 'NFC', division: 'West' },
  SF:  { conference: 'NFC', division: 'West' },
  SEA: { conference: 'NFC', division: 'West' },
};

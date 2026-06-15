/** Hour (ET) at which each week's picks lock on the day of its first game. */
export const WEEK_LOCK_HOUR_ET = 9;

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
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
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
 * The instant a single week's picks lock: 9:00 AM ET on the calendar date
 * (in ET) of that week's earliest kickoff. Null if the week has no games.
 */
export function weekLockTime(weekKickoffs: Date[]): Date | null {
  if (weekKickoffs.length === 0) return null;
  const earliest = new Date(Math.min(...weekKickoffs.map((d) => d.getTime())));

  // Calendar date of the first kickoff, in ET (not UTC).
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(earliest);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);

  // 9:00 AM ET on that date, expressed as a UTC instant (handles EDT/EST).
  const naiveUtc = Date.UTC(get('year'), get('month') - 1, get('day'), WEEK_LOCK_HOUR_ET, 0, 0);
  const offset = tzOffsetMs('America/New_York', new Date(naiveUtc));
  return new Date(naiveUtc - offset);
}

/** True only when the week has games AND now is strictly before its lock. */
export function isWeekOpen(now: Date, weekKickoffs: Date[]): boolean {
  const lock = weekLockTime(weekKickoffs);
  if (!lock) return false;
  return now.getTime() < lock.getTime();
}

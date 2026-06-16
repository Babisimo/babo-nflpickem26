/** How many hours before a week's first kickoff its picks lock. */
export const WEEK_LOCK_OFFSET_HOURS = 4;

/**
 * The instant a single week's picks lock: 4 hours before that week's earliest
 * kickoff. Null if the week has no games.
 */
export function weekLockTime(weekKickoffs: Date[]): Date | null {
  if (weekKickoffs.length === 0) return null;
  const earliest = Math.min(...weekKickoffs.map((d) => d.getTime()));
  return new Date(earliest - WEEK_LOCK_OFFSET_HOURS * 60 * 60 * 1000);
}

/** True only when the week has games AND now is strictly before its lock. */
export function isWeekOpen(now: Date, weekKickoffs: Date[]): boolean {
  const lock = weekLockTime(weekKickoffs);
  if (!lock) return false;
  return now.getTime() < lock.getTime();
}

export const LOCK_OFFSET_MS = 48 * 60 * 60 * 1000; // 48 hours

/** The instant picks lock: 48h before the earliest kickoff. Null if no games. */
export function seasonLockTime(kickoffs: Date[]): Date | null {
  if (kickoffs.length === 0) return null;
  const earliest = Math.min(...kickoffs.map((d) => d.getTime()));
  return new Date(earliest - LOCK_OFFSET_MS);
}

/** True only when there are games AND now is strictly before the lock. */
export function arePicksOpen(now: Date, kickoffs: Date[]): boolean {
  const lock = seasonLockTime(kickoffs);
  if (!lock) return false;
  return now.getTime() < lock.getTime();
}

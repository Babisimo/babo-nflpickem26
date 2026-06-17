export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** How many times a player may change their username after signup. */
export const MAX_USERNAME_CHANGES = 2;

/** Username changes still available given how many have been used. */
export function usernameChangesRemaining(count: number): number {
  return Math.max(0, MAX_USERNAME_CHANGES - count);
}

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

/** Validate a public username: 3–20 letters/numbers/underscores. Trims; does NOT
 *  check DB uniqueness (the server action does that). */
export function validateUsername(raw: string): ValidationResult {
  const value = raw.trim();
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: 'Username must be 3–20 letters, numbers, or underscores.' };
  }
  return { ok: true, value };
}

/** Validate a first/last name: 1–50 chars after trimming. `label` is used in the error. */
export function validateName(raw: string, label: string): ValidationResult {
  const value = raw.trim();
  if (value.length < 1 || value.length > 50) {
    return { ok: false, error: `${label} must be 1–50 characters.` };
  }
  return { ok: true, value };
}

/** A profile is complete once username, first name, and last name are all set. */
export function isProfileComplete(u: {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}): boolean {
  return !!(u.username && u.firstName && u.lastName);
}

/** The display full name: "First Last" when both are present, else the legacy `name`. */
export function fullName(u: {
  firstName: string | null;
  lastName: string | null;
  name: string;
}): string {
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
  return u.name;
}

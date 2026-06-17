# Change Username (Limited + Filtered) — Design

_Date: 2026-06-17_

Let players change their username from the account page, capped at **2 changes after
signup**, with a profanity/slur filter and a reserved-handle block applied to **every**
username entry point (signup, complete-profile, change-username).

Builds on the usernames feature shipped earlier today (`User.username` etc.).

---

## A. Limit model

- New column `User.usernameChangeCount Int @default(0)`.
- The username set at **signup / complete-profile does NOT count**. Each successful, actual
  change increments the counter; players get **2** changes (up to 3 distinct usernames total).
- A **no-op** (new username case-insensitively equal to the current one) never consumes a
  change — it returns a friendly message instead.
- Enforced server-side in the `changeUsername` action: blocked once `usernameChangeCount >= 2`.

`db.push` adds the column; existing rows get the default `0` (no data-loss prompt).

## B. Word filter — `src/lib/username-filter.ts` (new)

Adds the **`obscenity`** dependency (maintained, TypeScript, MIT; obfuscation-aware — catches
leetspeak/spacing like `sh1t`, `f u c k`).

```ts
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const RESERVED = [
  'admin', 'administrator', 'official', 'moderator', 'mod',
  'staff', 'support', 'owner', 'root', 'system',
];
const RESERVED_RE = new RegExp(`^(${RESERVED.join('|')})\\d*$`);

export function checkUsernameAllowed(value: string): { ok: true } | { ok: false; error: string } {
  const normalized = value.toLowerCase().replace(/_/g, '');
  if (RESERVED_RE.test(normalized)) {
    return { ok: false, error: 'That username is reserved — please choose another.' };
  }
  if (matcher.hasMatch(value)) {
    return { ok: false, error: 'That username contains language that isn’t allowed.' };
  }
  return { ok: true };
}
```

- **Reserved**: normalize (lowercase, strip `_`), reject `^(reserved)\d*$` — blocks `admin`,
  `Admin_07`, `official`; allows false-positive-prone words like `modern`, `badminton`.
- **Profanity/slurs**: `matcher.hasMatch(value)` against the English dataset.
- Called at all three entry points **after** the existing `validateUsername` format check, so
  the order is always: format → allowed-words → (DB) uniqueness.

## C. Limit helpers — `src/lib/profile.ts` (pure, tested)

```ts
export const MAX_USERNAME_CHANGES = 2;
export function usernameChangesRemaining(count: number): number {
  return Math.max(0, MAX_USERNAME_CHANGES - count);
}
```

## D. `changeUsername` action — `src/app/actions/auth.ts`

```ts
export type ChangeUsernameState = { error?: string; ok?: boolean } | undefined;
```

Flow (auth-gated; returns `{error:'Not signed in.'}` when logged out):
1. `validateUsername(input)` (format) → on fail return its error.
2. `checkUsernameAllowed(value)` → on fail return its error.
3. Load `{ username, usernameChangeCount }` for the current user; missing row → `{error:'Account not found.'}`.
4. **No-op**: `username?.toLowerCase() === value.toLowerCase()` → `{error:'That’s already your username.'}` (no increment).
5. **Limit**: `usernameChangeCount >= MAX_USERNAME_CHANGES` → `{error:'You’ve used all your username changes.'}`.
6. **Uniqueness**: `findFirst({ where: { username: { equals: value, mode: 'insensitive' }, NOT: { id: userId } } })` → taken → `{error:'That username is taken.'}`.
7. `update({ data: { username: value, usernameChangeCount: { increment: 1 } } })` → `{ ok: true }`.

`name` (full name) is untouched. Signup and `completeProfile` add a `checkUsernameAllowed` call
after their existing `validateUsername` (same order), so no profane/reserved username can be
created anywhere.

## E. UI — `/account`

- `src/app/account/page.tsx` already loads the user for its completeness guard; it additionally
  selects `username` + `usernameChangeCount` and passes them to `AccountForm`.
- `src/app/account/AccountForm.tsx` gains a **"Change username"** card **above** the existing
  change-password card:
  - Shows the current `@handle` and **"N of 2 changes left"** (`usernameChangesRemaining`).
  - If `remaining > 0`: a `useActionState(changeUsername)` form (single username input + submit),
    error/success banners, and `router.refresh()` on success so the count/handle update.
  - If `remaining === 0`: the form is **replaced** by a "No username changes left" note.
- The change-password form in the same component is unchanged.

## F. Testing

- `src/lib/username-filter.test.ts`: a clean username passes; a profane word fails; an
  obfuscated profanity (e.g. `sh1t`) fails; `admin` and `admin123` fail; `modern` and
  `badminton` pass.
- `src/lib/profile.test.ts`: `usernameChangesRemaining` (count 0→2, 1→1, 2→0, 3→0).
- `changeUsername` is DB-bound glue — untested per repo convention; it leans on the tested
  helpers (`validateUsername`, `checkUsernameAllowed`, `usernameChangesRemaining`).

## G. Files

- **New:** `src/lib/username-filter.ts` (+ test).
- **Modified:** `prisma/schema.prisma`; `src/lib/profile.ts` (+ its test); `src/app/actions/auth.ts`
  (changeUsername + filter calls in signup/completeProfile); `src/app/account/page.tsx` (pass
  props); `src/app/account/AccountForm.tsx` (username card); `package.json`/lockfile (`obscenity`).

## H. Out of scope
- No username change history/audit log. No admin override to grant more changes (could be added
  later). No rate-limiting beyond the 2-change cap.

## I. Rollout
- `npm install obscenity`; `npm run db:push` for the new column.
- `npm test` + `npm run typecheck` + `npm run build` green before commit.
- Deploy = `git push origin master`. Update `handoff.md` (schema, profile/filter libs, account
  page behavior, §7 identity, §8).

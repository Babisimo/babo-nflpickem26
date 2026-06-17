# Usernames + Shared Picks After Lock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public usernames + private first/last names (with a complete-profile prompt for existing users), and show every player's picks on the picks board once a week locks.

**Architecture:** Add three nullable `User` columns (`username`/`firstName`/`lastName`) while keeping `name` as the denormalized full name. Pure helpers in `profile.ts` (validation/identity) and `league-picks.ts` (weekly correctness) stay unit-tested. Signup collects all fields; legacy users are redirected to `/complete-profile` by completeness guards on the authenticated pages. The picks page sends other players' picks only for locked weeks, rendered by a new `LeaguePicksGrid`.

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma 6 + Postgres (Neon), next-auth v5, Tailwind v3, Vitest, zod.

## Global Constraints

- Username rules: **3–20 chars, `[A-Za-z0-9_]` only, unique case-insensitively.** Regex `/^[A-Za-z0-9_]{3,20}$/`.
- First/last name: **1–50 chars** (trimmed).
- `User.name` is kept and set to `"First Last"` on signup/complete-profile (denormalized full name; powers the header/session).
- Public views show `@username` primary + `First Last` secondary; the grid includes **all** users who picked that week (admins included). Other players' picks are sent to the client **only for locked weeks**.
- Repo convention: pure logic is unit-tested; DB/network glue (actions, page queries, components) is not.
- Reference spec: `docs/superpowers/specs/2026-06-17-usernames-and-shared-picks-design.md`.

---

### Task 1: Add username / firstName / lastName to the schema

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.username String?` (`@unique`), `User.firstName String?`, `User.lastName String?`; the `db.user` Prisma delegate now accepts/returns these.

- [ ] **Step 1: Add the three columns**

In `prisma/schema.prisma`, in `model User`, insert three fields right after the `name String` line so it reads:

```prisma
  name         String
  username     String?  @unique
  firstName    String?
  lastName     String?
```

- [ ] **Step 2: Push the schema + regenerate the client**

Run: `npm run db:push`
Expected: "Your database is now in sync with your Prisma schema" and the client regenerates.

> Windows note: if `prisma generate` fails with `EPERM ... query_engine-windows.dll`, stop any running `next dev`/`next start` (it locks the DLL), then re-run.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add username/firstName/lastName to User"
```

---

### Task 2: Pure profile helpers

**Files:**
- Create: `src/lib/profile.ts`
- Test: `src/lib/profile.test.ts`

**Interfaces:**
- Produces:
  - `type ValidationResult = { ok: true; value: string } | { ok: false; error: string }`
  - `validateUsername(raw: string): ValidationResult`
  - `validateName(raw: string, label: string): ValidationResult`
  - `isProfileComplete(u: { username: string | null; firstName: string | null; lastName: string | null }): boolean`
  - `fullName(u: { firstName: string | null; lastName: string | null; name: string }): string`
  - `USERNAME_RE: RegExp`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateUsername, validateName, isProfileComplete, fullName } from './profile';

describe('validateUsername', () => {
  it('accepts 3–20 chars of letters/numbers/underscore and trims', () => {
    expect(validateUsername('  big_blue1 ')).toEqual({ ok: true, value: 'big_blue1' });
  });
  it('rejects too short', () => {
    expect(validateUsername('ab').ok).toBe(false);
  });
  it('rejects too long (21)', () => {
    expect(validateUsername('a'.repeat(21)).ok).toBe(false);
  });
  it('rejects spaces and punctuation', () => {
    expect(validateUsername('bad name').ok).toBe(false);
    expect(validateUsername('no-dash').ok).toBe(false);
  });
});

describe('validateName', () => {
  it('accepts 1–50 chars and trims', () => {
    expect(validateName('  Bob ', 'First name')).toEqual({ ok: true, value: 'Bob' });
  });
  it('rejects empty', () => {
    expect(validateName('   ', 'First name').ok).toBe(false);
  });
  it('rejects over 50 chars', () => {
    expect(validateName('x'.repeat(51), 'Last name').ok).toBe(false);
  });
});

describe('isProfileComplete', () => {
  it('is true only when username + first + last are all present', () => {
    expect(isProfileComplete({ username: 'u', firstName: 'A', lastName: 'B' })).toBe(true);
    expect(isProfileComplete({ username: null, firstName: 'A', lastName: 'B' })).toBe(false);
    expect(isProfileComplete({ username: 'u', firstName: '', lastName: 'B' })).toBe(false);
  });
});

describe('fullName', () => {
  it('joins first + last when present', () => {
    expect(fullName({ firstName: 'Ada', lastName: 'Lovelace', name: 'legacy' })).toBe('Ada Lovelace');
  });
  it('falls back to name when parts are missing', () => {
    expect(fullName({ firstName: null, lastName: null, name: 'Legacy Name' })).toBe('Legacy Name');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/profile.test.ts`
Expected: FAIL — `./profile` does not exist.

- [ ] **Step 3: Implement `src/lib/profile.ts`**

```ts
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/profile.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile.ts src/lib/profile.test.ts
git commit -m "feat: profile validation + identity helpers"
```

---

### Task 3: Signup collects username + first/last

**Files:**
- Modify: `src/app/actions/auth.ts`
- Modify: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `validateUsername`, `validateName` from `@/lib/profile`.
- Produces: `signup` now requires `username`, `firstName`, `lastName` form fields in addition to `email`/`password`.

- [ ] **Step 1: Update the `signup` action**

In `src/app/actions/auth.ts`, add to the imports:

```ts
import { validateUsername, validateName } from '@/lib/profile';
```

Replace the `SignupSchema` definition and the entire `signup` function with:

```ts
const SignupSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupState = { error?: string } | undefined;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { error: uname.error };
  const first = validateName(String(formData.get('firstName') ?? ''), 'First name');
  if (!first.ok) return { error: first.error };
  const last = validateName(String(formData.get('lastName') ?? ''), 'Last name');
  if (!last.ok) return { error: last.error };

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'An account with that email already exists.' };
  }
  if (await db.user.findFirst({ where: { username: { equals: uname.value, mode: 'insensitive' } } })) {
    return { error: 'That username is taken.' };
  }

  if (!process.env.ADMIN_EMAIL) {
    console.warn('[signup] ADMIN_EMAIL env var is not set — no user will be granted admin access on signup.');
  }
  await db.user.create({
    data: {
      name: `${first.value} ${last.value}`,
      username: uname.value,
      firstName: first.value,
      lastName: last.value,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      isAdmin: email === process.env.ADMIN_EMAIL?.toLowerCase(),
    },
  });
  return undefined; // success; UI redirects to /login
}
```

- [ ] **Step 2: Update the signup form**

In `src/app/signup/page.tsx`, replace the single name input line:

```tsx
          <input name="name" placeholder="Name" className="field-input" required />
```

with username + first/last inputs:

```tsx
          <input name="username" placeholder="Username" className="field-input" required />
          <div className="flex gap-3">
            <input name="firstName" placeholder="First name" className="field-input" required />
            <input name="lastName" placeholder="Last name" className="field-input" required />
          </div>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (confirms the Prisma client accepts the new fields + `mode: 'insensitive'`).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/auth.ts src/app/signup/page.tsx
git commit -m "feat: signup collects username + first/last name"
```

---

### Task 4: complete-profile flow + completeness guards

**Files:**
- Modify: `src/app/actions/auth.ts`
- Create: `src/app/complete-profile/page.tsx`
- Create: `src/app/complete-profile/CompleteProfileForm.tsx`
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/account/AccountForm.tsx`
- Modify: `src/app/account/page.tsx`

**Interfaces:**
- Consumes: `validateUsername`, `validateName`, `isProfileComplete` from `@/lib/profile`.
- Produces: `completeProfile(_prev, formData)` action returning `{ ok?: boolean; error?: string } | undefined`; `/complete-profile` route; completeness guards (redirect to `/complete-profile`) on `/admin` and `/account`. (The `/picks` guard is added in Task 7, which already edits that page.)

- [ ] **Step 1: Add the `completeProfile` action**

In `src/app/actions/auth.ts`, extend the profile import to include `isProfileComplete` is **not** needed here (only validators):

```ts
import { validateUsername, validateName } from '@/lib/profile';
```

(If Task 3 already added this exact line, leave it.) Append the action:

```ts
export type CompleteProfileState = { error?: string; ok?: boolean } | undefined;

export async function completeProfile(
  _prev: CompleteProfileState,
  formData: FormData,
): Promise<CompleteProfileState> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { error: 'Not signed in.' };

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { error: uname.error };
  const first = validateName(String(formData.get('firstName') ?? ''), 'First name');
  if (!first.ok) return { error: first.error };
  const last = validateName(String(formData.get('lastName') ?? ''), 'Last name');
  if (!last.ok) return { error: last.error };

  const taken = await db.user.findFirst({
    where: { username: { equals: uname.value, mode: 'insensitive' }, NOT: { id: userId } },
  });
  if (taken) return { error: 'That username is taken.' };

  await db.user.update({
    where: { id: userId },
    data: {
      username: uname.value,
      firstName: first.value,
      lastName: last.value,
      name: `${first.value} ${last.value}`,
    },
  });
  return { ok: true };
}
```

- [ ] **Step 2: Create the complete-profile client form**

Create `src/app/complete-profile/CompleteProfileForm.tsx`:

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { completeProfile, type CompleteProfileState } from '@/app/actions/auth';

export function CompleteProfileForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CompleteProfileState, FormData>(
    completeProfile,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push('/picks');
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">One more step</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Complete your profile
        </h1>
        <p className="mt-4 text-sm text-muted">
          Pick a username and tell us your name so others can see who&rsquo;s who.
        </p>

        {state?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-3">
          <input name="username" placeholder="Username" className="field-input" required />
          <div className="flex gap-3">
            <input name="firstName" placeholder="First name" className="field-input" required />
            <input name="lastName" placeholder="Last name" className="field-input" required />
          </div>
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the complete-profile server page (guarded)**

Create `src/app/complete-profile/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isProfileComplete } from '@/lib/profile';
import { CompleteProfileForm } from './CompleteProfileForm';

export default async function CompleteProfilePage() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, firstName: true, lastName: true },
  });
  if (user && isProfileComplete(user)) redirect('/picks');

  return <CompleteProfileForm />;
}
```

- [ ] **Step 4: Guard `/admin`**

In `src/app/admin/page.tsx`, add the import:

```ts
import { isProfileComplete } from '@/lib/profile';
```

Immediately after the existing `if (!session?.user?.isAdmin) redirect('/');` line, add:

```ts
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, firstName: true, lastName: true },
  });
  if (me && !isProfileComplete(me)) redirect('/complete-profile');
```

(`db` and `redirect` are already imported in that file.)

- [ ] **Step 5: Split `/account` into a guarded server page + client form**

Create `src/app/account/AccountForm.tsx` with the **current** contents of `src/app/account/page.tsx`, but change the default export into a named export. The file is:

```tsx
'use client';

import { useActionState } from 'react';
import { changePassword, type ChangePasswordState } from '@/app/actions/auth';

export function AccountForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined,
  );

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Change password
        </h1>

        {state?.ok && (
          <p className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-accent">
            Password updated
          </p>
        )}
        {state?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-3">
          <input
            name="currentPassword"
            type="password"
            placeholder="Current password"
            className="field-input"
            required
          />
          <input
            name="newPassword"
            type="password"
            placeholder="New password (min 8 chars)"
            className="field-input"
            required
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            className="field-input"
            required
          />
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

Then replace the entire contents of `src/app/account/page.tsx` with a guarded server page:

```tsx
import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isProfileComplete } from '@/lib/profile';
import { AccountForm } from './AccountForm';

export default async function AccountPage() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, firstName: true, lastName: true },
  });
  if (me && !isProfileComplete(me)) redirect('/complete-profile');

  return <AccountForm />;
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/auth.ts src/app/complete-profile/ src/app/admin/page.tsx src/app/account/
git commit -m "feat: complete-profile flow + completeness guards"
```

---

### Task 5: Weekly correctness helper

**Files:**
- Create: `src/lib/league-picks.ts`
- Test: `src/lib/league-picks.test.ts`

**Interfaces:**
- Produces: `weeklyCorrectByUser(picks: { userId: string; gameId: string; pickedTeamId: string }[], winnerByGame: Map<string, string | null>): Map<string, number>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/league-picks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { weeklyCorrectByUser } from './league-picks';

const winners = new Map<string, string | null>([
  ['g1', 'A'],
  ['g2', 'B'],
  ['g3', null], // not final yet
]);

const picks = [
  { userId: 'u1', gameId: 'g1', pickedTeamId: 'A' }, // correct
  { userId: 'u1', gameId: 'g2', pickedTeamId: 'A' }, // wrong
  { userId: 'u1', gameId: 'g3', pickedTeamId: 'A' }, // no winner -> ignored
  { userId: 'u2', gameId: 'g1', pickedTeamId: 'A' }, // correct
  { userId: 'u2', gameId: 'g2', pickedTeamId: 'B' }, // correct
];

describe('weeklyCorrectByUser', () => {
  it('counts correct picks per user', () => {
    const c = weeklyCorrectByUser(picks, winners);
    expect(c.get('u1')).toBe(1);
    expect(c.get('u2')).toBe(2);
  });

  it('ignores games with no winner yet', () => {
    const c = weeklyCorrectByUser(
      [{ userId: 'u9', gameId: 'g3', pickedTeamId: 'A' }],
      winners,
    );
    expect(c.get('u9')).toBeUndefined();
  });

  it('omits users with zero correct picks', () => {
    const c = weeklyCorrectByUser(
      [{ userId: 'u5', gameId: 'g1', pickedTeamId: 'B' }],
      winners,
    );
    expect(c.get('u5')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/league-picks.test.ts`
Expected: FAIL — `./league-picks` does not exist.

- [ ] **Step 3: Implement `src/lib/league-picks.ts`**

```ts
/** Count, per user, picks whose team won (games with no winner yet are ignored).
 *  Users with zero correct picks are simply absent from the returned map. */
export function weeklyCorrectByUser(
  picks: { userId: string; gameId: string; pickedTeamId: string }[],
  winnerByGame: Map<string, string | null>,
): Map<string, number> {
  const correct = new Map<string, number>();
  for (const p of picks) {
    const winner = winnerByGame.get(p.gameId);
    if (winner && p.pickedTeamId === winner) {
      correct.set(p.userId, (correct.get(p.userId) ?? 0) + 1);
    }
  }
  return correct;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/league-picks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/league-picks.ts src/lib/league-picks.test.ts
git commit -m "feat: weeklyCorrectByUser helper for the shared-picks grid"
```

---

### Task 6: LeaguePicksGrid component

**Files:**
- Create: `src/app/picks/LeaguePicksGrid.tsx`

**Interfaces:**
- Consumes: `weeklyCorrectByUser` from `@/lib/league-picks`.
- Produces: `LeaguePicksGrid({ games, players, picks })` where
  - `games: { id: string; home: { id: string; abbr: string }; away: { id: string; abbr: string }; winnerTeamId: string | null; status: string }[]`
  - `players: { id: string; handle: string; fullName: string }[]`
  - `picks: { userId: string; gameId: string; pickedTeamId: string }[]`

- [ ] **Step 1: Create the component**

Create `src/app/picks/LeaguePicksGrid.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { weeklyCorrectByUser } from '@/lib/league-picks';

type GridTeam = { id: string; abbr: string };
type GridGame = { id: string; home: GridTeam; away: GridTeam; winnerTeamId: string | null; status: string };
type GridPlayer = { id: string; handle: string; fullName: string };
type GridPick = { userId: string; gameId: string; pickedTeamId: string };

export function LeaguePicksGrid({
  games,
  players,
  picks,
}: {
  games: GridGame[];
  players: GridPlayer[];
  picks: GridPick[];
}) {
  const pickMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of picks) m.set(`${p.userId}:${p.gameId}`, p.pickedTeamId);
    return m;
  }, [picks]);

  const winnerByGame = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const g of games) m.set(g.id, g.winnerTeamId);
    return m;
  }, [games]);

  const correct = useMemo(() => weeklyCorrectByUser(picks, winnerByGame), [picks, winnerByGame]);

  if (players.length === 0) {
    return <p className="card px-4 py-6 text-center text-sm text-faint">No picks were made this week.</p>;
  }

  return (
    <div className="card no-scrollbar overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-ink-800 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              Game
            </th>
            {players.map((p) => (
              <th
                key={p.id}
                title={p.fullName}
                className="whitespace-nowrap px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-chalk"
              >
                {p.handle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} className="border-t border-line">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-ink-800 px-3 py-2 font-display uppercase tracking-wide text-chalk">
                {g.away.abbr} @ {g.home.abbr}
              </td>
              {players.map((p) => {
                const picked = pickMap.get(`${p.id}:${g.id}`);
                const team = picked === g.home.id ? g.home : picked === g.away.id ? g.away : null;
                const final = g.status === 'FINAL' && g.winnerTeamId != null;
                const isCorrect = final && picked != null && picked === g.winnerTeamId;
                const isWrong = final && picked != null && picked !== g.winnerTeamId;
                return (
                  <td
                    key={p.id}
                    className={`px-3 py-2 text-center font-mono text-[12px] font-semibold ${
                      isCorrect
                        ? 'bg-accent/15 text-accent'
                        : isWrong
                          ? 'bg-red-500/10 text-red-300'
                          : 'text-muted'
                    }`}
                  >
                    {team ? team.abbr : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-line bg-ink-900/40">
            <td className="sticky left-0 z-10 bg-ink-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              Correct
            </td>
            {players.map((p) => (
              <td key={p.id} className="stat-num px-3 py-2 text-center text-lg text-chalk">
                {correct.get(p.id) ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (component is standalone; not yet rendered).

- [ ] **Step 3: Commit**

```bash
git add src/app/picks/LeaguePicksGrid.tsx
git commit -m "feat: LeaguePicksGrid (everyone's picks for a locked week)"
```

---

### Task 7: Wire the grid into the picks page (locked weeks) + guard

**Files:**
- Modify: `src/app/picks/page.tsx`
- Modify: `src/app/picks/PicksClient.tsx`

**Interfaces:**
- Consumes: `LeaguePicksGrid` (Task 6); `isProfileComplete`, `fullName` from `@/lib/profile`.
- Produces: each week object gains `league: { players: { id; handle; fullName }[]; picks: { userId; gameId; pickedTeamId }[] } | null`; each game gains `winnerTeamId: string | null` and `status: string`.

- [ ] **Step 1: `src/app/picks/page.tsx` — guard + league payload**

Add the import near the top:

```ts
import { isProfileComplete, fullName } from '@/lib/profile';
```

(The weekly-correct tally is computed inside `LeaguePicksGrid` on the client, so the page doesn't import `weeklyCorrectByUser`.)

After the existing `if (!userId) redirect('/login');`, add the completeness guard:

```ts
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, firstName: true, lastName: true },
  });
  if (me && !isProfileComplete(me)) redirect('/complete-profile');
```

After the existing `const picks = await db.pick.findMany({ where: { userId } });` and `const predictions = ...` lines, load everyone's picks + identities:

```ts
  const allUsers = await db.user.findMany({
    select: { id: true, name: true, username: true, firstName: true, lastName: true },
  });
  const allPicks = await db.pick.findMany({ select: { userId: true, gameId: true, pickedTeamId: true } });
  const userById = new Map(allUsers.map((u) => [u.id, u]));
```

In the per-week `Object.entries(gamesByWeek).map(([week, gs]) => { ... })` callback, the games are mapped to client objects. **Add `winnerTeamId` and `status`** to each game object — the games mapping inside the callback becomes:

```ts
      games: gs.map((g) => ({
        id: g.id,
        home: { id: g.homeTeamId, abbr: g.homeTeam.abbr, name: g.homeTeam.name, color: g.homeTeam.color, logoUrl: g.homeTeam.logoUrl },
        away: { id: g.awayTeamId, abbr: g.awayTeam.abbr, name: g.awayTeam.name, color: g.awayTeam.color, logoUrl: g.awayTeam.logoUrl },
        kickoffAt: g.kickoffAt.toISOString(),
        winnerTeamId: g.winnerTeamId,
        status: g.status,
      })),
```

Still inside the callback, compute `open` once into a const and build the `league` payload for locked weeks. Replace the `open: isWeekOpen(now, kickoffs),` line and add `league`. Concretely, the returned object should now include these (alongside the existing `week`, `lockAt`, `tiebreaker`, `games`):

```ts
    const open = isWeekOpen(now, kickoffs);
    const weekGameIds = new Set(gs.map((g) => g.id));
    const weekPicks = open ? [] : allPicks.filter((p) => weekGameIds.has(p.gameId));
    const playerIds = open ? [] : [...new Set(weekPicks.map((p) => p.userId))];
    const league = open
      ? null
      : {
          players: playerIds
            .map((id) => userById.get(id)!)
            .filter(Boolean)
            .map((u) => ({
              id: u.id,
              handle: u.username ? `@${u.username}` : fullName(u),
              fullName: fullName(u),
            }))
            .sort((a, b) => a.handle.toLowerCase().localeCompare(b.handle.toLowerCase())),
          picks: weekPicks,
        };
```

and the returned object uses `open,` and adds `league,`. (Keep `tiebreaker` and everything else exactly as-is.)

- [ ] **Step 2: `src/app/picks/PicksClient.tsx` — types + render**

Add the import:

```ts
import { LeaguePicksGrid } from './LeaguePicksGrid';
```

Extend the `Game` type to carry the result fields (add the two fields):

```ts
type Game = {
  id: string;
  home: Team;
  away: Team;
  kickoffAt: string;
  winnerTeamId: string | null;
  status: string;
};
```

Add a `League` type and extend `Week` with `league`:

```ts
type LeaguePlayer = { id: string; handle: string; fullName: string };
type League = { players: LeaguePlayer[]; picks: { userId: string; gameId: string; pickedTeamId: string }[] };
type Week = {
  week: number;
  open: boolean;
  lockAt: string | null;
  games: Game[];
  tiebreaker: Tiebreaker | null;
  league: League | null;
};
```

Find the games list `<ul className="grid gap-3 sm:grid-cols-2">…</ul>` that renders `weekGames.map(...)`. Wrap it so the buttons show only for open weeks and the grid shows for locked weeks. Replace the opening `<ul ...>` … and its closing `</ul>` so the whole block is:

```tsx
      {weekOpen ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {weekGames.map((g, i) => (
            /* ...existing <li> game-button markup unchanged... */
          ))}
        </ul>
      ) : current?.league ? (
        <LeaguePicksGrid games={weekGames} players={current.league.players} picks={current.league.picks} />
      ) : null}
```

Keep the existing `<li>` markup exactly as-is inside the `weekGames.map(...)`. (The `Team` cards' team `id`/`abbr` already satisfy `LeaguePicksGrid`'s `GridTeam`, and `Game` now has `winnerTeamId`/`status`.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Build (validates the whole picks route)**

Run: `npm run build`
Expected: success; `/picks` and `/complete-profile` appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/app/picks/page.tsx src/app/picks/PicksClient.tsx
git commit -m "feat: show everyone's picks on the board once a week locks"
```

---

### Task 8: Leaderboard shows username + full name

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `fullName` from `@/lib/profile`.

- [ ] **Step 1: Load name parts + adjust the display**

In `src/app/page.tsx`, add the import:

```ts
import { fullName } from '@/lib/profile';
```

Change the users query (the `db.user.findMany` inside the `Promise.all`) to select the name parts:

```ts
    db.user.findMany({
      where: { isAdmin: false },
      select: { id: true, name: true, username: true, firstName: true, lastName: true },
    }),
```

The standings are computed from `(id, name)`. Feed the **username** (falling back to `name`) as the sort/display key, and keep a lookup for the secondary line. Replace the `const standings = computeStandings(users, picks, results, errors);` line with:

```ts
  const usersForScoring = users.map((u) => ({ id: u.id, name: u.username ?? u.name }));
  const userById = new Map(users.map((u) => [u.id, u]));
  const standings = computeStandings(usersForScoring, picks, results, errors);
```

Update the leaderboard row JSX. Find the block that renders the player's name + hit-rate line:

```tsx
                    <p className="truncate font-sans text-base font-semibold text-chalk sm:text-lg">
                      {row.name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                          You
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                      {finals > 0 ? `${Math.round((row.correct / finals) * 100)}% hit rate` : 'No results yet'}
                    </p>
```

Replace it with username-primary + full-name secondary (the secondary line keeps the hit rate):

```tsx
                    <p className="truncate font-sans text-base font-semibold text-chalk sm:text-lg">
                      {userById.get(row.userId)?.username ? `@${userById.get(row.userId)!.username}` : row.name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                      {fullName(userById.get(row.userId)!)}
                      {finals > 0 ? ` · ${Math.round((row.correct / finals) * 100)}% hit rate` : ''}
                    </p>
```

Update the avatar initials to use the full name. Find:

```tsx
                    {initials(row.name)}
```

Replace with:

```tsx
                    {initials(fullName(userById.get(row.userId)!))}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: leaderboard shows @username with full name"
```

---

### Task 9: Full verification + docs

**Files:**
- Modify: `handoff.md`

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS — all prior tests plus the new `profile` and `league-picks` tests (was 49; now ~62).

- [ ] **Step 2: Typecheck + production build**

Run: `npm run typecheck` then `npm run build`
Expected: both succeed; routes include `/complete-profile`.

- [ ] **Step 3: Update `handoff.md`**

Make these edits:
- §3 Data layer — `schema.prisma` models line: note `User` now has `username`/`firstName`/`lastName`.
- §3 Logic — add `src/lib/profile.ts` (username/name validation, `isProfileComplete`, `fullName`) and `src/lib/league-picks.ts` (`weeklyCorrectByUser`).
- §3 Pages/routes — `signup` now collects username + first/last; add `/complete-profile`; note the picks board shows **everyone's picks once a week locks** (`LeaguePicksGrid`); `/account` and `/admin` (and `/picks`) redirect users with an incomplete profile to `/complete-profile`.
- §3 actions — `auth.ts` now also has `completeProfile`.
- §7 Key behaviors — add a **Usernames** bullet (public `@username` + private first/last; existing users complete their profile on next login) and a **Shared picks** bullet (locked weeks reveal everyone's picks on the board; open-week picks are never sent early).
- §8 — note that changing your username later is only possible while the profile is incomplete (no general rename UI yet).

- [ ] **Step 4: Commit**

```bash
git add handoff.md
git commit -m "docs: update handoff for usernames + shared picks"
```

- [ ] **Step 5: Deploy (only when the user asks)**

Per project guidance, push only on the user's go-ahead:

```bash
git push origin master   # auto-deploys nfl-pickem26
```

Verify by content: signup shows username/first/last fields; logging in as a legacy user lands on `/complete-profile`; a locked week shows the picks grid; the leaderboard shows `@username`.

---

## Self-review notes

- **Spec coverage:** schema → T1; `profile.ts` → T2; signup → T3; complete-profile + guards → T4 (and the `/picks` guard in T7); `league-picks.ts` → T5; grid component → T6; picks-page payload + wiring → T7; leaderboard display → T8; docs/rollout → T9. All spec sections covered.
- **Type consistency:** `LeaguePicksGrid` props (`games`/`players`/`picks`) in T6 match what T7 passes (`weekGames`, `current.league.players`, `current.league.picks`); `Game` gains `winnerTeamId`/`status` in both the page payload (T7 step 1) and the `Game` type (T7 step 2); `league` shape (`{ players: {id,handle,fullName}[]; picks }`) is identical in page (T7) and `Week` type (T7). `fullName`/`isProfileComplete`/`validateUsername`/`validateName` signatures are used consistently across T2/T3/T4/T7/T8. `computeStandings` still takes `{id,name}[]` — T8 passes `usersForScoring` of that shape.
- **No placeholders:** every code step shows the exact code. No unused imports (the grid owns `weeklyCorrectByUser`).

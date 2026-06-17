# Self-Service Password Reset by Email — Design

_Date: 2026-06-17_

Add a "Forgot password?" flow so a player who is locked out can reset their own
password by email, without an admin. Email is sent via the admin's Gmail account
(Nodemailer + Gmail SMTP), since the app has no custom domain to verify with a
hosted email provider.

This complements the existing **admin** reset (admin issues a one-time temp
password) shipped on 2026-06-16; that stays as-is.

---

## Flow

1. **Login page** (`src/app/login/page.tsx`) gains a **"Forgot password?"** link → `/forgot-password`.
2. **`/forgot-password`** — user submits their email. The server *always* returns the same
   generic confirmation ("If an account exists for that email, a reset link is on its way"),
   so the page can't be used to discover which emails are registered. If the email matches a
   user, a reset token is created and a link is emailed.
3. The email links to **`/reset-password?token=…`**.
4. **`/reset-password`** — user enters a new password (+ confirm). The token is validated
   (exists, not expired, not already used); on success the password is updated and the token
   is marked used.

---

## Components

Each unit has one responsibility and a small, well-defined interface.

### `src/lib/password-reset.ts` — pure token logic (unit-tested)
- `RESET_TOKEN_TTL_MS = 60 * 60 * 1000` (1 hour).
- `hashResetToken(token: string): string` — SHA-256 hex digest of the raw token. Deterministic.
- `generateResetToken(): { token: string; tokenHash: string }` — `token` is 32 bytes of
  `crypto.randomBytes` encoded base64url; `tokenHash = hashResetToken(token)`.
- `isResetTokenValid(record: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean` —
  `record.usedAt == null && now < record.expiresAt`.

The raw token travels only in the emailed URL; the database stores **only the hash**.

### `src/lib/email.ts` — email side-effect boundary
- A lazily-created Nodemailer transporter (created on first use) configured from env
  `GMAIL_USER` / `GMAIL_APP_PASSWORD`, using Gmail SMTP (`service: 'gmail'`).
- `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>` — sends a short
  plain-text + simple HTML message containing the reset link and noting it expires in 1 hour.
- Isolated so the network dependency is contained and the rest of the system is testable.

### `PasswordResetToken` Prisma model
```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```
- Add `passwordResetTokens PasswordResetToken[]` to `User`.
- `removeUser` (admin action) also `deleteMany` these for consistency with the existing
  pick/prediction cleanup (the cascade is a backstop).
- Applied with `npm run db:push` against the shared Neon DB.

### `src/app/actions/password-reset.ts` — server actions (`'use server'`)
- `type RequestResetState = { sent?: boolean; error?: string } | undefined`
- `requestPasswordReset(_prev, formData): Promise<RequestResetState>`
  1. Parse + lowercase the email (zod; on invalid format return the **generic** sent state
     anyway — do not reveal validation about real accounts beyond basic shape).
  2. Look up the user. If none: return `{ sent: true }` (generic).
  3. If found: `deleteMany` the user's prior **unused** tokens; `generateResetToken()`; create a
     `PasswordResetToken` with `expiresAt = now + RESET_TOKEN_TTL_MS`.
  4. Build the reset URL from the incoming request host via `headers()` (`x-forwarded-proto`
     + `host`), so it works on localhost and the Vercel domain with no extra env.
  5. `sendPasswordResetEmail(...)`. On send failure, log server-side; still return `{ sent: true }`.
- `type ResetPasswordState = { ok?: boolean; error?: string } | undefined`
- `resetPassword(_prev, formData): Promise<ResetPasswordState>`
  1. Read `token`, `newPassword`, `confirmPassword`.
  2. Validate `newPassword.length >= 8`; `newPassword === confirmPassword`. Else `{ error }`.
  3. `hashResetToken(token)`, look up by `tokenHash`. If missing → `{ error: 'This reset link is invalid or has expired.' }`.
  4. `isResetTokenValid(record, new Date())`? If not → same generic invalid/expired error.
  5. Update the user's `passwordHash` (existing `hashPassword`); set `usedAt = new Date()`.
     (Optionally delete the user's other tokens.) Return `{ ok: true }`.

### Pages
- `src/app/forgot-password/page.tsx` — client component, `useActionState(requestPasswordReset)`.
  Email input + submit; renders the generic confirmation when `state?.sent`. Styled like the
  existing login/signup card. Link back to `/login`.
- `src/app/reset-password/page.tsx` — client component reading `?token=` via `useSearchParams`
  inside a `Suspense` boundary (same pattern as `login/page.tsx`). New-password + confirm
  fields, a hidden `token` field, `useActionState(resetPassword)`. On `state?.ok`, show success
  + a link to `/login`. If the URL has no token, show an "invalid link" message.
- `src/app/login/page.tsx` — add a "Forgot password?" link (near the password field / above the
  "No account? Sign up" line).

---

## Security
- Tokens are high-entropy (`crypto.randomBytes(32)`), **stored hashed** (SHA-256), **single-use**
  (`usedAt`), and **expire in 1 hour**.
- No user enumeration: `/forgot-password` always returns the same response.
- Server-side password validation on reset.
- **Out of scope (noted for future hardening):** rate-limiting the request endpoint. Acceptable
  for a small private league; revisit if abused.

---

## Environment & dependencies
- New env (local `.env` **and** Vercel — Vercel side already added by the user):
  `GMAIL_USER` (sender Gmail address), `GMAIL_APP_PASSWORD` (16-char Google App Password, **not**
  the account password; requires 2-Step Verification on that Google account).
- New dependency: `nodemailer`; dev dependency: `@types/nodemailer`.
- No new URL env: reset links are built from the request host.

---

## Testing
- `src/lib/password-reset.test.ts` — `hashResetToken` determinism + differs per input;
  `generateResetToken` shape (base64url, hash matches) and uniqueness across calls;
  `isResetTokenValid` for valid / expired / used records.
- Email transport and DB-bound server actions are glue (network + DB) — left untested,
  consistent with the repo convention (`results-apply`, `schedule-apply`, `seed`).

---

## Rollout
- `npm run db:push` for `PasswordResetToken`.
- Set `GMAIL_USER` / `GMAIL_APP_PASSWORD` locally (already on Vercel).
- `npm test` + `npm run typecheck` + `npm run build` green before commit.
- Deploy = `git push origin master` (auto-deploys). Verify by content: `/forgot-password` and
  `/reset-password` load; the login page shows the "Forgot password?" link; a real reset email
  arrives and the link sets a new password.
- Update `handoff.md` (§3 file map, §4 env table, §7 password-reset behavior, §8).

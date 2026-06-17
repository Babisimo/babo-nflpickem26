'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth-helpers';
import {
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
  RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';
import { sendPasswordResetEmail } from '@/lib/email';

export type RequestResetState = { sent?: boolean; error?: string } | undefined;

const EmailSchema = z.string().email();

/** Step 1: a user requests a reset link. Always returns the same generic state so
 *  the endpoint can't be used to discover which emails are registered. */
export async function requestPasswordReset(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const generic: RequestResetState = { sent: true };

  const parsed = EmailSchema.safeParse(String(formData.get('email') ?? '').toLowerCase().trim());
  if (!parsed.success) return generic;

  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (!user) return generic;

  // Invalidate prior unused tokens, then mint a fresh one.
  await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  const { token, tokenHash } = generateResetToken();
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const h = await headers();
  const host = h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const resetUrl = `${proto}://${host}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(parsed.data, resetUrl);
  } catch (err) {
    // Don't leak failures to the client (keeps the response generic); log for ops.
    console.error('[password-reset] failed to send email:', err);
  }
  return generic;
}

export type ResetPasswordState = { ok?: boolean; error?: string } | undefined;

const INVALID = 'This reset link is invalid or has expired.';

/** Step 2: a user submits a new password with the token from the email link. */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!token) return { error: INVALID };
  if (newPassword.length < 8) return { error: 'New password must be at least 8 characters.' };
  if (newPassword !== confirmPassword) return { error: 'New passwords do not match.' };

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!record || !isResetTokenValid(record, new Date())) return { error: INVALID };

  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return { ok: true };
}

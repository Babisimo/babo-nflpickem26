'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth, signOut, type AppSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth-helpers';

/** Sign the current user out and return to the standings home. */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SignupState = { error?: string } | undefined;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: 'An account with that email already exists.' };

  if (!process.env.ADMIN_EMAIL) {
    console.warn('[signup] ADMIN_EMAIL env var is not set — no user will be granted admin access on signup.');
  }
  await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      isAdmin: email === process.env.ADMIN_EMAIL?.toLowerCase(),
    },
  });
  return undefined; // success; UI redirects to /login
}

export type ChangePasswordState = { error?: string; ok?: boolean } | undefined;

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { error: 'Not signed in.' };

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (next.length < 8) return { error: 'New password must be at least 8 characters.' };
  if (next !== confirm) return { error: 'New passwords do not match.' };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'Account not found.' };
  if (!(await verifyPassword(current, user.passwordHash))) {
    return { error: 'Current password is incorrect.' };
  }

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true };
}

'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth, signOut, type AppSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth-helpers';
import { validateUsername, validateName, MAX_USERNAME_CHANGES } from '@/lib/profile';
import { checkUsernameAllowed } from '@/lib/username-filter';

/** Sign the current user out and return to the standings home. */
export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

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
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { error: allowed.error };
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
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { error: allowed.error };
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

export type ChangeUsernameState = { error?: string; ok?: boolean } | undefined;

export async function changeUsername(
  _prev: ChangeUsernameState,
  formData: FormData,
): Promise<ChangeUsernameState> {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { error: 'Not signed in.' };

  const uname = validateUsername(String(formData.get('username') ?? ''));
  if (!uname.ok) return { error: uname.error };
  const allowed = checkUsernameAllowed(uname.value);
  if (!allowed.ok) return { error: allowed.error };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, usernameChangeCount: true },
  });
  if (!user) return { error: 'Account not found.' };

  if (user.username && user.username.toLowerCase() === uname.value.toLowerCase()) {
    return { error: 'That’s already your username.' };
  }
  if (user.usernameChangeCount >= MAX_USERNAME_CHANGES) {
    return { error: 'You’ve used all your username changes.' };
  }

  const taken = await db.user.findFirst({
    where: { username: { equals: uname.value, mode: 'insensitive' }, NOT: { id: userId } },
  });
  if (taken) return { error: 'That username is taken.' };

  await db.user.update({
    where: { id: userId },
    data: { username: uname.value, usernameChangeCount: { increment: 1 } },
  });
  return { ok: true };
}

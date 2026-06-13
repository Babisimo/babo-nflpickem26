'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { signOut } from '@/lib/auth';
import { hashPassword } from '@/lib/auth-helpers';

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

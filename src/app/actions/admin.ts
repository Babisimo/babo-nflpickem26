'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { canRemoveUser, canSetAdmin, type GuardResult } from '@/lib/admin-guard';

async function requireAdmin(): Promise<AppSession | null> {
  const session = (await auth()) as AppSession | null;
  return session?.user?.isAdmin ? session : null;
}

async function adminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

/** Delete a user and their picks. Admin-only, with guardrails. */
export async function removeUser(targetUserId: string): Promise<GuardResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Forbidden.' };

  const guard = canRemoveUser(session.user.id, targetUserId, await adminIds());
  if (!guard.ok) return guard;

  await db.pick.deleteMany({ where: { userId: targetUserId } });
  await db.weekPrediction.deleteMany({ where: { userId: targetUserId } });
  await db.user.delete({ where: { id: targetUserId } });
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

/** Promote or demote a user's admin flag. Admin-only, with guardrails. */
export async function setAdmin(targetUserId: string, makeAdmin: boolean): Promise<GuardResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Forbidden.' };

  const guard = canSetAdmin(session.user.id, targetUserId, makeAdmin, await adminIds());
  if (!guard.ok) return guard;

  await db.user.update({ where: { id: targetUserId }, data: { isAdmin: makeAdmin } });
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

import { NextResponse } from 'next/server';
import { auth, type AppSession } from '@/lib/auth';
import { applyAllResults } from '@/lib/results-apply';

export async function POST() {
  const session = await auth() as AppSession | null;
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const updated = await applyAllResults();
  return NextResponse.json({ ok: true, updated });
}

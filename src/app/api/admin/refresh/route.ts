import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { applyAllResults } from '@/lib/results-apply';

export async function POST() {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const updated = await applyAllResults();
  return NextResponse.json({ ok: true, updated });
}

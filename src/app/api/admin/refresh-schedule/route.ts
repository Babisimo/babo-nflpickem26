import { NextResponse } from 'next/server';
import { auth, type AppSession } from '@/lib/auth';
import { refreshSchedule } from '@/lib/schedule-apply';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await refreshSchedule();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}

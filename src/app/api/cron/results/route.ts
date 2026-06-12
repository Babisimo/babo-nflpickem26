import { NextResponse } from 'next/server';
import { applyAllResults } from '@/lib/results-apply';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const updated = await applyAllResults();
  return NextResponse.json({ ok: true, updated });
}

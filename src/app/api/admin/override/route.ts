import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { gameId, winnerTeamId } = await req.json();
  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: 'Unknown game' }, { status: 404 });
  if (winnerTeamId && winnerTeamId !== game.homeTeamId && winnerTeamId !== game.awayTeamId) {
    return NextResponse.json({ error: 'Team not in game' }, { status: 400 });
  }
  await db.game.update({
    where: { id: gameId },
    data: { winnerTeamId: winnerTeamId ?? null, status: 'FINAL' },
  });
  return NextResponse.json({ ok: true });
}

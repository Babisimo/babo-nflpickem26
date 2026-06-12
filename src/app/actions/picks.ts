'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { arePicksOpen } from '@/lib/lock';

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePick(gameId: string, pickedTeamId: string): Promise<SaveResult> {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const games = await db.game.findMany({ select: { kickoffAt: true } });
  if (!arePicksOpen(new Date(), games.map((g) => g.kickoffAt))) {
    return { ok: false, error: 'Picks are locked.' };
  }

  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) return { ok: false, error: 'Unknown game.' };
  if (pickedTeamId !== game.homeTeamId && pickedTeamId !== game.awayTeamId) {
    return { ok: false, error: 'Team not in this game.' };
  }

  await db.pick.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId, pickedTeamId },
    update: { pickedTeamId },
  });
  return { ok: true };
}

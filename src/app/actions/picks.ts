'use server';

import { db } from '@/lib/db';
import { auth, type AppSession } from '@/lib/auth';
import { isWeekOpen } from '@/lib/lock';

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePick(gameId: string, pickedTeamId: string): Promise<SaveResult> {
  const session = await auth() as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) return { ok: false, error: 'Unknown game.' };

  // Enforce this game's week lock (9 AM ET on the week's first game day).
  const weekGames = await db.game.findMany({
    where: { week: game.week },
    select: { kickoffAt: true },
  });
  if (!isWeekOpen(new Date(), weekGames.map((g) => g.kickoffAt))) {
    return { ok: false, error: `Week ${game.week} is locked.` };
  }

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

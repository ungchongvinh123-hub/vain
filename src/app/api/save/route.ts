import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handle, currentSnapshot, nameBody, SAVE_COOKIE, dbStatus } from '@/server/session';
import { setSaveName, setSettings, wipeSave, addCheat, grantCharacter } from '@/db/repo';
import { z } from 'zod';

async function loadGet() {
  const { snapshot } = await currentSnapshot();
  return { snapshot, db: await dbStatus() };
}

const post = z.object({
  action: z.enum(['rename', 'settings', 'wipe', 'cheat', 'grant', 'switchSave']).optional(),
  name: z.string().optional(), settings: z.record(z.any()).optional(),
  gold: z.number().int().optional(), gem: z.number().int().optional(),
  charId: z.string().optional(), saveKey: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = post.parse(await req.json());
    if (!body.action) return loadGet();
    const { player } = await currentSnapshot();
    switch (body.action) {
      case 'rename': return setSaveName(player.id, nameBody.parse({ name: body.name }).name);
      case 'settings': return setSettings(player.id, body.settings ?? {});
      case 'wipe': return wipeSave(player.id);
      case 'cheat': return addCheat(player.id, body.gold ?? 0, body.gem ?? 0);
      case 'grant': return grantCharacter(player.id, body.charId ?? '');
      case 'switchSave': {
        const key = /^[a-z0-9_-]{1,32}$/.test(body.saveKey ?? '') ? body.saveKey! : 'local';
        (await cookies()).set(SAVE_COOKIE, key, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
        return NextResponse.json({ ok: true, data: { saveKey: key } });
      }
    }
  });
}

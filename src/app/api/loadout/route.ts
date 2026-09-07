import { handle, currentSnapshot, loadoutBody } from '@/server/session';
import { setLoadout } from '@/db/repo';

export async function POST(req: Request) {
  return handle(async () => {
    const body = loadoutBody.parse(await req.json());
    const { player } = await currentSnapshot();
    return { loadout: await setLoadout(player.id, body.instanceId, body.loadout) };
  });
}

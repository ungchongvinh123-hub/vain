import { handle, currentSnapshot, pullBody } from '@/server/session';
import { doPull } from '@/db/repo';

export async function POST(req: Request) {
  return handle(async () => {
    const body = pullBody.parse(await req.json());
    const { player } = await currentSnapshot();
    const res = await doPull(player.id, body.kind);
    const { snapshot } = await currentSnapshot();
    return { ...res, snapshot };
  });
}

import { handle, currentSnapshot, battleBody } from '@/server/session';
import { completeStage } from '@/db/repo';

export async function POST(req: Request) {
  return handle(async () => {
    const body = battleBody.parse(await req.json());
    const { player } = await currentSnapshot();
    const verdict = await completeStage(player.id, {
      ...body,
      actions: body.actions.map((a) => ({ ...a, targetUid: a.targetUid ?? null, mastery: a.mastery ?? undefined, blockMastery: a.blockMastery ?? undefined })),
    });
    const { snapshot } = await currentSnapshot();
    return { verdict, snapshot };
  });
}

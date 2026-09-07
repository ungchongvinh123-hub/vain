import { handle, currentSnapshot, teamBody } from '@/server/session';
import { toggleTeam, releaseCharacter, toggleLockChar } from '@/db/repo';

export async function POST(req: Request) {
  return handle(async () => {
    const { player } = await currentSnapshot();
    const raw = await req.json();
    if (raw.action === 'release') {
      const r = await releaseCharacter(player.id, Number(raw.instanceId));
      return { ...r, snapshot: await currentSnapshot().then((x) => x.snapshot) };
    }
    if (raw.action === 'lock') {
      const r = await toggleLockChar(player.id, Number(raw.instanceId));
      return { ...r, snapshot: await currentSnapshot().then((x) => x.snapshot) };
    }
    const body = teamBody.parse(raw);
    const team = await toggleTeam(player.id, body.instanceId, body.mode, body.toSlot);
    return { team };
  });
}

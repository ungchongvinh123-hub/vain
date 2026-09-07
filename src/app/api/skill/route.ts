import { handle, currentSnapshot, skillBody } from '@/server/session';
import { upgradeSkill, spAuto } from '@/db/repo';

export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.json();
    const { player } = await currentSnapshot();
    if (raw.action === 'auto') return spAuto(player.id, Number(raw.instanceId));
    const body = skillBody.parse(raw);
    return upgradeSkill(player.id, body.instanceId, body.skillId);
  });
}

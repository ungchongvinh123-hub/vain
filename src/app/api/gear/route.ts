import { handle, currentSnapshot, gearBody, gearUpBody } from '@/server/session';
import { equipGear, upgradeGear } from '@/db/repo';

export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.json();
    const { player } = await currentSnapshot();
    if (raw.action === 'upgrade') {
      const b = gearUpBody.parse(raw);
      return upgradeGear(player.id, b.gearInstanceId);
    }
    const b = gearBody.parse(raw);
    return equipGear(player.id, b.gearInstanceId, b.charInstanceId ?? null);
  });
}

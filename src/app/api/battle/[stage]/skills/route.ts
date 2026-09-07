import { z } from 'zod';
import { handle, currentSnapshot } from '@/server/session';
import { buildSeeds } from '@/db/repo';
import { characterCombat } from '@/game/systems/stats';

const body = z.object({
  stageId: z.number().int().min(1).max(10),
  slots: z.array(z.number().int().min(1).max(50)).max(8),
});

/** authoritative skill runtimes for a set of character instances (anti-cheat source of truth) */
export async function POST(req: Request) {
  return handle(async () => {
    const b = body.parse(await req.json());
    const { snapshot } = await currentSnapshot();
    const { party } = buildSeeds(snapshot, b.stageId);
    void party;
    const out = b.slots.map((instanceId) => {
      const oc = snapshot.owned.find((o) => o.instanceId === instanceId);
      if (!oc) return null;
      const c = characterCombat(oc, snapshot.gear);
      return {
        instanceId,
        stats: c.stats,
        mods: c.mods,
        skills: c.actives.map((a) => ({
          id: a.def.id, name: a.def.name, element: a.def.element, cost: a.def.cost, target: a.def.target,
          icon: a.def.icon, desc: a.def.desc, tags: a.def.tags, qte: a.def.qte, strictness: a.def.qteStrictness,
          hits: a.def.hits, level: a.level, effects: a.effects,
        })),
      };
    }).filter(Boolean);
    return { units: out };
  });
}

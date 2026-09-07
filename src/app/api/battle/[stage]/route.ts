import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, currentSnapshot } from '@/server/session';
import { buildSeeds } from '@/db/repo';
import { CHAR_MAP } from '@/game/data/characters';
import { MONSTER_MAP } from '@/game/data/monsters';
import { STAGE_MAP } from '@/game/data/stages';
import { characterCombat, monsterCombat } from '@/game/systems/stats';
import { ELEMENT_META, RARITY_META, ROLE_META } from '@/game/data/constants';

const runtime = (a: { def: { id: string; name: string; element: string; cost: number; target: string; icon: string; desc: string; tags: string[]; qte?: string; qteStrictness?: number; hits?: number }; level: number; effects: unknown }) => ({
  id: a.def.id, name: a.def.name, element: a.def.element, cost: a.def.cost, target: a.def.target,
  icon: a.def.icon, desc: a.def.desc, tags: a.def.tags, qte: a.def.qte, strictness: a.def.qteStrictness,
  hits: a.def.hits, level: a.level, effects: a.effects,
});

export async function POST(req: Request, ctx: { params: Promise<{ stage: string }> }) {
  const { stage: raw } = await ctx.params;
  void req;
  const schema = z.object({ stage: z.coerce.number().int().min(1).max(10) });
  return handle(async () => {
    const { stage: stageId } = schema.parse({ stage: raw });
    const { snapshot } = await currentSnapshot();
    const { party, foes, stage } = buildSeeds(snapshot, stageId);
    const units = party.map((p) => {
      const oc = snapshot.owned.find((o) => o.instanceId === snapshot.team[p.slot])!;
      const c = characterCombat(oc, snapshot.gear);
      const def = CHAR_MAP[p.defId];
      return {
        ...p,
        title: def.title,
        rarity: def.rarity,
        sprite: def.id,
        visual: { roleLabel: ROLE_META[def.role].vn, elementLabel: ELEMENT_META[def.element].vn, rarityColor: RARITY_META[def.rarity].color },
        skills: c.actives.map(runtime),
        exp: oc.exp, expNeed: 0,
      };
    });
    const foeUnits = foes.map((f) => {
      const md = MONSTER_MAP[f.defId];
      const stageDef = STAGE_MAP[stageId];
      const monsterLevel = stageDef.waves[0].monsters.find((m) => m.id === f.defId)?.level ?? 1;
      const c = monsterCombat(md, monsterLevel, (1 + (stageId - 1) * 0.285 + (stageId >= 8 ? (stageId - 7) * 0.14 : 0)));
      return {
        ...f,
        sprite: md.id,
        skills: monsterCombat(md, monsterLevel, 1).actives.map(runtime),
        visual: { roleLabel: ROLE_META[md.role].vn, elementLabel: ELEMENT_META[md.element].vn, rarityColor: '#c9c6d6' },
        c,
      };
    });
    return {
      stageId,
      seed: (Date.now() ^ (stageId * 2654435761)) >>> 0,
      name: stage.name,
      desc: stage.desc,
      boss: !!stage.boss,
      party: units,
      foes: foeUnits.map(({ c, ...rest }) => ({ ...rest, stats: c.stats })),
      reward: stage.reward,
      maxRounds: 30,
    };
  });
}

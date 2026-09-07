/** Mirrors the static content (roster + gear) into SQL and creates a demo save. */
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';
import { charDefs, gearDefs, players, characters, gears } from '../src/db/schema';
import { CHARACTERS } from '../src/game/data/characters';
import { GEAR } from '../src/game/data/gear';
import { MONSTERS } from '../src/game/data/monsters';
import { STAGES } from '../src/game/data/stages';
import { defaultLoadout } from '../src/game/systems/loadout';
import { skillTree } from '../src/game/data/skillFactory';

function url() {
  return process.env.DATABASE_URL ?? `postgres://${process.env.PGUSER ?? 'vain'}@${process.env.PGHOST ?? '127.0.0.1'}:${process.env.PGPORT ?? '5432'}/${process.env.PGDATABASE ?? 'vain'}`;
}

async function main() {
  const pool = new Pool({ connectionString: url(), ssl: false, max: 4 });
  const db = drizzle(pool, { schema });
  try {
    for (const c of CHARACTERS) {
      const tree = skillTree(c);
      await db.insert(charDefs).values({
        charId: c.id, name: c.name, role: c.role, element: c.element, rarity: c.rarity,
        payload: { ...c, skillCount: tree.all.length } as never,
      }).onConflictDoUpdate({ target: charDefs.charId, set: { name: c.name, role: c.role, element: c.element, rarity: c.rarity, payload: { ...c, skillCount: tree.all.length } as never } });
    }
    for (const g of GEAR) {
      await db.insert(gearDefs).values({ gearId: g.id, name: g.name, slot: g.slot, rarity: g.rarity, payload: g as never })
        .onConflictDoUpdate({ target: gearDefs.gearId, set: { name: g.name, slot: g.slot, rarity: g.rarity, payload: g as never } });
    }
    console.log(`[seed] content: ${CHARACTERS.length} characters, ${GEAR.length} gear pieces`);
    const skillTotal = CHARACTERS.reduce((a, c) => a + skillTree(c).all.length, 0);
    console.log(`[seed] generated skills: ${skillTotal} (${skillTotal / CHARACTERS.length} per character)`);
    console.log(`[seed] monsters: ${MONSTERS.length}, stages: ${STAGES.length}`);

    const existing = await db.select().from(players).where(eq(players.saveKey, 'demo'));
    if (!existing.length) {
      const [p] = await db.insert(players).values({ saveKey: 'demo', name: 'Demo', gold: 30000, gem: 12000, stageProgress: 3 }).returning();
      const hero = ['t_valdis', 'a_shirayuki', 's_glacia', 'a_vehra', 's_lumina'];
      const ids: number[] = [];
      for (const id of hero) {
        const rows = await db.insert(characters).values({
          playerId: p.id, charId: id, level: 12, exp: 400, sp: 24,
          skillLevels: {}, loadout: defaultLoadout(id),
        }).returning({ instanceId: characters.instanceId });
        ids.push(rows[0].instanceId);
      }
      const gs = ['w_sword_iron', 'ar_cloth_traveler', 'ac_ring_copper', 'w_bow_frost', 'ar_vest_silk'];
      const grows = await db.insert(gears).values(gs.map((gearId) => ({ playerId: p.id, gearId, plus: 1 }))).returning({ instanceId: gears.instanceId });
      await db.update(players).set({ team: ids }).where(eq(players.id, p.id));
      console.log(`[seed] demo save ready (player #${p.id}, team: ${ids.join(', ')}, gear: ${grows.length})`);
    } else {
      console.log(`[seed] demo save already exists (#${existing[0].id})`);
    }
    await pool.end();
  } catch (e) {
    await pool.end();
    throw e;
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

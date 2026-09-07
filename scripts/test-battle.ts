import { CHARACTERS } from '../src/game/data/characters';
import type { OwnedCharacter, OwnedGear } from '../src/game/types';
import { makeBattle, currentUnit, partyPreview, foeChoose, foeApply, partyTurnOpen, usableSkills } from '../src/game/sim';
import { rollDice, actSkill, finishTurn } from '../src/game/engine/battle';

function starterOwned(): { owned: OwnedCharacter[]; gear: OwnedGear[]; team: (number | null)[] } {
  const picks = ['t_valdis', 'a_kaze', 's_lumina', 'a_pyralis', 's_seleste'];
  const owned: OwnedCharacter[] = [];
  let inst = 1;
  for (const id of picks) {
    owned.push({
      instanceId: inst, charId: id, level: 6, exp: 0, sp: 0, skillLevels: {},
      loadout: [], gear: { weapon: null, armor: null, accessory: null }, createdAt: Date.now(),
    });
    inst++;
  }
  const gear: OwnedGear[] = [
    { instanceId: 900, gearId: 'w_sword_iron', plus: 2, equippedBy: 2 },
    { instanceId: 901, gearId: 'ar_cloth_traveler', plus: 1, equippedBy: 1 },
  ];
  owned[1].gear.weapon = 900;
  owned[0].gear.armor = 901;
  return { owned, gear, team: [1, 2, 3, 4, 5] };
}

let fails = 0;
const check = (cond: boolean, msg: string) => { if (!cond) { fails++; console.log('  ✗', msg); } };

for (const stageId of [1, 3, 5, 8, 10]) {
  const { owned, gear, team } = starterOwned();
  const { st } = makeBattle(stageId, owned, gear, team, 1234 + stageId);
  let guard = 0, actions = 0;
  while (!st.result && guard++ < 5000) {
    const u = currentUnit(st);
    if (!u) break;
    if (st.phase === 'party') {
      const open = partyTurnOpen(st);
      if (open === 'skipped') continue;
      rollDice(st, u);
      const list = usableSkills(st, u);
      const skill = list[Math.floor(Math.random() * list.length)] ?? u.skills[0];
      const intent = partyPreview(st, u, skill, null);
      actSkill(st, u, skill, intent.targets[0] ?? null, 0.4 + Math.random() * 0.6);
      finishTurn(st);
      actions++;
    } else if (st.phase === 'foe') {
      const it = foeChoose(st, u);
      if (it) foeApply(st, u, it, Math.random());
      finishTurn(st);
    } else break;
  }
  const deaths = st.events.filter((e) => e.e === 'death').length;
  const dmg = st.units.filter((x) => x.side === 'party').reduce((a, b) => a + b.dealtDamage, 0);
  console.log(`stage ${String(stageId).padStart(2)}: result=${st.result} rounds=${st.round} events=${st.events.length} partyDmg=${dmg} actions=${actions} deaths=${deaths}`);
  check(st.events.length > 10, `stage ${stageId} produced events`);
  check(st.events.some((e) => e.e === 'dice'), 'dice events present');
}
console.log(fails ? `FAILS=${fails}` : 'ALL OK');

import { makeBattle, currentUnit, partyPreview, foeChoose, foeApply, advanceToNextTurn, partyTurnOpen, usableSkills } from '/home/user/vain/src/game/sim';
import { rollDice, actSkill, finishTurn } from '/home/user/vain/src/game/engine/battle';
import { CHARACTERS } from '/home/user/vain/src/game/data/characters';
import type { OwnedCharacter, OwnedGear } from '/home/user/vain/src/game/types';
import { defaultLoadout } from '/home/user/vain/src/game/systems/loadout';
const DEFAULT_LOADOUT = (id: string) => defaultLoadout(id);

const picks = ['t_valdis','a_kaze','s_lumina','a_pyralis','s_seleste'];
const owned: OwnedCharacter[] = picks.map((id,i)=>({instanceId:i+1,charId:id,level:6,exp:0,sp:0,skillLevels:{},loadout: DEFAULT_LOADOUT(id),gear:{weapon:null,armor:null,accessory:null},createdAt:0}));
const gear: OwnedGear[] = [];
const { st } = makeBattle(1, owned, gear, [1,2,3,4,5], 42);
console.log('party:', st.units.filter(u=>u.side==='party').map(u=>`${u.name} hp=${u.hp} atk=${u.base.atk} def=${u.base.def} spd=${u.base.spd} skills=${u.skills.length}`).join('\n       '));
console.log('foes :', st.units.filter(u=>u.side==='foe').map(u=>`${u.name} hp=${u.hp} atk=${u.base.atk} def=${u.base.def} skills=${u.skills.length}`).join('\n       '));
for (let n=0;n<12 && !st.result;n++){
  const u = currentUnit(st)!;
  if (st.phase==='party'){
    if (partyTurnOpen(st)==='skipped'){ continue; }
    rollDice(st,u);
    const list = usableSkills(st,u);
    const sk = [...list].sort((a:any,b:any)=>b.cost-a.cost)[0];
    const it = partyPreview(st,u,sk,null);
    console.log(`[p] ${u.name} mana=${u.mana} use ${sk.name} cost=${(sk as any).cost} tgt=${it.targets.join(',')} self=${it.selfOnly}`);
    actSkill(st,u,sk,it.targets[0]??null,1); finishTurn(st);
  } else {
    const it = foeChoose(st,u);
    console.log(`[f] ${u.name} -> ${it && (it.skill as any).name} targets=${it?.targets.map(t=>t.name).join(',')}`);
    if (it) foeApply(st,u,it);
    finishTurn(st);
  }
  console.log('   state:', st.units.map(x=>`${x.uid}:${x.hp}`).join(' '));
}
console.log(st.events.slice(0,26).map(e=>JSON.stringify(e)).join('\n'));

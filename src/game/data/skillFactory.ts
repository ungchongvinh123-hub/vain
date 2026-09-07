import type { CharacterDef, Element, EffectDef, EffectTargetMode, QteKind, Role, SkillDef, StatMods } from '../types';
import { MAX_LEVEL, MAX_SKILL_LEVEL } from '../data/constants';
import { hashStr, pick, rand, seedRng } from '../rng';

/* ----------------------------- name vocabulary ----------------------------- */

const NOUN: Record<Element, string[]> = {
  fire: ['Thiêu Đốt', 'Hỏa Hoa', 'Liệt Diệm', 'Lò Rèn', 'Tro Tàn', 'Thạch Lửa', 'Minh Hỏa', 'Bạo Diệm'],
  ice: ['Sương Giá', 'Băng Lam', 'Tuyết Rơi', 'Hàn Phong', 'Băng Hoa', 'Zero', 'Băng Bích', 'Tuyết Vũ'],
  thunder: ['Lôi Đình', 'Tĩnh Điện', 'Sét Đánh', 'Bão Tố', 'Hồ Quang', 'Lôi Kiếm', 'Chớp Tàn', 'Tần Số'],
  nature: ['Độc Tố', 'Dây leo', 'Hoa Nở', 'Rừng Thẳm', 'Gai Mọc', 'Sinh Sôi', 'Cỏ Độc', 'Hương Thơm'],
  holy: ['Thánh Quang', 'Hừng Đông', 'Chúc Phúc', 'Thánh Ca', 'Vầng Sáng', 'Nguyện Cầu', 'Giáng Trần', 'Hào Quang'],
  dark: ['Hắc Ám', 'Vực Thẳm', 'Tử Vong', 'Bóng Ma', 'Đêm Dài', 'Tàn Tích', 'Nguyền Rủa', 'Quạ Đen'],
  neutral: ['Vô Danh', 'Thép Lạnh', 'Bão Cát', 'Trọng Lực', 'Vết Nứt', 'Phá Vỡ', 'Tĩnh Lặng', 'Góc Khuất'],
};

const VERB_DMG: Record<Role, string[]> = {
  attacker: ['Trảm', 'Xiên', 'Xé Toạc', 'Giáng', 'Phóng', 'Đoản', 'Chém', 'Bắn'],
  tank: ['Nghiền', 'Va Đập', 'Hất', 'Chọi', 'Dẫm', 'Đập'],
  support: ['Phạt', 'Viên Đạn', 'Chấn', 'Quất', 'Ép'],
};
const VERB_SUP = ['Nâng Đỡ', 'Che Chở', 'Nuôi Dưỡng', 'Thức Tỉnh', 'Khâu Vết', 'Hồi Sinh', 'Gột Rửa', 'Thánh Hóa'];
const VERB_TANK = ['Khiên Chắn', 'Giữ Trận', 'Nghiêm Lệnh', 'Thách Đấu', 'Chặn Đường', 'Ép Góc'];

function nameFor(el: Element, role: Role, i: number, kind: Template['kind'] | 'passive'): string {
  const nouns = NOUN[el];
  if (kind === 'passive') return `${nouns[i % nouns.length]} Nội Tại`;
  if (kind === 'heal') return `${VERB_SUP[(i * 3 + 1) % VERB_SUP.length]} ${nouns[(i + 2) % nouns.length]}`;
  if (kind === 'buff') return `${VERB_TANK[i % VERB_TANK.length]} ${nouns[(i * 5) % nouns.length]}`;
  const v = VERB_DMG[role];
  return `${v[i % v.length]} ${nouns[(i * 3 + 1) % nouns.length]}`;
}

/* ------------------------------- archetypes -------------------------------- */

type StatusEffect = Extract<EffectDef, { t: 'status' }>;

interface Template {
  key: string;
  weight: Record<Role, number>;
  target: EffectTargetMode;
  base: number;
  kind: 'dmg' | 'heal' | 'buff' | 'tank';
  effects: (p: number, potency: number, el: Element) => EffectDef[];
  qte?: QteKind;
  strictness?: number;
  hits?: number;
  extraPower?: number;
}

const TEMPLATES: Template[] = [
  { key: 'nuketh', weight: { attacker: 8, tank: 3, support: 3 }, target: 'enemyOne', base: 1.75, kind: 'dmg', effects: (p) => [{ t: 'damage', power: p, scale: 1 }], qte: 'focus', strictness: 0.72 },
  { key: 'pierce', weight: { attacker: 7, tank: 2, support: 2 }, target: 'enemyFront', base: 1.95, kind: 'dmg', effects: (p) => [{ t: 'damage', power: p, scale: 1 }], qte: 'link', strictness: 0.6 },
  { key: 'spread', weight: { attacker: 6, tank: 4, support: 2 }, target: 'enemySpread', base: 1.25, kind: 'dmg', effects: (p) => [{ t: 'damage', power: p, scale: 1 }], qte: 'tap', strictness: 0.5 },
  { key: 'nukes', weight: { attacker: 6, tank: 2, support: 2 }, target: 'enemyOne', base: 1.15, kind: 'dmg', hits: 3, effects: (p) => [{ t: 'damage', power: p, scale: 0.82 }], qte: 'tap', strictness: 0.55 },
  { key: 'burst', weight: { attacker: 6, tank: 1, support: 1 }, target: 'enemyOne', base: 2.35, kind: 'dmg', effects: (p) => [{ t: 'damage', power: p, scale: 1.05 }], qte: 'focus', strictness: 0.88 },
  { key: 'multi', weight: { attacker: 5, tank: 1, support: 1 }, target: 'enemyOne', base: 1.05, kind: 'dmg', hits: 2, effects: (p) => [{ t: 'damage', power: p, scale: 1 }, { t: 'damage', power: p * 0.7, scale: 1 }], qte: 'link', strictness: 0.62 },
  { key: 'execute', weight: { attacker: 4, tank: 3, support: 1 }, target: 'enemyOne', base: 1.35, kind: 'dmg', effects: (p) => [{ t: 'damage', power: p, scale: 1 }, { t: 'dispel', scope: 'buffs', count: 2 }], qte: 'focus', strictness: 0.7 },
  { key: 'drain', weight: { attacker: 4, tank: 2, support: 3 }, target: 'enemyOne', base: 1.15, kind: 'dmg', effects: (p) => [{ t: 'drain', power: p, scale: 1, healPct: 55 }], qte: 'focus', strictness: 0.55 },
  { key: 'allhit', weight: { attacker: 4, tank: 3, support: 2 }, target: 'enemyAll', base: 0.85, kind: 'dmg', effects: (p) => [{ t: 'damage', power: p, scale: 1 }], qte: 'tap', strictness: 0.45 },
  { key: 'burnC', weight: { attacker: 5, tank: 2, support: 2 }, target: 'enemyOne', base: 1.2, kind: 'dmg', effects: (p, pt, el) => [{ t: 'damage', power: p, scale: 1 }, status('burn', 2, pt, el)], qte: 'focus', strictness: 0.66 },
  { key: 'poisonC', weight: { attacker: 4, tank: 3, support: 3 }, target: 'enemySpread', base: 0.9, kind: 'dmg', effects: (p, pt, el) => [{ t: 'damage', power: p, scale: 1 }, status('poison', 3, pt, el)], qte: 'tap', strictness: 0.5 },
  { key: 'freezeC', weight: { attacker: 3, tank: 2, support: 2 }, target: 'enemyOne', base: 0.95, kind: 'dmg', effects: (p, pt, el) => [{ t: 'damage', power: p, scale: 1 }, status('freeze', 1, pt, el)], qte: 'link', strictness: 0.75 },
  { key: 'shockC', weight: { attacker: 3, tank: 2, support: 2 }, target: 'enemySpread', base: 0.88, kind: 'dmg', effects: (p, pt, el) => [{ t: 'damage', power: p, scale: 1 }, status('shock', 1, pt, el)], qte: 'tap', strictness: 0.6 },
  { key: 'debuff', weight: { attacker: 2, tank: 4, support: 4 }, target: 'enemyOne', base: 0.7, kind: 'dmg', effects: (p, pt) => [{ t: 'damage', power: p, scale: 1 }, status('atkDown', 2, pt, 'neutral'), status('defDown', 2, pt, 'neutral')] },
  { key: 'healS', weight: { attacker: 1, tank: 2, support: 8 }, target: 'allyLowest', base: 1.15, kind: 'heal', effects: (p) => [{ t: 'heal', power: p, scale: 1 }] },
  { key: 'healA', weight: { attacker: 1, tank: 2, support: 7 }, target: 'allyAll', base: 0.72, kind: 'heal', effects: (p) => [{ t: 'heal', power: p, scale: 1 }] },
  { key: 'regen', weight: { attacker: 1, tank: 2, support: 5 }, target: 'allyAll', base: 0.5, kind: 'heal', effects: (p, pt) => [{ t: 'heal', power: p, scale: 1 }, status('regen', 3, pt, 'holy')] },
  { key: 'cleanse', weight: { attacker: 0.5, tank: 3, support: 6 }, target: 'allyOne', base: 0.3, kind: 'heal', effects: () => [{ t: 'cleanse', scope: 'debuffs', count: 9 }, { t: 'heal', power: 0.45, scale: 1 }] },
  { key: 'revive', weight: { attacker: 0, tank: 1, support: 4 }, target: 'allyDead', base: 0.4, kind: 'heal', effects: (p) => [{ t: 'revive', healPct: 24 + p * 8 }] },
  { key: 'shieldA', weight: { attacker: 1, tank: 6, support: 5 }, target: 'allyAll', base: 0.6, kind: 'buff', effects: (p) => [{ t: 'shield', power: p, scale: 1 }] },
  { key: 'shieldS', weight: { attacker: 1, tank: 5, support: 4 }, target: 'allyOne', base: 1.15, kind: 'buff', effects: (p) => [{ t: 'shield', power: p, scale: 1 }] },
  { key: 'atkBuff', weight: { attacker: 3, tank: 2, support: 5 }, target: 'allyOne', base: 0.3, kind: 'buff', effects: (p, pt) => [status('atkUp', 3, pt, 'holy'), { t: 'heal', power: 0.35, scale: 1 }] },
  { key: 'defBuff', weight: { attacker: 1, tank: 5, support: 5 }, target: 'allyAll', base: 0.3, kind: 'buff', effects: (p, pt) => [status('defUp', 3, pt, 'neutral')] },
  { key: 'taunt', weight: { attacker: 0.5, tank: 8, support: 2 }, target: 'enemyAll', base: 0.55, kind: 'tank', effects: (p, pt) => [{ t: 'damage', power: p * 0.8, scale: 1 }, status('taunt', 2, pt, 'neutral')] },
  { key: 'tauntHit', weight: { attacker: 0.5, tank: 6, support: 1 }, target: 'enemySpread', base: 1.0, kind: 'tank', effects: (p, pt) => [{ t: 'damage', power: p, scale: 1 }, status('taunt', 2, pt, 'neutral')] },
  { key: 'tankSmash', weight: { attacker: 2, tank: 6, support: 2 }, target: 'enemyOne', base: 1.3, kind: 'tank', effects: (p, pt) => [{ t: 'damage', power: p, scale: 1 }, status('atkDown', 2, pt, 'neutral')], qte: 'focus', strictness: 0.5 },
  { key: 'selfBuffHit', weight: { attacker: 4, tank: 3, support: 2 }, target: 'enemyOne', base: 1.05, kind: 'dmg', effects: (p, pt) => [{ t: 'damage', power: p, scale: 1 }, status('atkUp', 2, pt * 0.7, 'fire')], qte: 'link', strictness: 0.58 },
  { key: 'frontBreak', weight: { attacker: 5, tank: 3, support: 1 }, target: 'enemyFront', base: 1.55, kind: 'dmg', effects: (p, pt) => [{ t: 'damage', power: p, scale: 1 }, status('defDown', 2, pt, 'neutral')], qte: 'link', strictness: 0.66 },
];

function status(kind: StatusEffect['status'], turns: number, potency: number, _el: Element): StatusEffect {
  return { t: 'status', status: kind, turns, potency };
}

/* -------------------------------- passives -------------------------------- */

type PassiveSpec = { mods: StatMods; name: string; desc: string };
const PASSIVE_POOL: PassiveSpec[] = [
  { mods: { atkPct: 7 }, name: 'Lưỡi Dao Sắc', desc: '+% ATK' },
  { mods: { hpPct: 9 }, name: 'Da Bọc Thép', desc: '+% HP tối đa' },
  { mods: { defPct: 8 }, name: 'Tấm Khiên Nội Tâm', desc: '+% DEF' },
  { mods: { critRate: 6 }, name: 'Nhìn Điểm Yếu', desc: '+% Chí mạng' },
  { mods: { critDmg: 16 }, name: 'Đòn Chốt', desc: '+ Sát thương chí mạng' },
  { mods: { spdPct: 6 }, name: 'Bước Chân Nhẹ', desc: '+% Tốc độ' },
  { mods: { resist: 10 }, name: 'Tâm Trí Thép', desc: '+% Kháng hiệu ứng' },
  { mods: { diceBonus: 16 }, name: 'Con Bài May', desc: '+% cơ hội +1 Xúc Xắc' },
  { mods: { dmgOut: 6 }, name: 'Cơn Hưng Phấn', desc: '+% sát thương gây ra' },
  { mods: { dmgIn: -6 }, name: 'Lì Lợm', desc: '-% sát thương nhận vào' },
  { mods: { healOut: 14 }, name: 'Bàn Tay Ấm', desc: '+% hồi máu' },
  { mods: { lifesteal: 6 }, name: 'Khát Máu', desc: '+% hút máu' },
  { mods: { killHeal: 5 }, name: 'Hồi Phục Sau Trảm', desc: '+% HP hồi khi hạ gục' },
  { mods: { execute: 3 }, name: 'Kết Liễu Gần', desc: '+% ngưỡng hành quyết' },
  { mods: { atkPct: 4, critDmg: 10 }, name: 'Thịnh Nộ', desc: '+% ATK, +sát thương chí mạng' },
  { mods: { hpPct: 5, resist: 6 }, name: 'Thệ Nguyện', desc: '+% HP, +% kháng' },
  { mods: { atkPct: 3, dmgOut: 4 }, name: 'Nhịp Thở Gấp', desc: '+% ATK, +% sát thương' },
  { mods: { defPct: 4, healOut: 8 }, name: 'Gốc Rễ Bền', desc: '+% DEF, +% hồi máu' },
  { mods: { procChance: 10, procTurns: 2 }, name: 'Dấu Ấn Thuộc Tính', desc: '% proc hiệu ứng khi tung skill' },
  { mods: { skillCostReduce: 0 }, name: 'Tiết Kiệm Năng Lượng', desc: 'Giảm 1 điểm xúc xắc cho skill 4+' },
];

/* ------------------------------ tree assembly ------------------------------ */

const RARITY_QUERIES: Record<string, number> = { R: 0, SR: 5, SSR: 10 };

/** cost ladder per active index (11 tree skills; +1 free basic attack = 12 active, +8 passives = 20 total) — cheap options always exist */
function costLadder(role: Role): number[] {
  const base = role === 'attacker' ? [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]
    : role === 'tank' ? [1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6]
      : [1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 6];
  return base;
}

const TIER_OF_ACTIVE = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4];

export interface CharSkills { actives: SkillDef[]; passives: SkillDef[]; all: SkillDef[] }
const CACHE = new Map<string, CharSkills>();

export function skillTree(char: CharacterDef): CharSkills {
  const cached = CACHE.get(char.id);
  if (cached) return cached;

  const rng = seedRng(char.seed ^ hashStr(char.id));
  const role = char.role;
  const el = char.element;

  // weighted template draw without replacement
  const bag: Template[] = [];
  for (const t of TEMPLATES) {
    const w = t.weight[role];
    for (let i = 0; i < w; i++) bag.push(t);
  }
  const chosen: Template[] = [];
  const used = new Set<string>();
  // ensure class identity: attacker gets burst+spread, tank gets taunt, support gets healA & cleanse
  const forced: Record<Role, string[]> = {
    attacker: ['burst', 'spread'],
    tank: ['taunt', 'shieldA'],
    support: ['healA', 'cleanse'],
  };
  for (const key of forced[role]) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    chosen.push(t); used.add(t.key);
  }
  // guarantee a cheap damage option for every class
  const cheap = TEMPLATES.find((x) => x.key === (role === 'support' ? 'healS' : 'tankSmash'))!;
  if (role === 'support') { chosen.push(TEMPLATES.find((t) => t.key === 'nuketh')!); used.add('nuketh'); }
  else { chosen.push(cheap); used.add(cheap.key); }

  while (chosen.length < 11) {
    const t = pick(rng, bag);
    if (used.has(t.key)) {
      // allow up to 2 copies of a template for large pools; else reroll
      const count = chosen.filter((c) => c.key === t.key).length;
      if (count >= 1) continue;
    }
    chosen.push(t); used.add(t.key);
  }

  // sort so expensive ultimates land at the end of the tree
  chosen.sort((a, b) => b.base - a.base);
  // place the highest-power one last (ultimate) but keep cheap options early
  const ladder = costLadder(role);
  const skills: SkillDef[] = [];
  const names = new Set<string>();
  const sigNames = char.signature.activeNames.filter(Boolean);

  for (let i = 0; i < 11; i++) {
    const t = chosen[i];
    const cost = ladder[i];
    const tier = TIER_OF_ACTIVE[i];
    const scaleUp = t.base * (0.62 + cost * 0.085);
    const potency = clamp(0.10 + t.base * 0.06 + cost * 0.018, 0.08, 0.34);
    const name = i < sigNames.length ? sigNames[i] : uniqueName(nameFor(el, role, i + (char.seed % 5), t.kind), names);
    const effects = t.effects(round2(scaleUp), round2(potency), el);
    const requires: string[] = tier === 0 ? []
      : tier === 1 ? [`${char.id}_sk0`]
        : tier === 2 ? [`${char.id}_sk${1 + (i % 3)}`]
          : [`${char.id}_sk${4 + (i % 4)}`];
    skills.push({
      id: `${char.id}_sk${i}`, charId: char.id, name,
      kind: 'active', element: t.kind === 'heal' || t.kind === 'buff' ? (el === 'neutral' ? 'holy' : el) : el,
      cost, target: t.target, effects, hits: t.hits,
      qte: i < sigNames.length ? (t.qte ?? 'focus') : t.qte,
      qteStrictness: t.strictness ?? 0.6,
      tier, node: i, requires, maxLevel: MAX_SKILL_LEVEL,
      icon: iconFor(t, effects),
      tags: tagsFor(t, effects),
      powerMult: clamp(t.base / 2.6, 0.15, 1),
      desc: describeSkill(t, effects, i < sigNames.length),
    });
  }

  // basic attack (always index 0 slot in loadout UI, cost 0, not part of tree gates)
  skills.unshift(makeBasic(char, rng));

  // passives
  const passives: SkillDef[] = [];
  const pool = PASSIVE_POOL.slice();
  const sigP = char.signature.passiveNames.filter(Boolean);
  for (let i = 0; i < 8; i++) {
    const spec = pool.splice(Math.floor(rand(rng) * pool.length), 1)[0];
    const levelGate = 5 * (1 + Math.floor(i / 2));
    passives.push({
      id: `${char.id}_pa${i}`, charId: char.id,
      name: i < sigP.length ? sigP[i] : uniqueName(`${nameFor(el, role, i + 3, 'passive')}`, names),
      kind: 'passive', element: el, cost: 0, target: 'self', effects: [],
      tier: 5, node: i, requires: levelGate > 5 ? [`${char.id}_pa${i - 1}`] : [], maxLevel: MAX_SKILL_LEVEL,
      icon: iconForPassive(spec), tags: ['passive', `lv${levelGate}`],
      powerMult: 0.3,
      desc: `${spec.desc} (x ${(1 + 0.35 * (MAX_SKILL_LEVEL - 1)).toFixed(2)} tại Lv.${MAX_SKILL_LEVEL}) — cần Lv.${levelGate}`,
    });
    (passives[passives.length - 1] as SkillDef & { mods?: StatMods; levelGate?: number }).mods = spec.mods;
    (passives[passives.length - 1] as SkillDef & { levelGate?: number }).levelGate = levelGate;
    (passives[passives.length - 1] as SkillDef & { passiveMods?: StatMods }).passiveMods = spec.mods;
  }

  const out = { actives: skills, passives, all: [...skills, ...passives] };
  CACHE.set(char.id, out);
  return out;
}

export function makeBasic(char: CharacterDef, rng?: ReturnType<typeof seedRng>): SkillDef {
  const r = rng ?? seedRng(char.seed);
  const extra = rand(r) > 0.5;
  return {
    id: `${char.id}_skbasic`, charId: char.id, name: 'Đánh Thường', kind: 'active',
    element: char.element, cost: 0, target: char.role === 'tank' ? 'enemySpread' : 'enemyOne',
    effects: [{ t: 'damage', power: 1.0, scale: 1 }],
    tier: 0, node: -1, requires: [], maxLevel: MAX_SKILL_LEVEL,
    icon: 'slash', tags: ['basic'], powerMult: 0.34,
    desc: char.role === 'tank' ? 'Đòn cơ bản miễn phí, đánh lan 3 mục tiêu.' : 'Đòn cơ bản miễn phí, đánh 1 mục tiêu.',
    qte: extra ? undefined : undefined,
  };
}

/* --------------------------------- helpers --------------------------------- */

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function round2(v: number) { return Math.round(v * 100) / 100; }
function uniqueName(n: string, set: Set<string>): string {
  let out = n, i = 2;
  while (set.has(out)) { out = `${n} ${romanize(i++)}`; }
  set.add(out);
  return out;
}
function romanize(i: number) { return ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] ?? String(i); }

function iconFor(t: Template, fx: EffectDef[]): string {
  const kinds = fx.map((f) => f.t);
  if (kinds.includes('revive')) return 'revive';
  if (kinds.includes('cleanse')) return 'cleanse';
  if (kinds.includes('heal') && !kinds.includes('damage')) return 'heal';
  if (kinds.includes('shield')) return 'shield';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'taunt')) return 'taunt';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'freeze')) return 'snow';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'burn')) return 'flame';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'poison')) return 'leaf';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'shock')) return 'bolt';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'atkUp')) return 'atkUp';
  if (fx.some((f) => f.t === 'status' && (f as StatusEffect).status === 'defUp')) return 'defUp';
  if (kinds.includes('dispel')) return 'dispel';
  if (kinds.includes('drain')) return 'drain';
  if (t.target === 'enemyAll' || t.target === 'enemySpread') return 'aoe';
  return t.kind === 'tank' ? 'shieldStrike' : 'slash';
}
function iconForPassive(p: PassiveSpec): string {
  const m = p.mods;
  if (m.atkPct) return 'atkUp';
  if (m.defPct) return 'defUp';
  if (m.hpPct) return 'heart';
  if (m.critRate) return 'crit';
  if (m.critDmg) return 'critDmg';
  if (m.resist) return 'resist';
  if (m.diceBonus) return 'dice';
  if (m.healOut) return 'heal';
  if (m.lifesteal) return 'drain';
  if (m.execute) return 'execute';
  if (m.killHeal) return 'revive';
  if (m.spdPct) return 'spd';
  return 'star';
}

function tagsFor(t: Template, fx: EffectDef[]): string[] {
  const tags: string[] = [t.kind === 'heal' ? 'heal' : t.kind === 'buff' ? 'buff' : t.kind === 'tank' ? 'control' : 'damage'];
  if (t.target === 'enemyAll' || t.target === 'enemySpread') tags.push('aoe');
  if (t.target.startsWith('ally')) tags.push('utility');
  for (const f of fx) { if (f.t === 'status') tags.push(f.status); else if (!tags.includes(f.t)) tags.push(f.t); }
  return Array.from(new Set(tags));
}

function describeSkill(t: Template, fx: EffectDef[], signature: boolean): string {
  const parts: string[] = [];
  for (const f of fx) {
    switch (f.t) {
      case 'damage': parts.push(`Gây ${Math.round(f.power * 100)}% ATK sát thương`); break;
      case 'drain': parts.push(`Hút ${Math.round(f.power * 100)}% ATK, hồi ${f.healPct}% sát thương`); break;
      case 'heal': parts.push(`Hồi ${Math.round(f.power * 100)}% ATK`); break;
      case 'shield': parts.push(`Khiên ${Math.round(f.power * 100)}% HP tối đa`); break;
      case 'status': parts.push(`[${f.status}] ${f.turns} lượt (${Math.round(f.potency * 100)}%)`); break;
      case 'cleanse': parts.push('Thanh tẩy hiệu ứng xấu'); break;
      case 'dispel': parts.push('Xóa hiệu ứng tăng sức mạnh'); break;
      case 'revive': parts.push(`Hồi sinh ${f.healPct}% Máu`); break;
    }
  }
  if (t.hits && t.hits > 1) parts.push(`${t.hits} hit`);
  const tgt = t.target === 'enemyAll' ? 'toàn bộ quái' : t.target === 'enemySpread' ? 'mục tiêu ±1 bên cạnh' : t.target === 'enemyFront' ? 'kẻ đầu hàng ngũ' : t.target === 'allyAll' ? 'toàn đội' : t.target === 'allyLowest' ? 'đồng đội ít máu nhất' : t.target === 'allyDead' ? 'đồng đội đã ngã' : '1 mục tiêu';
  return `${parts.join(', ')} — ${tgt}.${signature ? ' (Kỹ năng thương hiệu)' : ''}`;
}

/* --------------------------------- runtime --------------------------------- */

export function resolveEffects(def: SkillDef, level: number): EffectDef[] {
  if (def.kind === 'passive' || def.cost === 0) return def.effects;
  const k = 1 + (level - 1) * 0.12;
  const kd = 1 + (level - 1) * 0.08;
  return def.effects.map((f) => {
    switch (f.t) {
      case 'damage': return { ...f, power: round2(f.power * k) };
      case 'heal': return { ...f, power: round2(f.power * k) };
      case 'drain': return { ...f, power: round2(f.power * k) };
      case 'shield': return { ...f, power: round2(f.power * k) };
      case 'status': return { ...f, potency: round2(f.potency * kd), turns: f.turns + (level >= 4 ? 1 : 0) };
      case 'revive': return { ...f, healPct: Math.min(85, f.healPct + (level - 1) * 6) };
      case 'cleanse': return { ...f, count: f.count };
      default: return f;
    }
  });
}

export function passiveMods(def: SkillDef, level: number): StatMods {
  const raw = (def as SkillDef & { passiveMods?: StatMods }).passiveMods;
  if (!raw) return {};
  const k = 1 + (level - 1) * 0.35;
  const out: StatMods = {};
  (Object.keys(raw) as (keyof StatMods)[]).forEach((key) => {
    const v = raw[key];
    if (typeof v === 'number') (out as Record<string, unknown>)[key] = Math.round(v * k * 100) / 100;
  });
  if (raw.procElement) out.procElement = raw.procElement;
  return out;
}

export function passiveLevelGate(def: SkillDef): number {
  return (def as SkillDef & { levelGate?: number }).levelGate ?? 1;
}

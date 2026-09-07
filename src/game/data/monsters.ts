import type { MonsterDef, Role, Element, SkillDef, SpriteSpec } from '../types';

type MobSkill = Omit<SkillDef, 'id' | 'charId' | 'tier' | 'node' | 'requires' | 'maxLevel' | 'icon' | 'tags'> & Partial<Pick<SkillDef, 'icon' | 'tags'>>;

const MB: Record<Role, { hp: number; atk: number; def: number; spd: number; critRate: number; critDmg: number; resist: number }> = {
  tank: { hp: 2520, atk: 138, def: 226, spd: 82, critRate: 5, critDmg: 150, resist: 34 },
  attacker: { hp: 1380, atk: 242, def: 118, spd: 106, critRate: 18, critDmg: 172, resist: 12 },
  support: { hp: 1780, atk: 168, def: 152, spd: 96, critRate: 8, critDmg: 150, resist: 26 },
};

function mk(id: string, name: string, role: Role, element: Element, tier: 1 | 2 | 3, art: Partial<SpriteSpec>, skills: MobSkill[], statTune = 1): MonsterDef {
  const b = MB[role];
  return {
    id, name, element, role, tier,
    base: {
      hp: Math.round(b.hp * statTune), atk: Math.round(b.atk * statTune), def: Math.round(b.def * statTune),
      spd: b.spd, critRate: b.critRate, critDmg: b.critDmg, resist: b.resist,
    },
    art: {
      body: art.body ?? 'brute', skin: art.skin ?? '#8f7f6a',
      hair: art.hair ?? { color: '#3b2f2a', shade: '#181210', style: 'bald' },
      eyes: art.eyes ?? { color: '#ff5a3c' },
      outfit: { kind: art.outfit?.kind ?? 'rags', primary: art.outfit?.primary ?? '#4b3f38', secondary: art.outfit?.secondary ?? '#2c241f', accent: art.outfit?.accent ?? '#ff8b3d' },
      trim: art.trim, height: art.height ?? 1, bulk: art.bulk ?? 1.25, element,
    },
    skills: skills.map((s, i) => ({
      ...s, id: `${id}_s${i}`, charId: id, tier: 1, node: i, requires: [], maxLevel: 1,
      icon: s.icon || 'claw', tags: s.tags || [],
    } as SkillDef)),
  };
}

const dmg = (power: number, scale: number, extra: Partial<SkillDef> = {}): MobSkill => ({
  name: 'Strike', desc: '', kind: 'active', element: 'neutral', cost: 0, target: 'enemyOne', effects: [{ t: 'damage', power, scale }], powerMult: Math.min(1, power / 2.4), ...extra,
});

export const MONSTERS: MonsterDef[] = [
  /* ------------------------------- REGION 1 ------------------------------- */
  mk('m_goblin', 'Goblin Tạp Phẩm', 'attacker', 'neutral', 1,
    { skin: '#8fbf6a', eyes: { color: '#ffe066' }, outfit: { kind: 'rags', primary: '#6a5b3c', secondary: '#3d3423', accent: '#9fd06a' }, bulk: 0.85, height: 0.78, trim: { weapon: 'blade', ears: 'elf' } },
    [dmg(1.5, 1, { name: 'Đâm Lén', element: 'neutral', target: 'enemyOne' }), dmg(1.15, 0.7, { name: 'Ném Đá', target: 'enemyFront' })]),
  mk('m_wolf', 'Sói Rừng Sương', 'attacker', 'ice', 1,
    { body: 'beast', skin: '#9fb4cc', hair: { color: '#cfe0f2', shade: '#5b7291', style: 'wild' }, eyes: { color: '#8fd8ff' }, outfit: { kind: 'hide', primary: '#7f96b4', secondary: '#4d5f78', accent: '#c9f0ff' }, bulk: 1.05, height: 0.82, trim: { weapon: 'claw' } },
    [dmg(1.45, 1, { name: 'Cắn Xé', element: 'ice', procs: [{ status: 'shock', turns: 1, potency: 0, chance: 12 }] }), dmg(1.2, 0.9, { name: 'Sủa Đàn', element: 'ice', target: 'enemySpread' })]),
  mk('m_imp', 'Tiểu Quỷ Lửa', 'attacker', 'fire', 1,
    { skin: '#e2654a', hair: { color: '#ff8b3d', shade: '#a3380f', style: 'horns' }, eyes: { color: '#ffe066' }, outfit: { kind: 'rags', primary: '#7a2a16', secondary: '#40140b', accent: '#ffb36b' }, bulk: 0.8, height: 0.75, trim: { weapon: 'blade' } },
    [dmg(1.55, 1, { name: 'Phun Than', element: 'fire', procs: [{ status: 'burn', turns: 2, potency: 0.5, chance: 45 }] }), dmg(1.25, 0.8, { name: 'Tia Lửa Kín', element: 'fire', target: 'enemyAll' })]),
  mk('m_spider', 'Nhện Độc Thung Lũng', 'tank', 'nature', 1,
    { body: 'beast', skin: '#4a3b57', hair: { color: '#2b2233', shade: '#100c18', style: 'bald' }, eyes: { color: '#9fd06a' }, outfit: { kind: 'husk', primary: '#332a3d', secondary: '#221b29', accent: '#7ee081' }, bulk: 1.3, height: 0.7, trim: { weapon: 'claw' } },
    [dmg(1.1, 1, { name: 'Mạng Nhện', element: 'nature', target: 'enemyOne', effects: [{ t: 'damage', power: 0.9, scale: 1 }, { t: 'status', status: 'poison', turns: 3, potency: 0.55 }] }), dmg(0.6, 1, { name: 'Tơ Buộc', target: 'enemyOne', effects: [{ t: 'status', status: 'poison', turns: 2, potency: 0.4 }] })]),
  mk('m_boss_cult', 'Hắc Diện Giáo Sĩ', 'support', 'dark', 1,
    { body: 'wraith', skin: '#cfd2e0', hair: { color: '#2b2335', shade: '#100c18', style: 'hood' }, eyes: { color: '#c084fc' }, outfit: { kind: 'robe', primary: '#2b2140', secondary: '#4a3670', accent: '#a855f7' }, bulk: 1, height: 1.02, trim: { hood: true, weapon: 'tome', aura: '#a855f7' } },
    [
      dmg(1.35, 1, { name: 'Lời Nguyền', element: 'dark', procs: [{ status: 'atkDown', turns: 2, potency: 0.15, chance: 60 }] }),
      { name: 'Hồi Sinh Bóng Tối', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'allyLowest', effects: [{ t: 'heal', power: 0.9, scale: 1 }], powerMult: 0.5 },
      { name: 'Khiêu Khích Hắc Ám', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'enemyAll', effects: [{ t: 'status', status: 'taunt', turns: 1, potency: 1 }], powerMult: 0.3 },
    ], 1.18),

  /* ------------------------------- REGION 2 ------------------------------- */
  mk('m_golem', 'Golem Đá Sét', 'tank', 'thunder', 2,
    { body: 'construct', skin: '#8a8f9c', hair: { color: '#5b6070', shade: '#2e323c', style: 'bald' }, eyes: { color: '#ffe066' }, outfit: { kind: 'husk', primary: '#6b7280', secondary: '#414652', accent: '#ffd93d' }, bulk: 1.6, height: 1.1, trim: { aura: '#ffe066' } },
    [dmg(1.3, 1, { name: 'Nắm Đấm Đá', element: 'thunder', procs: [{ status: 'shock', turns: 1, potency: 0, chance: 30 }] }), dmg(1.05, 1, { name: 'Địa Chấn', element: 'thunder', target: 'enemySpread' })], 1.15),
  mk('m_banshee', 'Nữ Hồn Băng Giá', 'attacker', 'ice', 2,
    { body: 'wraith', skin: '#dbe9ff', hair: { color: '#e6ecff', shade: '#9aa8c8', style: 'long' }, eyes: { color: '#63d2ff' }, outfit: { kind: 'gown', primary: '#16344f', secondary: '#2f6f96', accent: '#c9f0ff' }, bulk: 0.95, height: 1.05, trim: { aura: '#63d2ff' } },
    [dmg(1.6, 1, { name: 'Gào Thét', element: 'ice', procs: [{ status: 'freeze', turns: 1, potency: 0.25, chance: 22 }] }), dmg(1.3, 0.85, { name: 'Sương Giá Lõa', element: 'ice', target: 'enemyAll' })], 1.05),
  mk('m_aspis', 'Xà Nữ Rừng Độc', 'attacker', 'nature', 2,
    { skin: '#a8c79b', hair: { color: '#9fd06a', shade: '#43702b', style: 'wild' }, eyes: { color: '#7ee081' }, outfit: { kind: 'hide', primary: '#4c6b3f', secondary: '#2c4024', accent: '#c8f0d8' }, bulk: 1.05, height: 1, trim: { ears: 'elf', weapon: 'claw' } },
    [dmg(1.4, 1, { name: 'Nanh Độc', element: 'nature', procs: [{ status: 'poison', turns: 3, potency: 0.7, chance: 70 }] }), dmg(1.15, 0.9, { name: 'Phun Độc', element: 'nature', target: 'enemySpread' })]),
  mk('m_wardog', 'Khuyển Vệ Hoàng Gia', 'tank', 'neutral', 2,
    { body: 'beast', skin: '#b08b5a', hair: { color: '#7a5a34', shade: '#3d2c19', style: 'short' }, eyes: { color: '#ffe9a8' }, outfit: { kind: 'armor', primary: '#93a6c2', secondary: '#5a6f8f', accent: '#f5c453' }, bulk: 1.35, height: 0.9, trim: { weapon: 'claw' } },
    [dmg(1.1, 1, { name: 'Cắn Gạt', element: 'neutral', procs: [{ status: 'atkDown', turns: 2, potency: 0.12, chance: 40 }] }), { name: 'Canh Cửa', desc: '', kind: 'active', element: 'neutral', cost: 0, target: 'enemyAll', effects: [{ t: 'status', status: 'taunt', turns: 2, potency: 1 }], powerMult: 0.3 }], 1.1),
  mk('m_harpy', 'Càm Chùy Bão', 'attacker', 'thunder', 2,
    { body: 'beast', skin: '#c7a2d8', hair: { color: '#5f6dff', shade: '#242a80', style: 'wild' }, eyes: { color: '#ffd93d' }, outfit: { kind: 'hide', primary: '#4a3a6b', secondary: '#2b2140', accent: '#ffe066' }, bulk: 1, height: 1.02, trim: { wings: true, weapon: 'claw', aura: '#ffe066' } },
    [dmg(1.5, 1, { name: 'Swoosh Sét', element: 'thunder', procs: [{ status: 'shock', turns: 1, potency: 0, chance: 34 }] }), dmg(1.2, 0.8, { name: 'Lốc Điện', element: 'thunder', target: 'enemyAll' })]),
  mk('m_boss_knight', 'Hắc Kỵ Sĩ Vô Diện', 'tank', 'dark', 2,
    { skin: '#9aa0b4', hair: { color: '#2b2335', shade: '#100c18', style: 'horns' }, eyes: { color: '#ff3d68' }, outfit: { kind: 'armor', primary: '#2b2140', secondary: '#4a3670', accent: '#a855f7' }, bulk: 1.5, height: 1.16, trim: { cape: true, weapon: 'greatsword', aura: '#7c3aed' } },
    [
      dmg(1.35, 1, { name: 'Chém Vô Diện', element: 'dark', qte: 'block', qteStrictness: 0.7, procs: [{ status: 'defDown', turns: 2, potency: 0.14, chance: 50 }] }),
      { name: 'Lời Thề Hắc Ám', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'enemyAll', effects: [{ t: 'status', status: 'taunt', turns: 2, potency: 1 }, { t: 'status', status: 'defUp', turns: 2, potency: 0.2 }], powerMult: 0.4 },
      dmg(1.15, 0.95, { name: 'Hắc Diện Xoáy', element: 'dark', target: 'enemySpread' }),
    ], 1.3),

  /* ------------------------------- REGION 3 ------------------------------- */
  mk('m_ifrit', 'Ifrit Thiêu Thiên', 'attacker', 'fire', 3,
    { skin: '#ff8a5c', hair: { color: '#ff8b3d', shade: '#a3380f', style: 'wild' }, eyes: { color: '#fff3b0' }, outfit: { kind: 'hide', primary: '#8d1f34', secondary: '#4c0f1c', accent: '#ffd76b' }, bulk: 1.35, height: 1.2, trim: { aura: '#ff5a3c', weapon: 'claw', wings: true } },
    [dmg(1.7, 1, { name: 'Hoả Cầu', element: 'fire', procs: [{ status: 'burn', turns: 3, potency: 0.75, chance: 70 }] }), dmg(1.4, 0.9, { name: 'Biển Lửa', element: 'fire', target: 'enemyAll' })]),
  mk('m_lich', 'Vương Quan Tử Linh', 'support', 'dark', 3,
    { body: 'wraith', skin: '#cfd2e0', hair: { color: '#b9b3a2', shade: '#4a4640', style: 'bald' }, eyes: { color: '#a855f7' }, outfit: { kind: 'robe', primary: '#2b2140', secondary: '#4a3670', accent: '#c084fc' }, bulk: 1, height: 1.12, trim: { crown: true, weapon: 'staff', aura: '#7c3aed' } },
    [
      dmg(1.3, 1, { name: 'Chạm Tử Vong', element: 'dark', procs: [{ status: 'atkDown', turns: 2, potency: 0.18, chance: 55 }] }),
      { name: 'Sinh Khí Đánh Đổi', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'allyLowest', effects: [{ t: 'heal', power: 1.1, scale: 1 }], powerMult: 0.5 },
      { name: 'Vòng Tròn Cấm', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'enemyOne', effects: [{ t: 'status', status: 'freeze', turns: 1, potency: 0.3 }, { t: 'damage', power: 0.7, scale: 1 }], powerMult: 0.6 },
    ], 1.12),
  mk('m_drake', 'Giao Long Bão Tuyết', 'attacker', 'ice', 3,
    { body: 'dragon', skin: '#a9d8f0', hair: { color: '#e6f8ff', shade: '#5b7291', style: 'horns' }, eyes: { color: '#63d2ff' }, outfit: { kind: 'hide', primary: '#2f6f96', secondary: '#16344f', accent: '#c9f0ff' }, bulk: 1.55, height: 1.22, trim: { wings: true, weapon: 'claw', aura: '#63d2ff' } },
    [dmg(1.55, 1, { name: 'Hơi Thở Băng', element: 'ice', procs: [{ status: 'freeze', turns: 1, potency: 0.35, chance: 32 }] }), dmg(1.3, 1, { name: 'Sừng Băng', element: 'ice', target: 'enemyFront' })]),
  mk('m_thundertitan', 'Thần Sét Núi Cao', 'tank', 'thunder', 3,
    { skin: '#c7b087', hair: { color: '#ffd93d', shade: '#8a6d21', style: 'wild' }, eyes: { color: '#fff3b0' }, outfit: { kind: 'armor', primary: '#7e6423', secondary: '#4a3a12', accent: '#ffe066' }, bulk: 1.75, height: 1.28, trim: { aura: '#ffe066' } },
    [dmg(1.45, 1, { name: 'Búa Sét', element: 'thunder', procs: [{ status: 'shock', turns: 1, potency: 0, chance: 45 }], qte: 'block', qteStrictness: 0.6 }), { name: 'Tĩnh Điện Toàn Phần', desc: '', kind: 'active', element: 'thunder', cost: 0, target: 'enemyAll', effects: [{ t: 'status', status: 'shock', turns: 1, potency: 0, chance: 0 }, { t: 'damage', power: 0.95, scale: 0.8 }], powerMult: 0.7 }], 1.2),
  mk('m_archangel', 'Tổng Lãnh Thiên Thần', 'support', 'holy', 3,
    { skin: '#f6dcc8', hair: { color: '#fff3dc', shade: '#cbb79a', style: 'long' }, eyes: { color: '#ffe9a8' }, outfit: { kind: 'prayer', primary: '#f7f4ea', secondary: '#d9cdb2', accent: '#f5c453' }, bulk: 1, height: 1.15, trim: { halo: true, wings: true, weapon: 'staff' } },
    [
      dmg(1.25, 1, { name: 'Gươm Lửa Thánh', element: 'holy', procs: [{ status: 'burn', turns: 2, potency: 0.5, chance: 40 }] }),
      { name: 'Chúc Phúc', desc: '', kind: 'active', element: 'holy', cost: 0, target: 'allyAll', effects: [{ t: 'heal', power: 0.55, scale: 1 }, { t: 'status', status: 'defUp', turns: 2, potency: 0.18 }], powerMult: 0.4 },
      { name: 'Thanh Tẩy', desc: '', kind: 'active', element: 'holy', cost: 0, target: 'allyLowest', effects: [{ t: 'cleanse', scope: 'debuffs', count: 9 }, { t: 'heal', power: 0.5, scale: 1 }], powerMult: 0.3 },
    ], 1.1),
  mk('m_boss_demonking', 'Ma Vương Azgharoth', 'attacker', 'dark', 3,
    { skin: '#c05a4a', hair: { color: '#2b2335', shade: '#100c18', style: 'horns' }, eyes: { color: '#ff3d68' }, outfit: { kind: 'armor', primary: '#2b2140', secondary: '#4a3670', accent: '#ff3d68' }, bulk: 1.7, height: 1.34, trim: { wings: true, cape: true, crown: true, weapon: 'greatsword', aura: '#ff3d68' } },
    [
      dmg(1.75, 1, { name: 'Trảm Hắc Diện', element: 'dark', qte: 'block', qteStrictness: 0.85 }),
      dmg(1.5, 0.95, { name: 'Hoàng Hôn Của Loài Người', element: 'dark', target: 'enemyAll', procs: [{ status: 'burn', turns: 2, potency: 0.6, chance: 50 }], qte: 'block', qteStrictness: 0.5 }),
      { name: 'Triệu Hồi Vực Thẳm', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'allyAll', effects: [{ t: 'status', status: 'atkUp', turns: 3, potency: 0.22 }, { t: 'shield', power: 0.35, scale: 1 }], powerMult: 0.4 },
      { name: 'Ăn Mòn Linh Hồn', desc: '', kind: 'active', element: 'dark', cost: 0, target: 'enemyOne', effects: [{ t: 'drain', power: 1.25, scale: 1, healPct: 60 }], powerMult: 0.8 },
    ], 1.55),
];

export const MONSTER_MAP: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

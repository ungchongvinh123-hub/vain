import type { StageDef } from '../types';
import { GEAR_BY_RARITY } from './gear';

/**
 * 10 stages across 3 regions. Drop rates rise per region:
 *  R-region: mostly R  |  II: R/SR  |  III: R/SR/SSR
 */
function table(region: 1 | 2 | 3) {
  const w = region === 1
    ? { R: 82, SR: 16, SSR: 2 }
    : region === 2
      ? { R: 62, SR: 30, SSR: 8 }
      : { R: 42, SR: 40, SSR: 18 };
  const out: { gearId: string; weight: number }[] = [];
  (['R', 'SR', 'SSR'] as const).forEach((r) => {
    const pool = GEAR_BY_RARITY[r];
    pool.forEach((g, i) => out.push({ gearId: g.id, weight: w[r] / pool.length + (i === 0 ? 0.001 : 0) }));
  });
  return out;
}

interface S { id: number; name: string; region: 1 | 2 | 3; desc: string; monsters: [string, number][]; boss?: boolean; drop?: number }

const RAW: S[] = [
  { id: 1, name: 'Bìa Rừng Sương', region: 1, desc: 'Con đường mòn ướt sương, nơi đội waifu tập phối hợp.', monsters: [['m_goblin', 1], ['m_goblin', 1], ['m_wolf', 2]] },
  { id: 2, name: 'Hang Nhện Độc', region: 1, desc: 'Mạng nhện dày tới mức ánh sáng bị mắc kẹt.', monsters: [['m_spider', 3], ['m_goblin', 3], ['m_wolf', 3], ['m_imp', 2]] },
  { id: 3, name: 'Phế Tích Làng Lửa', region: 1, desc: 'Tiểu Quỷ lửa sống trong lò rèn bỏ hoang.', monsters: [['m_imp', 4], ['m_imp', 4], ['m_spider', 5]] },
  { id: 4, name: 'Cánh Đồng Tro', region: 1, desc: 'Trận địa tiền tiêu của giáo đoàn Hắc Diện.', monsters: [['m_wolf', 6], ['m_imp', 6], ['m_goblin', 6], ['m_spider', 7]], boss: false },
  { id: 5, name: 'Vương Cung Nứt Vỡ', region: 1, boss: true, desc: 'Hắc Diện Giáo Sĩ cầm chìa khoá của cả vùng I.', monsters: [['m_boss_cult', 8], ['m_imp', 7], ['m_spider', 7]] },
  { id: 6, name: 'Hẻm Núi Sét', region: 2, desc: 'Golem đá sét ngủ trong hẻm, dậy khi có bước chân.', monsters: [['m_golem', 10], ['m_aspis', 9], ['m_harpy', 9]] },
  { id: 7, name: 'Hồ Băng Khóc', region: 2, desc: 'Nữ hồn dưới hồ hát lại tên những người đã chết đuối.', monsters: [['m_banshee', 12], ['m_banshee', 11], ['m_wardog', 12], ['m_aspis', 11]] },
  { id: 8, name: 'Thành Trú Phản nghịch', region: 2, boss: true, desc: 'Hắc Kỵ Sĩ không mặt — và không biết lùi.', monsters: [['m_boss_knight', 14], ['m_golem', 13], ['m_harpy', 13], ['m_wardog', 12]] },
  { id: 9, name: 'Vực Thẳm Cắn Nứt', region: 3, desc: 'Vực thẳm thở ra. Tránh đứng gần mép.', monsters: [['m_drake', 17], ['m_archangel', 16], ['m_lich', 16], ['m_ifrit', 17], ['m_thundertitan', 16]] },
  { id: 10, name: 'Ngai Vàng Ma Vương', region: 3, boss: true, desc: 'Trận cuối. Azgharoth đã chờ 300 năm cho đúng ngày này.', monsters: [['m_boss_demonking', 20], ['m_ifrit', 19], ['m_lich', 18], ['m_drake', 19]] },
];

export const STAGES: StageDef[] = RAW.map((s) => {
  const mult = 1 + (s.id - 1) * 0.06;
  return {
    id: s.id,
    name: s.name,
    region: s.region,
    difficulty: s.id + (s.boss ? 1 : 0),
    desc: s.desc,
    boss: s.boss,
    waves: [{ monsters: s.monsters.map(([id, level]) => ({ id, level })) }],
    reward: {
      gold: Math.round((170 + s.id * 95) * (s.boss ? 2.4 : 1) * mult),
      gem: s.boss ? 60 : 12 + Math.floor(s.id / 2) * 4,
      exp: Math.round((90 + s.id * 46) * mult),
      firstClearGold: Math.round((520 + s.id * 260) * (s.boss ? 2.2 : 1)),
    },
    drop: { chance: s.boss ? (s.region === 1 ? 0.85 : s.region === 2 ? 0.92 : 1) : s.drop ?? (0.26 + s.id * 0.03), table: table(s.region) },
  } as StageDef;
});

export const STAGE_MAP: Record<number, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const REGIONS = [
  { id: 1 as const, name: 'Vùng I — Biên Thuỳ Sương Mù', stages: [1, 2, 3, 4, 5], color: '#7dd3fc' },
  { id: 2 as const, name: 'Vùng II — Cao Nguyên Sét & Băng', stages: [6, 7, 8], color: '#a855f7' },
  { id: 3 as const, name: 'Vùng III — Ngai Vàng Hắc Ám', stages: [9, 10], color: '#ff5a3c' },
];

/* ---------------------------------- shop ---------------------------------- */

export interface ShopItem { id: string; name: string; desc: string; gold: number; kind: 'gear' | 'chest'; gearId?: string; contents?: { type: 'gear' | 'gem' | 'gold' | 'sp'; value: string | number; label: string }[]; stock: number; }

export const SHOP: ShopItem[] = [
  {
    id: 'chest_gacha', name: 'Rương Ngọc Gacha x10', kind: 'chest', gold: 8200, stock: 6,
    desc: '10 vé quay — tương đương 1000 Ngọc, tiết kiệm 180. Mở ngay lập tức.',
    contents: [{ type: 'gem', value: 1000, label: '+1000 Ngọc quay' }],
  },
  {
    id: 'chest_essence', name: 'Rương Tinh Hoa Kỹ Năng', kind: 'chest', gold: 3400, stock: 10,
    desc: '+40 Điểm Kỹ Năng chia đều cho cả đội hình đang mang.',
    contents: [{ type: 'sp', value: 40, label: '+40 Điểm Kỹ Năng' }],
  },
  { id: 'shop_w_yata', name: 'Thần Binh: Xích Đao Dạ-Xoa', kind: 'gear', gearId: 'w_kat_yata', gold: 12500, stock: 1, desc: 'SSR Đao cho Tấn Công — Execute + Hồi máu khi hạ gục + Proc Lửa.' },
  { id: 'shop_w_heaven', name: 'Thần Cung Aurum', kind: 'gear', gearId: 'w_bow_heaven', gold: 12500, stock: 1, desc: 'SSR Cung — +1 Xúc Xắc có xác suất cao, Sát thương +12%.' },
  { id: 'shop_a_aegis', name: 'Giáp: Hồn Giáp Vệ Thành', kind: 'gear', gearId: 'ar_aegis_soul', gold: 11800, stock: 1, desc: 'SSR Giáp — Giảm sát thương nhận -16%, Kháng +20, Hồi máu khi hạ gục.' },
  { id: 'shop_a_star', name: 'Giáp: Đầm Ánh Sao', kind: 'gear', gearId: 'ar_dress_starlight', gold: 11800, stock: 1, desc: 'SSR Đầm — +1 Xúc Xắc, Kháng +14, sát thương nhận -10%.' },
  { id: 'shop_c_dice', name: 'Trang Sức: Xúc Xắc Lữ Khách', kind: 'gear', gearId: 'ac_dice_gambler', gold: 10600, stock: 1, desc: 'SSR Trang Sức — +34% cơ hội +1 Xúc Xắc, Chí mạng +6.' },
  { id: 'shop_c_grail', name: 'Trang Sức: Chén Thánh Bình Minh', kind: 'gear', gearId: 'ac_grail_dawn', gold: 10600, stock: 1, desc: 'SSR — Hồi máu +26%, Hồi máu khi hạ gục +8%, Kháng +12.' },
  { id: 'shop_w_lunacy', name: 'Kiếm Cuồng Nguyệt', kind: 'gear', gearId: 'w_sword_lunacy', gold: 12800, stock: 1, desc: 'SSR Kiếm — Execute, Hút máu, Sát thương +10%.' },
  { id: 'shop_a_moon', name: 'Màn Trăng Mờ', kind: 'gear', gearId: 'ar_veil_moon', gold: 11200, stock: 1, desc: 'SSR — Proc Hắc Ám 26%, Execute 7%, Hồi máu +16%.' },
];

export const SHOP_MAP: Record<string, ShopItem> = Object.fromEntries(SHOP.map((s) => [s.id, s]));

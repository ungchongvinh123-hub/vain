import type { GearDef, Rarity, Role, EquipSlot, WeaponKind, GearPassiveId } from '../types';

/** 40+ equipment pieces. SR/SSR carry multiple passives. */

interface G {
  id: string; name: string; slot: EquipSlot; wk?: WeaponKind; rarity: Rarity; roles?: Role[] | 'all';
  hp?: number; atk?: number; def?: number; spd?: number; cr?: number; cd?: number; rs?: number;
  p?: [GearPassiveId, number, string][]; desc: string;
}

const ALL: Role[] = ['tank', 'attacker', 'support'];
const ATK: Role[] = ['attacker'];
const TNK: Role[] = ['tank'];
const SUP: Role[] = ['support'];

const RAW: G[] = [
  /* ------------------------------- WEAPONS: ATTACKER ------------------------------ */
  { id: 'w_kat_ronin', name: 'Đao Lãng Nhân', slot: 'weapon', wk: 'blade', rarity: 'R', roles: ATK, atk: 46, cr: 3, desc: 'Lưỡi dao cùn đi nhưng vẫn sắc enough để cắt cổ áo.' },
  { id: 'w_bow_frost', name: 'Cung Sương Giá', slot: 'weapon', wk: 'bow', rarity: 'R', roles: ATK, atk: 42, spd: 4, p: [['procElement', 14, 'ice']], desc: 'Mỗi phát bắn mang theo một hơi thở mùa đông.' },
  { id: 'w_sword_iron', name: 'Kiếm Sắt Đen', slot: 'weapon', wk: 'sword', rarity: 'R', roles: ATK, atk: 52, desc: 'Không đẹp, không phép, chỉ có trọng lượng.' },
  { id: 'w_kat_shirayuki', name: 'Bạch Tuyết Đao', slot: 'weapon', wk: 'blade', rarity: 'SR', roles: ATK, atk: 96, cr: 6, cd: 18, p: [['execute', 6, 'execute'], ['procElement', 20, 'ice']], desc: 'Đóng băng vết thương rồi để nó tự vỡ ra.' },
  { id: 'w_bow_storm', name: 'Cung Bão Tố', slot: 'weapon', wk: 'bow', rarity: 'SR', roles: ATK, atk: 88, spd: 8, p: [['procElement', 22, 'thunder'], ['dmgOut', 7, 'dmgOut']], desc: 'Mũi tên đi trước cả tiếng sấm.' },
  { id: 'w_dual_verdant', name: 'Song Đao Độc Mộc', slot: 'weapon', wk: 'blade', rarity: 'SR', roles: ATK, atk: 92, p: [['procElement', 26, 'nature'], ['lifesteal', 6, 'lifesteal']], desc: 'Cây độc quấn quanh cán dao từ thời chủ nhân cũ.' },
  { id: 'w_great_hell', name: 'Đại Kiếm Địa Ngục', slot: 'weapon', wk: 'greatsword', rarity: 'SR', roles: ATK, atk: 118, cd: 14, p: [['procElement', 18, 'fire'], ['dmgIn', 4, 'dmgIn']], desc: 'Nóng tới mức không ai muốn cầm hộ.' },
  { id: 'w_kat_yata', name: 'Xích Đao Dạ-Xoa', slot: 'weapon', wk: 'blade', rarity: 'SSR', roles: ATK, atk: 172, cr: 9, cd: 30, p: [['execute', 9, 'execute'], ['killHeal', 7, 'killHeal'], ['procElement', 28, 'fire']], desc: 'Thần binh rèn từ một ngôi sao rơi xuống chiến trường.' },
  { id: 'w_bow_heaven', name: 'Thiên Cung Aurum', slot: 'weapon', wk: 'bow', rarity: 'SSR', roles: ATK, atk: 158, spd: 12, cd: 24, p: [['diceBonus', 26, 'diceBonus'], ['dmgOut', 12, 'dmgOut'], ['procElement', 24, 'holy']], desc: 'Dây cung là tia sáng đóng rắn; bắn ra là một lời phán xét.' },
  { id: 'w_sword_lunacy', name: 'Kiếm Cuồng Nguyệt', slot: 'weapon', wk: 'sword', rarity: 'SSR', roles: ATK, atk: 166, cr: 11, cd: 26, p: [['execute', 8, 'execute'], ['lifesteal', 9, 'lifesteal'], ['dmgOut', 10, 'dmgOut']], desc: 'Lưỡi kiếm uống máu và trả lại bằng ánh trăng đỏ.' },
  { id: 'w_sword_dawn', name: 'Kiếm Hừng Đông', slot: 'weapon', wk: 'sword', rarity: 'SR', roles: ATK, atk: 102, p: [['dmgOut', 9, 'dmgOut'], ['procElement', 16, 'holy']], desc: 'Kẻ bị nó chém sẽ không bao giờ thấy bình minh.' },

  /* -------------------------------- WEAPONS: TANK ------------------------------- */
  { id: 'a_shd_bulwark', name: 'Khiên Thành Trú', slot: 'weapon', wk: 'shield', rarity: 'R', roles: TNK, def: 44, hp: 180, desc: 'Bề mặt dày tới mức kẻ đâm phải phải xin lỗi.' },
  { id: 'a_shd_spikes', name: 'Khiên Gai Mọc', slot: 'weapon', wk: 'shield', rarity: 'R', roles: TNK, def: 36, hp: 120, p: [['dmgOut', 6, 'dmgOut']], desc: 'Phòng thủ tốt nhất là khiến đối phương thấy đau.' },
  { id: 'a_shd_frost', name: 'Khiên Băng Bích', slot: 'weapon', wk: 'shield', rarity: 'SR', roles: TNK, def: 74, hp: 320, p: [['procElement', 22, 'ice'], ['resist', 10, 'resist']], desc: 'Hơi lạnh thoát ra làm chậm mọi cú vung gần nó.' },
  { id: 'a_shd_holy', name: 'Khiên Thánh Quang', slot: 'weapon', wk: 'shield', rarity: 'SR', roles: TNK, def: 68, hp: 300, rs: 12, p: [['resist', 14, 'resist'], ['killHeal', 5, 'killHeal']], desc: 'Bị chiếu vào là thấy xấu hổ tự nhiên.' },
  { id: 'a_gs_judge', name: 'Đại Kiếm Phán Xử', slot: 'weapon', wk: 'greatsword', rarity: 'SR', roles: TNK, atk: 74, def: 40, p: [['execute', 7, 'execute'], ['dmgOut', 8, 'dmgOut']], desc: 'Búa và kiếm là một; luật pháp cũng vậy.' },
  { id: 'a_shd_aegis', name: 'Thần Khiên Aegis', slot: 'weapon', wk: 'shield', rarity: 'SSR', roles: TNK, def: 128, hp: 640, p: [['resist', 22, 'resist'], ['diceBonus', 22, 'diceBonus'], ['procElement', 18, 'holy']], desc: 'Vị thần giữ thành để lại, kèm một lời nhắn "đừng làm nó xước".' },
  { id: 'a_gs_void', name: 'Đại Kiếm Hư Không', slot: 'weapon', wk: 'greatsword', rarity: 'SSR', roles: TNK, atk: 122, def: 86, hp: 320, p: [['execute', 8, 'execute'], ['procElement', 24, 'dark'], ['dmgOut', 9, 'dmgOut']], desc: 'Lưỡi kiếm cắt into không gian, giáp chỉ là thủ tục.' },

  /* ------------------------------- WEAPONS: SUPPORT ------------------------------ */
  { id: 's_staff_sprout', name: 'Trượng Mầm Xanh', slot: 'weapon', wk: 'staff', rarity: 'R', roles: SUP, hp: 140, atk: 30, p: [['healOut', 10, 'healOut']], desc: 'Mọc thêm lá mỗi khi chủ nhân hồi máu cho ai đó.' },
  { id: 's_tome_rime', name: 'Thư Băng Phù', slot: 'weapon', wk: 'tome', rarity: 'R', roles: SUP, atk: 38, def: 20, p: [['procElement', 14, 'ice']], desc: 'Trang sách đóng băng ngón tay người đọc — tiết kiệm trà.' },
  { id: 's_staff_tempest', name: 'Trượng Lôi Đình', slot: 'weapon', wk: 'staff', rarity: 'SR', roles: SUP, atk: 66, spd: 6, p: [['procElement', 24, 'thunder'], ['diceBonus', 16, 'diceBonus']], desc: 'Đỉnh trượng luôn tích điện, tóc người dùng thì không.' },
  { id: 's_orb_warden', name: 'Minh Châu Hộ Mệnh', slot: 'weapon', wk: 'orb', rarity: 'SR', roles: SUP, hp: 260, def: 34, p: [['healOut', 18, 'healOut'], ['resist', 10, 'resist']], desc: 'Vầng sáng nhỏ, cái khiên to.' },
  { id: 's_tome_grimoire', name: 'Ma Thư Vọng Âm', slot: 'weapon', wk: 'tome', rarity: 'SR', roles: SUP, atk: 78, cd: 10, p: [['procElement', 22, 'dark'], ['dmgOut', 8, 'dmgOut']], desc: 'Đọc to lên, câu thần chú sẽ tự sửa lỗi chính tả cho bạn.' },
  { id: 's_staff_genesis', name: 'Thánh Trượng Khởi Nguyên', slot: 'weapon', wk: 'staff', rarity: 'SSR', roles: SUP, atk: 118, hp: 380, p: [['healOut', 30, 'healOut'], ['diceBonus', 24, 'diceBonus'], ['killHeal', 6, 'killHeal']], desc: 'Người ta nói nó từng chạm vào ngày thứ bảy của tuần sáng thế.' },
  { id: 's_orb_nightfall', name: 'Hắc Nguyệt Châu', slot: 'weapon', wk: 'orb', rarity: 'SSR', roles: SUP, atk: 128, spd: 8, p: [['procElement', 30, 'dark'], ['resist', 16, 'resist'], ['dmgOut', 10, 'dmgOut']], desc: 'Bên trong là một thành phố đang ngủ.' },

  /* --------------------------------- ARMOR (body) -------------------------------- */
  { id: 'ar_leather_shadow', name: 'Đồ Da Bóng Đêm', slot: 'armor', rarity: 'R', roles: 'all', def: 26, hp: 120, spd: 4, desc: 'Mịn, dai, và gần như không phản xạ ánh sáng.' },
  { id: 'ar_cloth_traveler', name: 'Áo Choàng Lữ Khách', slot: 'armor', rarity: 'R', roles: 'all', def: 18, hp: 160, rs: 6, desc: 'Che được mưa, gió và cả ánh mắt tò mò.' },
  { id: 'ar_vest_silk', name: 'Yếm Tơ Lụa', slot: 'armor', rarity: 'R', roles: 'all', def: 14, hp: 90, spd: 6, cr: 2, desc: 'Nhẹ tới mức nhiều hiệp sĩ quên là mình đang mặc giáp.' },
  { id: 'ar_plate_maiden', name: 'Giáp Trinh Nữ', slot: 'armor', rarity: 'SR', roles: 'all', def: 58, hp: 300, rs: 8, p: [['dmgIn', -8, 'dmgIn'], ['resist', 8, 'resist']], desc: 'Khóa chặt ở eo, mở ra ở những chỗ cần mở.' },
  { id: 'ar_robe_arcanum', name: 'Lễ Phục Bí Thuật', slot: 'armor', rarity: 'SR', roles: 'all', def: 34, hp: 220, atk: 34, p: [['dmgOut', 9, 'dmgOut'], ['healOut', 10, 'healOut']], desc: 'Các ký tự trên vạt áo tự sắp xếp lại theo thời tiết phép.' },
  { id: 'ar_hide_beast', name: 'Bì Giáp Dã Thú', slot: 'armor', rarity: 'SR', roles: 'all', def: 52, hp: 340, p: [['killHeal', 6, 'killHeal'], ['critRate', 5, 'critRate']], desc: 'May từ con quái vật đầu tiên mà chủ nhân hạ được.' },
  { id: 'ar_dress_starlight', name: 'Đầm Ánh Sao', slot: 'armor', rarity: 'SSR', roles: 'all', def: 72, hp: 420, spd: 10, p: [['diceBonus', 20, 'diceBonus'], ['resist', 14, 'resist'], ['dmgIn', -10, 'dmgIn']], desc: 'Được dệt từ quỹ đạo của những vì sao đã tắt.' },
  { id: 'ar_aegis_soul', name: 'Hồn Giáp Vệ Thành', slot: 'armor', rarity: 'SSR', roles: 'all', def: 118, hp: 620, rs: 18, p: [['dmgIn', -16, 'dmgIn'], ['resist', 20, 'resist'], ['killHeal', 5, 'killHeal']], desc: 'Bên trong giáp là một lời thề cũ đang còn hiệu lực.' },
  { id: 'ar_veil_moon', name: 'Màn Trăng Mờ', slot: 'armor', rarity: 'SSR', roles: 'all', def: 60, hp: 300, atk: 62, p: [['procElement', 26, 'dark'], ['execute', 7, 'execute'], ['healOut', 16, 'healOut']], desc: 'Ai mặc nó đều trở nên đẹp một cách nguy hiểm.' },

  /* -------------------------------- ACCESSORIES ------------------------------- */
  { id: 'ac_ring_copper', name: 'Nhẫn Đồng Gốc', slot: 'accessory', rarity: 'R', roles: 'all', atk: 14, desc: 'Một vòng đồng có khắc chữ "cố lên".' },
  { id: 'ac_charm_herb', name: 'Bùa Thảo Mộc', slot: 'accessory', rarity: 'R', roles: 'all', hp: 110, rs: 8, desc: 'Ngửi thì tỉnh, đeo thì miễn nhiễm với sự mệt mỏi (tương đối).' },
  { id: 'ac_earring_frost', name: 'Khuyên Băng Giá', slot: 'accessory', rarity: 'R', roles: 'all', cr: 4, desc: 'Làm lạnh đầu óc, tăng độ chính xác.' },
  { id: 'ac_gloves_sniper', name: 'Găng Tay Xạ Thủ', slot: 'accessory', rarity: 'SR', roles: 'all', cr: 8, cd: 14, p: [['critRate', 6, 'critRate']], desc: 'Bàn tay trái luôn lạnh, bàn tay phải luôn chính xác.' },
  { id: 'ac_boots_wind', name: 'Ủng Gió Nhẹ', slot: 'accessory', rarity: 'SR', roles: 'all', spd: 14, hp: 120, p: [['diceBonus', 14, 'diceBonus']], desc: 'Đi nhanh hơn một nhịp so với phần còn lại của thế giới.' },
  { id: 'ac_pendant_guard', name: 'Mặt Dây Hộ Mệnh', slot: 'accessory', rarity: 'SR', roles: 'all', rs: 22, def: 26, p: [['resist', 16, 'resist']], desc: 'Một miếng bạc nhỏ, một lời chúc to.' },
  { id: 'ac_band_revenant', name: 'Băng Đầu Hồi Sinh', slot: 'accessory', rarity: 'SR', roles: 'all', hp: 260, p: [['killHeal', 8, 'killHeal'], ['healOut', 12, 'healOut']], desc: 'Người đeo nó hiếm khi chết ở đúng chỗ bị thương.' },
  { id: 'ac_crown_martyr', name: 'Vương Miện Tử Đạo', slot: 'accessory', rarity: 'SSR', roles: 'all', hp: 420, def: 56, p: [['execute', 8, 'execute'], ['resist', 20, 'resist'], ['dmgIn', -10, 'dmgIn']], desc: 'Gai bên trong, vinh quang bên ngoài.' },
  { id: 'ac_eye_abyss', name: 'Nhãn Cầu Vực Thẳm', slot: 'accessory', rarity: 'SSR', roles: 'all', atk: 74, cr: 10, cd: 22, p: [['procElement', 26, 'dark'], ['execute', 9, 'execute']], desc: 'Nó nhìn lại bạn. Mỗi ngày. Luôn luôn.' },
  { id: 'ac_dice_gambler', name: 'Xúc Xắc Lữ Khách', slot: 'accessory', rarity: 'SSR', roles: 'all', spd: 12, p: [['diceBonus', 34, 'diceBonus'], ['critRate', 6, 'critRate'], ['resist', 8, 'resist']], desc: 'Mặt nào cũng thắng — trừ mặt bạn cần nhất.' },
  { id: 'ac_grail_dawn', name: 'Chén Thánh Bình Minh', slot: 'accessory', rarity: 'SSR', roles: 'all', hp: 380, atk: 48, p: [['healOut', 26, 'healOut'], ['killHeal', 8, 'killHeal'], ['resist', 12, 'resist']], desc: 'Đáy chén còn đọng một buổi sáng chưa kết thúc.' },
];

export const GEAR: GearDef[] = RAW.map((g) => ({
  id: g.id,
  name: g.name,
  slot: g.slot,
  weaponKind: g.wk,
  rarity: g.rarity,
  roles: g.roles ?? ALL,
  base: {
    hp: g.hp ?? 0, atk: g.atk ?? 0, def: g.def ?? 0, spd: g.spd ?? 0,
    critRate: g.cr ?? 0, critDmg: g.cd ?? 0, resist: g.rs ?? 0,
  },
  passives: (g.p ?? []).map(([id, value, label]) => ({ id, value, label })),
  desc: g.desc,
  levelStepPct: 0.15,
}));

export const GEAR_MAP: Record<string, GearDef> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

/** gear ids by rarity, for drops & shop */
export const GEAR_BY_RARITY: Record<Rarity, GearDef[]> = {
  R: GEAR.filter((g) => g.rarity === 'R'),
  SR: GEAR.filter((g) => g.rarity === 'SR'),
  SSR: GEAR.filter((g) => g.rarity === 'SSR'),
};

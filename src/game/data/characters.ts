import type { CharacterDef, Element, Rarity, Role, SpriteSpec, WeaponKind } from '../types';

/* ------------------------------ palette helpers ------------------------------ */
const SK = {
  porcelain: '#f6dcc8', ivory: '#f2d3ba', warm: '#e8bd9c', tan: '#d9a077', olive: '#c78d63',
  dusk: '#b3765a', ash: '#cfd2e0', violetSkin: '#d8c6f0', greySkin: '#9aa0b4', moss: '#a8c79b',
} as const;

const HAIR = {
  crimson: ['#ff4d5e', '#a01f36'], raven: ['#2b2335', '#100c18'], silver: ['#e6ecff', '#9aa8c8'],
  gold: ['#ffd76b', '#c08a1e'], azure: ['#54b9ff', '#1d5f9e'], jade: ['#7cf0b0', '#1f8f62'],
  violet: ['#b98cff', '#5c2ea8'], rose: ['#ff9ec4', '#c94d7e'], ivory: ['#fff3dc', '#cbb79a'],
  ember: ['#ff8b3d', '#a3380f'], bone: ['#f2efe6', '#b9b3a2'], moss: ['#9fd06a', '#43702b'],
  black: ['#191521', '#080610'], plum: ['#d07ad0', '#6b2a6b'], steel: ['#a9c0d8', '#5b7291'],
  blood: ['#e0243f', '#7a0d1e'], white: ['#ffffff', '#cfd6ea'], indigo: ['#5f6dff', '#242a80'],
  forest: ['#3fbf7f', '#12512f'],
} as const;

const FIT = {
  leatherBlack: { primary: '#221722', secondary: '#3b2536', accent: '#ff3d68' },
  leatherWine: { primary: '#3d0f1d', secondary: '#6d1830', accent: '#ff9ec4' },
  leatherNavy: { primary: '#131a33', secondary: '#243458', accent: '#63d2ff' },
  leatherMoss: { primary: '#16281c', secondary: '#2b4a2f', accent: '#9fd06a' },
  gownViolet: { primary: '#39205e', secondary: '#65409c', accent: '#e0b3ff' },
  gownCrimson: { primary: '#4c0f1c', secondary: '#8d1f34', accent: '#ffb3a8' },
  gownIce: { primary: '#16344f', secondary: '#2f6f96', accent: '#c9f0ff' },
  gownGold: { primary: '#4a3a12', secondary: '#8a6d21', accent: '#ffe9a8' },
  gownEmerald: { primary: '#0f3a2c', secondary: '#1f6b4f', accent: '#b6f2d8' },
  plateSteel: { primary: '#93a6c2', secondary: '#5a6f8f', accent: '#dbe7ff' },
  plateRose: { primary: '#c98a95', secondary: '#7e4a58', accent: '#ffe0e8' },
  plateVoid: { primary: '#2b2140', secondary: '#4a3670', accent: '#a855f7' },
  plateSun: { primary: '#c9a34e', secondary: '#7e6423', accent: '#fff3c4' },
  plateJade: { primary: '#5f8f74', secondary: '#33543f', accent: '#c8f0d8' },
  plateFrost: { primary: '#7fb6d8', secondary: '#3f6c8c', accent: '#e6f8ff' },
  kimonoSnow: { primary: '#eef2ff', secondary: '#b9c6e0', accent: '#ff6b8a' },
  kimonoNight: { primary: '#1b2140', secondary: '#39426e', accent: '#ffd93d' },
  prayerWhite: { primary: '#f7f4ea', secondary: '#d9cdb2', accent: '#f5c453' },
  prayerGold: { primary: '#fff6dd', secondary: '#e0c07a', accent: '#b8862b' },
  prayerShadow: { primary: '#2a2233', secondary: '#4b3a5a', accent: '#c084fc' },
  robeStorm: { primary: '#243a63', secondary: '#3f5f96', accent: '#ffe066' },
  robeBlood: { primary: '#4a1220', secondary: '#7d2437', accent: '#ff8fa3' },
  robeVerdant: { primary: '#1e4030', secondary: '#356b4d', accent: '#9fd06a' },
  robeAzure: { primary: '#152f52', secondary: '#2b5c8f', accent: '#8fd8ff' },
} as const;

type ArtIn = {
  outfitKind: SpriteSpec['outfit']['kind'];
  fit: keyof typeof FIT;
  hair: keyof typeof HAIR;
  hairStyle?: SpriteSpec['hair']['style'];
  skin?: keyof typeof SK;
  eyes?: string;
  trim?: SpriteSpec['trim'];
  height?: number;
  bulk?: number;
  body?: SpriteSpec['body'];
};

function art(a: ArtIn, element: Element): SpriteSpec {
  const [color, shade] = HAIR[a.hair];
  return {
    body: a.body ?? 'waifu',
    skin: SK[a.skin ?? 'porcelain'],
    hair: { color, shade, style: a.hairStyle ?? 'long' },
    eyes: { color: a.eyes ?? '#ff7a90', lashes: true },
    outfit: { kind: a.outfitKind, ...FIT[a.fit] },
    trim: a.trim,
    height: a.height,
    bulk: a.bulk,
    element,
  };
}

/* ------------------------------- stat baseline ------------------------------- */
const BASE: Record<Role, { hp: number; atk: number; def: number; spd: number; critRate: number; critDmg: number; resist: number }> = {
  tank: { hp: 1980, atk: 132, def: 232, spd: 94, critRate: 6, critDmg: 150, resist: 32 },
  attacker: { hp: 1080, atk: 246, def: 112, spd: 118, critRate: 22, critDmg: 178, resist: 12 },
  support: { hp: 1420, atk: 168, def: 158, spd: 106, critRate: 10, critDmg: 155, resist: 24 },
};
const R_MULT: Record<Rarity, number> = { R: 1, SR: 1.12, SSR: 1.28 };
const R_SPD: Record<Rarity, number> = { R: 0, SR: 4, SSR: 9 };

const W: Record<Role, WeaponKind[]> = {
  tank: ['shield', 'greatsword'],
  attacker: ['sword', 'bow', 'blade'],
  support: ['staff', 'tome', 'orb'],
};

let SEQ = 0;
function C(
  id: string, name: string, title: string, role: Role, element: Element, rarity: Rarity,
  artIn: ArtIn, signature: { activeNames: string[]; passiveNames: string[] }, bio: string,
): CharacterDef {
  const b = BASE[role]; const m = R_MULT[rarity];
  SEQ += 1;
  return {
    id, name, title, role, element, rarity, seed: hash(id), bio,
    base: {
      hp: Math.round(b.hp * m), atk: Math.round(b.atk * m), def: Math.round(b.def * m),
      spd: b.spd + R_SPD[rarity] + (SEQ % 5), critRate: b.critRate + (rarity === 'SSR' ? 4 : rarity === 'SR' ? 2 : 0),
      critDmg: b.critDmg + (rarity === 'SSR' ? 22 : rarity === 'SR' ? 12 : 4), resist: b.resist,
    },
    art: art(artIn, element),
    signature,
    weaponKind: artIn.trim?.weapon === 'bow' ? 'bow' : artIn.trim?.weapon === 'katana' ? 'blade' : artIn.trim?.weapon === 'staff' ? 'staff' : artIn.trim?.weapon === 'tome' ? 'tome' : artIn.trim?.weapon === 'orb' ? 'orb' : artIn.trim?.weapon === 'shield' ? 'shield' : artIn.trim?.weapon === 'greatsword' ? 'greatsword' : W[role][SEQ % W[role].length],
  };
}

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/* ---------------------------------- ROSTER ---------------------------------- */

export const CHARACTERS: CharacterDef[] = [
  /* ------------------------------- TANKS (10) ------------------------------- */
  C('t_ryuka', 'Ryuka', 'Hắc Xà Khiên Cơ', 'tank', 'dark', 'SR',
    { outfitKind: 'catsuit', fit: 'leatherBlack', hair: 'raven', skin: 'porcelain', eyes: '#c084fc', hairStyle: 'pony', trim: { mask: true, aura: '#a855f7', weapon: 'shield' } },
    { activeNames: ['Xà Quyền Chấn Địa', 'Vảy Đêm Che Chở'], passiveNames: ['Giáp Độc Xà'] },
    'Sát thủ phản bội tổ chức, giờ cầm khiên che cho đồng đội thay vì dao găm sau lưng.'),
  C('t_valdis', 'Valdis', 'Băng Khiên Nữ Hiệp', 'tank', 'ice', 'R',
    { outfitKind: 'armor', fit: 'plateFrost', hair: 'silver', skin: 'ivory', eyes: '#63d2ff', hairStyle: 'braid', trim: { cape: true, weapon: 'shield' } },
    { activeNames: ['Bích Bang Băng', 'Thành Tuyết Rơi'], passiveNames: ['Hơi Thở Zero'] },
    'Giáp băng của nàng chưa từng tan, kể cả trong hoả ngục của Ma Vương.'),
  C('t_brienne', 'Brienne', 'Thiết Bích Hiệp Sĩ', 'tank', 'neutral', 'SR',
    { outfitKind: 'armor', fit: 'plateSteel', hair: 'gold', skin: 'warm', eyes: '#7aa2ff', hairStyle: 'pony', trim: { cape: true, weapon: 'greatsword' } },
    { activeNames: ['Khiêu Chiến Thiết Bảng', 'Động Đất'], passiveNames: ['Tường Thành Sống'] },
    'Người duy nhất sống sót sau 11 lần phòng thành, và cả 11 lần đều đứng ở cửa.'),
  C('t_solara', 'Solara', 'Thánh Nữ Hộ Thành', 'tank', 'holy', 'R',
    { outfitKind: 'prayer', fit: 'prayerGold', hair: 'ivory', skin: 'porcelain', eyes: '#ffd76b', trim: { halo: true, weapon: 'shield' } },
    { activeNames: ['Lời Nguyền Phản Đòn', 'Thành Quang'], passiveNames: ['Đức Tin Bất Khuất'] },
    'Khiên của nàng là thánh thư; kẻ nào đấm vào đó sẽ tự cháy tay.'),
  C('t_ammara', 'Ammara', 'Sa Mạc Thiết Vệ', 'tank', 'neutral', 'SSR',
    { outfitKind: 'armor', fit: 'plateSun', hair: 'black', skin: 'dusk', eyes: '#f5c453', hairStyle: 'braid', trim: { scarf: true, weapon: 'shield' } },
    { activeNames: ['Bão Cát Chắn Đường', 'Nghiền Sương'], passiveNames: ['Đạn Phong Hoá'] },
    'Luyện khiên bằng cách đỡ thác cát — nàng không biết lùi một bước.'),
  C('t_veraine', 'Veraine', 'Lục Sâm Thủ Hộ', 'tank', 'nature', 'R',
    { outfitKind: 'armor', fit: 'plateJade', hair: 'forest', skin: 'ivory', eyes: '#7ee081', hairStyle: 'long', trim: { ears: 'elf', weapon: 'shield' } },
    { activeNames: ['Rễ Gai Giữ Chân', 'Vỏ Cây Sắt'], passiveNames: ['Quang Hợp Thép'] },
    'Người rừng canh cửa thung lũng; rễ cây nghe thấy nàng ra lệnh.'),
  C('t_nyx', 'Nyx', 'U Minh Khiên Vũ', 'tank', 'dark', 'SSR',
    { outfitKind: 'catsuit', fit: 'leatherWine', hair: 'plum', skin: 'ash', eyes: '#e0243f', hairStyle: 'twin', trim: { wings: true, aura: '#ff3d68', weapon: 'shield' } },
    { activeNames: ['Vực Thẳm Hô Hoán', 'Áo Choàng Hắc Diện'], passiveNames: ['Giao Ước Bóng Tối'] },
    'Ma Vương từng trả giá bằng một sừng để đổi lấy khiên của nàng. Nàng từ chối.'),
  C('t_ignia', 'Ignia', 'Lực Sĩ Hoả Ngục', 'tank', 'fire', 'SR',
    { outfitKind: 'catsuit', fit: 'leatherWine', hair: 'ember', skin: 'tan', eyes: '#ff6b3d', hairStyle: 'wild', trim: { weapon: 'greatsword' } },
    { activeNames: ['Búa Nung Đỏ', 'Vành Đai Lửa'], passiveNames: ['Rèn Trong Lửa'] },
    'Nàng coi giáp địch như quặng thô, và khiên nàng như cái đe.'),
  C('t_kurenai', 'Kurenai', 'Hồng Kỳ Hộ Vệ', 'tank', 'nature', 'SR',
    { outfitKind: 'kimono', fit: 'kimonoSnow', hair: 'rose', skin: 'porcelain', eyes: '#ff4d5e', hairStyle: 'pony', trim: { weapon: 'greatsword', scarf: true } },
    { activeNames: ['Cờ Đỏ Chia Sóng', 'Tấm Khiên Giấy Dó'], passiveNames: ['Bền Như Tre'] },
    'Kiếm khách giải nghệ, giờ nàng đứng chắn trước học trò của mình.'),
  C('t_thundera', 'Thundera', 'Tĩnh Điện Hộ Vệ', 'tank', 'thunder', 'R',
    { outfitKind: 'armor', fit: 'plateRose', hair: 'indigo', skin: 'violetSkin', eyes: '#ffd93d', hairStyle: 'short', trim: { aura: '#ffe066', weapon: 'shield' } },
    { activeNames: ['Lồng Faraday', 'Sét Đánh Trả'], passiveNames: ['Dòng Điện Né'] },
    'Cơ thể nàng là dây nối đất sống: mọi tia sét đều chết dưới chân nàng.'),

  /* ------------------------------ ATTACKERS (10) ----------------------------- */
  C('a_shirayuki', 'Shirayuki', 'Bạch Tuyết Thích객', 'attacker', 'ice', 'SSR',
    { outfitKind: 'catsuit', fit: 'leatherNavy', hair: 'white', skin: 'porcelain', eyes: '#63d2ff', hairStyle: 'long', trim: { mask: true, weapon: 'katana', aura: '#63d2ff' } },
    { activeNames: ['Nguyệt Hàn Nhất Kiếm', 'Hoa Tuyết Rơi', 'Lưỡi Băng Vô Thanh'], passiveNames: ['Điểm Đóng Băng'] },
    'Nàng không thích nhiệm vụ lâu, vì mục tiêu thường tắt nguồn trước khi nàng rút kiếm.'),
  C('a_vehra', 'Vehra', 'Xích Diệm Thích Ảnh', 'attacker', 'fire', 'SR',
    { outfitKind: 'catsuit', fit: 'leatherWine', hair: 'crimson', skin: 'warm', eyes: '#ff6b3d', hairStyle: 'pony', trim: { weapon: 'katana', aura: '#ff6b3d' } },
    { activeNames: ['Đoản Đao Phá Hoả', 'Lửa Thiêu Sau Lưng', 'Nhảy Lửa'], passiveNames: ['Nhiệt Huyết'] },
    'Dao của nàng tôi bằng lửa rồng, nên vết thương không bao giờ lành.'),
  C('a_arnita', 'Arnita', 'Băng Xạ Thủ', 'attacker', 'ice', 'R',
    { outfitKind: 'armor', fit: 'plateFrost', hair: 'azure', skin: 'ivory', eyes: '#54b9ff', hairStyle: 'pony', trim: { weapon: 'bow', ears: 'elf' } },
    { activeNames: ['Tiễn Sương Mù', 'Băng Tiễn Liên Kích'], passiveNames: ['Bắn Điểm Yếu'] },
    'Nàng đếm nhịp thở của mục tiêu rồi mới bóp cò — thường là nhịp cuối.'),
  C('a_virel', 'Virel', 'Vũ Điệu Độc Nhận', 'attacker', 'nature', 'R',
    { outfitKind: 'catsuit', fit: 'leatherMoss', hair: 'moss', skin: 'olive', eyes: '#7ee081', hairStyle: 'twin', trim: { weapon: 'blade', mask: true } },
    { activeNames: ['Vũ Điệu Độc Nhận', 'Gai Độc Xoáy', 'Hoa Nở Chậm'], passiveNames: ['Huyết Độc'] },
    'Nàng là dược sư bị đuổi việc vì cho rằng mọi bệnh nhân đều nên được "an táng".'),
  C('a_raiden', 'Raiden Mai', 'Vũ Cơ Sấm', 'attacker', 'thunder', 'SR',
    { outfitKind: 'kimono', fit: 'kimonoNight', hair: 'gold', skin: 'porcelain', eyes: '#ffd93d', hairStyle: 'twin', trim: { weapon: 'blade', aura: '#ffe066' } },
    { activeNames: ['Nhát Chém Tĩnh Điện', 'Múa Quạt Sét', 'Trống Sấm'], passiveNames: ['Tần Số Cao'] },
    'Sân khấu của nàng là chiến trường; khán giả chỉ được xem một lần.'),
  C('a_lyrielle', 'Lyrielle', 'Thánh Tiễn Nữ', 'attacker', 'holy', 'SR',
    { outfitKind: 'prayer', fit: 'prayerWhite', hair: 'ivory', skin: 'ivory', eyes: '#ffe9a8', hairStyle: 'long', trim: { weapon: 'bow', halo: true, ears: 'elf' } },
    { activeNames: ['Tiễn Thánh Quang', 'Mưa Ánh Sáng', 'Lời Nguyền Chẻ Đôi'], passiveNames: ['Mắt Diều Hâu'] },
    'Nàng thề chỉ bắn vào kẻ đáng chết — nên danh sách của nàng rất dài.'),
  C('a_eris', 'Eris', 'Hắc Dực Tiễn Linh', 'attacker', 'dark', 'SSR',
    { outfitKind: 'catsuit', fit: 'leatherBlack', hair: 'violet', skin: 'violetSkin', eyes: '#a855f7', hairStyle: 'long', trim: { weapon: 'bow', wings: true, aura: '#a855f7' } },
    { activeNames: ['Tiễn Vong Nhạc', 'Đạn Hắc Nguyệt', 'Bầy Quạ Kêu'], passiveNames: ['Vết Thương Không Lành'] },
    'Fallen angel chuyên nghề săn fallen angel — nàng rõ đồng nghiệp hơn ai hết.'),
  C('a_kaze', 'Kaze', 'Phong nhận Vô Danh', 'attacker', 'neutral', 'R',
    { outfitKind: 'catsuit', fit: 'leatherNavy', hair: 'steel', skin: 'tan', eyes: '#c9c6d6', hairStyle: 'short', trim: { weapon: 'katana', scarf: true } },
    { activeNames: ['Đoản Đao Vô Danh', 'Cắt Gió', 'Bóng Transfer'], passiveNames: ['Im Lặng Tuyệt Đối'] },
    'Hồ sơ của nàng trống trơn, kể cả họ tên — "Kaze" là do đồng đội đặt tạm.'),
  C('a_pyralis', 'Pyralis', 'Hoả Vũ Cơ', 'attacker', 'fire', 'R',
    { outfitKind: 'gown', fit: 'gownCrimson', hair: 'ember', skin: 'tan', eyes: '#ff8b3d', hairStyle: 'wild', trim: { weapon: 'blade', aura: '#ff5a3c' } },
    { activeNames: ['Quạt Lửa Xoáy', 'Nhảy Múa Trên Tro', 'Pháo Hoa Kín'], passiveNames: ['Nhiệt Lượng Dồi Dào'] },
    'Nàng tin rằng một điệu múa không cháy thì chưa đủ cảm xúc.'),
  C('a_morgana', 'Morgana', 'Đêm Dài Lưỡi Hái', 'attacker', 'dark', 'SR',
    { outfitKind: 'gown', fit: 'gownViolet', hair: 'raven', skin: 'ash', eyes: '#c084fc', hairStyle: 'long', trim: { weapon: 'blade', aura: '#7c3aed' } },
    { activeNames: ['Lưỡi Hái Đêm Dài', 'Vết Cắt Linh Hồn', 'Mồ Cưới'], passiveNames: ['Thu Hoạch Gần'] },
    'Nàng mang theo một cuốn sổ nhỏ, ghi tên những kẻ còn sống quá lâu.'),

  /* ------------------------------ SUPPORTS (10) ------------------------------ */
  C('s_lumina', 'Lumina', 'Quang Trị Liệu Sư', 'support', 'holy', 'R',
    { outfitKind: 'prayer', fit: 'prayerWhite', hair: 'ivory', skin: 'porcelain', eyes: '#ffe9a8', trim: { halo: true, weapon: 'staff' } },
    { activeNames: ['Ánh Sáng Hồi Sinh', 'Thanh Tẩy', 'Lời Cầu Nguyện'], passiveNames: ['Tay Mẹ Hiền'] },
    'Nàng có thể gọi sáng từ bóng tối — chỉ là không gọi được cảm giác biết ơn.'),
  C('s_glacia', 'Glacia', 'Băng Pháp Nữ', 'support', 'ice', 'SR',
    { outfitKind: 'gown', fit: 'gownIce', hair: 'azure', skin: 'ivory', eyes: '#63d2ff', hairStyle: 'long', trim: { weapon: 'staff', aura: '#63d2ff' } },
    { activeNames: ['Băng Sương Hộ Thể', 'Đóng Băng Thời Gian', 'Tuyết Rơi Nhẹ'], passiveNames: ['Mát Lạnh Đầu Óc'] },
    'Phù thuỷ băng, chuyên hạ sốt bằng cách đóng băng luôn con virus.'),
  C('s_umbra', 'Umbra', 'Bóng Ma Y Thuật', 'support', 'dark', 'R',
    { outfitKind: 'robe', fit: 'robeBlood', hair: 'black', skin: 'greySkin', eyes: '#a855f7', hairStyle: 'hood', trim: { hood: true, weapon: 'tome', aura: '#7c3aed' } },
    { activeNames: ['Hồi Sinh Hắc Ám', 'Đánh Đổi Sinh Khí', 'Lời Nguyền Chữa Lành'], passiveNames: ['Y Thuật Cấm'] },
    'Nàng chữa bệnh bằng cách nói chuyện với cái chết, và cái chết luôn nghe máy.'),
  C('s_felix', 'Felix', 'Sấm Đồng Hành', 'support', 'thunder', 'SR',
    { outfitKind: 'robe', fit: 'robeStorm', hair: 'gold', skin: 'warm', eyes: '#ffd93d', hairStyle: 'short', trim: { weapon: 'orb', aura: '#ffe066' } },
    { activeNames: ['Tia Chạy Sóng', 'Khuếch Đại', 'Sạc Đồng Đội'], passiveNames: ['Pin Con Người'] },
    'Cựu thợ điện của tháp phép, giờ làm "nguồn dự phòng" cho cả đội.'),
  C('s_verdania', 'Verdania', 'Thảo Mộc Y Sư', 'support', 'nature', 'R',
    { outfitKind: 'robe', fit: 'robeVerdant', hair: 'jade', skin: 'moss', eyes: '#7ee081', hairStyle: 'braid', trim: { ears: 'elf', weapon: 'staff' } },
    { activeNames: ['Vườn Thuốc Sống', 'Khử Độc', 'Hương Thơm Tỉnh Thức'], passiveNames: ['Lương Y Tự Tại'] },
    'Nàng tin mọi loại độc chỉ là thuốc uống sai liều — kể cả độc của chính mình.'),
  C('s_nyxia', 'Nyxia', 'Thánh Ca Y Nữ', 'support', 'holy', 'SSR',
    { outfitKind: 'prayer', fit: 'prayerGold', hair: 'gold', skin: 'porcelain', eyes: '#fff3c4', hairStyle: 'twin', trim: { halo: true, wings: true, weapon: 'staff' } },
    { activeNames: ['Thánh Ca Hồi Sinh', 'Vòng Tay Bất Tử', 'Ngàn Cánh Chắn'], passiveNames: ['Ân Sủng Tràn Ngập'] },
    'Hát hay tới mức thương binh quên cả đau — và cũng không nhớ mình đang ở đâu.'),
  C('s_seleste', 'Seleste', 'Thuỷ Tinh Pháp Sư', 'support', 'neutral', 'SR',
    { outfitKind: 'robe', fit: 'robeAzure', hair: 'silver', skin: 'ivory', eyes: '#8fd8ff', hairStyle: 'pony', trim: { weapon: 'orb' } },
    { activeNames: ['Thấu Kính', 'Lăng Trụ Phản Xạ', 'Bùa Trong Suốt'], passiveNames: ['Tiên Đoán'] },
    'Quả cầu của nàng dự đoán tương lai chính xác 90% — 10% còn lại nàng không kể.'),
  C('s_hibiki', 'Hibiki', 'Âm Bộ Vũ Cơ', 'support', 'nature', 'R',
    { outfitKind: 'kimono', fit: 'kimonoSnow', hair: 'rose', skin: 'ivory', eyes: '#ff9ec4', hairStyle: 'twin', trim: { weapon: 'staff', scarf: true } },
    { activeNames: ['Trống Nhịp Hồi Sinh', 'Vũ Điệu Chữa Lành', 'Tiếng Hát Ru'], passiveNames: ['Nhịp Điệu Chuẩn'] },
    'Nàng giữ nhịp cho cả đội, kể cả khi cả đội đang chạy trốn.'),
  C('s_laveille', 'Lavéille', 'Hoả Lô Phù Thuỷ', 'support', 'fire', 'SR',
    { outfitKind: 'gown', fit: 'gownGold', hair: 'crimson', skin: 'warm', eyes: '#ff8b3d', hairStyle: 'braid', trim: { weapon: 'tome', aura: '#ff6b3d' } },
    { activeNames: ['Lò Rèn Ấm Áp', 'Tàn Hỏa Tái Sinh', 'Phù chú Cháy'], passiveNames: ['Giữ Ấm'] },
    'Phù thuỷ luyện đan bằng lửa địa ngục — đan nào cũng hơi khét.'),
  C('s_morrigan', 'Morrigan', 'Tử Vong Tiên Tri', 'support', 'dark', 'SSR',
    { outfitKind: 'gown', fit: 'gownViolet', hair: 'violet', skin: 'ash', eyes: '#c084fc', hairStyle: 'long', trim: { weapon: 'orb', crown: true, aura: '#a855f7' } },
    { activeNames: ['Tiên Tri Tử Vong', 'Cát Sổ Mệnh', 'Lời Nguyền Đảo Ngược'], passiveNames: ['Nhìn Thấu Cái Chết'] },
    'Nàng biết trước ngày mình chết, và chọn ngày đó là ngày Ma Vương gục ngã.'),
];

export const CHAR_MAP: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

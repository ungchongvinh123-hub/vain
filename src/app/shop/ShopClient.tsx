'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Panel, Btn, Chip, SectionTitle, RarityBadge } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useGame } from '../../store/game';
import { GEAR_MAP } from '../../game/data/gear';
import { PASSIVE_TEXT } from '../roster/CharDetail';
import { audio } from '../../game/audio/synth';
import { apiFetch } from '../../game/offline/fetch';

interface ShopItemView { id: string; name: string; desc: string; gold: number; kind: 'gear' | 'chest'; gearId?: string; stock: number; bought: number; soldOut: boolean }

export function ShopClient() {
  const snap = useGame((s) => s.snapshot)!;
  const post = useGame((s) => s.post);
  const busy = useGame((s) => s.busy);
  const router = useRouter();
  const [items, setItems] = useState<ShopItemView[]>([]);

  const load = async () => {
    const res = await apiFetch('/api/shop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const j = await res.json();
    if (j?.ok) setItems(j.data.items as ShopItemView[]);
  };
  useEffect(() => { void load(); }, []);

  const buy = async (it: ShopItemView) => {
    if (it.soldOut || snap.gold < it.gold) { audio().sfx('error'); return; }
    const res = await post('/api/shop', { itemId: it.id });
    if (res.ok) { audio().sfx('coin'); void load(); }
  };

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_320px] gap-2.5 p-2.5">
      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle right={<Chip tone="gold">{snap.gold.toLocaleString('vi-VN')} Vàng</Chip>}>Cửa Hàng Thần Bí</SectionTitle>
        <p className="mb-2 text-[10.5px] leading-snug text-white/45">
          Định giá cố tình rất cao — đây là mục tiêu dài hạn cho việc cày Vàng từ 10 ải. Mỗi món SSR ở đây đều mang
          <b className="text-violet-200"> 2–3 nội tại</b> cộng lại (chốt đơn, hồi máu khi hạ gục, proc nguyên tố, +1 xúc xắc…).
        </p>
        <div className="thin-scroll -mr-1 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pr-1">
          {items.map((it) => {
            const g = it.gearId ? GEAR_MAP[it.gearId] : null;
            const afford = snap.gold >= it.gold && !it.soldOut;
            return (
              <motion.div key={it.id} layout className={`relative overflow-hidden rounded-xl border p-2.5 ${it.soldOut ? 'border-white/8 bg-black/40 opacity-55' : afford ? 'border-gild/45 bg-gild/[.05]' : 'border-white/12 bg-black/35'}`}>
                <div className="flex items-start gap-2">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/15 bg-black/50">
                    <Icon name={it.kind === 'chest' ? 'bag' : 'sword'} size={26} color={it.kind === 'chest' ? '#c084fc' : '#f5c453'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {g && <RarityBadge rarity={g.rarity} size="sm" />}
                      <span className="truncate text-[12.5px] font-bold text-white/90">{it.name}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/50">{it.desc}</p>
                  </div>
                </div>
                {g && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex flex-wrap gap-1 text-[9.5px] text-white/60">
                      {Object.entries(g.base).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => (
                        <span key={k} className="rounded border border-white/12 bg-white/5 px-1 py-[1px]">
                          {({ hp: 'Máu', atk: 'Công', def: 'Thủ', spd: 'Tốc', critRate: 'Chí mạng', critDmg: 'STCM', resist: 'Kháng' } as Record<string, string>)[k]} +{v}
                        </span>
                      ))}
                    </div>
                    {g.passives.map((p) => (
                      <div key={p.id} className="flex items-center gap-1 text-[9.5px] text-violet-100"><Icon name="star" size={9} color="#c4b5fd" />{PASSIVE_TEXT(p.id, p.value)}</div>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center gap-1 font-display text-[16px] font-black text-amber-200">
                    <Icon name="coin" size={13} color="#f5c453" /> {it.gold.toLocaleString('vi-VN')}
                  </span>
                  {it.stock > 0 && <span className="text-[9px] text-white/40">còn {Math.max(0, it.stock - it.bought)}/{it.stock}</span>}
                  <Btn size="sm" tone={it.soldOut ? 'ghost' : 'gold'} className="ml-auto" disabled={!afford || busy} onClick={() => void buy(it)}>
                    {it.soldOut ? 'HẾT HÀNG' : 'MUA'}
                  </Btn>
                </div>
              </motion.div>
            );
          })}
          {!items.length && <div className="col-span-2 py-10 text-center text-[12px] text-white/35">đang mở cửa hàng…</div>}
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle>Kiếm Vàng</SectionTitle>
        <ul className="space-y-1.5 text-[10.5px] leading-snug text-white/55">
          <li>• Ải thường: <b className="text-amber-200">~250–1000 Vàng</b>/lần, thắng lại được farm.</li>
          <li>• Clear ải lần đầu: thưởng <b className="text-amber-200">gấp 2–3×</b> + 80 Ngọc.</li>
          <li>• Boss (ải 5, 8, 10): vàng gấp 2.4× và 100% rơi trang bị.</li>
          <li>• Rơi trang bị: 26% ở Vùng I tới 100% ở boss Vùng III, tỉ lệ SR/SSR tăng theo vùng.</li>
          <li>• Tháo bán? Chưa — nhưng <b>thả tướng trùng</b> sẽ hoàn 120+ Vàng.</li>
        </ul>
        <div className="mt-auto flex flex-col gap-1.5">
          <Btn tone="green" onClick={() => router.push('/stages')}>Đi cày ải</Btn>
          <Btn tone="violet" onClick={() => router.push('/gacha')}>Dùng Ngọc quay Gacha</Btn>
        </div>
      </Panel>
    </div>
  );
}

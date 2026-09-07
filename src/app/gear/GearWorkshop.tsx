'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Panel, Btn, Chip, SectionTitle, RarityBadge, Bar } from '../../components/ui';
import { Icon, ELEMENT_COLORS } from '../../components/Icon';
import { Sprite } from '../../components/Sprite';
import { useGame } from '../../store/game';
import { CHAR_MAP } from '../../game/data/characters';
import { GEAR_MAP } from '../../game/data/gear';
import { characterCombat } from '../../game/systems/stats';
import { PASSIVE_TEXT } from '../roster/CharDetail';
import { MAX_GEAR_PLUS, ROLE_META, gearUpgradeCost } from '../../game/data/constants';
import type { EquipSlot, OwnedGear } from '../../game/types';
import { audio } from '../../game/audio/synth';

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: 'Vũ Khí', armor: 'Giáp', accessory: 'Trang Sức' };

export function GearWorkshop() {
  const snap = useGame((s) => s.snapshot)!;
  const post = useGame((s) => s.post);
  const busy = useGame((s) => s.busy);
  const router = useRouter();
  const [slot, setSlot] = useState<EquipSlot>('weapon');
  const [selected, setSelected] = useState<number | null>(null);

  const items = useMemo(() => snap.gear.filter((g) => GEAR_MAP[g.gearId]?.slot === slot)
    .sort((a, b) => b.plus - a.plus || rankOf(b) - rankOf(a)), [snap.gear, slot]);
  const equipped = useMemo(() => {
    const m = new Map<number, { gear: OwnedGear; ocId: number }>();
    for (const g of snap.gear) if (g.equippedBy != null) m.set(g.equippedBy, { gear: g, ocId: g.equippedBy });
    return m;
  }, [snap.gear]);
  const sel = selected != null ? snap.gear.find((g) => g.instanceId === selected) ?? null : null;
  const selDef = sel ? GEAR_MAP[sel.gearId] : null;

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_360px] gap-2.5 p-2.5">
      {/* ------------------------------- slots list ------------------------------ */}
      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle right={<Chip tone="gold">{snap.gold.toLocaleString('vi-VN')} Vàng</Chip>}>Kho Vũ Khí</SectionTitle>
        <div className="mb-2 flex gap-1">
          {(['weapon', 'armor', 'accessory'] as EquipSlot[]).map((s) => (
            <button key={s} type="button" onClick={() => { audio().sfx('ui'); setSlot(s); setSelected(null); }}
              className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-bold uppercase tracking-wide ${slot === s ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/45'}`}>
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="thin-scroll -mr-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {items.map((g) => {
            const d = GEAR_MAP[g.gearId];
            const owner = g.equippedBy != null ? snap.owned.find((o) => o.instanceId === g.equippedBy) : null;
            const cap = g.equippedBy != null ? Math.min(MAX_GEAR_PLUS, owner?.level ?? 1) : 3;
            return (
              <button
                key={g.instanceId}
                type="button"
                onClick={() => { setSelected(g.instanceId); audio().sfx('select'); }}
                className={`relative w-full overflow-hidden rounded-lg border p-1.5 text-left transition ${selected === g.instanceId ? 'border-gild bg-gild/[.08]' : 'border-white/12 bg-black/35 hover:border-white/30'}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="grid h-8 w-8 place-items-center rounded-md border border-white/15 bg-black/40">
                    <Icon name={gearIcon(d.weaponKind ?? d.slot)} size={16} color={ELEMENT_COLORS[d.passives.find((p) => p.id === 'procElement')?.label as never] ?? '#cfc7e8'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-bold text-white/90">{d.name}</span>
                    <span className="block text-[9px] text-white/45">
                      {d.roles === 'all' ? 'mọi class' : (d.roles as string[]).map((r) => ROLE_META[r as 'tank'].vn).join('/')}
                    </span>
                  </span>
                  <span className="text-[13px] font-black text-amber-200">+{g.plus}</span>
                  <RarityBadge rarity={d.rarity} size="sm" />
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {owner && <Chip tone="green"><Sprite defId={owner.charId} pose="idle" style={{ height: 14 }} className="pointer-events-none" />{CHAR_MAP[owner.charId].name}</Chip>}
                  {g.plus < cap
                    ? <Chip tone="gold">lên +{g.plus + 1}: {gearUpgradeCost(g.plus, d.rarity).gold.toLocaleString('vi-VN')}v</Chip>
                    : <Chip tone="red">{g.equippedBy != null ? `kênh cấp ${owner?.level ?? 1}` : 'cần mặc để +4+'}</Chip>}
                </div>
              </button>
            );
          })}
          {!items.length && <div className="py-8 text-center text-[11px] text-white/35">chưa có món nào — đánh ải để rơi trang bị</div>}
        </div>
      </Panel>

      {/* -------------------------------- forge --------------------------------- */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="relative min-h-0 flex-1 overflow-hidden p-3">
          {sel && selDef ? (
            <>
              <div className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 50% 20%, ${RARITY_COLOR[selDef.rarity]}1f, transparent 70%)` }} />
              <div className="relative flex items-start gap-3">
                <div className="grid h-[112px] w-[112px] shrink-0 place-items-center rounded-xl border border-white/15 bg-black/50">
                  <Icon name={gearIcon(selDef.weaponKind ?? selDef.slot)} size={62} color={RARITY_COLOR[selDef.rarity]} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <RarityBadge rarity={selDef.rarity} />
                    <span className="text-[15px] font-black text-white">{selDef.name}</span>
                    <span className="font-display text-[20px] text-gild">+{sel.plus}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] italic leading-snug text-white/50">{selDef.desc}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                    {Object.entries(selDef.base).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => {
                      const scaled = Math.round((v ?? 0) * (1 + sel.plus * 0.15));
                      return (
                        <div key={k} className="flex items-center gap-1">
                          <span className="text-white/45">{({ hp: 'Máu', atk: 'Công', def: 'Thủ', spd: 'Tốc', critRate: 'Chí mạng', critDmg: 'ST chí mạng', resist: 'Kháng' } as Record<string, string>)[k]}</span>
                          <b className="text-white/90">+{scaled}</b>
                          {sel.plus > 0 && <span className="text-[9px] text-emerald-300">(+{Math.round(sel.plus * 15)}%)</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="relative mt-2">
                <div className="mb-1 text-[9px] uppercase tracking-[.22em] text-violet-300/80">Đa nội tại ({selDef.passives.length})</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {selDef.passives.map((p) => (
                    <div key={p.id} className="rounded-lg border border-violet-400/25 bg-violet-400/[.07] p-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-violet-100">
                        <Icon name={passiveIcon(p.id)} size={13} color="#c4b5fd" /> {PASSIVE_TEXT(p.id, p.value)}
                      </div>
                      {p.id === 'procElement' && <div className="mt-0.5 text-[9.5px] text-white/50">proc hệ <b style={{ color: ELEMENT_COLORS[p.label as keyof typeof ELEMENT_COLORS] }}>{p.label}</b></div>}
                    </div>
                  ))}
                  {!selDef.passives.length && <div className="text-[10px] text-white/35">đồ bậc R — chỉ có chỉ số thuần</div>}
                </div>
              </div>

              <div className="relative mt-2 rounded-lg border border-white/10 bg-black/35 p-2">
                <div className="flex items-center justify-between text-[10px] text-white/55">
                  <span>Cường hóa</span>
                  <span>+{sel.plus} → <b className="text-amber-200">+{Math.min(MAX_GEAR_PLUS, sel.plus + 1)}</b> · tối đa +{MAX_GEAR_PLUS}</span>
                </div>
                <div className="mt-1"><Bar pct={sel.plus / MAX_GEAR_PLUS} color="#f5c453" height={6} glow /></div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Btn tone="gold" disabled={busy} onClick={() => { audio().sfx('forge'); void post('/api/gear', { action: 'upgrade', gearInstanceId: sel.instanceId }); }}>
                    <Icon name="gear" size={13} /> CƯỜNG HÓA · {gearUpgradeCost(sel.plus, selDef.rarity).gold.toLocaleString('vi-VN')} Vàng
                  </Btn>
                  <span className="text-[10px] text-white/45">mỗi cấp +15% chỉ số gốc · nội tại +6%</span>
                </div>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Icon name="bag" size={34} color="#4a3674" className="mx-auto" />
                <p className="mt-2 text-[12px] text-white/45">chọn một món trang bị bên trái để xem nội tại và cường hóa</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel className="p-2.5">
          <SectionTitle>Lắp Vào Tướng</SectionTitle>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const id = snap.team[i];
              const oc = id == null ? null : snap.owned.find((o) => o.instanceId === id);
              const def = oc ? CHAR_MAP[oc.charId] : null;
              const ok = sel && def && (selDef!.roles === 'all' || selDef!.roles!.includes(def.role)) && sel.plus <= (oc?.level ?? 1);
              return (
                <div key={i} className={`relative overflow-hidden rounded-lg border p-1.5 text-center ${ok ? 'border-emerald-400/50 bg-emerald-400/[.07]' : 'border-white/10 bg-black/30 opacity-70'}`}>
                  {oc && def ? (
                    <>
                      <Sprite defId={def.id} pose="idle" style={{ height: 76 }} className="pointer-events-none mx-auto" />
                      <div className="truncate text-[10px] font-bold text-white/85">{def.name}</div>
                      <div className="text-[9px] text-white/45">Lv{oc.level} · {ROLE_META[def.role].vn}</div>
                      <Btn size="sm" tone={ok ? 'green' : 'ghost'} disabled={!ok} className="mt-1 w-full !px-1"
                        onClick={() => { if (!ok) return; audio().sfx('forge'); void post('/api/gear', { gearInstanceId: sel!.instanceId, charInstanceId: oc.instanceId }); }}>
                        {ok ? 'LẮP' : (selDef!.roles !== 'all' && !selDef!.roles!.includes(def.role)) ? 'SAI CLASS' : `CẦN Lv${sel!.plus}`}
                      </Btn>
                    </>
                  ) : (
                    <div className="flex h-[122px] flex-col items-center justify-center gap-1 text-[10px] text-white/30">
                      <Icon name="plus" size={14} /> ô trống
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {sel?.equippedBy != null && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-emerald-300">đang mặc bởi {CHAR_MAP[snap.owned.find((o) => o.instanceId === sel.equippedBy!)?.charId ?? '']?.name}</span>
              <Btn size="sm" tone="danger" onClick={() => void post('/api/gear', { gearInstanceId: sel.instanceId, charInstanceId: null })}>Tháo ra</Btn>
            </div>
          )}
        </Panel>
      </div>

      {/* ------------------------------ total power ----------------------------- */}
      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle right={<Chip tone="violet">{snap.gear.length} món</Chip>}>Sức Mạnh Đội Hình</SectionTitle>
        <div className="thin-scroll -mr-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {snap.team.map((id, i) => {
            if (id == null) return null;
            const oc = snap.owned.find((o) => o.instanceId === id);
            const def = oc && CHAR_MAP[oc.charId];
            if (!oc || !def) return null;
            const c = characterCombat(oc, snap.gear);
            const slots = (['weapon', 'armor', 'accessory'] as EquipSlot[]).map((s) => {
              const gid = oc.gear[s];
              const g = gid == null ? null : snap.gear.find((x) => x.instanceId === gid);
              return { s, g, d: g ? GEAR_MAP[g.gearId] : null };
            });
            const power = c.stats.hpMax * 0.12 + c.stats.atk * 2.6 + c.stats.def * 2.1 + c.stats.critRate * 12 + c.stats.critDmg * 2.2;
            return (
              <button key={id} type="button" onClick={() => router.push(`/roster?c=${id}`)} className="w-full rounded-lg border border-white/12 bg-black/35 p-2 text-left hover:border-gild/50">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-gild">#{i + 1}</span>
                  <span className="truncate text-[11.5px] font-bold text-white/90">{def.name}</span>
                  <span className="ml-auto font-display text-[13px] text-emerald-300">{Math.round(power).toLocaleString('vi-VN')}</span>
                </div>
                <div className="mt-1 flex gap-1">
                  {slots.map(({ s, g, d }) => (
                    <span key={s} className={`flex flex-1 items-center gap-1 rounded border px-1 py-[2px] text-[9px] ${d ? 'border-white/15 bg-white/5 text-white/70' : 'border-dashed border-white/12 text-white/25'}`}>
                      <Icon name={gearIcon(d?.weaponKind ?? s)} size={10} color={d ? RARITY_COLOR[d.rarity] : undefined} />
                      {d ? `+${g?.plus ?? 0}` : 'trống'}
                    </span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1 text-[9px] text-white/50">
                  <span>HP {c.stats.hpMax}</span><span>ATK {c.stats.atk}</span><span>DEF {c.stats.def}</span><span>CR {c.stats.critRate}%</span>
                </div>
              </button>
            );
          })}
          {equipped.size === 0 && <div className="py-6 text-center text-[11px] text-white/35">chưa ai mặc gì</div>}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 rounded-lg border border-gild/25 bg-gild/[.06] p-2 text-[10px] leading-snug text-amber-100/80">
          Quy tắc nghiêm ngặt: đồ <b>chưa mặc</b> tối đa <b>+3</b>. Sau khi mặc, mức cường hóa <b>không được vượt cấp tướng</b> —
          muốn +5 thì phải luyện tướng lên Lv.5.
        </motion.div>
      </Panel>
    </div>
  );
}

const RARITY_COLOR: Record<string, string> = { R: '#7dd3fc', SR: '#c084fc', SSR: '#f5c453' };
function rankOf(g: OwnedGear) {
  const d = GEAR_MAP[g.gearId];
  return (d.rarity === 'SSR' ? 300 : d.rarity === 'SR' ? 200 : 100) + g.plus;
}
function gearIcon(kind: string) {
  if (kind === 'shield') return 'shield';
  if (kind === 'greatsword') return 'critDmg';
  if (kind === 'bow') return 'bow';
  if (kind === 'staff') return 'staff';
  if (kind === 'tome') return 'tome';
  if (kind === 'orb') return 'orb';
  if (kind === 'blade') return 'slash';
  if (kind === 'armor') return 'shield';
  if (kind === 'accessory') return 'gem';
  return 'sword';
}
function passiveIcon(id: string) {
  const map: Record<string, string> = {
    killHeal: 'revive', execute: 'execute', procElement: 'flame', diceBonus: 'dice', resist: 'resist', critRate: 'crit',
    critDmg: 'critDmg', atkPct: 'atkUp', defPct: 'defUp', hpPct: 'heart', spdPct: 'spd', dmgOut: 'slash', dmgIn: 'shield',
    healOut: 'heal', lifesteal: 'drain', costReduce: 'dice',
  };
  return map[id] ?? 'star';
}

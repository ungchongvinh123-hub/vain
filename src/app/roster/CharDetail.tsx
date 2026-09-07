'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Panel, Btn, Chip, RarityBadge, SectionTitle, Bar } from '../../components/ui';
import { Icon, ElementBadge, ELEMENT_COLORS } from '../../components/Icon';
import { Sprite, MagicCircle } from '../../components/Sprite';
import { useGame } from '../../store/game';
import { CHAR_MAP } from '../../game/data/characters';
import { GEAR_MAP } from '../../game/data/gear';
import { skillTree, passiveLevelGate, resolveEffects } from '../../game/data/skillFactory';
import { characterCombat } from '../../game/systems/stats';
import { MAX_LEVEL, MAX_LOADOUT, MAX_MANA, RARITY_META, ROLE_META, expToNext, skillUpgradeCost } from '../../game/data/constants';
import type { CharacterDef, EffectDef, EquipSlot, OwnedCharacter, OwnedGear, SkillDef } from '../../game/types';
import { audio } from '../../game/audio/synth';

const POSES: { key: 'idle' | 'attack' | 'skill' | 'hit' | 'dead'; label: string }[] = [
  { key: 'idle', label: 'IDLE' }, { key: 'attack', label: 'ATTACK' }, { key: 'skill', label: 'SKILL' },
  { key: 'hit', label: 'HIT' }, { key: 'dead', label: 'DEAD' },
];

export const STAT_VN: Record<string, string> = {
  hp: 'Máu', atk: 'Công', def: 'Thủ', spd: 'Tốc', critRate: 'Chí mạng', critDmg: 'ST chí mạng', resist: 'Kháng',
};

export function CharDetail({ instanceId }: { instanceId: number }) {
  const snap = useGame((s) => s.snapshot);
  const post = useGame((s) => s.post);
  const router = useRouter();
  const [pose, setPose] = useState<'idle' | 'attack' | 'skill' | 'hit' | 'dead'>('idle');
  const [tab, setTab] = useState<'skills' | 'gear'>('skills');
  const [pickingFor, setPickingFor] = useState<number | null>(null);

  const oc = snap?.owned.find((o) => o.instanceId === instanceId) ?? null;
  const def = oc ? CHAR_MAP[oc.charId] : undefined;
  const tree = useMemo(() => (def ? skillTree(def) : null), [def]);
  const combat = useMemo(() => (oc && snap ? characterCombat(oc, snap.gear) : null), [oc, snap]);

  if (!snap || !oc || !def || !tree || !combat) {
    return (
      <div className="grid h-full place-items-center">
        <Panel className="p-6 text-center">
          <p className="text-sm text-white/70">Không tìm thấy tướng này.</p>
          <Btn className="mt-3" onClick={() => router.push('/roster')}>Về túi tướng</Btn>
        </Panel>
      </div>
    );
  }

  const inTeam = snap.team.includes(instanceId);
  const rc = RARITY_META[def.rarity];
  const loadout = [...oc.loadout];
  const skillById = new Map(tree.all.map((s) => [s.id, s]));
  const levelOf = (id: string) => oc.skillLevels[id] ?? 0;
  const upgradeCheck = (s: SkillDef) => {
    const lv = levelOf(s.id);
    if (lv >= 5) return { ok: false, why: 'MAX' };
    if (s.kind === 'passive' && oc.level < passiveLevelGate(s)) return { ok: false, why: `Cần Lv.${passiveLevelGate(s)}` };
    if (s.requires.length && !s.requires.every((r) => levelOf(r) > 0)) return { ok: false, why: 'Cần kỹ năng trước' };
    const c = skillUpgradeCost(lv + 1);
    if (oc.sp < c.sp) return { ok: false, why: `Thiếu ${c.sp - oc.sp} SP` };
    if (snap.gold < c.gold) return { ok: false, why: 'Thiếu vàng' };
    return { ok: true, why: '' };
  };

  const gearSlots = (['weapon', 'armor', 'accessory'] as EquipSlot[]).map((slot) => {
    const id = oc.gear[slot];
    const inst = id == null ? null : snap.gear.find((g) => g.instanceId === id) ?? null;
    return { slot, inst, gdef: inst ? GEAR_MAP[inst.gearId] : null };
  });

  async function toggleSkill(s: SkillDef, remove = false) {
    const next = [...loadout];
    const i = next.indexOf(s.id);
    if (remove || i >= 0) { if (i >= 0) next[i] = null; }
    else {
      const free = next.findIndex((x) => x == null);
      if (free >= 0) next[free] = s.id; else next[next.length - 1] = s.id;
    }
    const res = await post('/api/loadout', { instanceId, loadout: next });
    if (res.ok) audio().sfx('select');
  }

  return (
    <div className="relative grid h-full grid-cols-[300px_minmax(0,1fr)_330px] gap-2.5 p-2.5">
      {/* ------------------------------- portrait ------------------------------- */}
      <Panel className="relative flex min-h-0 flex-col overflow-hidden p-2.5">
        <div className="absolute inset-0" style={{ background: `radial-gradient(90% 60% at 50% 100%, ${ELEMENT_COLORS[def.element]}22, transparent 70%)` }} />
        <div className="relative flex items-center gap-2">
          <RarityBadge rarity={def.rarity} />
          <ElementBadge element={def.element} size={20} />
          <span className="text-[10px]" style={{ color: rc.color }}>{rc.vn}</span>
          <button className="ml-auto text-[10px] text-white/45 hover:text-white" onClick={() => router.push('/roster')}>← túi</button>
        </div>
        <div className="relative mt-1">
          <h2 className="font-display text-[26px] leading-tight text-white">{def.name}</h2>
          <div className="text-[11px] text-white/50">{def.title} · {ROLE_META[def.role].vn}</div>
        </div>

        <div className="relative mt-1 flex min-h-0 flex-1 flex-col items-center justify-end">
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2"><MagicCircle element={def.element} size={230} active /></div>
          <Sprite defId={def.id} pose={pose} poseKey={pose} style={{ height: 250 }} glow={ELEMENT_COLORS[def.element]} />
        </div>
        <div className="relative mt-1 grid grid-cols-5 gap-1">
          {POSES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setPose(p.key); audio().sfx('select'); }}
              className={`rounded-md border py-1 text-[9px] font-bold tracking-wider transition ${pose === p.key ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/45 hover:border-white/30'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="relative mt-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/60">Cấp {oc.level}/{MAX_LEVEL}</span>
            <span className="text-violet-200">SP: {oc.sp}</span>
          </div>
          <Bar pct={oc.level >= MAX_LEVEL ? 1 : oc.exp / expToNext(oc.level)} color="#a855f7" height={5} />
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 text-[10.5px] text-white/70">
            <StatLine label="Máu" value={combat.stats.hpMax} icon="heal" color="#34d399" />
            <StatLine label="Công" value={combat.stats.atk} icon="sword" color="#fb7185" />
            <StatLine label="Thủ" value={combat.stats.def} icon="shield" color="#60a5fa" />
            <StatLine label="Tốc" value={combat.stats.spd} icon="spd" color="#f5c453" />
            <StatLine label="Chí mạng" value={`${combat.stats.critRate}%`} icon="crit" color="#fda4af" />
            <StatLine label="ST chí mạng" value={`${combat.stats.critDmg}%`} icon="critDmg" color="#fca5a5" />
            <StatLine label="Kháng" value={`${combat.stats.resist}%`} icon="resist" color="#c4b5fd" />
            <StatLine label="Exp cần" value={expToNext(oc.level)} icon="star" color="#94a3b8" />
          </div>
          <p className="pt-1 text-[10px] italic leading-snug text-white/40">{def.bio}</p>
        </div>
        <div className="relative mt-2 flex gap-1.5">
          <Btn size="sm" tone={inTeam ? 'danger' : 'green'} onClick={() => void post('/api/team', { instanceId, mode: inTeam ? 'remove' : 'add' })}>
            {inTeam ? 'Tháo khỏi đội' : 'Thêm vào đội'}
          </Btn>
          <Btn size="sm" tone="ghost" onClick={() => void post('/api/team', { action: 'lock', instanceId })}>Khóa</Btn>
        </div>
      </Panel>

      {/* --------------------------------- tabs -------------------------------- */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex gap-1.5">
          {(['skills', 'gear'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] transition ${tab === t ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/45 hover:text-white/80'}`}
            >
              {t === 'skills' ? `Cây Kỹ Năng (${tree.all.length})` : 'Trang Bị (3 ô)'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <Chip tone="gold">Vàng {snap.gold.toLocaleString('vi-VN')}</Chip>
            <Chip tone="violet">SP {oc.sp}</Chip>
            <Btn size="sm" tone="blue" disabled={oc.sp <= 0} onClick={() => void post('/api/skill', { action: 'auto', instanceId })}>
              Tự cộng điểm
            </Btn>
          </div>
        </div>

        {tab === 'skills' ? (
          <Panel className="flex min-h-0 flex-1 flex-col p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[.2em] text-white/45">
                12 chủ động (có đánh thường) + 8 nội tại = 20 kỹ năng · mỗi skill 5 cấp · mang tối đa {MAX_LOADOUT} vào trận
              </div>
              <div className="text-[10px] text-emerald-300">Đánh thường: miễn phí (0 xúc xắc)</div>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              {[0, 1, 2, 3, 4].map((tierIdx) => {
                const nodes = tree.actives.filter((s) => s.tier === tierIdx);
                if (!nodes.length) return null;
                return (
                  <div key={tierIdx} className="mb-2">
                    <div className="mb-1 text-[9px] uppercase tracking-[.24em] text-gild/70">Tầng {tierIdx + 1} {tierIdx === 4 && '— Tối Thượng'}</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {nodes.map((s) => (
                        <SkillNode
                          key={s.id}
                          s={s}
                          level={levelOf(s.id)}
                          locked={!upgradeCheck(s).ok && levelOf(s.id) === 0}
                          why={upgradeCheck(s).why}
                          inLoadout={loadout.includes(s.id)}
                          onUpgrade={() => { audio().sfx('forge'); void post('/api/skill', { instanceId, skillId: s.id }); }}
                          onToggle={s.cost === 0 ? undefined : () => void toggleSkill(s)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="mb-1 mt-3 text-[9px] uppercase tracking-[.24em] text-emerald-300/70">Nội tại (mở theo cấp tướng)</div>
              <div className="grid grid-cols-4 gap-1.5">
                {tree.passives.map((s) => (
                  <SkillNode
                    key={s.id}
                    s={s}
                    passive
                    level={levelOf(s.id)}
                    locked={oc.level < passiveLevelGate(s)}
                    why={oc.level < passiveLevelGate(s) ? `Cần Lv.${passiveLevelGate(s)}` : upgradeCheck(s).why}
                    inLoadout={false}
                    onUpgrade={() => { audio().sfx('buff'); void post('/api/skill', { instanceId, skillId: s.id }); }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-1.5 rounded-lg border border-white/10 bg-black/35 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-[.22em] text-white/45">Thanh kỹ năng trong trận — chạm ô để đổi</div>
              <div className="flex gap-1.5">
                {Array.from({ length: MAX_LOADOUT }).map((_, i) => {
                  const id = loadout[i];
                  const s = id ? skillById.get(id) : undefined;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPickingFor(i)}
                      className={`relative flex h-14 w-14 items-center justify-center rounded-lg border transition ${s ? 'border-white/25 bg-white/5' : 'border-dashed border-white/20 bg-black/30'}`}
                      style={{ boxShadow: s ? `inset 0 0 0 1px ${ELEMENT_COLORS[s.element]}33` : undefined }}
                    >
                      {s ? <Icon name={s.icon} size={26} color={ELEMENT_COLORS[s.element]} /> : <Icon name="plus" size={16} color="#666" />}
                      {s && <span className="absolute bottom-0 right-1 text-[8px] font-black text-amber-200">{s.cost}</span>}
                      {s && s.cost > 0 && (
                        <span
                          className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded bg-black/70 text-[9px] text-white/60 hover:text-rose-300"
                          onClick={(e) => { e.stopPropagation(); void toggleSkill(s, true); }}
                        >×</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        ) : (
          <Panel className="flex min-h-0 flex-1 flex-col p-2.5">
            <SectionTitle right={<span className="text-[10px] text-white/40">chưa mặc ≤ +3 · đã mặc ≤ cấp tướng · tối đa +15</span>}>Ba Khe Trang Bị</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {gearSlots.map(({ slot, inst, gdef }) => (
                <div key={slot} className="rounded-lg border border-white/12 bg-black/35 p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[.2em] text-white/45">
                    <Icon name={slot === 'weapon' ? 'sword' : slot === 'armor' ? 'shield' : 'gem'} size={12} /> {slot === 'weapon' ? 'Vũ Khí' : slot === 'armor' ? 'Giáp' : 'Trang Sức'}
                  </div>
                  {gdef && inst ? (
                    <>
                      <div className="flex items-center gap-1">
                        <RarityBadge rarity={gdef.rarity} size="sm" />
                        <span className="text-[13px] font-black text-amber-200">+{inst.plus}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] font-bold text-white/90">{gdef.name}</div>
                      <div className="mt-1 space-y-0.5 text-[10px] text-white/60">
                        {Object.entries(gdef.base).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span>{STAT_VN[k] ?? k}</span>
                            <b className="text-white/80">+{Math.round((v ?? 0) * (1 + inst.plus * 0.15))}</b>
                          </div>
                        ))}
                      </div>
                      {gdef.passives.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {gdef.passives.map((p) => (
                            <div key={p.id} className="rounded border border-violet-400/25 bg-violet-400/10 px-1 py-[2px] text-[9.5px] text-violet-100">
                              {PASSIVE_TEXT(p.id, p.value)}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 line-clamp-2 text-[9.5px] italic text-white/40">{gdef.desc}</p>
                      <div className="mt-1.5 flex gap-1">
                        <Btn size="sm" tone="gold" className="flex-1" onClick={() => { audio().sfx('forge'); void post('/api/gear', { action: 'upgrade', gearInstanceId: inst.instanceId }); }}>+1</Btn>
                        <Btn size="sm" tone="danger" className="flex-1" onClick={() => void post('/api/gear', { gearInstanceId: inst.instanceId, charInstanceId: null })}>Tháo</Btn>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[150px] flex-col items-center justify-center gap-1 text-[10px] text-white/35">
                      <Icon name="bag" size={18} /> chưa lắp
                      <Btn size="sm" tone="violet" onClick={() => setPickingFor(-1 - (slot === 'weapon' ? 0 : slot === 'armor' ? 1 : 2))}>Chọn đồ</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-[.22em] text-white/40">Nội tại đang có (trang bị + kỹ năng)</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(combat.mods).filter(([, v]) => typeof v === 'number' ? Math.abs(v as number) > 0.01 : !!v).map(([k, v]) => (
                  <span key={k} className="rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-[2px] text-[10px] text-violet-100">
                    {MOD_LABEL[k] ?? k}: <b>{typeof v === 'number' ? (Math.abs(v) < 1 ? v.toFixed(2) : Math.round(v)) : String(v)}</b>
                  </span>
                ))}
                {!Object.keys(combat.mods).length && <span className="text-[10px] text-white/30">chưa có nội tại nào</span>}
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* ------------------------------ right column ----------------------------- */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="min-h-0 flex-1 p-2.5">
          <SectionTitle>Diễn Giải Kỹ Năng Đã Trang Bị</SectionTitle>
          <div className="thin-scroll -mr-1 max-h-full space-y-1.5 overflow-y-auto pr-1">
            {combat.actives.map((a) => (
              <div key={a.def.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
                <div className="flex items-center gap-1.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md border" style={{ borderColor: `${ELEMENT_COLORS[a.def.element]}66`, background: `${ELEMENT_COLORS[a.def.element]}18` }}>
                    <Icon name={a.def.icon} size={15} color={ELEMENT_COLORS[a.def.element]} />
                  </span>
                  <span className="truncate text-[12px] font-bold text-white/90">{a.def.name}</span>
                  <span className="ml-auto text-[10px] font-black text-amber-200">{a.def.cost === 0 ? '0' : `${a.def.cost}⚄`}</span>
                  <span className="rounded bg-white/10 px-1 text-[9px] text-white/60">Lv{a.level}</span>
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-white/60">{a.def.desc}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {resolveEffects(a.def, a.level).map((e, i) => <EffectChip key={i} e={e} />)}
                  {a.def.qte && <span className="rounded border border-emerald-400/40 bg-emerald-400/10 px-1 py-[1px] text-[9px] text-emerald-200">QTE {a.def.qte === 'focus' ? 'TỤ LỰC' : a.def.qte === 'link' ? 'NỐI ĐIỂM' : 'TAP'}</span>}
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-[10px] text-white/45">
              Điểm xúc xắc của mỗi kỹ năng nằm trong khoảng 1–6, vì vậy dù xúc xắc ra 1 hay 2 điểm bạn vẫn luôn có kỹ năng để dùng.
              Trần Mana của mọi nhân vật là {MAX_MANA} (trang bị có thể cộng thêm 1 mặt).
            </div>
          </div>
        </Panel>
      </div>

      {/* ------------------------------ picker modal ---------------------------- */}
      <AnimatePresence>
        {pickingFor != null && (
          <PickerModal
            forSlot={pickingFor}
            charDef={def}
            skills={tree.actives}
            gearPool={snap.gear.filter((g) => {
              const gd = GEAR_MAP[g.gearId];
              if (!gd) return false;
              const wantSlot: EquipSlot = pickingFor < 0 ? (['weapon', 'armor', 'accessory'] as EquipSlot[])[-1 - pickingFor] : (['weapon', 'armor', 'accessory'] as EquipSlot[])[0];
              if (pickingFor >= 0) return false;
              if (gd.slot !== wantSlot) return false;
              if (g.equippedBy != null && g.equippedBy !== instanceId) return false;
              return gd.roles === 'all' || gd.roles.includes(def.role);
            })}
            onClose={() => setPickingFor(null)}
            onPickSkill={async (skillId) => {
              const s = skillById.get(skillId);
              setPickingFor(null);
              if (s) await toggleSkill(s);
            }}
            onPickGear={async (gearInstanceId) => {
              setPickingFor(null);
              await post('/api/gear', { gearInstanceId, charInstanceId: instanceId });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- sub-components ------------------------------ */

function PickerModal({ forSlot, charDef, skills, gearPool, onClose, onPickSkill, onPickGear }: {
  forSlot: number;
  charDef: CharacterDef;
  skills: SkillDef[];
  gearPool: OwnedGear[];
  onClose: () => void;
  onPickSkill: (id: string) => void | Promise<void>;
  onPickGear: (id: number) => void | Promise<void>;
}) {
  const isGear = forSlot < 0;
  const gearSlot = isGear ? (['weapon', 'armor', 'accessory'] as EquipSlot[])[-1 - forSlot] : null;
  return (
    <motion.div
      className="absolute inset-0 z-50 grid place-items-center bg-black/85 p-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Panel className="max-h-[80vh] w-full max-w-3xl overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-lg text-gild">
              {isGear ? `Chọn ${gearSlot === 'weapon' ? 'vũ khí' : gearSlot === 'armor' ? 'giáp' : 'trang sức'} cho ${charDef.name}` : 'Chọn kỹ năng vào thanh'}
            </h3>
            <button onClick={onClose} className="text-white/50"><Icon name="close" size={16} /></button>
          </div>
          <div className="thin-scroll grid max-h-[52vh] grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {isGear
              ? gearPool.map((g) => {
                const gd = GEAR_MAP[g.gearId];
                return (
                  <button key={g.instanceId} type="button" onClick={() => void onPickGear(g.instanceId)} className="rounded-lg border border-white/12 bg-black/40 p-2 text-left hover:border-gild/60">
                    <div className="flex items-center gap-1">
                      <RarityBadge rarity={gd.rarity} size="sm" />
                      <span className="truncate text-[12px] font-bold text-white/90">{gd.name}</span>
                      <span className="ml-auto text-[11px] font-black text-amber-200">+{g.plus}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-white/55">
                      {Object.entries(gd.base).filter(([, v]) => (v ?? 0) > 0)
                        .map(([k, v]) => `${STAT_VN[k] ?? k} +${Math.round((v ?? 0) * (1 + g.plus * 0.15))}`).join(' · ')}
                    </div>
                    {gd.passives.map((p) => <div key={p.id} className="text-[9.5px] text-violet-200">{PASSIVE_TEXT(p.id, p.value)}</div>)}
                  </button>
                );
              })
              : skills.map((s) => (
                <button key={s.id} type="button" onClick={() => void onPickSkill(s.id)} className="rounded-lg border border-white/12 bg-black/40 p-2 text-left hover:border-gild/60">
                  <div className="flex items-center gap-1">
                    <Icon name={s.icon} size={15} color={ELEMENT_COLORS[s.element]} />
                    <span className="truncate text-[11.5px] font-bold text-white/90">{s.name}</span>
                    <span className="ml-auto text-[10px] font-black text-amber-200">{s.cost}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[9.5px] text-white/50">{s.desc}</div>
                </button>
              ))}
            {(isGear ? gearPool.length === 0 : skills.length === 0) && (
              <div className="col-span-3 py-6 text-center text-[11px] text-white/40">Chưa có mục nào phù hợp — hãy cày ải hoặc mua ở Cửa Hàng Thần Bí.</div>
            )}
          </div>
        </Panel>
      </div>
    </motion.div>
  );
}

function StatLine({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <Icon name={icon} size={11} color={color} />
      <span className="text-white/45">{label}</span>
      <b className="ml-auto text-white/85">{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</b>
    </div>
  );
}

function SkillNode({ s, level, locked, why, inLoadout, onUpgrade, onToggle, passive }: {
  s: SkillDef; level: number; locked?: boolean; why?: string; inLoadout: boolean;
  onUpgrade: () => void; onToggle?: () => void; passive?: boolean;
}) {
  const cost = skillUpgradeCost(level + 1);
  return (
    <div className={`relative rounded-lg border p-1.5 transition ${inLoadout ? 'border-gild/60 bg-gild/[.07]' : passive ? 'border-emerald-400/25 bg-emerald-400/[.05]' : 'border-white/12 bg-black/35'}`}>
      <div className="flex items-center gap-1">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border" style={{ borderColor: locked ? 'rgba(255,255,255,.12)' : `${ELEMENT_COLORS[s.element]}66`, background: locked ? 'rgba(255,255,255,.03)' : `${ELEMENT_COLORS[s.element]}18` }}>
          <Icon name={s.icon} size={17} color={locked ? '#6b6680' : ELEMENT_COLORS[s.element]} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold text-white/85">{s.name}</div>
          <div className="flex items-center gap-1 text-[9px] text-white/45">
            {passive ? <span className="text-emerald-300">NỘI TẠI</span> : <span>{s.cost === 0 ? 'MIỄN PHÍ' : `${s.cost}⚄`}</span>}
            <span>· Lv{level}/5</span>
            {locked && why && <span className="truncate text-rose-300/80">· {why}</span>}
          </div>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 min-h-[24px] text-[9.5px] leading-snug text-white/50">{s.desc}</p>
      <div className="mt-1 flex gap-1">
        {!passive && onToggle && (
          <button type="button" onClick={onToggle} className={`tap-scale flex-1 rounded border px-1 py-[2px] text-[9px] font-bold ${inLoadout ? 'border-rose-400/50 text-rose-200' : 'border-emerald-400/50 text-emerald-200'}`}>
            {inLoadout ? 'Bỏ khỏi thanh' : 'Vào thanh'}
          </button>
        )}
        <button
          type="button"
          disabled={locked || level >= 5}
          onClick={onUpgrade}
          className="tap-scale flex-1 rounded border border-gild/50 bg-gild/10 px-1 py-[2px] text-[9px] font-bold text-amber-100 disabled:opacity-30"
        >
          {level >= 5 ? 'MAX' : `NÂNG · ${cost.sp}SP · ${cost.gold}v`}
        </button>
      </div>
      <div className="mt-1 flex gap-[2px]">
        {Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-[3px] flex-1 rounded-full" style={{ background: i < level ? 'linear-gradient(90deg,#ffe9a8,#c08a1e)' : 'rgba(255,255,255,.12)' }} />)}
      </div>
    </div>
  );
}

function EffectChip({ e }: { e: EffectDef }) {
  const label = (() => {
    switch (e.t) {
      case 'damage': return `DMG ${Math.round(e.power * 100)}%`;
      case 'heal': return `HỒI ${Math.round(e.power * 100)}%`;
      case 'shield': return `KHIÊN ${Math.round(e.power * 100)}%`;
      case 'status': return `${statusVN(e.status)} ${e.turns}L · ${Math.round(e.potency * 100)}%`;
      case 'cleanse': return 'THANH TẨY';
      case 'dispel': return 'GỠ BUFF';
      case 'revive': return `HỒI SINH ${e.healPct}%`;
      case 'drain': return `HÚT MÁU ${Math.round(e.power * 100)}%`;
      default: return (e as { t: string }).t;
    }
  })();
  return <span className="rounded border border-white/15 bg-white/5 px-1 py-[1px] text-[9px] text-white/65">{label}</span>;
}

export function statusVN(k: string) {
  return ({ burn: 'Thiêu đốt', poison: 'Ngộ độc', freeze: 'Đóng băng', shock: 'Tê liệt', regen: 'Hồi máu', shield: 'Khiên', taunt: 'Khiêu khích', atkUp: 'Công+', defUp: 'Thủ+', atkDown: 'Công−', defDown: 'Thủ−' } as Record<string, string>)[k] ?? k;
}
const MOD_LABEL: Record<string, string> = {
  atkPct: 'Công %', defPct: 'Thủ %', hpPct: 'Máu %', spdPct: 'Tốc %', critRate: 'Chí mạng', critDmg: 'STCM', resist: 'Kháng',
  diceBonus: '+1 Xúc Xắc %', lifesteal: 'Hút máu %', dmgOut: 'ST gây ra %', dmgIn: 'ST nhận %', healOut: 'Hồi máu %',
  execute: 'Chốt đơn %', killHeal: 'Hồi khi hạ %', procElement: 'Nội tại hệ', procChance: 'Proc %', skillCostReduce: 'Giảm phí',
};
export function PASSIVE_TEXT(id: string, v: number) {
  const sign = v < 0 ? '−' : '+';
  const n = Math.abs(Math.round(v));
  switch (id) {
    case 'killHeal': return `Hồi ${sign}${n}% Máu tối đa khi hạ gục`;
    case 'execute': return `Chốt đơn mục tiêu dưới ${n}% Máu`;
    case 'diceBonus': return `${n}% cơ hội +1 Điểm Xúc Xắc`;
    case 'resist': return `Kháng hiệu ứng ${sign}${n}%`;
    case 'critRate': return `Tỉ lệ chí mạng ${sign}${n}%`;
    case 'critDmg': return `Sát thương chí mạng ${sign}${n}%`;
    case 'procElement': return `Xác suất gây hiệu ứng hệ kèm theo`;
    case 'healOut': return `Kỹ năng hồi máu ${sign}${n}%`;
    case 'lifesteal': return `Hút máu ${sign}${n}% sát thương`;
    case 'dmgOut': return `Sát thương gây ra ${sign}${n}%`;
    case 'dmgIn': return `Sát thương nhận vào ${sign}${n}%`;
    case 'atkPct': return `Công ${sign}${n}%`;
    case 'defPct': return `Thủ ${sign}${n}%`;
    case 'hpPct': return `Máu ${sign}${n}%`;
    case 'spdPct': return `Tốc ${sign}${n}%`;
    default: return `${id} ${sign}${n}`;
  }
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Panel, Btn, Chip, SectionTitle, RarityBadge, Bar } from '../../components/ui';
import { Icon, ElementBadge, ELEMENT_COLORS } from '../../components/Icon';
import { Sprite, MagicCircle } from '../../components/Sprite';
import { useGame } from '../../store/game';
import { STAGES, REGIONS } from '../../game/data/stages';
import { MONSTER_MAP } from '../../game/data/monsters';
import { GEAR_MAP } from '../../game/data/gear';
import { ROLE_META, elementMult } from '../../game/data/constants';
import type { Element } from '../../game/types';
import { audio } from '../../game/audio/synth';
import { apiFetch } from '../../game/offline/fetch';

interface StageView {
  id: number; name: string; region: 1 | 2 | 3; boss: boolean; desc: string; difficulty: number;
  reward: { gold: number; gem: number; exp: number; firstClearGold: number }; dropChance: number;
  monsters: { id: string; level: number }[]; unlocked: boolean;
}

export function StageList() {
  const snap = useGame((s) => s.snapshot)!;
  const router = useRouter();
  const [rows, setRows] = useState<StageView[]>([]);
  const [sel, setSel] = useState<number>(Math.max(1, Math.min(10, snap.stageProgress)));

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await apiFetch('/api/stage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await res.json();
      if (alive && j?.ok) setRows(j.data.stages as StageView[]);
    })();
    return () => { alive = false; };
  }, []);

  const view: StageView[] = rows.length ? rows : STAGES.map((s) => ({
    id: s.id, name: s.name, region: s.region, boss: !!s.boss, desc: s.desc, difficulty: s.difficulty,
    reward: s.reward, dropChance: s.drop.chance, monsters: s.waves[0].monsters.map((m) => ({ id: m.id, level: m.level })),
    unlocked: s.id <= snap.stageProgress,
  }));
  const cur = view.find((v) => v.id === sel) ?? view[0];

  const enemyElements = useMemo(() => {
    if (!cur) return [] as { element: Element; n: number }[];
    const m = new Map<Element, number>();
    for (const mo of cur.monsters) {
      const e = MONSTER_MAP[mo.id]?.element ?? 'neutral';
      m.set(e, (m.get(e) ?? 0) + 1);
    }
    return [...m.entries()].map(([element, n]) => ({ element, n })).sort((a, b) => b.n - a.n);
  }, [cur]);

  /** which elements counter anything present in this stage */
  const counters = useMemo(() => {
    if (!cur) return [];
    const foeEls = new Set(cur.monsters.map((m) => MONSTER_MAP[m.id]?.element ?? 'neutral'));
    const good = new Set<Element>();
    (['fire', 'ice', 'thunder', 'nature', 'holy', 'dark', 'neutral'] as Element[]).forEach((mine) => {
      foeEls.forEach((fe) => { if (elementMult(mine, fe) > 1) good.add(mine); });
    });
    return [...good];
  }, [cur]);

  const dropTable = useMemo(() => {
    if (!cur) return [];
    const st = STAGES.find((s) => s.id === cur.id)!;
    const total = st.drop.table.reduce((a, b) => a + b.weight, 0);
    const byRarity: Record<string, { w: number; ids: string[] }> = {};
    for (const row of st.drop.table) {
      const g = GEAR_MAP[row.gearId];
      if (!g) continue;
      byRarity[g.rarity] = byRarity[g.rarity] ?? { w: 0, ids: [] };
      byRarity[g.rarity].w += row.weight;
      byRarity[g.rarity].ids.push(g.id);
    }
    return (['SSR', 'SR', 'R'] as const).map((r) => ({
      rarity: r, pct: byRarity[r] ? (byRarity[r].w / total) * 100 : 0, ids: byRarity[r]?.ids ?? [],
    }));
  }, [cur]);

  if (!cur) return null;

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_320px] gap-2.5 p-2.5">
      {/* ------------------------------- stage map ------------------------------ */}
      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle right={<Chip tone="gold">Ải {snap.stageProgress}/10</Chip>}>Bản Đồ Chiến Dịch</SectionTitle>
        <div className="thin-scroll -mr-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {REGIONS.map((r) => (
            <div key={r.id}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="h-3 w-1 rounded-full" style={{ background: r.color }} />
                <span className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: r.color }}>{r.name}</span>
              </div>
              <div className="relative space-y-1 pl-2">
                <div className="absolute bottom-2 left-0 top-2 w-px" style={{ background: `linear-gradient(180deg, ${r.color}88, transparent)` }} />
                {view.filter((v) => v.region === r.id).map((v) => {
                  const cleared = v.id < snap.stageProgress;
                  const active = v.id === sel;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { audio().sfx('ui'); setSel(v.id); }}
                      className={`relative w-full rounded-lg border p-1.5 text-left transition ${active ? 'border-gild bg-gild/[.08]' : v.unlocked ? 'border-white/12 bg-black/35 hover:border-white/30' : 'border-white/8 bg-black/20 opacity-45'}`}
                    >
                      <span className="absolute -left-1 top-3 h-2 w-2 rounded-full" style={{ background: v.unlocked ? r.color : '#3a3550' }} />
                      <div className="flex items-center gap-1.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/15 bg-black/50 text-[10px] font-black text-white/80">{v.id}</span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-white/85">{v.name}</span>
                        {v.boss && <span className="rounded bg-blood/25 px-1 text-[8px] font-black text-rose-200">BOSS</span>}
                        {cleared && <Icon name="star" size={11} color="#f5c453" />}
                        {!v.unlocked && <Icon name="lock" size={11} color="#6b6680" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/45">
                        <span>Độ khó {v.difficulty}</span>
                        <span>· rơi đồ {Math.round(v.dropChance * 100)}%</span>
                        <span>· {v.monsters.length} quái</span>
                      </div>
                      <div className="mt-1"><Bar pct={cleared ? 1 : v.id === snap.stageProgress ? 0.5 : 0} color={cleared ? '#34d399' : r.color} height={3} /></div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ------------------------------ enemy preview --------------------------- */}
      <Panel className="relative flex min-h-0 flex-col overflow-hidden p-2.5">
        <div className="absolute inset-0" style={{ background: `radial-gradient(100% 70% at 50% 100%, ${cur.boss ? 'rgba(255,90,60,.18)' : 'rgba(74,54,116,.4)'}, transparent 70%)` }} />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[.3em] text-gild/70">Ải {cur.id}{cur.boss ? ' — TRÙM' : ''}</div>
            <h2 className="font-display text-[24px] leading-tight text-white">{cur.name}</h2>
            <p className="mt-0.5 max-w-[520px] text-[11px] leading-snug text-white/50">{cur.desc}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Chip tone="red">Độ khó {cur.difficulty}</Chip>
            <Chip tone="gold">+{cur.reward.gold.toLocaleString('vi-VN')} Vàng</Chip>
            <Chip tone="violet">+{cur.reward.exp} EXP</Chip>
          </div>
        </div>

        <div className="relative mt-2 flex min-h-0 flex-1 flex-col justify-end">
          <div className="fx-floor" />
          <div className="flex items-end justify-center gap-1 pb-1">
            {cur.monsters.map((mo, i) => {
              const d = MONSTER_MAP[mo.id];
              if (!d) return null;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="relative flex w-[132px] flex-col items-center">
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2"><MagicCircle element={d.element} size={118} /></div>
                  <Sprite defId={d.id} pose={d.role === 'tank' ? 'idle' : 'attack'} flip style={{ height: d.tier === 3 ? 168 : 132 }} glow={ELEMENT_COLORS[d.element]} className="pointer-events-none" />
                  <div className="relative mt-0.5 w-full truncate text-center text-[10.5px] font-bold text-white/85">{d.name}</div>
                  <div className="flex items-center gap-1 text-[9px] text-white/50">
                    <ElementBadge element={d.element} size={12} />
                    <span>Lv{mo.level}</span>
                    <span>· {ROLE_META[d.role].vn}</span>
                  </div>
                  <div className="mt-0.5 flex w-full justify-center gap-1 text-[8.5px] text-white/40">
                    <span>HP {d.base.hp}</span><span>ATK {d.base.atk}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="relative mt-1 flex flex-wrap items-center gap-2 border-t border-white/8 pt-1.5 text-[10px] text-white/50">
          <span className="uppercase tracking-[.2em] text-white/35">Gợi ý đội hình</span>
          {enemyElements.map((e) => (
            <span key={e.element} className="flex items-center gap-1 rounded border border-white/12 bg-black/30 px-1.5 py-[2px]">
              <ElementBadge element={e.element} size={12} /> ×{e.n}
            </span>
          ))}
          {counters.length > 0
            ? <span className="text-emerald-300">Dùng hệ {counters.map((c) => VN_EL[c]).join(' / ')} để kích hoạt <b>Khắc Chế ×1.5</b></span>
            : <span className="text-white/35">không có hệ nào khắc chế toàn bộ — dùng sát thương thuần</span>}
        </div>
      </Panel>

      {/* ------------------------------- drop table ---------------------------- */}
      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle>Bảng Rơi Trang Bị</SectionTitle>
        <div className="text-[10px] text-white/45">Xác suất rơi khi thắng: <b className="text-amber-200">{Math.round(cur.dropChance * 100)}%</b> — phần còn lại chỉ nhận vàng/EXP.</div>
        <div className="mt-2 space-y-1.5">
          {dropTable.map((d) => (
            <div key={d.rarity} className="rounded-lg border border-white/10 bg-black/30 p-1.5">
              <div className="flex items-center gap-1.5">
                <RarityBadge rarity={d.rarity as 'R'} size="sm" />
                <span className="text-[11px] font-black" style={{ color: d.rarity === 'SSR' ? '#f5c453' : d.rarity === 'SR' ? '#c084fc' : '#7dd3fc' }}>{d.pct.toFixed(1)}%</span>
                <span className="ml-auto text-[9px] text-white/35">{d.ids.length} món</span>
              </div>
              <div className="mt-1 thin-scroll flex max-h-[74px] flex-col gap-0.5 overflow-y-auto">
                {d.ids.map((id) => (
                  <span key={id} className="flex items-center gap-1 text-[9.5px] text-white/55">
                    <Icon name="bag" size={9} color="#6b6680" /> {GEAR_MAP[id]?.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2 text-[10px] leading-snug text-white/50">
          Quái <b className="text-white/75">không dùng xúc xắc</b> và không có mana — chúng hành động theo kịch bản:
          healer cứu đồng đội thấp máu, tank khiêu khích, và mọi con quái đều <b className="text-rose-200">ưu tiên đánh Đỡ Đòn</b> của bạn.
        </div>

        <div className="mt-auto space-y-1.5 pt-2">
          <Btn
            tone="gold" size="lg" full disabled={!cur.unlocked}
            onClick={() => { audio().ensure(); audio().sfx('select'); router.push(`/battle?stage=${cur.id}`); }}
          >
            {cur.unlocked ? `VÀO TRẬN — ẢI ${cur.id}` : 'CẦN PHÁ ẢI TRƯỚC'}
          </Btn>
          {cur.unlocked && cur.id < snap.stageProgress && (
            <Btn size="sm" tone="ghost" full onClick={() => router.push(`/battle?stage=${cur.id}`)}>
              ải này đã phá — vào farm lại để rơi trang bị
            </Btn>
          )}
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white/50">
            <span>Thưởng clear lần đầu</span><b className="text-emerald-300">+{cur.reward.firstClearGold.toLocaleString('vi-VN')} Vàng + 80 Ngọc</b>
          </div>
        </div>
      </Panel>
    </div>
  );
}

const VN_EL: Record<Element, string> = {
  fire: 'Lửa', ice: 'Băng', thunder: 'Sét', nature: 'Độc', holy: 'Thánh', dark: 'Hắc Ám', neutral: 'Trung Tính',
};

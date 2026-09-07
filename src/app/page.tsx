'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Panel, Btn, SectionTitle, Chip, Bar } from '../components/ui';
import { Icon, ElementBadge, ELEMENT_COLORS } from '../components/Icon';
import { PortraitCard } from '../components/PortraitCard';
import { Sprite } from '../components/Sprite';
import { useGame } from '../store/game';
import { CHARACTERS } from '../game/data/characters';
import { GACHA, RARITY_META, ROLE_META } from '../game/data/constants';
import { MONSTER_MAP } from '../game/data/monsters';
import { STAGES, REGIONS } from '../game/data/stages';
import { audio } from '../game/audio/synth';

export default function HomePage() {
  const snap = useGame((s) => s.snapshot);
  const router = useRouter();
  const ssrPool = CHARACTERS.filter((c) => c.rarity === 'SSR');
  const showcase = ssrPool[(Math.floor(Date.now() / 60000) % ssrPool.length)];

  if (!snap) return null;
  const team = snap.team.map((id) => (id == null ? null : snap.owned.find((o) => o.instanceId === id) ?? null));
  const nextStage = STAGES[Math.min(STAGES.length - 1, snap.stageProgress - 1)];
  const ownedIds = new Set(snap.owned.map((o) => o.charId));

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_330px] gap-2.5 p-2.5">
      {/* ------------------------------- left rail ------------------------------ */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="relative overflow-hidden p-3">
          <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(120% 80% at 20% 0%, ${ELEMENT_COLORS[showcase.element]}22, transparent 70%)` }} />
          <div className="relative flex items-end gap-2">
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-[.3em] text-gild/70">Tiêu điểm triệu hồi</div>
              <h1 className="font-display text-[26px] leading-tight text-white title-grad">{showcase.name}</h1>
              <div className="text-[10px] text-white/50">{showcase.title}</div>
              <div className="mt-1 flex items-center gap-1">
                <span className="rounded px-1.5 py-[2px] text-[9px] font-black" style={{ color: RARITY_META[showcase.rarity].color, background: `${RARITY_META[showcase.rarity].color}18` }}>{showcase.rarity}</span>
                <ElementBadge element={showcase.element} size={16} />
                <span className="text-[9px] text-white/40">{ROLE_META[showcase.role].vn}</span>
              </div>
            </div>
            <Sprite defId={showcase.id} pose="idle" style={{ height: 150 }} className="pointer-events-none shrink-0" />
          </div>
          <Btn tone="gold" size="sm" className="mt-2 w-full" onClick={() => { audio().sfx('aura'); router.push('/gacha'); }}>
            <Icon name="gem" size={13} /> MỞ CỔNG TRIỆU HỒI
          </Btn>
        </Panel>

        <Panel className="p-2.5">
          <SectionTitle>Nhật Ký</SectionTitle>
          <ul className="space-y-1.5 text-[11px] text-white/70">
            <li className="flex items-center justify-between"><span>Đã quay</span><b className="text-white">{snap.pullCount}</b></li>
            <li className="flex items-center justify-between"><span>Sưu tầm</span><b className="text-white">{new Set(snap.owned.map((o) => o.charId)).size}/{CHARACTERS.length}</b></li>
            <li className="flex items-center justify-between"><span>Bản sao tướng</span><b className="text-white">{snap.owned.length}</b></li>
            <li className="flex items-center justify-between"><span>Tỉ lệ SSR</span><b className="text-amber-200">{(GACHA.rates.SSR * 100).toFixed(0)}%</b></li>
            <li className="flex items-center justify-between"><span>Đảm bảo x10</span><b className="text-emerald-200">≥1 SR</b></li>
          </ul>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[9px] uppercase tracking-[.2em] text-white/40"><span>Tiến độ ải</span><span>{snap.stageProgress}/10</span></div>
            <Bar pct={snap.stageProgress / 10} color="#f5c453" glow height={6} />
          </div>
        </Panel>

        <Panel className="min-h-0 flex-1 p-2.5">
          <SectionTitle>Chiến Thuật</SectionTitle>
          <ul className="space-y-1 text-[10.5px] leading-snug text-white/60">
            <li>• Lửa ⇄ Băng, Sét ⇄ Độc, Thánh ⇄ Hắc Ám — đánh trúng khắc chế nhân <b className="text-ember">×1.5</b>.</li>
            <li>• Đầu lượt mỗi tướng tự đổ <b className="text-amber-200">xúc xắc 6 mặt</b>: ra bao nhiêu = nhiêu Mana (tối đa 6).</li>
            <li>• Thứ tự hành động theo hàng ngũ — không chọn tự do.</li>
            <li>• QTE chuẩn = sát thương tối đa; trượt = giảm. Đỡ đòn bằng tụ lực để miễn nhiễm.</li>
            <li>• Nhấn giữ nút kỹ năng để xem mô tả.</li>
          </ul>
        </Panel>
      </div>

      {/* -------------------------------- center -------------------------------- */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="relative overflow-hidden p-3">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 120% at 50% 110%, rgba(168,85,247,.25), transparent 70%)' }} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[.36em] text-gild/70">VAIN</div>
                <h2 className="font-display text-[28px] leading-none text-white">Gacha Waifu Tactics</h2>
              </div>
              <Chip tone="violet">Turn-Based · 16:9 Landscape</Chip>
            </div>
            <p className="mt-1.5 max-w-[640px] text-[11px] leading-relaxed text-white/55">
              30 nữ chiến binh — sát thủ da bó, phù thủy đầm trễ vai, kỵ sĩ giáp nhẹ, cung thủ thần thánh —
              đứng trên vòng ma pháp của hệ mình, đối đầu bầy quái và Ma Vương Azgharoth. Toàn bộ đồ họa là
              sprite vector dựng bằng thuật toán, âm thanh là synth Web Audio: <b className="text-white/80">game chạy offline hoàn toàn</b>.
            </p>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-1 flex-col p-2.5">
          <SectionTitle right={<Link href="/team" className="text-[10px] uppercase tracking-[.16em] text-gild/80 hover:text-gild">Chỉnh đội hình →</Link>}>
            Đội Hình Ra Trận — thứ tự hành động
          </SectionTitle>
          <div className="grid min-h-0 flex-1 grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const oc = team[i];
              return (
                <div key={i} className="relative flex min-w-0 flex-col">
                  <span className="absolute -top-0.5 left-1 z-10 rounded bg-black/80 px-1.5 text-[9px] font-black text-gild">#{i + 1}</span>
                  {oc ? (
                    <PortraitCard oc={oc} gear={snap.gear} inTeam size="sm" onClick={() => router.push(`/roster?c=${oc.instanceId}`)} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { audio().sfx('ui'); router.push('/team'); }}
                      className="hatch flex h-full min-h-[176px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-[10px] text-white/40 hover:border-gild/60 hover:text-gild"
                    >
                      <Icon name="plus" size={18} />
                      ô trống
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Btn tone="gold" size="md" onClick={() => router.push(`/battle?stage=${nextStage.id}`)}>
              <Icon name="next" size={14} /> BẮT ĐẦU ẢI {nextStage.id} — {nextStage.name}
            </Btn>
            <Btn tone="violet" onClick={() => router.push('/stages')}>Danh sách ải</Btn>
            <Btn tone="ghost" onClick={() => router.push('/roster')}>Túi tướng ({snap.owned.length})</Btn>
          </div>
        </Panel>
      </div>

      {/* -------------------------------- right --------------------------------- */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="flex min-h-0 flex-1 flex-col p-2.5">
          <SectionTitle right={<span className="text-[9px] text-white/40">rơi đồ tăng theo vùng</span>}>10 Ải Chiến Đấu</SectionTitle>
          <div className="thin-scroll -mr-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {REGIONS.map((r) => (
              <div key={r.id}>
                <div className="mb-1 text-[9px] uppercase tracking-[.22em]" style={{ color: r.color }}>{r.name}</div>
                <div className="space-y-1.5">
                  {r.stages.map((id) => {
                    const s = STAGES.find((x) => x.id === id)!;
                    const unlocked = id <= snap.stageProgress;
                    const cleared = id < snap.stageProgress;
                    return (
                      <motion.button
                        key={id}
                        type="button"
                        whileTap={unlocked ? { scale: .98 } : undefined}
                        onClick={() => { if (!unlocked) { audio().sfx('error'); return; } router.push(`/battle?stage=${id}`); }}
                        className={`relative w-full overflow-hidden rounded-lg border px-2 py-1.5 text-left transition ${
                          cleared ? 'border-emerald-400/40 bg-emerald-400/[.06]'
                            : unlocked ? 'border-gild/45 bg-gild/[.08] hover:border-gild'
                              : 'border-white/10 bg-black/40 opacity-45'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-[13px] font-black text-white/85">0{id}</span>
                          <span className="truncate text-[11px] font-semibold text-white/80">{s.name}</span>
                          {s.boss && <span className="rounded bg-blood/25 px-1 text-[8px] font-black text-rose-200">BOSS</span>}
                          {cleared && <Icon name="next" size={12} color="#34d399" className="ml-auto" />}
                          {!unlocked && <Icon name="lock" size={12} color="#fff" className="ml-auto opacity-60" />}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {s.waves[0].monsters.slice(0, 5).map((m, i) => {
                            const md = MONSTER_MAP[m.id];
                            return <ElementBadge key={i} element={md.element} size={13} />;
                          })}
                          <span className="ml-auto text-[9px] text-amber-200/80">{s.reward.gold.toLocaleString('vi-VN')} vàng</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Btn tone="green" onClick={() => { audio().sfx('aura'); router.push('/gacha'); }}>Gacha</Btn>
            <Btn tone="blue" onClick={() => router.push('/shop')}>Cửa Hàng</Btn>
            <Btn tone="ghost" onClick={() => router.push('/gear')}>Lò Rèn</Btn>
            <Btn tone="ghost" onClick={() => router.push('/settings')}>Cài Đặt</Btn>
          </div>
          <div className="mt-1.5 text-center text-[9px] text-white/30">dữ liệu lưu trên PostgreSQL cục bộ · offline 100%</div>
        </Panel>
      </div>
    </div>
  );
}

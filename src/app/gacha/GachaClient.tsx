'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Panel, Btn, Chip, RarityBadge, SectionTitle } from '../../components/ui';
import { Icon, ElementBadge, ELEMENT_COLORS } from '../../components/Icon';
import { Sprite } from '../../components/Sprite';
import { useGame } from '../../store/game';
import { CHARACTERS } from '../../game/data/characters';
import { GACHA, RARITY_META, ROLE_META } from '../../game/data/constants';
import { skillTree } from '../../game/data/skillFactory';
import { audio } from '../../game/audio/synth';

interface RevealItem { instanceId: number; charId: string; name: string; title: string; rarity: 'R' | 'SR' | 'SSR'; element: keyof typeof ELEMENT_COLORS; role: 'tank' | 'attacker' | 'support'; isNew: boolean }

export function GachaClient() {
  const snap = useGame((s) => s.snapshot)!;
  const post = useGame((s) => s.post);
  const busy = useGame((s) => s.busy);
  const router = useRouter();
  const [queue, setQueue] = useState<RevealItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [summary, setSummary] = useState<RevealItem[] | null>(null);
  const [showOdds, setShowOdds] = useState(false);

  const ownedCount = useMemo(() => {
    const set = new Set(snap.owned.map((o) => o.charId));
    return { got: set.size, total: CHARACTERS.length };
  }, [snap.owned]);

  const pull = async (kind: 'single' | 'ten') => {
    audio().sfx('aura');
    const res = await post('/api/pull', { kind });
    if (!res.ok) return;
    const data = res.data as { result: RevealItem[]; refund: number };
    setSummary(null);
    setIdx(0);
    setQueue(data.result);
    audio().stopMusic();
    audio().playMusic('gacha');
    audio().sfx('gacha');
  };

  const advance = () => {
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
      const next = queue[idx + 1];
      audio().sfx(next.rarity === 'SSR' ? 'gachaRevealSSR' : next.rarity === 'SR' ? 'gachaRevealSR' : 'gachaRevealR');
      return;
    }
    setSummary(queue);
    setQueue([]);
    audio().stopMusic();
    audio().playMusic('menu');
  };

  const current = queue[idx];
  const totalRefund = queue.reduce((a, b) => a + (b.isNew ? 0 : 40), 0);

  return (
    <div className="relative grid h-full grid-cols-[330px_minmax(0,1fr)_320px] gap-2.5 p-2.5">
      {/* ------------------------------- banner rail ------------------------------ */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="relative overflow-hidden p-3">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(168,85,247,.5), transparent)' }} />
          <div className="relative">
            <div className="text-[9px] uppercase tracking-[.34em] text-gild/75">Cổng Triệu Hồi</div>
            <h2 className="font-display text-[25px] leading-tight title-grad">VAIN Gacha</h2>
            <p className="mt-1 text-[10.5px] leading-snug text-white/55">
              30 nữ chiến binh · 3 class · 6 hệ khắc chế. Bản sao trùng không gộp — mỗi bản là một tướng độc lập trong túi.
            </p>
            <div className="mt-2 flex gap-1.5">
              <Chip tone="gold">SSR {(GACHA.rates.SSR * 100).toFixed(0)}%</Chip>
              <Chip tone="violet">SR {(GACHA.rates.SR * 100).toFixed(0)}%</Chip>
              <Chip tone="blue">R {(GACHA.rates.R * 100).toFixed(0)}%</Chip>
            </div>
            <button onClick={() => setShowOdds(true)} className="mt-1.5 text-[10px] text-white/40 underline decoration-dotted hover:text-white/70">
              xem chi tiết tỉ lệ & đảm bảo
            </button>
          </div>
        </Panel>

        <Panel className="p-3">
          <SectionTitle>Nguồn Lực</SectionTitle>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-2.5 py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-white/60"><Icon name="gem" size={14} color="#c084fc" /> Ngọc</span>
            <span className="font-display text-[22px] font-black text-violet-200">{snap.gem.toLocaleString('vi-VN')}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <Btn tone="violet" size="lg" full disabled={busy || snap.gem < GACHA.single} onClick={() => void pull('single')}>
              QUAY × 1 <span className="ml-1 opacity-70">({GACHA.single})</span>
            </Btn>
            <Btn tone="gold" size="lg" full disabled={busy || snap.gem < GACHA.ten} onClick={() => void pull('ten')}>
              QUAY × 10 <span className="ml-1 text-[11px] opacity-80">đảm bảo ≥1 SR · ({GACHA.ten})</span>
            </Btn>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
            <span>Sưu tầm {ownedCount.got}/{ownedCount.total}</span>
            <span>Số lượt đã quay: {snap.pullCount}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gild" style={{ width: `${(ownedCount.got / ownedCount.total) * 100}%` }} />
          </div>
        </Panel>

        <Panel className="min-h-0 flex-1 p-2.5">
          <SectionTitle>Tỉ Lệ Rơi Theo Độ Hiếm</SectionTitle>
          <div className="space-y-1.5">
            {(['SSR', 'SR', 'R'] as const).map((r) => (
              <div key={r} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-1.5">
                <RarityBadge rarity={r} size="sm" />
                <span className="text-[10px] text-white/50">{RARITY_META[r].vn}</span>
                <span className="ml-auto text-[11px] font-bold" style={{ color: RARITY_META[r].color }}>{(GACHA.rates[r] * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] leading-snug text-white/45">
            Mỗi lần quay x10, thẻ thứ 10 chắc chắn là SR hoặc SSR. Trùng tướng: +40 Ngọc mỗi bản.
          </div>
        </Panel>
      </div>

      {/* -------------------------------- stage -------------------------------- */}
      <div className="relative min-h-0 overflow-hidden rounded-xl border border-white/10" style={{ background: 'radial-gradient(120% 100% at 50% 100%, rgba(74,54,116,.5), rgba(5,4,10,1) 70%)' }}>
        <Gate idle={!current} rarity={current?.rarity} />
        <AnimatePresence mode="wait">
          {current && <CardReveal key={`${idx}-${current.instanceId}`} item={current} onNext={advance} isLast={idx === queue.length - 1} />}
          {!current && !summary && (
            <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 text-center">
              <div className="text-[11px] uppercase tracking-[.3em] text-white/35">chạm nút quay để mở cổng</div>
            </div>
          )}
        </AnimatePresence>

        {summary && (
          <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-void-950/92 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-[11px] uppercase tracking-[.3em] text-gild/80">kết quả triệu hồi</div>
            <div className="grid w-full max-w-[560px] grid-cols-5 gap-1.5">
              {summary.map((r, i) => {
                const def = CHARACTERS.find((c) => c.id === r.charId)!;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12, rotateX: -60 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: i * .04 }}
                    className="relative overflow-hidden rounded-lg border p-1 text-center"
                    style={{ borderColor: `${RARITY_META[r.rarity].color}66`, background: `linear-gradient(180deg, ${ELEMENT_COLORS[r.element]}18, #0a0813)` }}
                  >
                    <Sprite defId={def.id} pose="idle" style={{ height: 62 }} className="pointer-events-none" />
                    <div className="truncate text-[9px] font-bold text-white/85">{def.name}</div>
                    <div className="text-[8px]" style={{ color: RARITY_META[r.rarity].color }}>{r.rarity}{!r.isNew && ' · dup'}</div>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-2">
              <Btn tone="gold" onClick={() => { setSummary(null); router.push('/roster'); }}>Xem túi tướng</Btn>
              <Btn tone="ghost" onClick={() => setSummary(null)}>Đóng</Btn>
              {totalRefund > 0 && <Chip tone="violet">+{totalRefund} Ngọc hoàn</Chip>}
            </div>
          </motion.div>
        )}
      </div>

      {/* ------------------------------ roster preview --------------------------- */}
      <div className="flex min-h-0 flex-col gap-2.5">
        <Panel className="flex min-h-0 flex-1 flex-col p-2.5">
          <SectionTitle right={<Chip tone="gold">{snap.owned.length} bản sao</Chip>}>Bộ Sưu Tập</SectionTitle>
          <div className="thin-scroll -mr-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {CHARACTERS.map((c) => {
              const copies = snap.owned.filter((o) => o.charId === c.id);
              const best = copies.sort((a, b) => b.level - a.level)[0];
              const tree = skillTree(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => best && router.push(`/roster?c=${best.instanceId}`)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-1.5 py-1 text-left transition ${copies.length ? 'border-white/15 bg-black/30 hover:border-gild/60' : 'border-white/5 bg-black/20 opacity-50'}`}
                >
                  <ElementBadge element={c.element} size={16} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-white/85">{c.name}</span>
                    <span className="block truncate text-[9px] text-white/40">{ROLE_META[c.role].vn} · {tree.actives.length} skill · {tree.passives.length} nội tại</span>
                  </span>
                  <RarityBadge rarity={c.rarity} size="sm" />
                  {copies.length > 1 && <span className="rounded bg-gild/20 px-1 text-[9px] font-black text-amber-100">×{copies.length}</span>}
                  {copies.length === 1 && <span className="text-[9px] text-emerald-300">✓</span>}
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <AnimatePresence>
        {showOdds && (
          <motion.div className="absolute inset-0 z-50 grid place-items-center bg-black/80 p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowOdds(false)}>
            <Panel className="max-w-lg p-4 text-[12px] text-white/75" >
              <h3 className="font-display text-lg text-gild">Chi tiết tỉ lệ</h3>
              <ul className="mt-2 space-y-1">
                <li>SSR 3% · SR 17% · R 80% — mỗi lượt quay độc lập.</li>
                <li>Đủ 10 lượt trong một lần quay x10 mà chưa có SR+: lượt cuối ép về SR/SSR.</li>
                <li>Tướng trùng vẫn được cộng vào túi dưới dạng bản sao độc lập (không gộp, không mất).</li>
                <li>Hoàn 40 Ngọc cho mỗi bản sao trùng.</li>
              </ul>
              <Btn className="mt-3" tone="ghost" onClick={() => setShowOdds(false)}>Đóng</Btn>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Gate({ idle, rarity }: { idle: boolean; rarity?: 'R' | 'SR' | 'SSR' }) {
  const color = rarity === 'SSR' ? '#f5c453' : rarity === 'SR' ? '#c084fc' : '#7dd3fc';
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <motion.div
        className="relative h-[420px] w-[420px]"
        animate={{ rotate: idle ? 360 : 720, opacity: idle ? .5 : 1 }}
        transition={{ duration: idle ? 60 : 6, ease: 'linear', repeat: Infinity }}
      >
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <g fill="none" stroke={color} strokeOpacity=".55">
            <circle cx="200" cy="200" r="188" strokeWidth="1" strokeDasharray="3 9" />
            <circle cx="200" cy="200" r="150" strokeWidth="2" strokeDasharray="26 12" />
            <circle cx="200" cy="200" r="118" strokeWidth="1" />
            {Array.from({ length: 6 }).map((_, i) => {
              const a = (i / 6) * Math.PI * 2;
              return <path key={i} d={`M${200 + Math.cos(a) * 118},${200 + Math.sin(a) * 118} L${200 + Math.cos(a) * 150},${200 + Math.sin(a) * 150}`} strokeWidth="2" />;
            })}
            <path d="M200 62 L258 200 L200 338 L142 200 Z" strokeWidth="1" strokeOpacity=".35" />
          </g>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <text key={i} x={200 + Math.cos(a) * 170} y={200 + Math.sin(a) * 170 + 4} fill={color} fillOpacity=".7" fontSize="13" textAnchor="middle" style={{ fontFamily: 'serif' }}>{'ᛟᚱᚾᛉᛏᚦᚹᛈᛒᛖᚷᛗ'[i]}</text>;
          })}
        </svg>
      </motion.div>
      <div className="absolute inset-0" style={{ background: `radial-gradient(closest-side, ${color}22, transparent 65%)` }} />
    </div>
  );
}

function CardReveal({ item, onNext, isLast }: { item: RevealItem; onNext: () => void; isLast: boolean }) {
  const def = CHARACTERS.find((c) => c.id === item.charId)!;
  const rc = RARITY_META[item.rarity].color;
  const el = ELEMENT_COLORS[item.element];
  return (
    <motion.button
      type="button"
      onClick={onNext}
      className="absolute inset-0 z-10 grid place-items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }}
      whileTap={{ scale: .99 }}
    >
      {item.rarity === 'SSR' && (
        <motion.div className="absolute inset-0" style={{ background: 'radial-gradient(closest-side, rgba(245,196,83,.4), transparent 70%)' }}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, .5, 1] }} transition={{ duration: 1.1 }} />
      )}
      <motion.div
        className="relative flex h-[420px] w-[280px] items-end justify-center overflow-hidden rounded-2xl border-2 p-3"
        style={{ borderColor: rc, background: `linear-gradient(180deg, ${el}2e, #0a0813 60%)`, boxShadow: `0 0 60px -12px ${RARITY_META[item.rarity].glow}, inset 0 0 40px rgba(0,0,0,.6)` }}
        initial={{ rotateY: 92, scale: .92 }} animate={{ rotateY: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 230, damping: 22 }}
      >
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/10 to-transparent" />
        <motion.div
          className="absolute inset-0"
          style={{ background: `conic-gradient(from 0deg, transparent, ${rc}33, transparent 40%)` }}
          animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        />
        <Sprite defId={def.id} pose="idle" style={{ height: 320 }} className="relative pointer-events-none" />
        <div className="relative mt-1 w-full">
          <div className="flex items-center gap-1.5">
            <RarityBadge rarity={item.rarity} />
            <ElementBadge element={def.element} size={18} />
            <span className="text-[10px] text-white/60">{ROLE_META[def.role].vn}</span>
            {item.isNew
              ? <span className="ml-auto animate-pulse rounded bg-emerald-400 px-1.5 text-[9px] font-black text-black">NEW</span>
              : <span className="ml-auto rounded bg-white/10 px-1.5 text-[9px] text-white/60">+40 Ngọc</span>}
          </div>
          <div className="mt-1 font-display text-[22px] leading-tight text-white">{def.name}</div>
          <div className="text-[11px] text-white/55">{def.title}</div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/45">{def.bio}</p>
        </div>
        <div className="absolute inset-0 shine" />
      </motion.div>
      <div className="absolute bottom-4 text-[10px] uppercase tracking-[.3em] text-white/40">{isLast ? 'chạm để xem kết quả' : 'chạm để tiếp tục'}</div>
    </motion.button>
  );
}

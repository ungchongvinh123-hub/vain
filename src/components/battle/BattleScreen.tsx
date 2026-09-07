'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Arena } from './Arena';
import { ActionBar, needsTarget } from './ActionBar';
import { ClashView } from './ClashView';
import { DiceOverlay } from './DiceOverlay';
import { QteLayer } from './Qte';
import { useBattleFlow } from './useBattleFlow';
import { fetchBattleConfig, settleBattle, type ClientActionEntry } from './api';
import type { BattleConfigView, FloatNumber } from './types';
import { Btn, Panel, Chip } from '../ui';
import { Icon, ElementBadge, ELEMENT_COLORS } from '../Icon';
import { Sprite } from '../Sprite';
import { useGame } from '../../store/game';
import { audio } from '../../game/audio/synth';
import type { PlayerSnapshot } from '../../game/types';

export function BattleScreen({ stageId }: { stageId: number }) {
  const router = useRouter();
  const [config, setConfig] = useState<BattleConfigView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [pickedSkill, setPickedSkill] = useState<string | null>(null);
  const [pickedTarget, setPickedTarget] = useState<string | null>(null);
  const [settle, setSettle] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; msg?: string; data?: Awaited<ReturnType<typeof settleBattle>>['data'] }>({ state: 'idle' });
  const settlingRef = useRef(false);
  const refresh = useGame((s) => s.refresh);
  const snap = useGame((s) => s.snapshot);

  const flow = useBattleFlow(started ? config : null);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    void fetchBattleConfig(stageId).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) { setConfig(r.data); audio().stopMusic(); }
      else setLoadError(r.error ?? 'Không tải được trận đấu');
    });
    return () => { alive = false; };
  }, [stageId]);

  useEffect(() => {
    if (started) audio().playMusic(config?.boss ? 'boss' : 'battle');
    return () => audio().stopMusic();
  }, [started, config?.boss]);

  const targetMode = useMemo(() => {
    if (!pickedSkill) return false;
    const s = flow.activeUnit?.skills.find((x) => x.id === pickedSkill);
    return !!s && needsTarget(s);
  }, [pickedSkill, flow.activeUnit]);

  const numbersByUid = useMemo(() => {
    const map: Record<string, FloatNumber[]> = {};
    for (const n of flow.numbers) (map[n.uid] ??= []).push(n);
    return map;
  }, [flow.numbers]);

  const hiddenUids = flow.clash ? new Set([flow.clash.actorUid, ...flow.clash.targetUids]) : null;

  const commit = useCallback((skillId: string) => {
    const s = flow.activeUnit?.skills.find((x) => x.id === skillId);
    if (!s) return;
    if (needsTarget(s)) {
      const firstFoe = flow.units.find((u) => u.side === 'foe' && u.alive)?.uid ?? null;
      if (s.target.startsWith('ally')) {
        const firstAlly = flow.units.find((u) => u.side === 'party' && (s.target === 'allyDead' ? !u.alive : u.alive))?.uid ?? null;
        if (!firstAlly) return;
        setPickedSkill(skillId);
        setPickedTarget(firstAlly);
        return;
      }
      if (!firstFoe) return;
      setPickedSkill(skillId);
      setPickedTarget(firstFoe);
      return;
    }
    void flow.commitAction(skillId, null);
  }, [flow]);

  const onPickTarget = useCallback((uid: string) => {
    setPickedTarget(uid);
  }, []);

  // when a targeted skill + target are both chosen, launch immediately after a beat
  useEffect(() => {
    if (!pickedSkill || !pickedTarget || !targetMode) return;
    const t = window.setTimeout(() => {
      void flow.commitAction(pickedSkill, pickedTarget);
      setPickedSkill(null);
      setPickedTarget(null);
    }, 170);
    return () => window.clearTimeout(t);
  }, [pickedSkill, pickedTarget, targetMode, flow]);

  const resultData = flow.result;
  useEffect(() => {
    if (!resultData || settlingRef.current || !config) return;
    settlingRef.current = true;
    setSettle({ state: 'busy' });
    void settleBattle({
      stageId: config.stageId, seed: config.seed, claimedWin: resultData.win,
      actions: flow.actions() as ClientActionEntry[], durationMs: Math.round(performance.now() - (t0ref.current || performance.now())),
    }).then(async (r) => {
      if (r.ok) { setSettle({ state: 'done', data: r.data }); await refresh(); }
      else setSettle({ state: 'error', msg: r.error });
    });
  }, [resultData, config, flow, refresh]);

  const t0ref = useRef(0);
  useEffect(() => { t0ref.current = performance.now(); }, [started]);

  const turnOrder = useMemo(() => {
    const st = flow.state();
    if (!st) return [];
    return st.queue.slice(st.qi).map((q) => st.units.find((u) => u.uid === q.uid)).filter(Boolean).slice(0, 6)
      .map((u) => ({ uid: u!.uid, name: u!.name, side: u!.side, element: u!.element, active: u!.uid === flow.activeUnit?.uid }));
  }, [flow.units, flow.phase, flow.activeUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <div className="grid h-full place-items-center">
        <Panel className="max-w-md p-6 text-center">
          <p className="text-sm text-rose-200">{loadError}</p>
          <p className="mt-1 text-[11px] text-white/50">Cần PostgreSQL đang chạy và `npm run setup` để đọc dữ liệu lưu.</p>
          <Btn className="mt-4" onClick={() => router.push('/')}>Về thành trì</Btn>
        </Panel>
      </div>
    );
  }
  if (!config) return <LoadingBattle />;

  const activeAlly = flow.units.filter((u) => u.side === 'party');
  const activeFoe = flow.units.filter((u) => u.side === 'foe');
  const clashActive = !!flow.clash;
  const dimmed = clashActive ? 'brightness(.62) saturate(.8)' : undefined;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ------------------------------- top hud ------------------------------- */}
      <div className="relative z-30 flex items-center gap-2 px-3 py-1.5">
        <Chip tone="gold">Hiệp {flow.round}</Chip>
        <span className="text-[11px] font-semibold text-white/60">{config.name}</span>
        {config.boss && <Chip tone="red">BOSS</Chip>}
        <div className="ml-2 flex items-center gap-1">
          {turnOrder.map((t, i) => (
            <span key={t.uid + i} className={`flex items-center gap-1 rounded border px-1 py-[1px] text-[9px] ${t.active ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/40'}`}>
              <span className="h-1 w-1 rounded-full" style={{ background: t.side === 'party' ? '#34d399' : '#fb7185' }} />
              {t.name.slice(0, 8)}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => flow.setSpeed(flow.speed === 1 ? 1.8 : flow.speed === 1.8 ? 2.6 : 1)}
            className="tap-scale flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 text-[10px] font-bold text-white/70"
          >
            <Icon name="spd" size={12} /> {flow.speed === 1 ? '1×' : `${flow.speed}×`}
          </button>
          <button
            type="button"
            disabled={flow.phase !== 'action'}
            onClick={() => void flow.skipTurn()}
            className="tap-scale flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 text-[10px] font-bold text-white/70 disabled:opacity-30"
          >
            Bỏ lượt
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="tap-scale flex h-7 items-center gap-1 rounded-md border border-blood/40 bg-blood/10 px-2 text-[10px] font-bold text-rose-200"
          >
            <Icon name="close" size={12} /> Rút lui
          </button>
        </div>
      </div>

      {/* -------------------------------- arena -------------------------------- */}
      <div className="relative min-h-0 flex-1 transition-[filter] duration-300" style={{ filter: dimmed }}>
        <Arena
          units={flow.units}
          activeUid={flow.activeUnit?.uid ?? null}
          phase={flow.phase}
          targetMode={targetMode && flow.phase === 'action'}
          pickedTarget={pickedTarget}
          threatened={[]}
          onPickTarget={onPickTarget}
          numbersByUid={numbersByUid}
          hiddenUids={hiddenUids}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-2">
          <SquadPips units={activeAlly} />
          <SquadPips units={activeFoe} right />
        </div>

        <AnimatePresence>
          {flow.phase === 'dice' && flow.dice && (
            <DiceOverlay
              faces={flow.dice.faces} total={flow.dice.total} bonus={flow.dice.bonus} rolling={flow.dice.rolling}
              name={flow.activeUnit?.name ?? ''}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------ clash zoom ----------------------------- */}
      <AnimatePresence>
        {flow.clash && (
          <ClashView
            frame={flow.clash}
            units={flow.units}
            numbers={flow.clash.numbers.length ? flow.clash.numbers.map((n, i) => ({ ...n, id: 9000 + i, kind: n.kind })) : flow.numbers}
            qteSlot={<QteLayer prompt={flow.qte} onResolve={flow.submitQte} />}
          />
        )}
      </AnimatePresence>

      {/* QTE can also appear without a clash frame (defensive block) */}
      {!flow.clash && <QteLayer prompt={flow.qte} onResolve={flow.submitQte} />}

      {/* ------------------------------- action bar ---------------------------- */}
      <div className={clashActive ? 'pointer-events-none opacity-40' : ''}>
        <ActionBar
          unit={flow.activeUnit}
          usable={flow.activeUsable}
          mana={flow.activeUnit?.mana ?? 0}
          disabled={flow.phase !== 'action'}
          pickedSkill={pickedSkill}
          onPickSkill={(id) => { setPickedSkill(id); if (!id) setPickedTarget(null); audio().sfx('select'); }}
          onCommit={commit}
        />
      </div>

      {/* ------------------------------ intro overlay -------------------------- */}
      <AnimatePresence>
        {!started && (
          <motion.div className="absolute inset-0 z-50 grid place-items-center bg-black/80 px-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-[1180px]">
              <div className="mb-3 text-center">
                <div className="font-display text-[13px] uppercase tracking-[.44em] text-gild/80">{config.boss ? 'Trận Chiến Boss' : 'Bắt Đầu ải'} {config.stageId}</div>
                <h2 className="title-grad font-display text-4xl tracking-[.06em]">{config.name}</h2>
                <p className="mx-auto mt-1 max-w-xl text-[12px] text-white/55">{config.desc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Panel className="p-2.5">
                  <div className="mb-2 text-[10px] uppercase tracking-[.26em] text-emerald-300/80">Đội hình của bạn — thứ tự hành động</div>
                  <div className="flex gap-2 overflow-hidden">
                    {config.party.map((u, i) => (
                      <div key={u.uid} className="relative flex w-[15%] min-w-[104px] flex-col items-center rounded-lg border border-white/10 bg-black/40 pb-1.5 pt-1">
                        <Sprite defId={u.sprite} pose="idle" className="pointer-events-none" style={{ height: 118 }} />
                        <div className="flex w-full items-center justify-center gap-1 px-1">
                          <span className="truncate text-[10px] font-bold text-white/80">{u.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ElementBadge element={u.element} size={14} />
                          <span className="text-[9px] text-white/45">Lv{u.level}</span>
                          <span className="rounded bg-white/10 px-1 text-[9px] font-black text-gild">{i + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel className="p-2.5">
                  <div className="mb-2 text-[10px] uppercase tracking-[.26em] text-rose-300/80">Quái vật</div>
                  <div className="flex gap-2 overflow-hidden">
                    {config.foes.map((u) => (
                      <div key={u.uid} className={`relative flex w-[15%] min-w-[104px] flex-col items-center rounded-lg border pb-1.5 pt-1 ${u.boss ? 'border-blood/60 bg-blood/10' : 'border-white/10 bg-black/40'}`}>
                        <Sprite defId={u.sprite} pose="idle" flip className="pointer-events-none" style={{ height: 118 }} />
                        <span className="truncate px-1 text-[10px] font-bold text-white/80">{u.name}</span>
                        <div className="flex items-center gap-1">
                          <ElementBadge element={u.element} size={14} />
                          <span className="text-[9px] text-white/45">Lv{u.level}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <Btn size="lg" tone="gold" onClick={() => { audio().sfx('aura'); setStarted(true); }}>
                  <Icon name="next" size={16} /> VÀO TRẬN
                </Btn>
                <Btn size="lg" tone="ghost" onClick={() => router.push('/')}>Quay lại</Btn>
              </div>
              <div className="mt-2 text-center text-[10px] uppercase tracking-[.2em] text-white/35">
                mỗi lượt tự đổ xúc xắc 6 mặt · tối đa 6 điểm · QTE quyết định sát thương
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------- outcome ------------------------------ */}
      <AnimatePresence>
        {resultData && <ResultOverlay config={config} result={resultData} settle={settle} snap={snap} onRetry={() => router.refresh()} onExit={() => router.push('/')} />}
      </AnimatePresence>
    </div>
  );
}

function SquadPips({ units, right }: { units: { uid: string; name: string; hp: number; hpMax: number; alive: boolean; element: 'fire' | 'ice' | 'thunder' | 'nature' | 'holy' | 'dark' | 'neutral' }[]; right?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 py-1 ${right ? 'items-end' : 'items-start'}`}>
      {units.map((u) => (
        <div key={u.uid} className="flex items-center gap-1 rounded-md border border-white/10 bg-black/45 px-1.5 py-[2px]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ELEMENT_COLORS[u.element] }} />
          <span className={`text-[9px] ${u.alive ? 'text-white/75' : 'text-white/30 line-through'}`}>{u.name.slice(0, 9)}</span>
          <span className="h-1 w-10 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(0, (u.hp / Math.max(1, u.hpMax)) * 100)}%`, background: u.hp / Math.max(1, u.hpMax) > 0.35 ? '#34d399' : '#fb7185' }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingBattle() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gild/30 border-t-gild" />
        <div className="text-[11px] uppercase tracking-[.3em] text-white/40">dựng chiến trường</div>
      </div>
    </div>
  );
}

function ResultOverlay({
  config, result, settle, snap, onRetry, onExit,
}: {
  config: BattleConfigView;
  result: { win: boolean; rounds: number };
  settle: { state: 'idle' | 'busy' | 'done' | 'error'; msg?: string; data?: Awaited<ReturnType<typeof settleBattle>>['data'] };
  snap: PlayerSnapshot | null;
  onRetry: () => void;
  onExit: () => void;
}) {
  const router = useRouter();
  const data = settle.data as { rewards?: { gold: number; gem: number }; drops?: number[]; progress?: number } | undefined;
  const win = result.win;
  return (
    <motion.div className="absolute inset-0 z-[55] grid place-items-center bg-black/85 px-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Panel className="w-full max-w-2xl p-5" glow={win}>
        <div className="text-center">
          <div className={`font-display text-[42px] leading-none tracking-[.16em] ${win ? 'title-grad' : 'text-rose-300'}`}>{win ? 'CHIẾN THẮNG' : 'BẠI BINH'}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[.3em] text-white/45">{config.name} · {result.rounds} hiệp</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Reward label="Vàng" value={data?.rewards?.gold ?? 0} tone="#ffe08a" icon="coin" />
          <Reward label="Ngọc" value={data?.rewards?.gem ?? 0} tone="#e2ccff" icon="gem" />
          <Reward label="EXP" value={config.reward.exp} tone="#a7f3d0" icon="star" />
        </div>
        {!!data?.drops?.length && (
          <div className="mt-3 rounded-lg border border-gild/30 bg-gild/[.06] p-2 text-center">
            <div className="text-[10px] uppercase tracking-[.24em] text-gild/80">rơi trang bị</div>
            <div className="mt-1 text-[12px] text-amber-100">{data.drops.length} món mới trong túi — xem ở mục Trang Bị</div>
          </div>
        )}
        {win && (data?.progress ?? 0) > config.stageId && (
          <div className="mt-2 text-center text-[12px] text-emerald-300">Mở khóa ải {data?.progress}!</div>
        )}
        {!win && <div className="mt-2 text-center text-[11px] text-white/45">Phần thưởng an ủi 12% Vàng &amp; 20% EXP. Hãy nâng cấp kỹ năng, đổi mục tiêu khắc chế hệ, hoặc quay Gacha tìm SSR.</div>}
        <div className="mt-4 flex items-center justify-center gap-2">
          <Btn tone="ghost" onClick={onRetry}>Thử lại</Btn>
          <Btn tone="gold" onClick={() => { onExit(); }}>{win ? 'Tiếp tục' : 'Về thành trì'}</Btn>
          {win && config.stageId < 10 && (
            <Btn tone="green" onClick={() => router.push(`/battle?stage=${config.stageId + 1}`)}>Ải {config.stageId + 1}</Btn>
          )}
        </div>
        {settle.state === 'busy' && <div className="mt-2 text-center text-[10px] uppercase tracking-[.2em] text-white/35">đang xác nhận kết quả với server…</div>}
        {settle.state === 'error' && <div className="mt-2 text-center text-[10px] text-rose-300">Lỗi xác nhận: {settle.msg} {snap ? '' : '(mất kết nối)'}</div>}
      </Panel>
    </motion.div>
  );
}

function Reward({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-2">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-[.2em] text-white/45">
        <Icon name={icon} size={12} color={tone} /> {label}
      </div>
      <div className="mt-0.5 font-display text-[22px] font-black tabular-nums" style={{ color: tone }}>+{value.toLocaleString('vi-VN')}</div>
    </div>
  );
}

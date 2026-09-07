'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  actSkill, currentUnit, finishTurn, foeApply, foeChoose, initBattle, partyPreview,
  partyTurnOpen, rollDice, usableSkills,
  type BattleState, type CombatantSeed, type RuntimeSkill, type Unit,
} from '../../game/engine/battle';
import type { ClientActionEntry } from './api';
import { audio } from '../../game/audio/synth';
import type { BattleConfigView, FloatNumber, FlowPhase, Pose, QtePromptView, UnitView } from './types';
import type { SkillRuntime } from '../../game/types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** UnitSeedView -> engine CombatantSeed */
function toSeed(v: unknown) {
  const u = v as {
    uid: string; defId: string; name: string; slot: number; side: 'party' | 'foe'; role: CombatantSeed['role'];
    element: CombatantSeed['element']; level: number; rarity?: CombatantSeed['rarity']; boss?: boolean;
    stats: CombatantSeed['stats']; mods?: CombatantSeed['mods'];
  };
  return {
    uid: u.uid, defId: u.defId, name: u.name, slot: u.slot, side: u.side, role: u.role, element: u.element,
    level: u.level, rarity: u.rarity, boss: u.boss, stats: u.stats, mods: u.mods ?? {}, skills: [],
  };
}

export interface ClashFrame {
  actorUid: string;
  pose: Pose;
  targetUids: string[];
  selfOnly: boolean;
  skillName: string;
  element: string;
  /** damage numbers appear after the strike animation */
  numbers: { uid: string; text: string; kind: FloatNumber['kind'] }[];
  statuses: { uid: string; kind: string }[];
  deaths: string[];
}

export function useBattleFlow(config: BattleConfigView | null) {
  const stRef = useRef<BattleState | null>(null);
  const runtimeRef = useRef<Map<string, RuntimeSkill[]>>(new Map());
  const [units, setUnits] = useState<UnitView[]>([]);
  const [phase, setPhase] = useState<FlowPhase>('intro');
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [dice, setDice] = useState<{ faces: number[]; total: number; bonus: boolean; rolling: boolean } | null>(null);
  const [clash, setClash] = useState<ClashFrame | null>(null);
  const [numbers, setNumbers] = useState<FloatNumber[]>([]);
  const [qte, setQte] = useState<QtePromptView | null>(null);
  const [round, setRound] = useState(1);
  const [result, setResult] = useState<{ win: boolean; rounds: number } | null>(null);
  const [speed, setSpeed] = useState(1);
  const numId = useRef(1);
  const actionLog = useRef<ClientActionEntry[]>([]);
  const pendingBlock = useRef<((v: number) => void) | null>(null);
  const startedRef = useRef(false);

  /* ------------------------------- bootstrap ------------------------------- */
  useEffect(() => {
    if (!config || startedRef.current) return;
    startedRef.current = true;
    const toRuntime = (s: BattleConfigView['party'][number]['skills'][number]): RuntimeSkill => ({
      id: s.id, name: s.name, level: s.level, cost: s.cost, target: s.target, element: s.element,
      effects: s.effects, qte: s.qte, qteStrictness: s.strictness, hits: s.hits,
    } as unknown as RuntimeSkill);
    for (const u of [...config.party, ...config.foes]) runtimeRef.current.set(u.uid, u.skills.map(toRuntime));

    const st = initBattle(
      {
        stageId: config.stageId, seed: config.seed >>> 0, maxRounds: config.maxRounds,
        party: config.party.map(toSeed) as unknown as CombatantSeed[],
        foes: config.foes.map(toSeed) as unknown as CombatantSeed[],
      },
      (u) => runtimeRef.current.get(u.uid) ?? [],
    );
    stRef.current = st;
    syncUnits(st);
    setRound(st.round);
    void beginTurn();
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const toSeedView = (u: Unit): UnitView => ({
    uid: u.uid, sprite: u.defId, name: u.name, side: u.side, slot: u.slot, role: u.role, element: u.element,
    level: u.level, boss: u.boss, hp: Math.max(0, u.hp), hpMax: u.base.hpMax, mana: u.mana,
    statuses: u.statuses.map((s) => ({ kind: s.kind, turns: s.turns, potency: s.potency })),
    pose: u.alive ? 'idle' : 'dead', poseKey: 0, alive: u.alive,
    skills: (runtimeRef.current.get(u.uid) ?? []) as unknown as UnitView['skills'],
    rarity: u.rarity,
  });

  const syncUnits = (st: BattleState) => setUnits(st.units.map(toSeedView));

  const setPose = (st: BattleState, uidKey: string, pose: Pose) => {
    const u = st.units.find((x) => x.uid === uidKey);
    if (!u) return;
    setUnits((prev) => prev.map((v) => (v.uid === uidKey ? { ...v, pose, poseKey: v.poseKey + 1 } : v)));
  };

  const pushNumbers = (items: { uid: string; text: string; kind: FloatNumber['kind'] }[]) => {
    const stamped = items.map((i) => ({ ...i, id: numId.current++ }));
    setNumbers((p) => [...p, ...stamped]);
    const ids = stamped.map((s) => s.id);
    setTimeout(() => setNumbers((p) => p.filter((n) => !ids.includes(n.id))), 1100 / speedRef.current);
  };

  const speedRef = useRef(1);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const sfx = (n: string) => audio().sfx(n as never);

  /* ------------------------------ turn machine ------------------------------ */

  const beginTurn = useCallback(async () => {
    const st = stRef.current;
    if (!st || st.result) { finish(); return; }
    const u = currentUnit(st);
    if (!u) { finish(); return; }
    setActiveUid(u.uid);

    if (st.phase === 'party') {
      if (partyTurnOpen(st) === 'skipped') { syncUnits(st); await wait(260); return beginTurn(); }
      setPhase('dice');
      setDice({ faces: [], total: 0, bonus: false, rolling: true });
      audio().sfx('diceShake');
      const dur = 900 / speedRef.current;
      const t0 = performance.now();
      const spin = setInterval(() => {
        audio().diceTick((performance.now() - t0) / dur);
      }, 90);
      await wait(dur);
      clearInterval(spin);
      const res = rollDice(st, u);
      setDice({ faces: res.faces, total: res.total, bonus: res.bonus, rolling: false });
      audio().sfx('diceLand');
      syncUnits(st);
      await wait(620 / speedRef.current);
      if (st.result) { finish(); return; }
      setPhase('action');
    } else {
      // foe turn — AI, with a block QTE when the strike is telegraphed as blockable
      const it = foeChoose(st, u);
      if (!it) { finishTurn(st); return beginTurn(); }
      const skill = it.skill as unknown as { name: string };
      let blockMastery: number | undefined;
      const def = it.skill as unknown as { qte?: string };
      if (it.qte === 'block') {
        setPhase('clash');
        setClash({
          actorUid: u.uid, pose: 'skill', targetUids: it.targets.map((t) => t.uid), selfOnly: false,
          skillName: skill.name, element: (u.element as string) ?? 'neutral', numbers: [], statuses: [], deaths: [],
        });
        await wait(140 / speedRef.current);
        const mastery = await askQte({ kind: 'block', strictness: def.qte === 'block' ? 0.9 : 0.8, actorUid: u.uid, targetUids: it.targets.map((t) => t.uid), mode: 'incoming' });
        blockMastery = mastery;
      }
      const before = st.events.length;
      foeApply(st, u, it, blockMastery);
      await playEvents(st, before, u, it.targets.map((t) => t.uid));
      setClash(null);
      finishTurn(st);
      syncUnits(st);
      if (st.result) { finish(); return; }
      return beginTurn();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const askQte = useCallback((prompt: QtePromptView) => {
    return new Promise<number>((resolve) => {
      pendingBlock.current = resolve;
      setQte(prompt);
    });
  }, []);

  const submitQte = useCallback((mastery: number) => {
    const r = pendingBlock.current;
    pendingBlock.current = null;
    setQte(null);
    r?.(mastery);
  }, []);

  /** play out the events generated by the last action as clash animation */
  const playEvents = useCallback(async (st: BattleState, fromIdx: number, actor: Unit, forcedTargets: string[]) => {
    const evs = st.events.slice(fromIdx);
    const numbersFor: { uid: string; text: string; kind: FloatNumber['kind'] }[] = [];
    const statusesFor: { uid: string; kind: string }[] = [];
    const deaths: string[] = [];
    let counterSeen = 0;
    for (const e of evs) {
      if (e.e === 'damage') {
        const target = st.units.find((u) => u.uid === e.to);
        numbersFor.push({ uid: e.to, text: String(e.amount), kind: e.crit ? 'crit' : e.counter > 1 ? 'counter' : 'damage' });
        if (e.counter > 1) counterSeen++;
        if (target && !target.alive) deaths.push(e.to);
        setPose(st, e.to, target?.alive ? 'hit' : 'dead');
        if (e.source === 'status') sfx('burn'); else if (e.crit) sfx('crit'); else sfx('hit');
      } else if (e.e === 'heal') {
        numbersFor.push({ uid: e.to, text: `+${e.amount}`, kind: 'heal' });
        if (e.kind === 'heal') sfx('heal');
      } else if (e.e === 'shield') {
        numbersFor.push({ uid: e.to, text: `⟡${e.amount}`, kind: 'shield' });
      } else if (e.e === 'status' && e.applied) {
        statusesFor.push({ uid: e.to, kind: e.status });
        numbersFor.push({ uid: e.to, text: statusLabel(e.status), kind: 'status' });
        sfx(statusSfx(e.status));
      } else if (e.e === 'status' && e.resisted) {
        numbersFor.push({ uid: e.to, text: 'KHÁNG', kind: 'miss' });
      } else if (e.e === 'death') {
        if (!deaths.includes(e.uid)) deaths.push(e.uid);
        setPose(st, e.uid, 'dead');
        sfx('death');
      } else if (e.e === 'revive') {
        numbersFor.push({ uid: e.uid, text: 'HỒI SINH', kind: 'info' });
        setPose(st, e.uid, 'skill');
      } else if (e.e === 'execute') {
        numbersFor.push({ uid: e.uid, text: 'CHỐT ĐƠN', kind: 'crit' });
      } else if (e.e === 'block') {
        numbersFor.push({ uid: e.uid, text: e.success ? 'ĐỠ!' : 'XUYÊN', kind: e.success ? 'block' : 'damage' });
        sfx(e.success ? 'block' : 'hit');
      } else if (e.e === 'absorb') {
        numbersFor.push({ uid: e.to, text: `-${e.amount}`, kind: 'info' });
      } else if (e.e === 'cleanse' && e.removed.length) {
        numbersFor.push({ uid: e.to, text: 'THANH TẨY', kind: 'info' });
      } else if (e.e === 'dispel' && e.removed.length) {
        numbersFor.push({ uid: e.to, text: 'GỠ BUFF', kind: 'info' });
      } else if (e.e === 'killHeal') {
        numbersFor.push({ uid: e.uid, text: `+${e.amount}`, kind: 'heal' });
      }
    }
    const targets = forcedTargets.length ? forcedTargets : Array.from(new Set(numbersFor.map((n) => n.uid)));
    const selfOnly = targets.length > 0 && targets.every((t) => st.units.find((u) => u.uid === t)?.side === actor.side);
    setClash({
      actorUid: actor.uid,
      pose: (evs.find((e) => e.e === 'cast') as { skillId?: string } | undefined) && ((evs.find((e) => e.e === 'cast') as { cost?: number }).cost ?? 0) > 0 ? 'skill' : 'attack',
      targetUids: targets, selfOnly,
      skillName: (evs.find((e) => e.e === 'cast') as { skillName?: string } | undefined)?.skillName ?? 'Tấn Công',
      element: actor.element, numbers: numbersFor, statuses: statusesFor, deaths,
    });
    setPose(st, actor.uid, (evs.find((e) => e.e === 'cast') as { cost?: number } | undefined)?.cost ? 'skill' : 'attack');
    if (counterSeen > 0) sfx('aura');
    syncUnits(st);
    await wait(300 / speedRef.current);
    pushNumbers(numbersFor);
    await wait(560 / speedRef.current);
    syncUnits(st);
    await wait(180 / speedRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** player commits an action from the action bar */
  const commitAction = useCallback(async (skillId: string, targetUid: string | null) => {
    const st = stRef.current;
    if (!st) return;
    const u = currentUnit(st);
    if (!u || st.phase !== 'party' || !st.opened) return;
    const list = usableSkills(st, u);
    const sk = list.find((s) => (s as unknown as { id: string }).id === skillId);
    if (!sk) { sfx('error'); return; }
    const intent = partyPreview(st, u, sk, targetUid);
    let mastery: number | undefined;

    setPhase('clash');
    if (intent.qte) {
      // QTE happens inside the zoomed clash, between the two fighters
      setClash({
        actorUid: u.uid, pose: 'attack', targetUids: intent.targets, selfOnly: intent.selfOnly,
        skillName: '', element: intent.element, numbers: [], statuses: [], deaths: [],
      });
      setPose(st, u.uid, 'skill');
      await wait(120 / speedRef.current);
      mastery = await askQte({ kind: intent.qte, strictness: intent.strictness, actorUid: u.uid, targetUids: intent.targets, mode: 'outgoing' });
      sfx(mastery > 0.85 ? 'qteGood' : mastery > 0.4 ? 'select' : 'qteMiss');
    }

    const before = st.events.length;
    actSkill(st, u, sk, intent.targets[0] ?? null, mastery);
    actionLog.current.push({
      uid: u.uid, skillId, targetUid: intent.targets[0] ?? null,
      mastery: mastery ?? 0.85, blockMastery: 0,
    });
    await playEvents(st, before, u, intent.targets);
    setClash(null);
    finishTurn(st);
    syncUnits(st);
    if (st.result) { finish(); return; }
    void beginTurn();
  }, [askQte, beginTurn, playEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipTurn = useCallback(async () => {
    const st = stRef.current;
    if (!st || st.phase !== 'party' || !st.opened) return;
    const u = currentUnit(st);
    if (!u) return;
    // always use the free basic attack on the first alive foe
    const basic = usableSkills(st, u).find((s) => (s as unknown as { cost: number }).cost === 0) ?? u.skills[0];
    if (basic) await commitAction((basic as unknown as { id: string }).id, foesAlive(st)[0]?.uid ?? null);
    else { finishTurn(st); syncUnits(st); void beginTurn(); }
  }, [commitAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    const st = stRef.current;
    if (!st || result) return;
    setPhase('result');
    setResult({ win: st.result === 'win', rounds: st.round });
    audio().stopMusic();
    audio().sfx(st.result === 'win' ? 'victory' : 'defeat');
  }, [result]);

  const foesAlive = (st: BattleState) => st.units.filter((x) => x.side !== 'party' && x.alive);

  const activeUnit = useMemo(() => units.find((u) => u.uid === activeUid) ?? null, [units, activeUid]);
  const activeUsable = useMemo(() => {
    if (!activeUnit || phase !== 'action') return [];
    const shocked = activeUnit.statuses.some((s) => s.kind === 'shock');
    return activeUnit.skills.filter((s) => s.cost <= activeUnit.mana && (!shocked || s.cost === 0));
  }, [activeUnit, phase]);

  return {
    config, units, phase, dice, clash, numbers, qte, round, result, activeUnit, activeUsable, speed, setSpeed,
    commitAction, skipTurn, submitQte, actionLog,
    actions: () => actionLog.current,
    state: () => stRef.current,
    foesAliveOf: (side: 'party' | 'foe') => (stRef.current ? stRef.current.units.filter((u) => u.side !== side && u.alive) : []),
  };
}

export function statusLabel(k: string) {
  switch (k) {
    case 'burn': return 'THIÊU ĐỐT';
    case 'poison': return 'NGỘ ĐỘC';
    case 'freeze': return 'ĐÓNG BĂNG';
    case 'shock': return 'TÊ LIỆT';
    case 'regen': return 'HỒI MÁU';
    case 'shield': return 'KHIÊN';
    case 'taunt': return 'KHIÊU KHÍCH';
    case 'atkUp': return 'CÔNG +';
    case 'defUp': return 'THỦ +';
    case 'atkDown': return 'CÔNG −';
    case 'defDown': return 'THỦ −';
    default: return k.toUpperCase();
  }
}
export function statusSfx(k: string) {
  switch (k) {
    case 'burn': return 'burn';
    case 'poison': return 'poison';
    case 'freeze': return 'freeze';
    case 'shock': return 'shock';
    case 'regen': return 'heal';
    case 'shield': return 'buff';
    case 'taunt': return 'debuff';
    default: return 'debuff';
  }
}

export type { SkillRuntime };

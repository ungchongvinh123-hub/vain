'use client';
import { motion } from 'framer-motion';
import { HoldPopover } from '../ui';
import { Icon, ELEMENT_COLORS } from '../Icon';
import type { SkillView, UnitView } from './types';

function CostPips({ cost }: { cost: number }) {
  return (
    <span className="absolute -bottom-[3px] left-1/2 flex -translate-x-1/2 gap-[2px] rounded-full border border-white/15 bg-black/85 px-1 py-[1px]">
      {cost === 0
        ? <span className="text-[8px] font-black leading-[8px] text-emerald-300">0</span>
        : Array.from({ length: Math.min(6, cost) }).map((_, i) => (
          <span key={i} className="h-[5px] w-[5px] rounded-[1px] bg-amber-200 shadow-[0_0_4px_rgba(245,196,83,.9)]" />
        ))}
    </span>
  );
}

/**
 * Icon-only skill bar. No names, no labels — press & hold a button to read the
 * detail popover (cost / effect / QTE), release to dismiss.
 */
export function ActionBar({
  unit, usable, onCommit, disabled, pickedSkill, onPickSkill, mana,
}: {
  unit: UnitView | null;
  usable: SkillView[];
  onCommit: (skillId: string) => void;
  disabled?: boolean;
  pickedSkill: string | null;
  onPickSkill: (id: string | null) => void;
  mana: number;
}) {
  const all = unit?.skills ?? [];
  if (!unit) return <div className="h-[86px]" />;
  const shocked = unit.statuses.some((s) => s.kind === 'shock');
  const frozen = unit.statuses.some((s) => s.kind === 'freeze');

  return (
    <div className="relative flex h-[86px] shrink-0 items-center gap-2 border-t border-white/10 bg-void-950/92 px-3">
      <div className="flex items-center gap-2">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/50">
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 120%, ${ELEMENT_COLORS[unit.element]}55, transparent 70%)` }} />
          <Icon name={unit.role === 'tank' ? 'shield' : unit.role === 'support' ? 'heal' : 'sword'} size={22} color={ELEMENT_COLORS[unit.element]} className="absolute inset-0 m-auto" />
        </div>
        <div className="w-[92px]">
          <div className="truncate text-[12px] font-bold text-white/85">{unit.name}</div>
          <div className="mt-[3px] flex gap-[3px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-2 w-4 rounded-[2px]" style={{ background: i < mana ? 'linear-gradient(180deg,#ffe9a8,#c08a1e)' : 'rgba(255,255,255,.12)' }} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-1 h-12 w-px bg-white/10" />

      <div className="flex flex-1 items-center justify-center gap-2">
        {all.slice(0, 7).map((s) => {
          const afford = s.cost <= mana && !disabled && !frozen;
          const shockBlocked = shocked && s.cost > 0;
          const enabled = afford && !shockBlocked;
          const picked = pickedSkill === s.id;
          const color = ELEMENT_COLORS[s.element as keyof typeof ELEMENT_COLORS] ?? '#fff';
          return (
            <HoldPopover
              key={s.id}
              width={286}
              content={<SkillDetail s={s} mana={mana} />}
            >
              <motion.button
                type="button"
                disabled={!enabled}
                whileTap={enabled ? { scale: .9 } : undefined}
                onPointerDown={() => { if (enabled) navigator.vibrate?.(8); }}
                onClick={() => {
                  if (!enabled) return;
                  if (needsTarget(s)) onPickSkill(picked ? null : s.id);
                  else onCommit(s.id);
                }}
                className={`relative h-[58px] w-[58px] rounded-xl border bg-gradient-to-b transition ${
                  picked ? 'from-amber-500/30 to-black/60 border-gild shadow-[0_0_18px_rgba(245,196,83,.45)]'
                    : enabled ? 'from-white/10 to-black/55 border-white/20 hover:border-white/45'
                      : 'from-black/50 to-black/70 border-white/8 opacity-40 saturate-0'
                }`}
                style={{ boxShadow: enabled && !picked ? `inset 0 0 0 1px ${color}30` : undefined }}
              >
                <span className="absolute inset-0 rounded-xl" style={{ boxShadow: picked ? `0 0 0 2px ${color}` : undefined }} />
                <Icon name={s.icon} size={28} color={enabled ? color : '#8b8798'} className="absolute inset-0 m-auto" />
                <CostPips cost={s.cost} />
                {s.qte && (
                  <span className="absolute right-[3px] top-[3px] h-2 w-2 rounded-full bg-emerald-300/90 shadow-[0_0_6px_#34d399]" title="Có QTE" />
                )}
                {s.level > 1 && <span className="absolute left-[3px] top-[2px] text-[9px] font-black text-amber-200/90">L{s.level}</span>}
              </motion.button>
            </HoldPopover>
          );
        })}
      </div>

      {pickedSkill && (
        <motion.div initial={{ x: 12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[.2em] text-gild/80">chọn mục tiêu bên phải</div>
          <button
            type="button"
            onClick={() => onPickSkill(null)}
            className="tap-scale flex h-9 items-center gap-1 rounded-lg border border-white/20 bg-white/5 px-2 text-[11px] text-white/70"
          >
            <Icon name="close" size={13} /> Hủy
          </button>
        </motion.div>
      )}
    </div>
  );
}

export function needsTarget(s: SkillView) {
  return s.target === 'enemyOne' || s.target === 'enemySpread' || s.target === 'allyOne' || s.target === 'allyDead';
}

function SkillDetail({ s, mana }: { s: SkillView; mana: number }) {
  const color = ELEMENT_COLORS[s.element as keyof typeof ELEMENT_COLORS] ?? '#fff';
  const targetLabel: Record<string, string> = {
    enemyOne: '1 quái', enemyAll: 'toàn bộ quái', enemySpread: 'mục tiêu ±1 ô', enemyFront: 'kẻ đầu hàng ngũ',
    allyOne: '1 đồng đội', allyAll: 'toàn đội', allyLowest: 'đồng đội yếu nhất', self: 'bản thân', allyDead: 'đồng đội đã ngã',
  };
  const qteLabel: Record<string, string> = {
    focus: 'QTE Tụ Lực — canh đúng vùng sáng để đạt tối đa sát thương',
    link: 'QTE Nối 3 Điểm — lần lượt chạm 3 điểm theo thứ tự',
    tap: 'QTE Tap — chạm tối đa 10 lần trong thời gian cho phép',
    block: 'QTE Đỡ Đòn — tụ lực đúng lúc để miễn nhiễm sát thương',
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold" style={{ color }}>{s.name}</span>
        <span className={`text-[10px] font-bold ${s.cost > mana ? 'text-rose-300' : 'text-emerald-300'}`}>
          {s.cost === 0 ? 'MIỄN PHÍ' : `${s.cost} XÚC XẮC`}
        </span>
      </div>
      <p className="text-[10.5px] leading-snug text-white/75">{s.desc}</p>
      <div className="flex flex-wrap gap-1 pt-0.5 text-[9px]">
        <span className="rounded border border-white/15 bg-white/5 px-1 py-[1px] text-white/70">Lv.{s.level}/5</span>
        <span className="rounded border border-white/15 bg-white/5 px-1 py-[1px] text-white/70">{targetLabel[s.target] ?? s.target}</span>
        {!!s.hits && s.hits > 1 && <span className="rounded border border-white/15 bg-white/5 px-1 py-[1px] text-white/70">{s.hits} hit</span>}
        {s.qte && <span className="rounded border border-emerald-400/40 bg-emerald-400/10 px-1 py-[1px] text-emerald-200">{QTE_SHORT(s.qte)}</span>}
      </div>
      {s.qte && <p className="text-[9.5px] leading-snug text-emerald-200/80">{qteLabel[s.qte]}</p>}
    </div>
  );
}
function QTE_SHORT(k: string) { return k === 'focus' ? 'TỤ LỰC' : k === 'link' ? 'NỐI ĐIỂM' : k === 'tap' ? 'TAP' : 'ĐỠ'; }

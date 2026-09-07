'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Panel, Btn, Chip, SectionTitle } from '../../components/ui';
import { Icon, ElementBadge, ELEMENT_COLORS } from '../../components/Icon';
import { PortraitCard } from '../../components/PortraitCard';
import { Sprite, MagicCircle } from '../../components/Sprite';
import { useGame } from '../../store/game';
import { CHAR_MAP } from '../../game/data/characters';
import { ROLE_META, GACHA } from '../../game/data/constants';
import type { Role } from '../../game/types';
import { characterCombat } from '../../game/systems/stats';
import { audio } from '../../game/audio/synth';

export function TeamClient() {
  const snap = useGame((s) => s.snapshot)!;
  const post = useGame((s) => s.post);
  const busy = useGame((s) => s.busy);
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [selected, setSelected] = useState<number | null>(null);

  const team = snap.team.map((id) => (id == null ? null : snap.owned.find((o) => o.instanceId === id) ?? null));
  const roster = useMemo(() => {
    return snap.owned
      .filter((o) => (filter === 'all' ? true : CHAR_MAP[o.charId]?.role === filter))
      .sort((a, b) => {
        const da = CHAR_MAP[a.charId], db = CHAR_MAP[b.charId];
        const inA = snap.team.includes(a.instanceId) ? 1 : 0, inB = snap.team.includes(b.instanceId) ? 1 : 0;
        const rr = (x?: string) => (x === 'SSR' ? 3 : x === 'SR' ? 2 : 1);
        return inB - inA || rr(db?.rarity) - rr(da?.rarity) || b.level - a.level;
      });
  }, [snap.owned, snap.team, filter]);

  const doTeam = async (instanceId: number, mode: 'add' | 'remove' | 'move', toSlot?: number) => {
    audio().sfx(mode === 'remove' ? 'uiBack' : 'select');
    await post('/api/team', { instanceId, mode, toSlot });
  };

  const teamStats = team.filter(Boolean).map((oc) => ({ oc: oc!, data: characterCombat(oc!, snap.gear) }));
  const sums = teamStats.reduce((acc, s) => ({
    hp: acc.hp + s.data.stats.hpMax, atk: acc.atk + s.data.stats.atk, def: acc.def + s.data.stats.def,
  }), { hp: 0, atk: 0, def: 0 });
  const roles = teamStats.reduce((acc, s) => { const r = CHAR_MAP[s.oc.charId].role; acc[r] = (acc[r] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-2.5 p-2.5">
      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle right={<Chip tone="violet">5 ô · hành động theo thứ tự</Chip>}>Đội Hình Chiến Đấu</SectionTitle>
        <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-lg border border-white/10" style={{ background: 'linear-gradient(180deg, rgba(74,54,116,.22), rgba(5,4,10,.9))' }}>
          <div className="fx-floor" />
          <div className="absolute inset-x-0 bottom-3 flex items-end justify-start gap-1 px-3">
            {Array.from({ length: 5 }).map((_, i) => {
              const oc = team[i];
              const def = oc ? CHAR_MAP[oc.charId] : null;
              return (
                <motion.div key={i} layout className="relative flex flex-col items-center" style={{ width: 168 }}>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                    {def && <MagicCircle element={def.element} size={140} active={selected === oc?.instanceId} />}
                  </div>
                  {oc && def ? (
                    <div className="relative flex flex-col items-center">
                      <motion.div whileHover={{ y: -6 }} className="relative">
                        <button type="button" onClick={() => setSelected(selected === oc.instanceId ? null : oc.instanceId)}>
                          <Sprite defId={def.id} pose="idle" style={{ height: 190 }} glow={ELEMENT_COLORS[def.element]} />
                        </button>
                        <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-black/75 px-1.5 text-[10px] font-black text-gild">#{i + 1}</span>
                      </motion.div>
                      <div className="mt-1 w-full truncate rounded border border-white/10 bg-black/50 px-1 text-center text-[10px] font-bold text-white/85">{def.name}</div>
                      <div className="mt-1 flex w-full gap-1">
                        {i > 0 && <IconBtn icon="back" title="lùi" onClick={() => void doTeam(oc.instanceId, 'move', i - 1)} />}
                        <IconBtn icon="minus" title="tháo" onClick={() => void doTeam(oc.instanceId, 'remove')} danger />
                        {i < 4 && team[i + 1] && <IconBtn icon="next" title="đẩy" onClick={() => void doTeam(oc.instanceId, 'move', i + 1)} />}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="hatch flex h-[236px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-[10px] text-white/40"
                    >
                      <Icon name="plus" size={18} />
                      ô {i + 1} trống
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <Stat label="Máu" value={sums.hp} tone="#34d399" />
          <Stat label="Công" value={sums.atk} tone="#fb7185" />
          <Stat label="Thủ" value={sums.def} tone="#60a5fa" />
          <div className="rounded-lg border border-white/10 bg-black/40 p-2">
            <div className="text-[9px] uppercase tracking-[.2em] text-white/40">Cấu trúc</div>
            <div className="mt-1 flex gap-1 text-[10px]">
              {(['tank', 'attacker', 'support'] as Role[]).map((r) => (
                <span key={r} className="rounded px-1 py-[1px]" style={{ background: `${ROLE_META[r].color}22`, color: ROLE_META[r].color }}>
                  {ROLE_META[r].vn} {roles[r] ?? 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col p-2.5">
        <div className="mb-1.5 flex items-center gap-1">
          {(['all', 'tank', 'attacker', 'support'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { audio().sfx('ui'); setFilter(f); }}
              className={`rounded-md border px-2 py-[3px] text-[10px] font-bold transition ${filter === f ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/50 hover:text-white/80'}`}
            >
              {f === 'all' ? 'TẤT CẢ' : ROLE_META[f].vn}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-white/35">{roster.length} bản sao</span>
        </div>
        <div className="thin-scroll -mr-1 grid min-h-0 flex-1 grid-cols-2 content-start gap-1.5 overflow-y-auto pr-1">
          {roster.map((oc) => {
            const inTeam = snap.team.includes(oc.instanceId);
            const def = CHAR_MAP[oc.charId];
            return (
              <div key={oc.instanceId} className="relative">
                <PortraitCard oc={oc} gear={snap.gear} inTeam={inTeam} size="sm" selected={selected === oc.instanceId}
                  onClick={() => setSelected(oc.instanceId)} />
                <Btn
                  size="sm"
                  tone={inTeam ? 'danger' : 'green'}
                  className="absolute bottom-[52px] right-1 !h-6 !px-1.5 !text-[9px]"
                  disabled={busy || (!inTeam && snap.team.filter(Boolean).length >= 5)}
                  onClick={() => void doTeam(oc.instanceId, inTeam ? 'remove' : 'add')}
                >
                  {inTeam ? 'THÁO' : 'THÊM'}
                </Btn>
              </div>
            );
          })}
        </div>
        {selected != null && team.includes(snap.owned.find((o) => o.instanceId === selected) ?? null) === false && (
          <div className="mt-1.5 flex gap-2">
            <Btn size="sm" tone="gold" full onClick={() => void doTeam(selected, 'add')}>Vào ô trống đầu tiên</Btn>
          </div>
        )}
        <div className="mt-1.5 rounded-lg border border-white/10 bg-black/30 p-2 text-[10px] leading-snug text-white/50">
          Mẹo: Đỡ Đòn có Aggro ×3.2 nên quái ưu tiên nhắm vào. Giữ 1 Hỗ Trợ có hồi máu + thanh tẩy, và chọn hệ khắc chế quái của ải.
          Bản sao trùng tướng là hai đơn vị độc lập — bạn có thể xếp cả hai vào đội.
        </div>
        <div className="mt-1.5 text-[10px] text-white/35">Đảm bảo x10: sau {GACHA.pityTen} lượt luôn có ≥1 SR.</div>
      </Panel>
    </div>
  );
}

function IconBtn({ icon, onClick, title, danger }: { icon: string; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`tap-scale flex h-6 flex-1 items-center justify-center rounded border ${danger ? 'border-blood/40 bg-blood/10 text-rose-200' : 'border-white/15 bg-white/5 text-white/70'}`}
    >
      <Icon name={icon} size={12} />
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-2">
      <div className="text-[9px] uppercase tracking-[.2em] text-white/40">{label}</div>
      <div className="font-display text-[19px] font-black tabular-nums" style={{ color: tone }}>{value.toLocaleString('vi-VN')}</div>
    </div>
  );
}

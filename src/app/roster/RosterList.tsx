'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Btn, Chip, SectionTitle, RarityBadge } from '../../components/ui';
import { PortraitCard } from '../../components/PortraitCard';
import { useGame } from '../../store/game';
import { CHAR_MAP } from '../../game/data/characters';
import { ROLE_META, RARITY_META } from '../../game/data/constants';
import type { Rarity, Role } from '../../game/types';
import { audio } from '../../game/audio/synth';

type Sort = 'power' | 'newest' | 'level' | 'rarity';

export function RosterList() {
  const snap = useGame((s) => s.snapshot)!;
  const router = useRouter();
  const [role, setRole] = useState<Role | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('power');

  const list = useMemo(() => {
    const rr = (x?: Rarity) => (x === 'SSR' ? 3 : x === 'SR' ? 2 : 1);
    return snap.owned
      .filter((o) => {
        const d = CHAR_MAP[o.charId];
        if (!d) return false;
        if (role !== 'all' && d.role !== role) return false;
        if (rarity !== 'all' && d.rarity !== rarity) return false;
        if (q && !(`${d.name} ${d.title}`.toLowerCase().includes(q.toLowerCase()))) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'newest') return b.instanceId - a.instanceId;
        if (sort === 'level') return b.level - a.level;
        if (sort === 'rarity') return rr(CHAR_MAP[b.charId]?.rarity) - rr(CHAR_MAP[a.charId]?.rarity) || b.level - a.level;
        return (CHAR_MAP[b.charId]?.base.atk ?? 0) * b.level - (CHAR_MAP[a.charId]?.base.atk ?? 0) * a.level;
      });
  }, [snap.owned, role, rarity, q, sort]);

  const dupes = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of snap.owned) m.set(o.charId, (m.get(o.charId) ?? 0) + 1);
    return m;
  }, [snap.owned]);

  return (
    <div className="grid h-full grid-cols-[230px_minmax(0,1fr)] gap-2.5 p-2.5">
      <Panel className="flex min-h-0 flex-col gap-2 p-2.5">
        <SectionTitle>Bộ Lọc</SectionTitle>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="tên tướng…"
          className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[12px] outline-none placeholder:text-white/25 focus:border-gild/60"
        />
        <div className="flex flex-wrap gap-1">
          {(['all', 'tank', 'attacker', 'support'] as const).map((f) => (
            <button key={f} type="button" onClick={() => { audio().sfx('ui'); setRole(f); }}
              className={`rounded-md border px-2 py-[3px] text-[10px] font-bold ${role === f ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/50'}`}>
              {f === 'all' ? 'Mọi class' : ROLE_META[f].vn}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'SSR', 'SR', 'R'] as const).map((f) => (
            <button key={f} type="button" onClick={() => { audio().sfx('ui'); setRarity(f); }}
              className={`rounded-md border px-2 py-[3px] text-[10px] font-bold ${rarity === f ? 'border-gild bg-gild/15 text-amber-100' : 'border-white/10 text-white/50'}`}
              style={f !== 'all' && rarity === f ? { borderColor: RARITY_META[f as Rarity].color, color: RARITY_META[f as Rarity].color } : undefined}>
              {f === 'all' ? 'Mọi bậc' : f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-[10px]">
          {(['power', 'newest', 'level', 'rarity'] as Sort[]).map((s) => (
            <button key={s} type="button" onClick={() => setSort(s)} className={`rounded px-1.5 py-[2px] ${sort === s ? 'bg-white/15 text-white' : 'text-white/45'}`}>
              {s === 'power' ? 'Mạnh nhất' : s === 'newest' ? 'Mới nhận' : s === 'level' ? 'Cấp cao' : 'Độ hiếm'}
            </button>
          ))}
        </div>
        <div className="mt-1 space-y-1 rounded-lg border border-white/10 bg-black/30 p-2 text-[10px] text-white/55">
          <div className="flex justify-between"><span>Bản sao trong túi</span><b className="text-white">{snap.owned.length}</b></div>
          <div className="flex justify-between"><span>Tướng độc nhất</span><b className="text-white">{dupes.size}/{CHARACTERS_TOTAL}</b></div>
          <div className="flex justify-between"><span>Bản trùng</span><b className="text-amber-200">{[...dupes.values()].filter((v) => v > 1).length}</b></div>
          <p className="pt-1 leading-snug text-white/40">
            Bản trùng KHÔNG bị gộp hay mất — mỗi bản sao là một nhân vật riêng, có thể cùng đứng trong đội hình.
          </p>
        </div>
        <Btn tone="gold" size="sm" onClick={() => router.push('/gacha')}>Đi quay thêm</Btn>
      </Panel>

      <Panel className="flex min-h-0 flex-col p-2.5">
        <SectionTitle right={<Chip tone="violet">{list.length} kết quả</Chip>}>Túi Tướng</SectionTitle>
        <div className="thin-scroll -mr-1 grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(148px,1fr))] content-start gap-1.5 overflow-y-auto pr-1">
          {list.map((oc) => (
            <PortraitCard
              key={oc.instanceId}
              oc={oc}
              gear={snap.gear}
              inTeam={snap.team.includes(oc.instanceId)}
              onClick={() => router.push(`/roster?c=${oc.instanceId}`)}
              badge={(() => {
                const n = dupes.get(oc.charId) ?? 1;
                return n > 1 ? <span className="rounded bg-gild/25 px-1 text-[8px] font-black text-amber-100">×{n}</span> : null;
              })()}
            />
          ))}
          {!list.length && (
            <div className="col-span-full grid h-40 place-items-center text-[12px] text-white/35">chưa có tướng nào khớp bộ lọc</div>
          )}
        </div>
      </Panel>
    </div>
  );
}

import { CHARACTERS } from '../../game/data/characters';
const CHARACTERS_TOTAL = CHARACTERS.length;

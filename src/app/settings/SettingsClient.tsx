'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Btn, Chip, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useGame } from '../../store/game';
import { audio } from '../../game/audio/synth';
import { CHARACTERS } from '../../game/data/characters';

export function SettingsClient() {
  const snap = useGame((s) => s.snapshot);
  const prefs = useGame((s) => s.audio);
  const setPrefs = useGame((s) => s.setAudioPrefs);
  const post = useGame((s) => s.post);
  const boot = useGame((s) => s.boot);
  const dbOnline = useGame((s) => s.dbOnline);
  const router = useRouter();
  const [saveKey, setSaveKey] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [pick, setPick] = useState('t_nyx');

  return (
    <div className="grid h-full grid-cols-3 gap-2.5 p-2.5">
      <Panel className="p-3">
        <SectionTitle>Âm Thanh (Web Audio Synth)</SectionTitle>
        <p className="mb-2 text-[10px] leading-snug text-white/45">
          Toàn bộ nhạc nền &amp; hiệu ứng được tổng hợp bằng Web Audio API — không có một file âm thanh nào trong gói APK.
        </p>
        <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/35 px-2 py-2 text-[12px]">
          <span className="flex items-center gap-1.5"><Icon name={prefs.muted ? 'mute' : 'sound'} size={14} /> Bật âm thanh</span>
          <input type="checkbox" checked={!prefs.muted} onChange={(e) => setPrefs({ muted: !e.target.checked })} className="h-4 w-4 accent-amber-400" />
        </label>
        <label className="mt-1.5 flex items-center justify-between rounded-lg border border-white/10 bg-black/35 px-2 py-2 text-[12px]">
          <span className="flex items-center gap-1.5"><Icon name="star" size={14} /> Nhạc nền tự động</span>
          <input type="checkbox" checked={prefs.music} onChange={(e) => setPrefs({ music: e.target.checked })} className="h-4 w-4 accent-amber-400" />
        </label>
        <div className="mt-2 rounded-lg border border-white/10 bg-black/35 p-2">
          <div className="flex justify-between text-[11px] text-white/55"><span>Â lượng</span><b>{Math.round(prefs.volume * 100)}%</b></div>
          <input type="range" min={0} max={1} step={0.05} value={prefs.volume}
            onChange={(e) => setPrefs({ volume: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" />
        </div>
        <div className="mt-2 flex gap-1.5">
          <Btn size="sm" tone="violet" onClick={() => { audio().ensure(); audio().playMusic('menu'); audio().sfx('gacha'); }}>Test nhạc</Btn>
          <Btn size="sm" tone="ghost" onClick={() => audio().sfx('crit')}>Test đòn</Btn>
          <Btn size="sm" tone="ghost" onClick={() => audio().sfx('diceLand')}>Test xúc xắc</Btn>
        </div>
      </Panel>

      <Panel className="p-3">
        <SectionTitle right={<Chip tone={dbOnline ? 'green' : 'red'}>{dbOnline ? 'DB kết nối' : 'DB mất kết nối'}</Chip>}>Tập Tin Lưu</SectionTitle>
        <div className="space-y-1 text-[11px] text-white/60">
          <Row k="Người chơi" v={snap?.name ?? '—'} />
          <Row k="Vàng" v={String(snap?.gold ?? 0)} />
          <Row k="Ngọc" v={String(snap?.gem ?? 0)} />
          <Row k="Tổng lượt quay" v={String(snap?.pullCount ?? 0)} />
          <Row k="Bản sao tướng" v={String(snap?.owned.length ?? 0)} />
          <Row k="Trang bị" v={String(snap?.gear.length ?? 0)} />
          <Row k="Tiến độ ải" v={`${snap?.stageProgress ?? 1}/10`} />
        </div>
        <div className="mt-2 flex gap-1.5">
          <Btn size="sm" tone="blue" onClick={() => void boot()}>Nạp lại</Btn>
          <Btn size="sm" tone="ghost" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(snap)); }}>Copy save JSON</Btn>
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
          <div className="text-[10px] uppercase tracking-[.2em] text-white/40">Đổi slot lưu</div>
          <div className="mt-1 flex gap-1.5">
            <input value={saveKey} onChange={(e) => setSaveKey(e.target.value.replace(/[^a-z0-9_-]/g, ''))} placeholder="tên-slot (vd: hero-01)"
              className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[12px] outline-none focus:border-gild/60" />
            <Btn size="sm" tone="gold" onClick={async () => { await post('/api/save', { action: 'switchSave', saveKey }); router.refresh(); setTimeout(() => location.reload(), 250); }}>Chuyển</Btn>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/25 p-2">
          <div className="text-[11px] font-bold text-rose-200">Xóa toàn bộ tiến trình</div>
          <p className="mt-0.5 text-[10px] text-rose-200/60">Reset save về trạng thái người chơi mới (5 tướng khởi đầu).</p>
          {confirmWipe
            ? <div className="mt-1.5 flex gap-1.5">
              <Btn size="sm" tone="danger" onClick={async () => { await post('/api/save', { action: 'wipe' }); setConfirmWipe(false); await boot(); }}>Xác nhận xóa</Btn>
              <Btn size="sm" tone="ghost" onClick={() => setConfirmWipe(false)}>Hủy</Btn>
            </div>
            : <Btn size="sm" tone="danger" className="mt-1.5" onClick={() => setConfirmWipe(true)}>Xóa save</Btn>}
        </div>
      </Panel>

      <Panel className="p-3">
        <SectionTitle>Dev / Offline Test</SectionTitle>
        <p className="text-[10px] leading-snug text-white/45">
          Gói hỗ trợ test nhanh: cấp tài nguyên và tướng tức thì. Tắt ở bản release nếu bạn muốn kinh tế nguyên bản.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn size="sm" tone="gold" onClick={() => void post('/api/save', { action: 'cheat', gold: 50000, gem: 20000 })}>+50k vàng / +20k ngọc</Btn>
          <Btn size="sm" tone="green" onClick={() => void post('/api/save', { action: 'cheat', gold: 5000, gem: 1000 })}>+5k / +1k</Btn>
        </div>
        <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[.2em] text-white/40">Cấp một tướng vào túi</div>
          <div className="flex gap-1.5">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[12px]">
              {CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.rarity} · {c.name} — {c.title}</option>)}
            </select>
            <Btn size="sm" tone="violet" onClick={() => void post('/api/save', { action: 'grant', charId: pick })}>Cấp</Btn>
          </div>
        </div>
        <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-black/30 p-2 text-[10.5px] text-white/55">
          <div className="font-bold uppercase tracking-[.2em] text-white/70">Đóng gói Android</div>
          <p>• Layout đã khoá 16:9 (design space 1600×900) + <code>orientation: landscape</code> trong <code>capacitor.config.ts</code>.</p>
          <p>• Server Next chạy <code>output: standalone</code> khi build <code>BUILD_MODE=apk</code>.</p>
          <p>• Service Worker cache toàn bộ asset để mở được khi mất mạng.</p>
          <p>• GitHub Actions: <code>android.yml</code> build APK release + artifact tải về.</p>
        </div>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between border-b border-white/5 py-[3px]"><span className="text-white/45">{k}</span><b className="text-white/85">{v}</b></div>;
}

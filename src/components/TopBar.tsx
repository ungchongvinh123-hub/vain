'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Currency, Chip } from './ui';
import { Icon } from './Icon';
import { useGame } from '../store/game';
import { audio } from '../game/audio/synth';

export function TopBar() {
  const snap = useGame((s) => s.snapshot);
  const prefs = useGame((s) => s.audio);
  const setPrefs = useGame((s) => s.setAudioPrefs);
  const dbOnline = useGame((s) => s.dbOnline);
  const path = usePathname();
  const inBattle = path.startsWith('/battle');
  if (!snap) return <div className="h-12 shrink-0" />;

  return (
    <header className={`relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-void-950/90 px-3 ${inBattle ? 'opacity-95' : ''}`}>
      <Link href="/" className="flex items-center gap-2">
        <span className="font-display text-[19px] leading-none tracking-[.32em] text-gild title-grad">VAIN</span>
        <span className="hidden text-[9px] uppercase tracking-[.24em] text-white/35 lg:inline">Waifu Tactics</span>
      </Link>

      <div className="ml-2 hidden items-center gap-1.5 md:flex">
        <Chip tone={dbOnline ? 'green' : 'red'}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dbOnline ? '#34d399' : '#fb7185' }} />
          {dbOnline ? 'Save: PostgreSQL' : 'DB offline'}
        </Chip>
        <Chip tone="white">{snap.name}</Chip>
        <Chip tone="violet"> Ải {snap.stageProgress}/10</Chip>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Currency icon={<Icon name="coin" size={13} color="#f5c453" />} value={snap.gold} tone="#ffe08a" />
        <Currency icon={<Icon name="gem" size={13} color="#c084fc" />} value={snap.gem} tone="#e2ccff" />
        <button
          type="button"
          onClick={() => {
            const muted = !prefs.muted;
            setPrefs({ muted });
            if (!muted) { audio().ensure(); audio().sfx('ui'); }
          }}
          className="tap-scale flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/70"
          aria-label="bật/tắt âm thanh"
        >
          <Icon name={prefs.muted ? 'mute' : 'sound'} size={16} />
        </button>
      </div>
    </header>
  );
}

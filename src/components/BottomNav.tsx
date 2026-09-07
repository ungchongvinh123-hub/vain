'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useGame } from '../store/game';
import { audio } from '../game/audio/synth';

const TABS = [
  { href: '/', label: 'Trận Đấu', icon: 'map' },
  { href: '/gacha', label: 'Gacha', icon: 'gem' },
  { href: '/roster', label: 'Túi Tướng', icon: 'team' },
  { href: '/team', label: 'Đội Hình', icon: 'shield' },
  { href: '/gear', label: 'Trang Bị', icon: 'sword' },
  { href: '/shop', label: 'Cửa Hàng', icon: 'shop' },
  { href: '/settings', label: 'Cài Đặt', icon: 'gear' },
] as const;

export function BottomNav() {
  const path = usePathname();
  const snap = useGame((s) => s.snapshot);
  const battle = path.startsWith('/battle');
  if (battle) return null;
  return (
    <nav className="relative z-20 flex h-14 shrink-0 items-stretch gap-1 border-t border-white/10 bg-void-950/95 px-2 py-1.5">
      {TABS.map((t) => {
        const active = t.href === '/' ? path === '/' : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            onPointerDown={() => audio().sfx('ui')}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border text-[10px] font-semibold uppercase tracking-[.12em] transition
              ${active ? 'border-gild/60 bg-gild/10 text-amber-100' : 'border-transparent text-white/45 hover:border-white/15 hover:text-white/80'}`}
          >
            <Icon name={t.icon} size={17} color={active ? '#f5c453' : undefined} />
            <span className="max-w-full truncate">{t.label}</span>
            {t.href === '/gacha' && snap && snap.gem >= 900 && (
              <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            )}
            {active && <span className="absolute -top-[7px] left-1/2 h-px w-8 -translate-x-1/2 bg-gild" />}
          </Link>
        );
      })}
    </nav>
  );
}

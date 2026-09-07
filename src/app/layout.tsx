import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import '../styles/sprite.css';
import '../styles/battle.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'VAIN — Gacha Waifu Tactics',
  description: 'Offline turn-based gacha RPG. 30 waifus, dice mana, elemental counters, Darkest-Dungeon style clashes.',
  applicationName: 'VAIN',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VAIN' },
  other: {
    'mobile-web-app-capable': 'yes',
    'format-detection': 'telephone=no',
  },
};

export const viewport: Viewport = {
  themeColor: '#05040a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full">
      <body className="h-full" style={{ background: '#05040a' }}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

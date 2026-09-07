'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Fixed landscape 16:9 stage. Everything inside is laid out in a 1600×900
 * design space and uniformly scaled to the device — the exact behaviour we
 * want before wrapping the app in a Capacitor WebView (orientation locked to
 * landscape on Android).
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const DESIGN_W = 1600, DESIGN_H = 900;
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setPortrait(h > w * 1.08);
      const s = Math.min(w / DESIGN_W, h / DESIGN_H);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    const iv = window.setInterval(fit, 900); // cheap safety net for webview quirks
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('orientationchange', fit); window.clearInterval(iv); };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-void-950">
      {/* vignette + grain */}
      <div className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,.72)_100%)]" />
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{ width: 1600, height: 900, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div className="h-full w-full overflow-hidden rounded-[2px] bg-rune">
          {children}
        </div>
      </div>
      <AnimatePresence>
        {portrait && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-void-950/95 px-8 text-center"
          >
            <motion.div animate={{ rotate: [0, -90, -90, 0] }} transition={{ duration: 2.6, repeat: Infinity, times: [0, .3, .7, 1] }} className="text-5xl">
              📱
            </motion.div>
            <p className="font-display text-lg tracking-[.2em] text-gild">XOAY NGANG MÁY</p>
            <p className="max-w-xs text-sm text-white/60">VAIN được thiết kế cho màn hình ngang 16:9 — hãy xoay thiết bị sang ngang để vào trận.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

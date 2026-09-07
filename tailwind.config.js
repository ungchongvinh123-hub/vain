/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#05040a',
          900: '#0a0813',
          850: '#100d1e',
          800: '#161128',
          700: '#221a3d',
          600: '#322553',
          500: '#4a3674',
        },
        ember: '#ff5a3c',
        arcane: '#a855f7',
        gild: '#f5c453',
        blood: '#e11d48',
        verdant: '#34d399',
        frost: '#5cc8ff',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        ui: ['var(--font-ui)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 18px rgba(168,85,247,.45), 0 0 42px rgba(92,200,255,.18)',
        card: '0 18px 40px -18px rgba(0,0,0,.9)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.09)',
      },
      backgroundImage: {
        rune: "radial-gradient(circle at 50% 120%, rgba(168,85,247,.28), transparent 60%), linear-gradient(180deg, #0a0813 0%, #100d1e 55%, #05040a 100%)",
        vgap: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,.85) 100%)",
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseRing: {
          '0%': { transform: 'scale(.85)', opacity: '.9' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
      },
      animation: {
        floaty: 'floaty 3.4s ease-in-out infinite',
        shimmer: 'shimmer 2.6s linear infinite',
        ring: 'pulseRing 1.1s ease-out infinite',
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Sunday Field" — deep field green base with white yard lines.
        ink: {
          DEFAULT: '#0e3b24',
          900: '#0a2e1b',
          800: '#114a2d',
          700: '#165a37',
          600: '#1c6b42',
        },
        chalk: '#f1faf3',
        muted: '#a3cbb4',
        faint: '#6f9a82',
        accent: {
          DEFAULT: '#ffcb3d', // gold highlights
          dim: '#e0a52a',
        },
        gold: '#ffcb3d',
        primary: {
          DEFAULT: '#e63b30', // red CTAs / locked
          dim: '#c0281f',
        },
        line: 'rgba(255,255,255,0.14)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,203,61,0.45), 0 0 26px -6px rgba(255,203,61,0.5)',
        glowred: '0 0 22px -6px rgba(230,59,48,0.6)',
        card: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 24px 48px -24px rgba(0,0,0,0.55)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
      },
      animation: {
        riseIn: 'riseIn 0.6s cubic-bezier(0.2,0.7,0.2,1) both',
        pulseGlow: 'pulseGlow 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#090c10',
          900: '#0b0f14',
          800: '#0f141b',
          700: '#151c25',
          600: '#1d2731',
        },
        chalk: '#eef3f0',
        muted: '#8691a0',
        faint: '#5a6675',
        accent: {
          DEFAULT: '#c8ff3c',
          dim: '#9ad000',
        },
        gold: '#ffce4d',
        line: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200,255,60,0.4), 0 0 30px -6px rgba(200,255,60,0.45)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.8)',
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

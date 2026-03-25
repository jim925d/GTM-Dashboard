import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn CSS-variable-based semantic tokens
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // RevOS custom color tokens
        success: 'hsl(var(--success))',
        pipeline: 'hsl(var(--pipeline))',
        quote: 'hsl(var(--quote))',
        warning: 'hsl(var(--warning))',

        // Direct RevOS palette (matches constants.js T object)
        revos: {
          bg: '#06080F',
          surface: '#161B22',
          card: '#161B22',
          'card-hover': '#1C2128',
          border: '#21262D',
          'border-light': 'rgba(255,255,255,0.06)',
          text: '#e6edf3',
          'text-mid': '#c9d1d9',
          'text-dim': '#8b949e',
          tertiary: '#484f58',
          cyan: '#60a5fa',
          green: '#34d399',
          red: '#f87171',
          yellow: '#fbbf24',
          orange: '#f0883e',
          purple: '#a78bfa',
          blue: '#60a5fa',
          teal: '#2dd4bf',
          pink: '#f472b6',
          lime: '#a3e635',
          accent: '#7c5aff',
          'accent-dim': 'rgba(120,90,255,0.08)',
          'accent-border': 'rgba(120,90,255,0.15)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", '-apple-system', 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", "'SF Mono'", "'Cascadia Code'", 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.3)',
      },
      keyframes: {
        'fade-slide-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '0.8' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-slide-in': 'fade-slide-in 0.7s ease forwards',
        'fade-in':       'fade-in 0.6s ease forwards',
        'pulse-glow':    'pulse-glow 8s ease infinite',
        'spin-slow':     'spin-slow 4s linear infinite',
        'shimmer':       'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

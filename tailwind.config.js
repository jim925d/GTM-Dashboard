/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        revos: {
          bg: '#06080F',
          surface: '#0D1117',
          card: '#161B22',
          'card-hover': '#1C2333',
          border: '#21262D',
          'border-light': '#30363D',
          text: '#E6EDF3',
          'text-mid': '#8B949E',
          'text-dim': '#484F58',
          cyan: '#58A6FF',
          green: '#3FB950',
          red: '#F85149',
          yellow: '#D29922',
          orange: '#DB6D28',
          purple: '#BC8CFF',
          blue: '#388BFD',
          teal: '#2DD4BF',
          pink: '#F778BA',
          lime: '#A3E635',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", "'SF Mono'", "'Cascadia Code'", 'monospace'],
      },
    },
  },
  plugins: [],
}

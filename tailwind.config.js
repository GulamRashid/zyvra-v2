/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        green: 'var(--green)',
        gold: 'var(--gold)',
        accent: 'var(--accent)',
        forest: {
          950: '#07100C',
          900: '#0B1713',
          850: '#0F1D17',
          800: '#12231C',
          750: '#183126',
          700: '#214635',
          600: '#2D654A',
          500: '#378E61',
          400: '#42B878',
          300: '#72D39A',
          200: '#A3E5BA',
          100: '#D8F3E2',
          50: '#E8F3EC'
        },
        zyvra: {
          bg: '#0B1713',
          card: '#12231C',
          cardElevated: '#183126',
          cardGlass: 'rgba(18, 35, 28, 0.88)',
          border: 'rgba(116, 196, 146, 0.16)',
          borderHover: 'rgba(116, 196, 146, 0.32)',
          neon: '#42B878',
          neonHover: '#378E61',
          emerald: '#42B878',
          gold: '#f5c542',
          goldHover: '#eab308',
          goldLight: '#fde68a',
          textPrimary: '#E8F3EC',
          textSecondary: '#9AB0A3',
          textMuted: '#6E8879'
        }
      },
      boxShadow: {
        card: '0 18px 50px rgba(0,0,0,.22)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.24)',
        glowGreen: '0 0 25px -5px rgba(66, 184, 120, 0.22)',
        glowGold: '0 0 25px -5px rgba(245, 197, 66, 0.22)',
        cardEmerald: '0 10px 30px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(66, 184, 120, 0.1)'
      },
      backgroundImage: {
        'forest-radial': 'radial-gradient(ellipse 90% 60% at 50% -15%, #183126 0%, #0B1713 75%)',
        'forest-card': 'linear-gradient(145deg, rgba(18, 35, 28, 0.88), rgba(11, 23, 19, 0.95))',
        'gold-linear': 'linear-gradient(135deg, #fce072 0%, #e5a932 100%)',
        'neon-linear': 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)'
      }
    }
  },
  plugins: []
};

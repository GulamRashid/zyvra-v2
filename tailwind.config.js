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
          950: '#030f0a',
          900: '#04140e',
          850: '#061b13',
          800: '#072117',
          750: '#0a2a1e',
          700: '#0e3827',
          600: '#144e37',
          500: '#1b6e4f',
          400: '#22c55e',
          300: '#4ade80',
          200: '#86efac',
          100: '#dcfce7',
          50: '#f0fdf4'
        },
        zyvra: {
          bg: '#04140e',
          card: '#072117',
          cardElevated: '#0a2a1e',
          cardGlass: 'rgba(7, 33, 23, 0.82)',
          border: 'rgba(34, 197, 94, 0.15)',
          borderHover: 'rgba(34, 197, 94, 0.35)',
          neon: '#22c55e',
          neonHover: '#16a34a',
          emerald: '#10b981',
          gold: '#f5c542',
          goldHover: '#eab308',
          goldLight: '#fde68a',
          textPrimary: '#ffffff',
          textSecondary: '#8aa396',
          textMuted: '#52695c'
        }
      },
      boxShadow: {
        card: '0 18px 50px rgba(0,0,0,.35)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glowGreen: '0 0 25px -5px rgba(34, 197, 94, 0.35)',
        glowGold: '0 0 25px -5px rgba(245, 197, 66, 0.35)',
        cardEmerald: '0 10px 30px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 197, 94, 0.14)'
      },
      backgroundImage: {
        'forest-radial': 'radial-gradient(ellipse 90% 60% at 50% -15%, #0a2d20 0%, #04140e 75%)',
        'forest-card': 'linear-gradient(145deg, rgba(7, 33, 23, 0.85), rgba(4, 20, 14, 0.95))',
        'gold-linear': 'linear-gradient(135deg, #fce072 0%, #e5a932 100%)',
        'neon-linear': 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)'
      }
    }
  },
  plugins: []
};

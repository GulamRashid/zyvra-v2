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
        accent: 'var(--accent)'
      },
      boxShadow: {
        card: '0 18px 50px rgba(0,0,0,.18)'
      }
    }
  },
  plugins: []
};

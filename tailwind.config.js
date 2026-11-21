import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			bg: 'var(--bg)',
  			panel: 'var(--panel)',
  			panel2: 'var(--panel2)',
  			ink: 'var(--text)',
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			line: 'var(--line)',
  			green: 'var(--green)',
  			gold: 'var(--gold)',
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			navy: {
  				'50': '#F8FAFC',
  				'100': '#F1F5F9',
  				'200': '#E2E8F0',
  				'300': '#CBD5E1',
  				'400': '#94A3B8',
  				'500': '#64748B',
  				'600': '#475569',
  				'700': '#334155',
  				'750': '#283548',
  				'800': '#1E293B',
  				'850': '#0F172A',
  				'900': '#0B1120',
  				'950': '#070B14'
  			},
  			forest: {
  				'50': '#F8FAFC',
  				'100': '#F1F5F9',
  				'200': '#E2E8F0',
  				'300': '#CBD5E1',
  				'400': '#94A3B8',
  				'500': '#64748B',
  				'600': '#475569',
  				'700': '#334155',
  				'750': '#283548',
  				'800': '#1E293B',
  				'850': '#0F172A',
  				'900': '#0B1120',
  				'950': '#070B14'
  			},
  			zyvra: {
  				bg: '#0B1120',
  				card: '#1E293B',
  				cardElevated: '#334155',
  				cardGlass: 'rgba(30, 41, 59, 0.85)',
  				border: 'rgba(99, 102, 241, 0.2)',
  				borderHover: 'rgba(99, 102, 241, 0.4)',
  				indigo: '#4F46E5',
  				indigoHover: '#4338CA',
  				indigoDark: '#312E81',
  				emerald: '#10B981',
  				emeraldHover: '#059669',
  				amber: '#F59E0B',
  				orange: '#F97316',
  				neon: '#10B981',
  				neonHover: '#059669',
  				gold: '#F59E0B',
  				goldHover: '#D97706',
  				goldLight: '#FDE68A',
  				textPrimary: '#F8FAFC',
  				textSecondary: '#94A3B8',
  				textMuted: '#64748B'
  			}
  		},
  		boxShadow: {
  			card: '0 18px 50px rgba(0,0,0,.35)',
  			glass: '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
  			glowIndigo: '0 0 25px -5px rgba(79, 70, 229, 0.35)',
  			glowGreen: '0 0 25px -5px rgba(16, 185, 129, 0.3)',
  			glowGold: '0 0 25px -5px rgba(245, 158, 11, 0.35)',
  			glowOrange: '0 0 25px -5px rgba(249, 115, 22, 0.35)',
  			cardEmerald: '0 10px 30px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(16, 185, 129, 0.2)'
  		},
  		backgroundImage: {
  			'forest-radial': 'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(79, 70, 229, 0.18) 0%, #0B1120 75%)',
  			'forest-card': 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
  			'indigo-radial': 'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(79, 70, 229, 0.22) 0%, #0B1120 75%)',
  			'slate-card': 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
  			'gold-linear': 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
  			'orange-linear': 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
  			'neon-linear': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  			'indigo-linear': 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [tailwindcssAnimate]
};

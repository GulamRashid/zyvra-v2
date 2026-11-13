import { NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Wrench, BarChart3, User } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const navItems = [
  { to: '/', key: 'home', label: 'Home', Icon: Home, activeStyle: 'emerald' },
  { to: '/tests', key: 'practice', label: 'Practice', Icon: BookOpen, activeStyle: 'green' },
  { to: '/toolbox', key: 'toolbox', label: 'Toolbox', Icon: Wrench, activeStyle: 'emeraldBorder' },
  { to: '/analytics', key: 'performance', label: 'Performance', Icon: BarChart3, activeStyle: 'emerald' },
  { to: '/profile', key: 'profile', label: 'Profile', Icon: User, activeStyle: 'gold' }
];

export default function StudentBottomNav() {
  const { t } = useThemeLanguage();
  const location = useLocation();

  // Hide bottom nav on live quiz taking to prevent distractions (matching mockups)
  if (/^\/quiz\//.test(location.pathname)) {
    return null;
  }

  const getLabel = (item) => {
    if (item.key === 'practice') return t('practice') || 'Practice';
    if (item.key === 'performance') return t('performance') || 'Performance';
    return t(item.key) || item.label;
  };

  const isItemActive = (to) => {
    if (to === '/') return location.pathname === '/';
    if (to === '/tests') return location.pathname === '/tests' || location.pathname.startsWith('/explore');
    if (to === '/analytics') return location.pathname === '/analytics' || location.pathname === '/performance';
    return location.pathname.startsWith(to);
  };

  return (
    <nav
      className="student-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#04140e]/90 backdrop-blur-xl border-t border-emerald-500/15 shadow-[0_-8px_25px_rgba(0,0,0,0.5)] transition-all duration-300"
      aria-label="Student Mobile Navigation"
    >
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around gap-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {navItems.map((item) => {
          const active = isItemActive(item.to);
          const Icon = item.Icon;
          const label = getLabel(item);

          // Render active pill styles matching the mockup designs
          if (active) {
            if (item.activeStyle === 'gold') {
              // Gold Pill (Mockup Image 10: My Profile)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f5c542] text-[#04140e] font-bold text-xs shadow-md shadow-amber-400/25 transition-transform active:scale-95"
                  aria-current="page"
                >
                  <Icon size={17} strokeWidth={2.4} />
                  <span>{label}</span>
                </NavLink>
              );
            }

            if (item.activeStyle === 'green') {
              // Neon Green Pill (Mockup Image 15: Practice)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#22c55e] text-[#04140e] font-bold text-xs shadow-md shadow-emerald-500/30 transition-transform active:scale-95"
                  aria-current="page"
                >
                  <Icon size={17} strokeWidth={2.4} />
                  <span>{label}</span>
                </NavLink>
              );
            }

            if (item.activeStyle === 'emeraldBorder') {
              // Emerald Pill with glow border (Mockup Image 2: Study Toolbox)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#072c1e] text-[#34d399] border border-emerald-400/40 font-semibold text-xs shadow-md shadow-emerald-500/20 transition-transform active:scale-95"
                  aria-current="page"
                >
                  <Icon size={17} strokeWidth={2.4} />
                  <span>{label}</span>
                </NavLink>
              );
            }

            // Default Emerald Pill
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0a3524] text-[#4ade80] border border-emerald-500/30 font-semibold text-xs shadow-md shadow-emerald-500/15 transition-transform active:scale-95"
                aria-current="page"
              >
                <Icon size={17} strokeWidth={2.4} />
                <span>{label}</span>
              </NavLink>
            );
          }

          // Inactive state
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="group flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-emerald-300 transition-colors"
            >
              <Icon size={20} className="group-hover:scale-110 transition-transform text-slate-400 group-hover:text-emerald-300" strokeWidth={1.8} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight group-hover:text-emerald-200">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}


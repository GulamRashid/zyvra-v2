import { NavLink, useLocation } from 'react-router-dom';
import { Compass, GraduationCap, Home, User, Wrench } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const navItems = [
  { to: '/', key: 'home', labelEn: 'Home', labelHi: 'होम', Icon: Home },
  { to: '/explore', key: 'explore', labelEn: 'Exams', labelHi: 'परीक्षाएं', Icon: Compass },
  { to: '/purchases', key: 'purchases', labelEn: 'My Courses', labelHi: 'मेरे कोर्स', Icon: GraduationCap },
  { to: '/toolbox', key: 'toolbox', labelEn: 'Toolbox', labelHi: 'टूल्स', Icon: Wrench },
  { to: '/profile', key: 'profile', labelEn: 'Profile', labelHi: 'प्रोफ़ाइल', Icon: User }
];

export default function StudentBottomNav() {
  const { language } = useThemeLanguage();
  const location = useLocation();

  // Hide bottom nav during live quiz attempts to prevent distractions
  if (/^\/quiz\//.test(location.pathname)) {
    return null;
  }

  const getLabel = (item) => {
    return language === 'hi' ? item.labelHi : item.labelEn;
  };

  const isItemActive = (item) => {
    if (item.key === 'home') {
      return location.pathname === '/';
    }
    if (item.key === 'explore') {
      return location.pathname.startsWith('/explore') ||
             location.pathname.startsWith('/tests') ||
             (location.pathname.startsWith('/chapter') && !location.pathname.startsWith('/purchases')) ||
             (location.pathname.startsWith('/folder') && !location.pathname.startsWith('/purchases'));
    }
    if (item.key === 'purchases') {
      return location.pathname.startsWith('/purchases') ||
             location.pathname.startsWith('/my-courses') ||
             location.pathname.startsWith('/courses');
    }
    if (item.key === 'toolbox') {
      return location.pathname.startsWith('/toolbox');
    }
    if (item.key === 'profile') {
      return location.pathname.startsWith('/profile') ||
             location.pathname.startsWith('/wallet') ||
             location.pathname.startsWith('/bookmarks') ||
             location.pathname.startsWith('/analytics');
    }
    return false;
  };

  return (
    <nav
      className="student-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden dark:bg-[#0B1120]/90 bg-white/90 backdrop-blur-xl border-t dark:border-slate-800/80 border-slate-200/80 transition-all duration-300 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.5)]"
      aria-label="Student Mobile Navigation"
    >
      <div className="max-w-md mx-auto px-2 py-1 grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const active = isItemActive(item);
          const Icon = item.Icon;
          const label = getLabel(item);

          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={`relative flex min-h-[50px] flex-col items-center justify-center rounded-2xl py-1 text-[10px] font-bold transition-all touch-manipulation active:scale-95 ${
                active
                  ? 'text-indigo-600 dark:text-indigo-400 font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  active ? 'bg-indigo-500/15 dark:bg-indigo-400/20 scale-105' : ''
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.7} className="shrink-0" />
              </div>
              <span className="truncate max-w-full leading-tight text-center tracking-tight mt-0.5">
                {label}
              </span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

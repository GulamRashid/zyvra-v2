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
      className="student-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden dark:bg-[#0B1120]/95 bg-white/95 backdrop-blur-xl border-t dark:border-slate-800 border-slate-200 transition-all duration-300 pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Student Mobile Navigation"
    >
      <div className="max-w-xl mx-auto px-1.5 py-1 sm:py-1.5 grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const active = isItemActive(item);
          const Icon = item.Icon;
          const label = getLabel(item);

          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={`flex min-h-[50px] flex-col items-center justify-center rounded-2xl px-1 py-1 text-[10px] font-bold transition-all touch-manipulation ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm scale-[1.02]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-indigo-300'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} className="mb-0.5 shrink-0" />
              <span className="truncate max-w-full leading-tight text-center tracking-tight">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

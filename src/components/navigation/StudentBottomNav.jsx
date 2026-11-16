import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Compass, ClipboardList, Home, User } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const navItems = [
  { to: '/', key: 'home', label: 'Home', Icon: Home },
  { to: '/explore', key: 'explore', label: 'Exams', Icon: Compass },
  { to: '/tests?tab=tests', key: 'tests', label: 'Tests', Icon: ClipboardList },
  { to: '/tests?tab=subjects', key: 'practice', label: 'Practice', Icon: BookOpen },
  { to: '/profile', key: 'profile', label: 'Profile', Icon: User }
];

export default function StudentBottomNav() {
  const { t } = useThemeLanguage();
  const location = useLocation();

  // Hide bottom nav during live quiz attempts to prevent distractions
  if (/^\/quiz\//.test(location.pathname)) {
    return null;
  }

  const getLabel = (item) => {
    if (item.key === 'home') return t('home') || 'Home';
    if (item.key === 'explore') return t('exploreExams') || 'Exams';
    if (item.key === 'tests') return t('tests') || 'Tests';
    if (item.key === 'practice') return t('practice') || 'Practice';
    if (item.key === 'profile') return t('profile') || 'Profile';
    return item.label;
  };

  const isItemActive = (item) => {
    if (item.key === 'home') {
      return location.pathname === '/';
    }
    if (item.key === 'explore') {
      return location.pathname.startsWith('/explore') ||
             location.pathname.startsWith('/chapter') ||
             location.pathname.startsWith('/folder');
    }
    if (item.key === 'tests' || item.key === 'practice') {
      if (!location.pathname.startsWith('/tests')) return false;
      const selectedTab = new URLSearchParams(location.search).get('tab');
      return item.key === 'tests' ? selectedTab === 'tests' : selectedTab !== 'tests';
    }
    if (item.key === 'profile') {
      return location.pathname.startsWith('/profile') ||
             location.pathname.startsWith('/wallet') ||
             location.pathname.startsWith('/purchases') ||
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
      <div className="max-w-md mx-auto px-2 py-1 sm:py-1.5 grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const active = isItemActive(item);
          const Icon = item.Icon;
          const label = getLabel(item);

          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl px-1 py-1 text-[11px] font-semibold transition-all touch-manipulation ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm font-bold scale-[1.02]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-indigo-300'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.3 : 1.8} className="mb-0.5 shrink-0" />
              <span className="truncate max-w-[58px] leading-tight text-center">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Bell, BookOpen, Compass, Home, MoreHorizontal, ShoppingBag, User, WalletCards, Wrench, X } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const navItems = [
  { to: '/', key: 'continue', label: 'Continue', Icon: Home },
  { to: '/tests', key: 'practice', label: 'Practice', Icon: BookOpen },
  { to: '/toolbox', key: 'toolbox', label: 'Toolbox', Icon: Wrench },
  { to: '/profile', key: 'profile', label: 'Profile', Icon: User },
  { to: 'more', key: 'more', label: 'More', Icon: MoreHorizontal }
];

export default function StudentBottomNav() {
  const { t } = useThemeLanguage();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Hide bottom nav on live quiz taking to prevent distractions (matching mockups)
  if (/^\/quiz\//.test(location.pathname)) {
    return null;
  }

  const getLabel = (item) => {
    if (item.key === 'practice') return t('practice') || 'Practice';
    if (item.key === 'more') return 'More';
    if (item.key === 'continue') return 'Continue';
    return t(item.key) || item.label;
  };

  const isItemActive = (to) => {
    if (to === '/') return location.pathname === '/';
    if (to === '/tests') return location.pathname === '/tests' || location.pathname.startsWith('/explore');
    return location.pathname.startsWith(to);
  };

  const moreItems = [
    { to: '/explore', label: 'Explore Exams', Icon: Compass },
    { to: '/analytics', label: t('performance') || 'Performance', Icon: BarChart3 },
    { to: '/wallet', label: 'Coin Wallet', Icon: WalletCards },
    { to: '/bookmarks', label: 'Bookmarks', Icon: BookOpen },
    { to: '/purchases', label: 'My Purchases', Icon: ShoppingBag },
    { to: '/notifications', label: 'Notifications', Icon: Bell }
  ];

  const moreActive = moreItems.some(({ to }) => location.pathname.startsWith(to));

  return (
    <nav
      className="student-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden dark:bg-[#0B1120]/95 bg-white/95 backdrop-blur-xl border-t dark:border-slate-800 border-slate-200 transition-all duration-300"
      aria-label="Student Mobile Navigation"
    >
      <div className="max-w-md mx-auto px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-around gap-0.5 sm:gap-1">
        {navItems.map((item) => {
          const active = item.key === 'more' ? moreActive || moreOpen : isItemActive(item.to);
          const Icon = item.Icon;
          const label = getLabel(item);
          const itemClass = active
            ? 'flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-sm font-semibold text-white transition-colors active:bg-indigo-700 shadow-sm'
            : 'group flex min-h-[44px] flex-col items-center justify-center rounded-xl px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-indigo-300';

          if (item.key === 'more') {
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className={itemClass}
                aria-expanded={moreOpen}
                aria-controls="student-more-menu"
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
              </button>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} className={itemClass} aria-current={active ? 'page' : undefined}>
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span className={active ? '' : 'text-sm'}>{label}</span>
            </NavLink>
          );
        })}
      </div>
      {moreOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/30"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="student-more-menu"
            className="absolute bottom-full left-2 right-2 z-50 mb-2 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 shadow-xl p-2"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-black dark:text-white text-slate-900">More learning spaces</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more menu" className="min-h-[44px] min-w-[44px] p-1 rounded-lg dark:text-slate-400 text-slate-500">
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {moreItems.map(({ to, label: itemLabel, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium dark:text-slate-300 text-slate-700 dark:hover:bg-slate-800/80 hover:bg-slate-100"
                >
                  <Icon size={15} className="text-indigo-400" />
                  <span>{itemLabel}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}


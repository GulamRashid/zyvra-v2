import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChartNoAxesColumn, ChevronRight, ClipboardList,
  Compass, Home, Menu, Settings, Wrench, X,
  Shield, LogOut, Flame, ShoppingBag, Bookmark, GraduationCap, MessageCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import CoinBadge from '../common/CoinBadge';
import LanguageToggle from '../common/LanguageToggle';
import ThemeToggle from '../common/ThemeToggle';
import StudentBottomNav from '../navigation/StudentBottomNav';

const sections = [
  { to: '/', label: 'Home', key: 'home', Icon: Home },
  { to: '/explore', label: 'Explore Exams', key: 'explore', Icon: Compass },
  { to: '/purchases', label: 'My Courses', key: 'purchases', Icon: GraduationCap },
  { to: '/tests', label: 'Practice & Tests', key: 'tests', Icon: ClipboardList },
  { to: '/bookmarks', label: 'Saved Bookmarks', key: 'bookmarks', Icon: Bookmark },
  { to: '/analytics', label: 'Performance & Analytics', Icon: ChartNoAxesColumn },
  { to: '/toolbox', label: 'Study Toolbox', key: 'toolbox', Icon: Wrench },
  { to: '/profile', label: 'Profile & Settings', key: 'profile', Icon: Settings }
];

export default function StudentLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile, profileError, coinBalance, isAdmin, guest, signOut } = useAuth();
  const { t, language, theme } = useThemeLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const assessmentActive = /^\/(?:quiz|test|exams?)(?:\/|$)/i.test(location.pathname);
  const visibleSections = sections.filter(({ key }) => !(assessmentActive && key === 'toolbox'));
  const name = profile?.full_name || profile?.name || 'Learner';
  const streak = Number(profile?.current_streak || 0);

  const navKeys = {
    '/analytics': 'analytics', '/explore': 'exploreExams', '/profile': 'profileSettings'
  };
  const linkLabel = (item) => item.key ? t(item.key) : t(navKeys[item.to]) || item.label;
  const closeDrawer = () => setDrawerOpen(false);

  const logout = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  };

  return (
    <div className="app-shell student-app-shell min-h-screen">
      {drawerOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={closeDrawer} />}
      <aside className={`student-sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" />
          <div>
            <span className="text-[var(--text)] font-extrabold tracking-wider">ZYVRA</span>
            <span className="text-[var(--muted)] font-semibold tracking-widest text-[9px] block">LEARN WITH INTENT</span>
          </div>
          <button className="icon-button drawer-close ml-auto" onClick={closeDrawer} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>
        <div className="sidebar-caption">YOUR LEARNING SPACE</div>
        <nav className="side-nav">
          {visibleSections.map(({ to, Icon, ...item }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeDrawer}
              className={({ isActive }) => `side-link ${isActive ? 'active font-semibold' : ''}`}
            >
              <Icon size={17} />
              <span>{linkLabel(item)}</span>
              {location.pathname === to && <ChevronRight className="nav-chevron" size={15} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            onClick={() => {
              closeDrawer();
              window.dispatchEvent(new CustomEvent('zyvra:open-support-chat'));
            }}
            className="w-full mb-3 py-2 px-3 rounded-xl bg-indigo-600/15 border border-indigo-500/30 hover:bg-indigo-600/25 text-indigo-400 font-bold text-xs flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={15} />
              <span>{language === 'hi' ? 'सपोर्ट चैट (Help Desk)' : 'Support Live Chat'}</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <div className="focus-card border border-indigo-500/20 bg-slate-800/80 rounded-xl p-3">
            <span className="focus-mark text-indigo-400">✦</span>
            <strong className="text-[var(--text)] text-sm block mt-1">Focus, deliberate practice, results.</strong>
            <span className="text-[var(--muted)] text-sm">Your next session is one tap away.</span>
          </div>

          {/* Quick Preference Controls in Drawer for Mobile Ease */}
          <div className="flex sm:hidden items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 mt-3">
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <span className="text-[11px] text-slate-300 font-semibold">{language === 'hi' ? 'भाषा (Hindi)' : 'Language (EN)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="text-[11px] text-slate-300 font-semibold">{theme === 'light' ? 'Light' : 'Dark'}</span>
            </div>
          </div>

          <div className="sidebar-account flex items-center gap-2.5 pt-3 border-t border-slate-700/60 mt-3">
            <div className="avatar w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center font-bold text-white text-xs shadow-sm">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="account-copy flex-1 min-w-0">
              <strong className="text-[var(--text)] text-sm block truncate">{guest ? 'Demo learner' : name}</strong>
              <span className="text-[var(--muted)] text-xs">{guest ? 'Guest access' : 'Student account'}</span>
            </div>
            <button className="icon-button text-slate-400 hover:text-red-400" aria-label="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar student-topbar">
          <div className="topbar-left flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button className="icon-button mobile-menu shrink-0" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="mobile-brand flex items-center gap-1.5 font-bold text-[var(--text)] tracking-wide shrink-0">
              <img src="/logo-192.png" alt="Zyvra" className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-contain shadow-sm" />
              <span className="hidden xs:inline text-xs sm:text-sm font-black">ZYVRA</span>
            </div>
          </div>

          <div className="topbar-actions flex items-center gap-1.5 sm:gap-2">
            {/* Language Switcher (EN / HI) - Always visible on mobile & desktop */}
            <LanguageToggle />

            {/* Dark / Light Mode Toggle - Always visible on mobile & desktop */}
            <ThemeToggle />

            {/* Study Streak Badge - Vibrant Orange Dopamine Trigger */}
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/35 text-orange-400 text-xs font-black shadow-[0_0_15px_rgba(249,115,22,0.25)] shrink-0"
              title={`${streak} day study streak`}
            >
              <Flame size={13} className="fill-orange-500 text-orange-500 animate-pulse" />
              <span className="font-extrabold text-orange-400">{profileError ? '—' : streak}</span>
            </div>

            {/* Coin Badge */}
            <CoinBadge balance={coinBalance} />

            <NavLink
              className="icon-button notification-button relative"
              aria-label={t('notifications')}
              to="/notifications"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
            </NavLink>

            {isAdmin && (
              <NavLink className="button admin-shortcut bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-500/30 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" to="/admin">
                <Shield size={14} className="text-indigo-400" />
                <span>{t('adminPanel')}</span>
              </NavLink>
            )}
          </div>
        </header>

        <main className="content-area student-page-content">
          <Outlet />
        </main>

        {/* Unified, persistent Bottom Navigation Bar for Student portal */}
        <StudentBottomNav />
      </div>
    </div>
  );
}

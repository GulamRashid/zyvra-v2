import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChartNoAxesColumn, ChevronRight, ClipboardList,
  Compass, Home, Menu, Settings, Wrench, X,
  Shield, LogOut, Flame, ShoppingBag, Bookmark, GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudentStats } from '../../context/StudentStatsContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import CoinBadge from '../common/CoinBadge';
import LanguageToggle from '../common/LanguageToggle';
import ThemeToggle from '../common/ThemeToggle';
import StudentBottomNav from '../navigation/StudentBottomNav';
import DailyStreakModal from '../student/DailyStreakModal';
import useModalBack from '../../hooks/useModalBack';

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
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const { user, profile, profileError, coinBalance, walletLoaded, isAdmin, guest, signOut, supabase } = useAuth();
  const { streakData, currentStreak: streak, loading: statsLoading } = useStudentStats();
  const { t, language, theme } = useThemeLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const assessmentActive = /^\/(?:quiz|test|exams?)(?:\/|$)/i.test(location.pathname);
  const visibleSections = sections.filter(({ key }) => !(assessmentActive && key === 'toolbox'));
  const name = profile?.full_name || profile?.name || 'Learner';

  // Real unread notification count for header bell dot
  useEffect(() => {
    let active = true;
    const computeUnread = async () => {
      if (!supabase) {
        if (active) setUnreadNotificationsCount(0);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('key,setting_key,value,setting_value')
          .or('key.eq.platform_announcements,setting_key.eq.platform_announcements');

        if (error || !active) return;
        const row = data?.[0];
        const val = row?.setting_value !== undefined ? row.setting_value : row?.value;
        const audience = new Set((profile?.target_exams || []).map((exam) => String(exam).toLowerCase()));
        const list = (Array.isArray(val) ? val : []).filter((notice) =>
          !notice.audience || String(notice.audience).toLowerCase() === 'all' || audience.has(String(notice.audience).toLowerCase())
        );

        let readSet = new Set();
        try {
          const storageKey = `zyvra_read_announcement_ids:${user?.id || 'guest'}`;
          readSet = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
        } catch {}

        if (active) {
          setUnreadNotificationsCount(list.filter((n) => !readSet.has(n.id)).length);
        }
      } catch {
        if (active) setUnreadNotificationsCount(0);
      }
    };

    computeUnread();
    const handleUpdate = () => computeUnread();
    window.addEventListener('zyvra:notifications-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('zyvra:notifications-updated', handleUpdate);
    };
  }, [supabase, user?.id, profile?.target_exams]);

  const navKeys = {
    '/analytics': 'analytics', '/explore': 'exploreExams', '/profile': 'profileSettings'
  };
  const linkLabel = (item) => item.key ? t(item.key) : t(navKeys[item.to]) || item.label;
  const closeDrawer = () => setDrawerOpen(false);

  // Never keep the sidebar drawer open across route navigations
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const logout = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  };

  const [exitToastVisible, setExitToastVisible] = useState(false);
  const lastBackPressTimeRef = useRef(0);
  const exitToastTimerRef = useRef(null);

  // Wire hardware back for sidebar drawer
  useModalBack(drawerOpen, closeDrawer, 'sidebar-drawer');

  // Android Double-Back to Exit on Root Home Tab ('/')
  useEffect(() => {
    if (location.pathname !== '/' || typeof window === 'undefined') return undefined;

    // Push sentinel state so hardware back triggers popstate instead of instantly closing the app
    try {
      window.history.pushState({ zyvraHomeGuard: true }, '', window.location.href);
    } catch {}

    const handlePopState = () => {
      // 1. If any modal, dialog, or drawer is active or pop is suppressed, ignore
      if (
        window.__zyvra_suppress_modal_pop ||
        document.querySelector('[role="dialog"]') ||
        document.querySelector('.drawer-open') ||
        drawerOpen
      ) {
        return;
      }

      // 2. Check time since last back press
      const now = Date.now();
      if (lastBackPressTimeRef.current > 0 && now - lastBackPressTimeRef.current < 2000) {
        // Double back pressed within 2 seconds: let browser exit / navigate back
        lastBackPressTimeRef.current = 0;
        setExitToastVisible(false);
        window.history.back();
        return;
      }

      // 3. First back press on Home: trap and prompt user
      lastBackPressTimeRef.current = now;
      setExitToastVisible(true);

      // Re-push sentinel state so the next back press is also captured
      try {
        window.history.pushState({ zyvraHomeGuard: true }, '', window.location.href);
      } catch {}

      if (exitToastTimerRef.current) {
        clearTimeout(exitToastTimerRef.current);
      }
      exitToastTimerRef.current = setTimeout(() => {
        setExitToastVisible(false);
      }, 2000);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitToastTimerRef.current) {
        clearTimeout(exitToastTimerRef.current);
      }
    };
  }, [location.pathname, drawerOpen]);

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
          <div className="focus-card border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3">
            <span className="focus-mark text-indigo-500 dark:text-indigo-400">✦</span>
            <strong className="text-[var(--text)] text-sm block mt-1">Focus, deliberate practice, results.</strong>
            <span className="text-[var(--muted)] text-xs sm:text-sm">Your next session is one tap away.</span>
          </div>

          {/* Quick Preference Controls in Drawer for Mobile Ease */}
          <div className="flex sm:hidden items-center justify-between p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mt-3">
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{language === 'hi' ? 'भाषा (Hindi)' : 'Language (EN)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{theme === 'light' ? 'Light' : 'Dark'}</span>
            </div>
          </div>

          <div className="sidebar-account flex items-center gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/60 mt-3">
            <div className="avatar w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center font-bold text-white text-xs shadow-xs">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="account-copy flex-1 min-w-0">
              <strong className="text-[var(--text)] text-sm block truncate">{guest ? 'Demo learner' : name}</strong>
              <span className="text-[var(--muted)] text-xs">{guest ? 'Guest access' : 'Student account'}</span>
            </div>
            <button className="icon-button text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors" aria-label="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar student-topbar">
          <div className="topbar-left flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button className="icon-button mobile-menu shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="mobile-brand flex items-center gap-1.5 font-bold text-[var(--text)] tracking-wide shrink-0">
              <img src="/logo-192.png" alt="Zyvra" className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-contain shadow-sm" />
              <span className="hidden xs:inline text-xs sm:text-sm font-black">ZYVRA</span>
            </div>
          </div>

          <div className="topbar-actions flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language Switcher (EN / HI) - Always visible on mobile & desktop */}
            <LanguageToggle />

            {/* Dark / Light Mode Toggle - Always visible on mobile & desktop */}
            <ThemeToggle />

            {/* Study Streak Badge - Uniform 44px height */}
            <button
              type="button"
              onClick={() => setStreakModalOpen(true)}
              className={`h-11 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border shrink-0 ${
                streak > 0
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-orange-500/40'
              }`}
              title={language === 'hi' ? `${streak} दिन की अध्ययन स्ट्रीक (विस्तार देखें)` : `${streak} day study streak (click for details)`}
              aria-label="View daily study streak"
            >
              <Flame size={16} className={streak > 0 ? 'fill-orange-500 text-orange-500 shrink-0' : 'text-slate-400 shrink-0'} />
              {statsLoading ? (
                <span className="inline-block h-3.5 w-4 rounded bg-slate-400/30 animate-pulse" aria-hidden="true" />
              ) : (
                <span className="font-extrabold tabular-nums">{profileError && !streak ? '—' : streak}</span>
              )}
              {!statsLoading && streakData?.streakAtRisk && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Study today to keep streak" />
              )}
            </button>

            {/* Coin Badge */}
            <CoinBadge balance={coinBalance} loading={!walletLoaded} />

            <NavLink
              className="notification-button relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl dark:bg-slate-800/80 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 border dark:border-slate-700/60 border-slate-300 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all shrink-0"
              aria-label={t('notifications')}
              to="/notifications"
            >
              <Bell size={16} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </NavLink>

            {isAdmin && (
              <NavLink className="button admin-shortcut bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-500/30 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" to="/admin" title={t('adminPanel')}>
                <Shield size={14} className="text-indigo-400" />
                <span className="hidden sm:inline">{t('adminPanel')}</span>
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

      {/* Daily Study Streak Detail Modal */}
      <DailyStreakModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streakData={streakData}
      />

      {/* Android Double-Back Exit Toast */}
      {exitToastVisible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 inset-x-0 mx-auto w-fit max-w-[90vw] z-50 px-4 py-2.5 rounded-full dark:bg-[#1E293B] bg-slate-900 text-white text-xs font-bold shadow-xl border dark:border-slate-700/80 border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none"
        >
          <span className="text-amber-400 text-sm">⚡</span>
          <span>
            {language === 'hi'
              ? 'ऐप से बाहर निकलने के लिए दोबारा बैक दबाएं'
              : 'Press back again to exit'}
          </span>
        </div>
      )}
    </div>
  );
}

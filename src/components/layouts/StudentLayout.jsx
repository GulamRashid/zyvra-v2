import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChartNoAxesColumn, ChevronRight, ClipboardList,
  Compass, Home, Menu, Settings, Wrench, X,
  Shield, LogOut, Coins, Flame
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
  { to: '/tests', label: 'Practice & Tests', key: 'tests', Icon: ClipboardList },
  { to: '/analytics', label: 'Performance & Analytics', Icon: ChartNoAxesColumn },
  { to: '/toolbox', label: 'Study Toolbox', key: 'toolbox', Icon: Wrench },
  { to: '/profile', label: 'Profile & Settings', key: 'profile', Icon: Settings }
];

export default function StudentLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile, coinBalance, isAdmin, guest, signOut } = useAuth();
  const { t } = useThemeLanguage();
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
          <img src="/logo.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" />
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
          <div className="focus-card border border-emerald-500/20 bg-emerald-950/40 rounded-xl p-3">
            <span className="focus-mark text-emerald-300">✦</span>
            <strong className="text-[var(--text)] text-sm block mt-1">Small steps, strong results.</strong>
            <span className="text-[var(--muted)] text-sm">Your next session is one tap away.</span>
          </div>
          <div className="sidebar-account flex items-center gap-2.5 pt-3 border-t border-emerald-500/15 mt-3">
            <div className="avatar w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white text-xs">
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
          <div className="topbar-left flex items-center gap-2.5">
            <button className="icon-button mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="mobile-brand flex items-center gap-2 font-bold text-[var(--text)] tracking-wide">
              <img src="/logo.png" alt="Zyvra" className="w-7 h-7 rounded-lg object-contain shadow-sm" />
              <span>ZYVRA</span>
            </div>
          </div>

          <div className="topbar-actions flex items-center gap-2">
            {/* Study Streak Badge (matching mockups e.g. 🔥 12) */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold"
              title={`${streak} day study streak`}
            >
              <Flame size={14} className="fill-amber-400 text-amber-400" />
              <span>{streak}</span>
            </div>

            {/* Coin Badge */}
            <CoinBadge balance={coinBalance} />

            <LanguageToggle />
            <ThemeToggle />

            <NavLink
              className="icon-button notification-button relative"
              aria-label={t('notifications')}
              to="/notifications"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
            </NavLink>

            {isAdmin && (
              <NavLink className="button admin-shortcut bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-500/30 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" to="/admin">
                <Shield size={14} className="text-emerald-400" />
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

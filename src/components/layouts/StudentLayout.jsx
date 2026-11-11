import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bookmark, ChartNoAxesColumn, ChevronRight, ClipboardList, Compass, Home, Library, Menu, Settings, ShoppingBag, Wrench, X, Shield, LogOut, Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import CoinBadge from '../common/CoinBadge';
import LanguageToggle from '../common/LanguageToggle';
import ThemeToggle from '../common/ThemeToggle';

const sections = [
  { to: '/', label: 'Home', key: 'home', Icon: Home },
  { to: '/explore', label: 'Explore Exams', key: 'explore', Icon: Compass },
  { to: '/tests', label: 'Practice & Tests', key: 'tests', Icon: ClipboardList },
  { to: '/purchases', label: 'My Purchases', Icon: ShoppingBag },
  { to: '/analytics', label: 'Performance & Analytics', Icon: ChartNoAxesColumn },
  { to: '/bookmarks', label: 'Bookmarks', Icon: Bookmark },
  { to: '/wallet', label: 'Coin Wallet', Icon: Coins },
  { to: '/planner', label: 'Study Planner', Icon: Library },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/toolbox', label: 'Study Toolbox', key: 'toolbox', Icon: Wrench },
  { to: '/profile', label: 'Profile & Settings', key: 'profile', Icon: Settings }
];

export default function StudentLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile, coinBalance, isAdmin, guest, signOut } = useAuth();
  const { t } = useThemeLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const name = profile?.full_name || profile?.name || 'Learner';
  const navKeys = {
    '/purchases': 'purchases', '/analytics': 'analytics', '/bookmarks': 'bookmarks',
    '/wallet': 'wallet', '/planner': 'planner', '/notifications': 'notifications',
    '/explore': 'exploreExams', '/profile': 'profileSettings'
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

  return <div className="app-shell">
    {drawerOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={closeDrawer} />}
    <aside className={`student-sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
      <div className="sidebar-brand"><img src="/logo.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" /><div>ZYVRA<span>LEARN WITH INTENT</span></div><button className="icon-button drawer-close" onClick={closeDrawer} aria-label="Close menu"><X size={19} /></button></div>
      <div className="sidebar-caption">YOUR LEARNING SPACE</div>
      <nav className="side-nav">
        {sections.map(({ to, Icon, ...item }) => <NavLink key={to} to={to} end={to === '/'} onClick={closeDrawer} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          <Icon size={17} /><span>{linkLabel(item)}</span>{location.pathname === to && <ChevronRight className="nav-chevron" size={15} />}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="focus-card"><span className="focus-mark">✦</span><strong>Small steps, strong results.</strong><span>Your next session is one tap away.</span></div>
        <div className="sidebar-account"><div className="avatar">{name.slice(0, 1).toUpperCase()}</div><div className="account-copy"><strong>{guest ? 'Demo learner' : name}</strong><span>{guest ? 'Guest access' : 'Student account'}</span></div><button className="icon-button" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="mobile-brand"><img src="/logo.png" alt="Zyvra" className="w-8 h-8 rounded-xl object-contain shadow-sm" /> ZYVRA</div></div>
        <div className="topbar-actions"><CoinBadge balance={coinBalance} /><LanguageToggle /><ThemeToggle /><NavLink className="icon-button notification-button" aria-label={t('notifications')} to="/notifications"><Bell size={18} /></NavLink>{isAdmin && <NavLink className="button admin-shortcut" to="/admin"><Shield size={15} /> {t('adminPanel')}</NavLink>}</div>
      </header>
      <main className="content-area"><div className="mobile-welcome">Welcome back, {name}</div><Outlet /></main>
      <nav className="mobile-bottom-nav">
        {sections.filter(({ key }) => ['home', 'explore', 'tests', 'toolbox', 'profile'].includes(key)).map(({ to, Icon, ...item }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}><Icon size={19} /><span>{linkLabel(item)}</span></NavLink>)}
        <LanguageToggle compact />
      </nav>
    </div>
  </div>;
}

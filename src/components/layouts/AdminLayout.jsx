import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, ClipboardList, Coins, FileQuestion, FileText, Gauge, LogOut, Menu, PackageCheck, Settings, ShoppingCart, Tag, Users, Wrench, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';

const modules = [
  { to: '/admin', label: 'Dashboard', Icon: Gauge, end: true },
  { to: '/admin/content', label: 'Content Manager', Icon: FileText },
  { to: '/admin/qbank', label: 'Question Bank', Icon: FileQuestion },
  { to: '/admin/tests', label: 'Test Manager', Icon: ClipboardList },
  { to: '/admin/users', label: 'Users & Access', Icon: Users },
  { to: '/admin/subscriptions', label: 'Subscriptions', Icon: PackageCheck },
  { to: '/admin/orders', label: 'Orders & Payments', Icon: ShoppingCart },
  { to: '/admin/coins', label: 'Zyvra Coins', Icon: Coins },
  { to: '/admin/tools', label: 'Tools (Toolbox)', Icon: Wrench },
  { to: '/admin/pricing', label: 'Pricing & Offers', Icon: Tag },
  { to: '/admin/reports', label: 'Reports & Analytics', Icon: Activity },
  { to: '/admin/notifications', label: 'Notifications', Icon: Bell },
  { to: '/admin/settings', label: 'Settings', Icon: Settings }
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="admin-shell">
    {menuOpen && <button className="drawer-scrim" aria-label="Close admin navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`admin-sidebar ${menuOpen ? 'drawer-open' : ''}`}>
      <div className="sidebar-brand admin-brand"><NavLink to="/admin" onClick={() => setMenuOpen(false)} className="sidebar-brand"><div className="brand-mark">Z</div><div>ZYVRA<span>CONTROL CENTER</span></div></NavLink><button className="icon-button drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
      <div className="sidebar-caption">OPERATIONS</div>
      <nav className="side-nav admin-nav">{modules.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="admin-sidebar-footer"><div className="health-dot" /> All systems operational</div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><div><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Menu"><Menu size={20} /></button><span className="eyebrow">ADMIN CONTROL CENTER</span></div><div className="topbar-actions"><ThemeToggle /><div className="admin-user"><div className="avatar">{(profile?.full_name || 'A').slice(0, 1).toUpperCase()}</div><span>{profile?.full_name || 'Administrator'}</span></div><button className="icon-button" title="Sign out" onClick={() => signOut().catch((error) => console.error('Unable to sign out:', error))}><LogOut size={17} /></button></div></header>
      <main className="admin-content"><Outlet /></main>
    </div>
  </div>;
}

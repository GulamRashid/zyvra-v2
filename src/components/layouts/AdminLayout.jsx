import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, ClipboardList, Coins, FileQuestion, FileText, Gauge, LogOut, Menu, MessageCircle, PackageCheck, ShieldCheck, ShoppingCart, Sparkles, Tag, Users, Wrench, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';
import Admin2FAModal from '../admin/Admin2FAModal';

const navigationSections = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/admin', label: 'Dashboard', Icon: Gauge, end: true },
      { to: '/admin/reports', label: 'Reports & Analytics', Icon: Activity }
    ]
  },
  {
    title: 'ACADEMIC & CONTENT',
    items: [
      { to: '/admin/content', label: 'Content Manager', Icon: FileText },
      { to: '/admin/qbank', label: 'Question Bank', Icon: FileQuestion },
      { to: '/admin/tests', label: 'Test Manager', Icon: ClipboardList }
    ]
  },
  {
    title: 'STUDENTS & SUPPORT',
    items: [
      { to: '/admin/support', label: 'Support Chat', Icon: MessageCircle },
      { to: '/admin/users', label: 'Users & Access', Icon: Users },
      { to: '/admin/engagement', label: 'Banners & QotD', Icon: Sparkles },
      { to: '/admin/notifications', label: 'Notifications', Icon: Bell }
    ]
  },
  {
    title: 'COMMERCE & TOOLS',
    items: [
      { to: '/admin/orders', label: 'Orders & Payments', Icon: ShoppingCart },
      { to: '/admin/subscriptions', label: 'Subscriptions', Icon: PackageCheck },
      { to: '/admin/pricing', label: 'Pricing & Offers', Icon: Tag },
      { to: '/admin/coins', label: 'Zyvra Coins', Icon: Coins },
      { to: '/admin/tools', label: 'Tools (Toolbox)', Icon: Wrench }
    ]
  }
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  ));
  const [isTwoFaOpen, setIsTwoFaOpen] = useState(false);

  useEffect(() => {
    const breakpoint = window.matchMedia('(max-width: 760px)');
    const updateSidebarForViewport = (event) => setIsSidebarCollapsed(event.matches);
    breakpoint.addEventListener('change', updateSidebarForViewport);
    return () => breakpoint.removeEventListener('change', updateSidebarForViewport);
  }, []);
  const toggleSidebar = () => setIsSidebarCollapsed((collapsed) => !collapsed);
  const closeSidebar = () => {
    if (window.matchMedia('(max-width: 760px)').matches) setIsSidebarCollapsed(true);
  };
  return <div className="admin-shell">
    {!isSidebarCollapsed && <button type="button" className="drawer-scrim admin-drawer-scrim" aria-label="Close admin navigation" onClick={closeSidebar} />}
    <aside id="admin-navigation" className={`admin-sidebar ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand admin-brand"><NavLink to="/admin" onClick={closeSidebar} className="sidebar-brand"><img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" /><div>ZYVRA<span>CONTROL CENTER</span></div></NavLink></div>
      <nav className="side-nav admin-nav space-y-4">
        {navigationSections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <div className="sidebar-caption px-3 pt-2 pb-1 text-[10px] tracking-wider text-slate-400 dark:text-slate-500 font-bold uppercase">
              {section.title}
            </div>
            {section.items.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={closeSidebar}
                className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="admin-sidebar-footer"><div className="health-dot" /> All systems operational</div>
    </aside>
    <div className={`admin-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="admin-topbar"><div>{isSidebarCollapsed
        ? <button type="button" className="icon-button admin-sidebar-toggle" onClick={toggleSidebar} aria-label="Open admin navigation" aria-expanded="false" aria-controls="admin-navigation"><Menu size={20} /></button>
        : <button type="button" className="icon-button admin-sidebar-toggle" onClick={toggleSidebar} aria-label="Close admin navigation" aria-expanded="true" aria-controls="admin-navigation"><X size={20} /></button>}
        <span className="eyebrow">ADMIN CONTROL CENTER</span></div><div className="topbar-actions"><ThemeToggle /><button type="button" className="admin-2fa-topbar-btn" title="2FA Security (Google Authenticator)" onClick={() => setIsTwoFaOpen(true)}><ShieldCheck size={15} /><span className="hidden sm:inline">2FA Security</span></button><div className="admin-user"><div className="avatar">{(profile?.full_name || 'A').slice(0, 1).toUpperCase()}</div><span>{profile?.full_name || 'Administrator'}</span></div><button type="button" className="icon-button" title="Sign out" onClick={() => signOut().catch((error) => console.error('Unable to sign out:', error))}><LogOut size={17} /></button></div></header>
      <main className="admin-content"><Outlet /></main>
    </div>
    <Admin2FAModal isOpen={isTwoFaOpen} onClose={() => setIsTwoFaOpen(false)} />
  </div>;
}

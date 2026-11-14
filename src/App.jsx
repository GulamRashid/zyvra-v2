import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import StudentLayout from './components/layouts/StudentLayout';
import AdminLayout from './components/layouts/AdminLayout';
import ProtectedRoute from './components/layouts/ProtectedRoute';
import LoadingSkeleton from './components/common/LoadingSkeleton';
import QuizErrorBoundary from './components/common/QuizErrorBoundary';
import PwaInstallBanner from './components/common/PwaInstallBanner';
import { BookOpen, FileQuestion, ShoppingBag, Bookmark, Bell, Wrench, Users, PackageCheck, CreditCard, Coins, Tag, Activity } from 'lucide-react';

const AuthPage = lazy(() => import('./pages/auth/AuthPage'));
const StudentHome = lazy(() => import('./pages/student/StudentHome'));
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'));
const StudentWallet = lazy(() => import('./pages/student/StudentWallet'));
const StudentAnalytics = lazy(() => import('./pages/student/StudentAnalytics'));
const ContentManager = lazy(() => import('./pages/admin/ContentManager'));
const QBankManager = lazy(() => import('./pages/admin/QBankManager'));
const TestManager = lazy(() => import('./pages/admin/TestManager'));
const ExploreExams = lazy(() => import('./pages/student/ExploreExams'));
const ExamDetail = lazy(() => import('./pages/student/ExamDetail'));
const FolderView = lazy(() => import('./pages/student/FolderView'));
const ChapterDetail = lazy(() => import('./pages/student/ChapterDetail'));
const StudentToolbox = lazy(() => import('./pages/student/StudentToolbox'));
const TestHub = lazy(() => import('./pages/student/TestHub'));
const LiveQuiz = lazy(() => import('./pages/student/LiveQuiz'));
const QuizResult = lazy(() => import('./pages/student/QuizResult'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const PricingManager = lazy(() => import('./pages/admin/PricingManager'));
const UserManager = lazy(() => import('./pages/admin/UserManager'));
const AdminCoins = lazy(() => import('./pages/admin/AdminCoins'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminTools = lazy(() => import('./pages/admin/AdminTools'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

const studentPages = {
  '/tests': { title: 'Practice & tests', subtitle: 'Build your confidence with focused practice.', icon: FileQuestion, items: ['Daily practice', 'Chapter tests', 'Mock exams'] },
  '/purchases': { title: 'My purchases', subtitle: 'Your learning resources and access, all in one place.', icon: ShoppingBag, emptyTitle: 'No purchases yet', emptyDescription: 'Your unlocked chapters, tests, and learning access will appear here after your first purchase.', primaryLabel: 'Explore exams', primaryPath: '/explore' },
  '/bookmarks': { title: 'Bookmarks', subtitle: 'Keep important questions and content close.', icon: Bookmark, emptyTitle: 'No bookmarks yet', emptyDescription: 'Save important questions and learning content during your study sessions to review them here.', primaryLabel: 'Start practicing', primaryPath: '/tests' },
  '/notifications': { title: 'Notifications', subtitle: 'Your learning and platform updates.', icon: Bell, emptyTitle: 'You are all caught up', emptyDescription: 'Study reminders, test results, and account updates will appear here when there is something new.', primaryLabel: 'Continue learning', primaryPath: '/' },
  '/toolbox': { title: 'Study toolbox', subtitle: 'Simple tools for a sharper study session.', icon: Wrench, items: ['Math tools', 'Polity quick review', 'Reasoning practice'] }
};
const adminPages = {
  '/admin/content': ['Content Manager', 'Organise exams, chapters, learning content and questions.', BookOpen],
  '/admin/qbank': ['Question Bank', 'Author, review and organise questions for tests and practice.', FileQuestion],
  '/admin/tests': ['Test Manager', 'Configure test patterns, scoring and question sequences.', FileQuestion],
  '/admin/users': ['Users & Access', 'Review learner accounts, roles and verification status.', Users],
  '/admin/subscriptions': ['Subscriptions', 'Manage plans and subscription access.', PackageCheck],
  '/admin/orders': ['Orders & Payments', 'Review payment records and order status.', CreditCard],
  '/admin/coins': ['Zyvra Coins', 'Review coin balances and reward activity.', Coins],
  '/admin/tools': ['Tools (Toolbox)', 'Manage study utilities and their availability.', Wrench],
  '/admin/pricing': ['Pricing & Offers', 'Manage product pricing, discounts and offers.', Tag],
  '/admin/reports': ['Reports & Analytics', 'Understand engagement, learning and revenue trends.', Activity],
  '/admin/notifications': ['Notifications', 'Prepare platform announcements and learner updates.', Bell]
};

function StudentPlaceholder({ page }) {
  const { title, subtitle, icon: Icon, emptyTitle, emptyDescription, primaryLabel, primaryPath } = page;
  return (
    <div className="placeholder-page max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LEARNING SPACE</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{title}</h1>
          <p className="text-xs sm:text-sm text-emerald-300/80">{subtitle}</p>
        </div>
      </div>
      <div className="placeholder-hero panel-card p-6 rounded-3xl bg-[#072117]/85 border border-emerald-500/25 space-y-4">
        <div className="flex items-center gap-3">
          <div className="placeholder-icon w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Icon size={24} />
          </div>
          <div>
            <h2 className="text-base font-black text-white">{emptyTitle || 'This space is empty for now'}</h2>
            <p className="text-xs text-emerald-300/80">{emptyDescription || 'Your learning activity will appear here when it is available.'}</p>
          </div>
        </div>
        <div className="pt-2 flex items-center gap-3">
          <a href={primaryPath || '/tests'} className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold inline-flex items-center gap-1.5 transition-transform active:scale-95">
            <span>{primaryLabel || 'Go to Practice Hub'}</span>
            <span>→</span>
          </a>
          <a href="/explore" className="px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:text-white transition-colors">
            Explore Exams
          </a>
        </div>
      </div>
      <div className="placeholder-note text-xs text-emerald-400/70 flex items-center gap-2">
        <span className="health-dot" /> We will keep this space up to date as your learning journey grows.
      </div>
    </div>
  );
}

function AdminPlaceholder({ page }) {
  const [title, subtitle, Icon] = page;
  return <div className="admin-placeholder"><div className="page-heading"><div><div className="eyebrow">ADMINISTRATION / MODULE</div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="panel-card placeholder-hero"><div className="placeholder-icon"><Icon size={23} /></div><h2>{title} workspace</h2><p>This module is scaffolded and ready for its management workflows.</p><div className="placeholder-items"><div><span className="placeholder-item-dot" />Overview</div><div><span className="placeholder-item-dot" />Management tools</div><div><span className="placeholder-item-dot" />Recent activity</div></div></div></div>;
}

function AppRoutes() {
  return <Suspense fallback={<main className="page-loading"><LoadingSkeleton rows={5} /></main>}><Routes>
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/quiz/:testId" element={<QuizErrorBoundary><ProtectedRoute><LiveQuiz /></ProtectedRoute></QuizErrorBoundary>} />
    <Route path="/quiz/result/:attemptId" element={<ProtectedRoute><QuizResult /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute admin><AdminLayout /></ProtectedRoute>}>
      <Route index element={<AdminDashboard />} />
      <Route path="content" element={<ContentManager />} />
      <Route path="qbank" element={<QBankManager />} />
      <Route path="tests" element={<TestManager />} />
      <Route path="pricing" element={<PricingManager />} />
      <Route path="users" element={<UserManager />} />
      <Route path="coins" element={<AdminCoins />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="subscriptions" element={<AdminSubscriptions />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="tools" element={<AdminTools />} />
      <Route path="reports" element={<AdminReports />} />
      <Route path="settings" element={<Navigate to="/admin" replace />} />
    </Route>
    <Route path="/" element={<ProtectedRoute><StudentLayout /></ProtectedRoute>}>
      <Route index element={<StudentHome />} />
      <Route path="explore" element={<ExploreExams />} />
      <Route path="explore/:examSlug" element={<ExamDetail />} />
      <Route path="folder/:folderId" element={<FolderView />} />
      <Route path="chapter/:chapterId" element={<ChapterDetail />} />
      <Route path="tests" element={<TestHub />} />
      <Route path="toolbox" element={<StudentToolbox />} />
      <Route path="wallet" element={<StudentWallet />} />
      <Route path="analytics" element={<StudentAnalytics />} />
      <Route path="performance" element={<Navigate to="/analytics" replace />} />
      <Route path="history" element={<Navigate to="/analytics" replace />} />
      <Route path="notes" element={<Navigate to="/toolbox" replace />} />
      <Route path="saved" element={<Navigate to="/bookmarks" replace />} />
      <Route path="subscriptions" element={<Navigate to="/purchases" replace />} />
      {Object.entries(studentPages).filter(([path]) => !['/toolbox', '/tests'].includes(path)).map(([path, page]) => <Route key={path} path={path.slice(1)} element={<StudentPlaceholder page={page} />} />)}
      <Route path="profile" element={<StudentProfile />} />
      <Route path="settings" element={<Navigate to="/profile" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>;
}

function RouteStatePreserver() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (location.pathname === '/') {
      try {
        const savedRoute = sessionStorage.getItem('zyvra_active_route');
        if (savedRoute && savedRoute !== '/' && !savedRoute.startsWith('/auth')) {
          navigate(savedRoute, { replace: true });
        }
      } catch {
        // ignore
      }
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (fullPath.startsWith('/auth')) return;
    try {
      sessionStorage.setItem('zyvra_active_route', fullPath);
    } catch {
      // ignore
    }
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <>
      <RouteStatePreserver />
      <AppRoutes />
      <PwaInstallBanner />
    </>
  );
}

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import StudentLayout from './components/layouts/StudentLayout';
import AdminLayout from './components/layouts/AdminLayout';
import ProtectedRoute from './components/layouts/ProtectedRoute';
import LoadingSkeleton from './components/common/LoadingSkeleton';
import QuizErrorBoundary from './components/common/QuizErrorBoundary';
import PwaInstallBanner from './components/common/PwaInstallBanner';
import { BookOpen, FileQuestion, ShoppingBag, ChartNoAxesColumn, Bookmark, CalendarDays, Bell, Wrench, Users, PackageCheck, CreditCard, Coins, Tag, Activity, Settings } from 'lucide-react';

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
const LiveQuiz = lazy(() => import('./pages/student/LiveQuiz'));
const QuizResult = lazy(() => import('./pages/student/QuizResult'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const SettingsPreview = lazy(() => import('./pages/admin/SettingsPreview'));
const PricingManager = lazy(() => import('./pages/admin/PricingManager'));
const UserManager = lazy(() => import('./pages/admin/UserManager'));

const studentPages = {
  '/tests': { title: 'Practice & tests', subtitle: 'Build your confidence with focused practice.', icon: FileQuestion, items: ['Daily practice', 'Chapter tests', 'Mock exams'] },
  '/purchases': { title: 'My purchases', subtitle: 'Your learning resources and access, all in one place.', icon: ShoppingBag, items: ['Purchased content', 'Active access', 'Order history'] },
  '/bookmarks': { title: 'Bookmarks', subtitle: 'Keep important questions and content close.', icon: Bookmark, items: ['Saved questions', 'Saved learning content'] },
  '/planner': { title: 'Study planner', subtitle: 'Create a steady rhythm that works for you.', icon: CalendarDays, items: ['Weekly goals', 'Study sessions', 'Reminders'] },
  '/notifications': { title: 'Notifications', subtitle: 'Your learning and platform updates.', icon: Bell, items: ['Study reminders', 'Platform updates', 'Account notices'] },
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
  const { title, subtitle, icon: Icon, items } = page;
  return <div className="placeholder-page"><div className="page-heading"><div><div className="eyebrow">YOUR LEARNING SPACE</div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="placeholder-hero panel-card"><div className="placeholder-icon"><Icon size={23} /></div><h2>Your next step starts here.</h2><p>This section is ready for your Zyvra learning journey. Explore a focused starting point below.</p><div className="placeholder-items">{items.map((item) => <div key={item}><span className="placeholder-item-dot" />{item}</div>)}</div></div><div className="placeholder-note"><span className="health-dot" /> Your learning space is ready to grow with you.</div></div>;
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
      {Object.entries(adminPages).filter(([path]) => !['/admin/content', '/admin/qbank', '/admin/tests', '/admin/pricing', '/admin/users'].includes(path)).map(([path, page]) => <Route key={path} path={path.replace('/admin/', '')} element={<AdminPlaceholder page={page} />} />)}
      <Route path="settings" element={<div className="admin-placeholder"><div className="page-heading"><div><div className="eyebrow">ADMINISTRATION / CONFIGURATION</div><h1><Settings size={22} /> Settings</h1><p>Control the platform’s core learning and reward behaviour.</p></div></div><SettingsPreview /></div>} />
    </Route>
    <Route path="/" element={<ProtectedRoute><StudentLayout /></ProtectedRoute>}>
      <Route index element={<StudentHome />} />
      <Route path="explore" element={<ExploreExams />} />
      <Route path="explore/:examSlug" element={<ExamDetail />} />
      <Route path="folder/:folderId" element={<FolderView />} />
      <Route path="chapter/:chapterId" element={<ChapterDetail />} />
      <Route path="toolbox" element={<StudentToolbox />} />
      <Route path="wallet" element={<StudentWallet />} />
      <Route path="analytics" element={<StudentAnalytics />} />
      <Route path="performance" element={<Navigate to="/analytics" replace />} />
      {Object.entries(studentPages).filter(([path]) => path !== '/toolbox').map(([path, page]) => <Route key={path} path={path.slice(1)} element={<StudentPlaceholder page={page} />} />)}
      <Route path="profile" element={<StudentProfile />} />
      <Route path="settings" element={<Navigate to="/profile" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>;
}

export default function App() {
  return <><AppRoutes /><PwaInstallBanner /></>;
}

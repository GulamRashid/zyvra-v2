import { Suspense, useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import StudentLayout from './components/layouts/StudentLayout';
import AdminLayout from './components/layouts/AdminLayout';
import ProtectedRoute from './components/layouts/ProtectedRoute';
import LoadingSkeleton from './components/common/LoadingSkeleton';
import QuizErrorBoundary from './components/common/QuizErrorBoundary';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import PwaInstallBanner from './components/common/PwaInstallBanner';
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt';
import { useAuth } from './context/AuthContext';
import { lazyWithRetry } from './lib/lazyWithRetry';

const LandingPage = lazyWithRetry(() => import('./pages/landing/LandingPage'));
const AuthPage = lazyWithRetry(() => import('./pages/auth/AuthPage'));
const LegalPage = lazyWithRetry(() => import('./pages/legal/LegalPage'));
const StudentHome = lazyWithRetry(() => import('./pages/student/StudentHome'));
const StudentProfile = lazyWithRetry(() => import('./pages/student/StudentProfile'));
const StudentWallet = lazyWithRetry(() => import('./pages/student/StudentWallet'));
const StudentAnalytics = lazyWithRetry(() => import('./pages/student/StudentAnalytics'));
const ContentManager = lazyWithRetry(() => import('./pages/admin/ContentManager'));
const QBankManager = lazyWithRetry(() => import('./pages/admin/QBankManager'));
const TestManager = lazyWithRetry(() => import('./pages/admin/TestManager'));
const ExploreExams = lazyWithRetry(() => import('./pages/student/ExploreExams'));
const ExamDetail = lazyWithRetry(() => import('./pages/student/ExamDetail'));
const FolderView = lazyWithRetry(() => import('./pages/student/FolderView'));
const ChapterDetail = lazyWithRetry(() => import('./pages/student/ChapterDetail'));
const StudentToolbox = lazyWithRetry(() => import('./pages/student/StudentToolbox'));
const TestHub = lazyWithRetry(() => import('./pages/student/TestHub'));
const LiveQuiz = lazyWithRetry(() => import('./pages/student/LiveQuiz'));
const QuizResult = lazyWithRetry(() => import('./pages/student/QuizResult'));
const StudentPurchases = lazyWithRetry(() => import('./pages/student/StudentPurchases'));
const StudentBookmarks = lazyWithRetry(() => import('./pages/student/StudentBookmarks'));
const StudentNotifications = lazyWithRetry(() => import('./pages/student/StudentNotifications'));
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const PricingManager = lazyWithRetry(() => import('./pages/admin/PricingManager'));
const UserManager = lazyWithRetry(() => import('./pages/admin/UserManager'));
const AdminCoins = lazyWithRetry(() => import('./pages/admin/AdminCoins'));
const AdminOrders = lazyWithRetry(() => import('./pages/admin/AdminOrders'));
const AdminSubscriptions = lazyWithRetry(() => import('./pages/admin/AdminSubscriptions'));
const AdminNotifications = lazyWithRetry(() => import('./pages/admin/AdminNotifications'));
const AdminTools = lazyWithRetry(() => import('./pages/admin/AdminTools'));
const AdminReports = lazyWithRetry(() => import('./pages/admin/AdminReports'));
const AdminEngagement = lazyWithRetry(() => import('./pages/admin/AdminEngagement'));
const AdminSupportChat = lazyWithRetry(() => import('./pages/admin/AdminSupportChat'));
const SupportChatWidget = lazyWithRetry(() => import('./components/common/SupportChatWidget'));

function RootRoute() {
  const { user, loading, guest } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="page-loading"><LoadingSkeleton variant="page" /></main>;
  }

  if (!user && !guest) {
    if (location.pathname === '/' || location.pathname === '') {
      return <LandingPage />;
    }
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return (
    <ProtectedRoute>
      <StudentLayout>
        <Outlet />
      </StudentLayout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return <Suspense fallback={<main className="page-loading"><LoadingSkeleton variant="page" /></main>}><Routes>
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/privacy" element={<LegalPage />} />
    <Route path="/terms" element={<LegalPage />} />
    <Route path="/refunds" element={<LegalPage />} />
    <Route path="/cancellation-refund" element={<LegalPage />} />
    <Route path="/quiz/:testId" element={<QuizErrorBoundary><ProtectedRoute><LiveQuiz /></ProtectedRoute></QuizErrorBoundary>} />
    <Route path="/quiz/result/:attemptId" element={<ProtectedRoute><QuizResult /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute admin><AdminLayout /></ProtectedRoute>}>
      <Route index element={<AdminDashboard />} />
      <Route path="engagement" element={<AdminEngagement />} />
      <Route path="content" element={<ContentManager />} />
      <Route path="qbank" element={<QBankManager />} />
      <Route path="tests" element={<TestManager />} />
      <Route path="pricing" element={<PricingManager />} />
      <Route path="users" element={<UserManager />} />
      <Route path="coins" element={<AdminCoins />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="subscriptions" element={<AdminSubscriptions />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="support" element={<AdminSupportChat />} />
      <Route path="tools" element={<AdminTools />} />
      <Route path="reports" element={<AdminReports />} />
      <Route path="settings" element={<Navigate to="/admin" replace />} />
    </Route>
    <Route path="/" element={<RootRoute />}>
      <Route index element={<StudentHome />} />
      <Route path="home" element={<StudentHome />} />
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
      <Route path="courses" element={<Navigate to="/purchases" replace />} />
      <Route path="my-courses" element={<Navigate to="/purchases" replace />} />
      <Route path="purchases" element={<StudentPurchases />} />
      <Route path="bookmarks" element={<StudentBookmarks />} />
      <Route path="notifications" element={<StudentNotifications />} />
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
  const { user } = useAuth();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    // Only restore previous route for authenticated students on root
    if (user && location.pathname === '/') {
      try {
        const savedRoute = sessionStorage.getItem('zyvra_active_route');
        if (savedRoute && savedRoute !== '/' && !savedRoute.startsWith('/auth') && !savedRoute.startsWith('/landing')) {
          navigate(savedRoute, { replace: true });
        }
      } catch {
        // ignore
      }
    }
  }, [location.pathname, navigate, user]);

  useEffect(() => {
    // Automatically capture and persist referral code from any page URL
    try {
      const searchParams = new URLSearchParams(location.search);
      const refParam = searchParams.get('ref');
      if (refParam && String(refParam).trim()) {
        const cleanRef = String(refParam).trim().toUpperCase();
        sessionStorage.setItem('zyvra_ref_code', cleanRef);
        localStorage.setItem('zyvra_ref_code', cleanRef);
      }
    } catch {
      // ignore
    }
  }, [location.search]);

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (fullPath.startsWith('/auth') || fullPath === '/landing') return;
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
    <AppErrorBoundary>
      <RouteStatePreserver />
      <AppRoutes />
      <Suspense fallback={null}>
        <SupportChatWidget />
      </Suspense>
      <PwaUpdatePrompt />
      <PwaInstallBanner />
    </AppErrorBoundary>
  );
}

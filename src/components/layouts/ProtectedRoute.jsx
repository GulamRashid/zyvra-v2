import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../common/LoadingSkeleton';

export default function ProtectedRoute({ children, admin = false }) {
  const { user, loading, guest, role } = useAuth();
  const location = useLocation();
  if (loading) return <main className="page-loading"><LoadingSkeleton rows={5} /></main>;
  if (admin) {
    if (!user || role === 'student' || role === 'guest') return <Navigate to="/auth" replace state={{ from: location }} />;
    return children;
  }
  if (!user && !guest) return <Navigate to="/auth" replace state={{ from: location }} />;
  return children;
}

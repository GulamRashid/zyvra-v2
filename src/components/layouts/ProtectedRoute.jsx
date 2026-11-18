import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../common/LoadingSkeleton';

export default function ProtectedRoute({ children, admin = false }) {
  const { user, loading, guest, role, supabase } = useAuth();
  const location = useLocation();
  const [mfaChecked, setMfaChecked] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    let active = true;
    if (admin && user && supabase?.auth?.mfa) {
      supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2') {
          setMfaRequired(true);
        }
        setMfaChecked(true);
      }).catch(() => {
        if (active) setMfaChecked(true);
      });
    } else {
      setMfaChecked(true);
    }
    return () => { active = false; };
  }, [admin, user, supabase]);

  if (loading || (admin && user && !mfaChecked)) {
    return <main className="page-loading"><LoadingSkeleton rows={5} /></main>;
  }
  if (admin) {
    if (!user || guest) return <Navigate to="/auth" replace state={{ from: location }} />;
    if (mfaRequired) return <Navigate to="/auth" replace state={{ from: location }} />;
    // Keep authenticated non-admin users out of admin routes without sending
    // them back to /auth, which would redirect them to /admin again.
    if (role === 'student' || role === 'guest') return <Navigate to="/" replace />;
    return children;
  }
  if (!user && !guest) return <Navigate to="/auth" replace state={{ from: location }} />;
  return children;
}

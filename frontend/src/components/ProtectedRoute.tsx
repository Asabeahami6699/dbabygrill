// frontend/src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isAuthReady } = useAuth();
  const location = useLocation();

  // Wait until /auth/me has resolved — metadata-only role is stale for delivery guys
  if (loading || !isAuthReady) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  // Not logged in — send to login, remember where they came from
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname, returnTo: location.pathname }}
        replace
      />
    );
  }

  // Wrong role — redirect to their correct dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'company_admin':
        return <Navigate to="/company/dashboard" replace />;
      case 'delivery_guy':
        return <Navigate to="/delivery/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
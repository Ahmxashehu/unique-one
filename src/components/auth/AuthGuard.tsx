import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { UNIQUE_OBSERVATION_MODE } from '../../lib/observationMode';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  // Once Firebase has a signed-in user, keep the protected shell mounted even
  // while the profile document is refreshing. This prevents Pay/Communication
  // -> Home from disappearing behind the auth-loading gate.
  if (currentUser) {
    return <>{children}</>;
  }

  if (loading && !UNIQUE_OBSERVATION_MODE) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (!UNIQUE_OBSERVATION_MODE) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

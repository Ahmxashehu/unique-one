import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type AuthActionGateProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

export default function AuthActionGate({
  children,
  title = 'Register to continue',
  description = 'You can explore Unique One as a guest. Create an account or sign in when you are ready to use this protected action.',
}: AuthActionGateProps) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-sm font-medium text-slate-500" role="status">
        Checking access…
      </div>
    );
  }

  if (currentUser) return <>{children}</>;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8" aria-labelledby="auth-action-title">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 id="auth-action-title" className="mt-5 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            state={{ from: location }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" />
            Create account
          </Link>
          <Link
            to="/login"
            state={{ from: location }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

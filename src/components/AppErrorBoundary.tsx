import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UniqueOS section error:', error, info);
  }

  handleHome = () => {
    window.location.assign('/os/dashboard');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-black text-slate-900">UniqueOS couldn’t load this section</h2>
          <p className="mt-2 text-sm text-slate-500">
            Something went wrong while opening this page. Your account is still safe.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleHome}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
            >
              Return Home
            </button>
            <Link
              to="/os/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              Open Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

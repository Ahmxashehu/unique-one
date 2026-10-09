import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HeartPulse, ShieldCheck, X } from 'lucide-react';

export default function HealthWellnessPage() {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Unique Health & Wellness"
    >
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center py-3 sm:py-8">
        <section className="w-full overflow-hidden rounded-[30px] border border-white/30 bg-white shadow-[0_25px_100px_rgba(0,0,0,.34)]">
          <header className="relative flex items-start justify-between gap-4 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 px-5 py-6 text-white sm:px-7">
            <div>
              <div className="flex items-center gap-2 text-emerald-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                  <HeartPulse className="h-5 w-5" />
                </span>
                <span className="text-xs font-black uppercase tracking-[0.16em]">Unique Health & Wellness</span>
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Verified care, when connected</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">
                Health services will appear here only after verified providers and secure service integrations are available.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-4 p-5 sm:p-7">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-black text-amber-950">Live healthcare integration is not enabled</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  No verified provider directory or secure booking, consultation, pharmacy, laboratory, or prescription endpoint has been confirmed. These actions are disabled instead of presenting simulated results or implying that a request was submitted.
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 p-4">
              <h2 className="text-sm font-black text-slate-900">Required before activation</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                <li>Verified provider onboarding and credential checks</li>
                <li>Live availability and transparent provider pricing</li>
                <li>Secure appointment, consultation, and prescription workflows</li>
                <li>Privacy controls, audit trails, and tested failure handling</li>
              </ul>
            </section>

            <p className="text-xs leading-5 text-slate-500">
              No provider has been contacted. No appointment, prescription, purchase, or payment has been submitted.
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> Return to UniquePlatform
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Fingerprint, Landmark, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";

type CheckKey = "nin" | "bvn" | "bank" | "phone";
const checks: Array<{ key: CheckKey; title: string; description: string; icon: typeof Fingerprint }> = [
  { key: "nin", title: "NIN validation", description: "Validate identity through an authorized NIN/vNIN integration.", icon: Fingerprint },
  { key: "bvn", title: "BVN validation", description: "Validate bank identity through an authorized BVN service.", icon: Landmark },
  { key: "bank", title: "Bank account", description: "Confirm account ownership/name match through a regulated provider.", icon: Building2 },
  { key: "phone", title: "Phone verification", description: "Confirm the phone number attached to the UniquePay account.", icon: Smartphone },
];

export default function VerificationCenterPage() {
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState<CheckKey | null>(null);
  const start = (key: CheckKey) => {
    setActive(key);
    setNotice(key === "phone" ? "Phone verification can use the existing account authentication flow." : "Provider connection required. UniquePay will not claim a successful NIN/BVN result without an authorized verification response.");
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-3xl bg-emerald-600 p-6 text-white"><div className="flex items-start gap-4"><div className="rounded-2xl bg-white/15 p-3"><ShieldCheck className="h-7 w-7" /></div><div><p className="text-sm font-medium text-emerald-100">UniquePay KYC</p><h1 className="mt-1 text-2xl font-bold">Verification Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">One place for identity and account verification. Sensitive identity numbers must be sent only to an approved provider through a secure server-side integration.</p></div></div></section>
      {notice && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{notice}</div>}
      <section className="grid gap-4 sm:grid-cols-2">{checks.map(({ key, title, description, icon: Icon }) => <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-4"><div className="rounded-xl bg-slate-100 p-3"><Icon className="h-6 w-6 text-slate-700" /></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Not connected</span></div><h2 className="mt-4 font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p><button type="button" onClick={() => start(key)} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">{active === key ? "Integration required" : key === "phone" ? "Verify phone" : "Start validation"}</button></article>)}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold text-slate-900">Privacy and verification controls</h2></div><ul className="mt-4 space-y-3 text-sm text-slate-600"><li>• Never store raw NIN or BVN values in browser storage, logs, or ordinary Firestore documents.</li><li>• Store provider reference, status, timestamps and audit metadata instead of unnecessary identity data.</li><li>• Keep NIN/BVN provider credentials server-side and outside the client application.</li><li>• Treat identity matching rules as explicit business rules rather than assuming the validation provider makes the final matching decision.</li></ul></section>
      <div className="flex flex-wrap gap-3"><Link to="/os/pay" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Back to UniquePay</Link><Link to="/os/pay/security" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Security</Link></div>
    </div>
  );
}

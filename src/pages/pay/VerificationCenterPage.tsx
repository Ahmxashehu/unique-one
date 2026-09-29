import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Fingerprint, Landmark, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

type CheckKey = "nin" | "bvn" | "bank_account" | "phone";
type Result = { status?: string; providerValidated?: boolean; matchStatus?: string; error?: { message?: string } };

const checks: Array<{ key: CheckKey; title: string; description: string; icon: typeof Fingerprint; inputLabel: string; placeholder: string }> = [
  { key: "nin", title: "NIN / vNIN", description: "Validate a Nigerian identity number through the configured server-side provider.", icon: Fingerprint, inputLabel: "NIN", placeholder: "11-digit NIN" },
  { key: "bvn", title: "BVN", description: "Validate bank identity and optionally compare name and date of birth.", icon: Landmark, inputLabel: "BVN", placeholder: "11-digit BVN" },
  { key: "bank_account", title: "Bank account", description: "Validate a NUBAN through the configured provider.", icon: Building2, inputLabel: "NUBAN", placeholder: "10-digit account number" },
  { key: "phone", title: "Phone verification", description: "Validate a Nigerian phone number through the configured provider.", icon: Smartphone, inputLabel: "Phone", placeholder: "+234..." },
];

export default function VerificationCenterPage() {
  const { currentUser } = useAuth();
  const [active, setActive] = useState<CheckKey>("nin");
  const [identifier, setIdentifier] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/verification/status", { headers: { Authorization: "Bearer " + token } });
        if (response.ok) {
          const data = await response.json() as { configured?: boolean };
          setProviderConfigured(Boolean(data.configured));
        }
      } catch {
        setProviderConfigured(false);
      }
    })();
  }, [currentUser]);

  const selected = checks.find((item) => item.key === active) ?? checks[0];

  const validate = async () => {
    if (!currentUser || !identifier.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const token = await currentUser.getIdToken();
      const type = active === "nin" ? "nin" : active;
      const response = await fetch("/api/verification/validate", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          identifier: identifier.trim(),
          match: { firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined, dateOfBirth: dateOfBirth || undefined },
        }),
      });
      const data = await response.json().catch(() => ({})) as Result;
      setResult(data);
    } catch {
      setResult({ error: { message: "Verification request could not be completed." } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-3xl bg-emerald-600 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/15 p-3"><ShieldCheck className="h-7 w-7" /></div>
          <div><p className="text-sm font-medium text-emerald-100">UniquePay KYC</p><h1 className="mt-1 text-2xl font-bold">Verification Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">NIN, BVN, bank-account and phone validation are routed through a secure server-side provider. UniquePay does not store the submitted identity number.</p></div>
        </div>
      </section>

      {providerConfigured === false && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Provider connection pending.</strong> The verification UI and backend are ready; provider credentials still need to be added to the server environment before live validation can run.</div>}

      <section className="grid gap-4 sm:grid-cols-2">
        {checks.map(({ key, title, description, icon: Icon }) => (
          <button key={key} type="button" onClick={() => { setActive(key); setResult(null); setIdentifier(""); }} className={"rounded-2xl border p-5 text-left transition " + (active === key ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white")}>
            <div className="flex items-start justify-between gap-4"><div className="rounded-xl bg-slate-100 p-3"><Icon className="h-6 w-6 text-slate-700" /></div><span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">{active === key ? "Selected" : "Open"}</span></div>
            <h2 className="mt-4 font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{selected.title}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">{selected.inputLabel}<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} inputMode="numeric" autoComplete="off" placeholder={selected.placeholder} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-medium text-slate-700">First name (optional)<input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-medium text-slate-700">Last name (optional)<input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-medium text-slate-700">Date of birth (optional)<input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" /></label>
        </div>
        <button type="button" disabled={busy || !identifier.trim() || providerConfigured === false} onClick={() => void validate()} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Validating…" : "Validate securely"}</button>
        {result && <div className={"mt-5 rounded-2xl p-4 text-sm " + (result.status === "verified" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}><p className="font-semibold">{result.error?.message || (result.status === "verified" ? "Provider validation completed." : "Validation requires attention.")}</p>{!result.error && <p className="mt-1">Provider: {result.providerValidated ? "validated" : "not validated"} · Identity match: {result.matchStatus || "not requested"}</p>}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold text-slate-900">Privacy and verification controls</h2></div>
        <ul className="mt-4 space-y-3 text-sm text-slate-600"><li>• Raw NIN, BVN, vNIN, phone and NUBAN values are never persisted by the verification route.</li><li>• Only provider, verification status, match status, reference ID and timestamps are retained.</li><li>• Provider credentials remain server-side and are never shipped to the browser.</li><li>• Identity matching remains an explicit UniquePay business rule; a provider lookup alone does not automatically establish a user-name match.</li></ul>
      </section>

      <div className="flex flex-wrap gap-3"><Link to="/os/pay" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Back to UniquePay</Link><Link to="/os/pay/security" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Security</Link></div>
    </div>
  );
}

import { Link } from "react-router-dom";
import {
  Landmark,
  Users,
  Truck,
  HeartPulse,
  Home,
  Sprout,
  WalletCards,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock3,
} from "lucide-react";

type ModuleStatus = "Foundation" | "Partial" | "Planned";

const modules: Array<{
  title: string;
  description: string;
  status: ModuleStatus;
  icon: typeof Landmark;
  path?: string;
}> = [
  {
    title: "Government / Citizen",
    description:
      "Citizen identity, government-service discovery, applications, notices, payments, requests and accountable service workflows.",
    status: "Foundation",
    icon: Landmark,
  },
  {
    title: "Community",
    description:
      "Community spaces, trusted groups, local requests, announcements, contributions, reporting and communication.",
    status: "Foundation",
    icon: Users,
  },
  {
    title: "Logistics / Delivery",
    description:
      "Delivery requests, dispatch, tracking, pickup/drop-off, proof of delivery, pricing and provider workflows.",
    status: "Foundation",
    icon: Truck,
  },
  {
    title: "Healthcare",
    description:
      "Provider discovery, appointments, records, prescriptions, health requests, payments and consent-aware data exchange.",
    status: "Foundation",
    icon: HeartPulse,
  },
  {
    title: "Property / Real Estate",
    description:
      "Property discovery, verified listings, agents, inspections, rent/sale workflows, documents and transaction requests.",
    status: "Foundation",
    icon: Home,
  },
  {
    title: "Agriculture Expansion",
    description:
      "Farmer, buyer, supplier, inputs, produce, logistics, market requests, advisory and payment-connected workflows.",
    status: "Partial",
    icon: Sprout,
  },
];

const integrations = [
  "UniqueID / NIN / BVN / KYC boundary",
  "UniquePay and Request-to-Pay",
  "Unique Store and business workflows",
  "Unique AI with authorized read-only context",
  "Messaging and notifications",
  "Verification, trust, disputes and auditability",
  "Nigeria-first location and service discovery",
];

const bulkItems = [
  {
    title: "Bulk Pay",
    icon: WalletCards,
    status: "Architecture retained",
    body:
      "Bulk Pay remains part of UniquePay. It is intended for approved business, school, organization, payroll, supplier and other authorized multi-recipient payment workflows. Real-money execution remains behind the approved bank/PSP/provider integration and authorization boundary.",
  },
  {
    title: "Bulk Request",
    icon: ClipboardList,
    status: "Architecture retained",
    body:
      "Bulk Request remains part of UniqueCollect/UniquePay. Organizations can prepare requests or invoices for multiple verified UniquePay recipients, with approval, partial/installment, recurring and rules-based workflows planned for the secure action layer.",
  },
];

function StatusBadge({ status }: { status: ModuleStatus | string }) {
  const active = status === "Partial" || status === "Foundation";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

export default function MasterVisionPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Unique One • Master Vision
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              The remaining ecosystem, connected
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              This is the control surface for the remaining Master Vision modules.
              Existing features stay in place; each module is being completed as a
              real platform workflow rather than as demo data.
            </p>
          </div>
          <Link
            to="/os/ai"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Open Unique AI
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Remaining major modules</h2>
          <p className="mt-1 text-sm text-slate-500">
            Foundations are being connected first, then each module gets its real
            provider, authorization, data and transaction workflows.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article key={module.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <StatusBadge status={module.status} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Master Vision integrations</h2>
          <p className="mt-1 text-sm text-slate-500">
            These are shared platform boundaries, not separate disconnected apps.
          </p>
        </div>
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
          {integrations.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Pay & Bulk Request</h2>
          <p className="mt-1 text-sm text-slate-500">
            Both remain in the Master Vision and are not being removed or replaced.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {bulkItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-xs font-medium text-slate-500">{item.status}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white md:p-7">
        <h2 className="text-lg font-semibold">Implementation rule</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          We will not create fake government records, fake healthcare records,
          fake properties, fake deliveries, fake agricultural transactions or
          fake payment results. Where a real external provider is required, the
          integration boundary will be explicit until that provider is connected.
        </p>
      </section>
    </div>
  );
}

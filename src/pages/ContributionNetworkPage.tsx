import { useState, type FormEvent } from "react";
import { HeartHandshake, Plus, ClipboardList, Users, Clock3, CheckCircle2 } from "lucide-react";

const categories = [
  "Household",
  "Community",
  "Education",
  "Agriculture",
  "Health",
  "Business",
  "Emergency",
  "Other",
];

export default function ContributionNetworkPage() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");

  const submitRequest = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setNotice("Please provide a title and describe what contribution is needed.");
      return;
    }
    setNotice("Draft prepared locally for this first feature stage. Network publishing and matching will be connected in the next implementation stage.");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/10 p-3">
            <HeartHandshake className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-300">New Master Vision feature</p>
            <h1 className="mt-1 text-2xl font-bold">Contribution Network</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Connect people, skills, time and resources around verified contribution requests.
              This is the foundation for a future network where people can ask for help and contribute what they can.
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ClipboardList, title: "Requests", text: "Create a clear contribution request." },
          { icon: Users, title: "People", text: "Connect future requests with contributors." },
          { icon: Clock3, title: "Contribution", text: "Track help from request to completion." },
        ].map(({ icon: Icon, title: cardTitle, text }) => (
          <div key={cardTitle} className="rounded-2xl border border-slate-200 bg-white p-5">
            <Icon className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-3 font-semibold text-slate-900">{cardTitle}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Start a contribution</h2>
            <p className="mt-1 text-sm text-slate-500">
              Describe something you need from people, skills, time or resources.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Close" : "Request contribution"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitRequest} className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <div>
              <label className="text-sm font-medium text-slate-700">Request title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="What contribution do you need?"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={5}
                placeholder="Explain what is needed, who it is for, and any important requirements."
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4" />
              Prepare request
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="font-semibold text-slate-900">Network status</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          No fabricated requests, contributors or statistics are shown. Matching, verified contributor profiles,
          contribution history and completion workflows will use real platform data as those parts are implemented.
        </p>
      </section>
    </div>
  );
}

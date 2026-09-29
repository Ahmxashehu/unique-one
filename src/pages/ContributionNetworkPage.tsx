import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, getDocs, limit , orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { HeartHandshake, Plus, ClipboardList, Users, Clock3, CheckCircle2, Loader2 } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

const categories = [
  "Household",
  "Community",
  "Education",
  "Agriculture",
  "Health",
  "Business",
  "Emergency",
  "Other",
] as const;

type ContributionRequest = {
  id: string;
  requesterUid: string;
  title: string;
  category: string;
  description: string;
  status: "published" | "closed" | "cancelled";
  createdAt?: string;
};

function toIso(value: unknown): string | undefined {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : undefined;
}

export default function ContributionNetworkPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<ContributionRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>(categories[0]);
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);\n  const [actionId, setActionId] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!currentUser) return;
    setLoading(true);
    setNotice("");
    try {
      const [publishedSnap, ownedSnap] = await Promise.all([
        getDocs(query(collection(db, "contributionRequests"), where("status", "==", "published"), limit(50))),
        getDocs(query(collection(db, "contributionRequests"), where("requesterUid", "==", currentUser.uid), limit(50))),
      ]);
      const map = new Map<string, ContributionRequest>();
      [...publishedSnap.docs, ...ownedSnap.docs].forEach((item) => {
        const data = item.data();
        if (
          typeof data.requesterUid === "string" &&
          typeof data.title === "string" &&
          typeof data.category === "string" &&
          typeof data.description === "string" &&
          (data.status === "published" || data.status === "closed" || data.status === "cancelled")
        ) {
          map.set(item.id, {
            id: item.id,
            requesterUid: data.requesterUid,
            title: data.title,
            category: data.category,
            description: data.description,
            status: data.status,
            createdAt: toIso(data.createdAt),
          });
        }
      });
      setRequests(Array.from(map.values()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    } catch (error) {
      console.error("Contribution request load failed:", error);
      setNotice("Contribution requests could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [currentUser]);

  const offerToHelp = async (request: ContributionRequest) => {
    if (!currentUser) {
      setNotice("Please sign in before offering to help.");
      return;
    }
    if (request.requesterUid === currentUser.uid) {
      setNotice("You cannot offer to help on your own request.");
      return;
    }
    setActionId(request.id);
    setNotice("");
    try {
      const offerId = request.id + "_" + currentUser.uid;
      await setDoc(doc(db, "contributionOffers", offerId), {
        requestId: request.id,
        requesterUid: request.requesterUid,
        contributorUid: currentUser.uid,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: false });
      setNotice("Your offer to help was submitted.");
    } catch (error) {
      console.error("Contribution offer failed:", error);
      setNotice("Could not submit your offer. You may already have an offer for this request.");
    } finally {
      setActionId(null);
    }
  };

  const cancelRequest = async (request: ContributionRequest) => {
    if (!currentUser || request.requesterUid !== currentUser.uid || request.status !== "published") return;
    setActionId(request.id);
    setNotice("");
    try {
      await updateDoc(doc(db, "contributionRequests", request.id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
      setRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "cancelled" } : item));
      setNotice("Your contribution request has been cancelled.");
    } catch (error) {
      console.error("Contribution request cancellation failed:", error);
      setNotice("Could not cancel the contribution request.");
    } finally {
      setActionId(null);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentUser) {
      setNotice("Please sign in before creating a contribution request.");
      return;
    }
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      setNotice("Please provide a title and describe what contribution is needed.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      await addDoc(collection(db, "contributionRequests"), {
        requesterUid: currentUser.uid,
        title: cleanTitle.slice(0, 120),
        category,
        description: cleanDescription.slice(0, 1000),
        status: "published",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle("");
      setCategory(categories[0]);
      setDescription("");
      setShowForm(false);
      setNotice("Your contribution request is now published using real platform data.");
      await loadRequests();
    } catch (error) {
      console.error("Contribution request creation failed:", error);
      setNotice("Could not publish the contribution request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white/10 p-3"><HeartHandshake className="h-7 w-7" /></div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-300">Master Vision feature</p>
            <h1 className="mt-1 text-2xl font-bold">Contribution Network</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Create and discover real contribution requests for people, skills, time and resources.
              Matching and completion workflows will be added without fabricating contributors or activity.
            </p>
          </div>
        </div>
      </section>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ClipboardList, title: "Requests", text: "Create and discover real contribution requests." },
          { icon: Users, title: "People", text: "Contributor matching will use verified platform records." },
          { icon: Clock3, title: "Contribution", text: "Completion tracking will follow real contribution activity." },
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
            <p className="mt-1 text-sm text-slate-500">Describe something you need from people, skills, time or resources.</p>
          </div>
          <button type="button" onClick={() => setShowForm((value) => !value)} disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <Plus className="h-4 w-4" />{showForm ? "Close" : "Request contribution"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitRequest} className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <div>
              <label className="text-sm font-medium text-slate-700">Request title</label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120}
                placeholder="What contribution do you need?" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={5}
                placeholder="Explain what is needed, who it is for, and any important requirements."
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
            </div>
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Publishing…" : "Publish request"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Live contribution requests</h2>
            <p className="text-sm text-slate-500 mt-1">Published requests from the real platform.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{requests.length}</span>
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> :
          requests.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">No published contribution requests yet.</div> :
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-slate-900">{request.title}</h3><p className="mt-1 text-xs text-slate-500">{request.category}</p></div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{request.status}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{request.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {request.requesterUid !== currentUser?.uid && request.status === "published" && (
                    <button type="button" onClick={() => void offerToHelp(request)} disabled={actionId === request.id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {actionId === request.id ? "Submitting…" : "Offer to help"}
                    </button>
                  )}
                  {request.requesterUid === currentUser?.uid && request.status === "published" && (
                    <button type="button" onClick={() => void cancelRequest(request)} disabled={actionId === request.id}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">
                      {actionId === request.id ? "Cancelling…" : "Cancel request"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>}
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="font-semibold text-slate-900">Network status</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Real requests are now supported. No fabricated contributors, matches or statistics are shown.
          Verified matching, contribution history and completion workflows remain future stages.
        </p>
      </section>
    </div>
  );
}

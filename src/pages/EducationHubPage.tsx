import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Users, Presentation, Lightbulb, HeartHandshake, School, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

const pathways = [
  { title: 'Learn', text: 'Discover courses, study resources, practical skills and learning opportunities.', icon: BookOpen, to: '/os/education' },
  { title: 'Teach', text: 'Teachers, lecturers, tutors and experts can share knowledge and build learning communities.', icon: Presentation, to: '/os/education' },
  { title: 'Contribute', text: 'Students, alumni, educators and everyone with useful knowledge can contribute ideas, resources and opportunities.', icon: HeartHandshake, to: '/register' },
  { title: 'Institutions', text: 'Schools, colleges, universities and training providers can build a trusted presence.', icon: School, to: '/os/education' },
];

export default function EducationHubPage() {
  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 shadow-2xl sm:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Unique Education Hub</div>
            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10 shadow-[0_0_30px_rgba(52,211,153,0.22)]"><GraduationCap className="h-7 w-7 text-emerald-300" /></div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Learn. Teach. Contribute. Grow.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">A shared education space for students, teachers, lecturers, tutors, institutions, alumni, innovators and anyone ready to add value to learning.</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
              <Link to="/education" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">Enter Education <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black text-white">Join & Contribute</Link>
            </div>
          </div>
        </section>
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {pathways.map(({ title, text, icon: Icon, to }) => (
            <Link key={title} to={to} className="group rounded-3xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-emerald-300/30 hover:bg-white/[0.08]">
              <div className="flex items-start gap-4"><div className="rounded-2xl bg-white/10 p-3"><Icon className="h-5 w-5 text-emerald-300" /></div><div className="min-w-0 flex-1"><h2 className="font-black">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-400">{text}</p></div><ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-emerald-300" /></div>
            </Link>
          ))}
        </section>
        <section className="mt-5 rounded-3xl border border-amber-300/15 bg-gradient-to-br from-amber-300/[0.08] to-white/[0.03] p-5 sm:p-6">
          <div className="flex items-start gap-4"><div className="rounded-2xl bg-amber-300/10 p-3"><Lightbulb className="h-5 w-5 text-amber-300" /></div><div><h2 className="font-black">Everyone can add value</h2><p className="mt-1 text-sm leading-6 text-slate-400">Share a useful lesson, study tip, scholarship lead, career guidance, research insight, mentorship opportunity, educational event or verified resource. Contributions should help people learn—not create noise.</p></div></div>
        </section>
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><Users className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-black">How you benefit</h2><p className="mt-1 text-sm leading-6 text-slate-400">Find learning paths, connect with educators, discover opportunities, build your education profile and turn knowledge into practical progress.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><ShieldCheck className="h-5 w-5 text-emerald-300" /><h2 className="mt-3 font-black">How Unique One helps you</h2><p className="mt-1 text-sm leading-6 text-slate-400">Unique One brings education closer to identity, communication, payments, opportunities, events and other everyday services—so users can move from learning to action in one ecosystem.</p></div>
        </section>
        <section className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-400/[0.06] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">About Unique One</p><h2 className="mt-2 text-xl font-black">Understand the platform. Discover your place in it.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Learn what Unique One is building, how the different experiences connect, what you can do as a guest or member, and how your participation can help make the platform more useful for people and communities.</p>
          <Link to="/about" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Learn about Unique One <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </div>
  );
}

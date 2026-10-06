import { useEffect, useState } from 'react';
import { setDoc, addDoc, collection, getDocs, limit, orderBy, query, updateDoc, where, doc } from 'firebase/firestore';
import { BookOpen, GraduationCap, Plus, School, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { EducationCourse, EducationEnrollment, EducationInstitution } from '../lib/education/educationTypes';

const toIso = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
};

export default function EducationPage() {
  const { currentUser } = useAuth();
  const [institutions, setInstitutions] = useState<EducationInstitution[]>([]);
  const [enrollments, setEnrollments] = useState<EducationEnrollment[]>([]);
  const [courses, setCourses] = useState<EducationCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstitutionForm, setShowInstitutionForm] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [enrollmentInstitutionId, setEnrollmentInstitutionId] = useState('');
  const [enrollmentProgramme, setEnrollmentProgramme] = useState('');
  const [enrollmentLevel, setEnrollmentLevel] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState<EducationInstitution['type']>('school');
  const [institutionLocation, setInstitutionLocation] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [publishedInstitutionSnap, ownedInstitutionSnap, enrollmentSnap, courseSnap] = await Promise.all([
          getDocs(query(collection(db, 'educationInstitutions'), where('status', '==', 'published'), orderBy('name'), limit(50))),
          getDocs(query(collection(db, 'educationInstitutions'), where('ownerUid', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50))),
          getDocs(query(collection(db, 'educationEnrollments'), where('studentUid', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50))),
          getDocs(query(collection(db, 'educationCourses'), where('ownerUid', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50))),
        ]);
        if (cancelled) return;
        const institutionMap = new Map<string, EducationInstitution>();
        [...publishedInstitutionSnap.docs, ...ownedInstitutionSnap.docs].forEach(d => institutionMap.set(d.id, { id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt), updatedAt: toIso(d.data().updatedAt) } as EducationInstitution));
        setInstitutions(Array.from(institutionMap.values()));
        setEnrollments(enrollmentSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt), updatedAt: toIso(d.data().updatedAt) } as EducationEnrollment)));
        setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt), updatedAt: toIso(d.data().updatedAt) } as EducationCourse)));
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Education data could not be loaded. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentUser]);

  const createInstitution = async () => {
    if (!currentUser || !institutionName.trim() || !institutionLocation.trim()) return;
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'educationInstitutions'), {
        ownerUid: currentUser.uid, name: institutionName.trim(), type: institutionType,
        location: institutionLocation.trim(), status: 'draft', createdAt: now, updatedAt: now,
      });
      setInstitutionName(''); setInstitutionLocation(''); setShowInstitutionForm(false);
    } catch (e) { console.error(e); setError('Could not create the institution profile.'); }
  };

  const createEnrollment = async () => {
    if (!currentUser || !enrollmentInstitutionId) return;
    try {
      const now = new Date().toISOString();
      const enrollmentRef = doc(collection(db, 'educationEnrollments'));
      await setDoc(enrollmentRef, { id: enrollmentRef.id, studentUid: currentUser.uid, institutionId: enrollmentInstitutionId, programme: enrollmentProgramme.trim(), level: enrollmentLevel.trim(), status: 'active', createdAt: now, updatedAt: now });
      setEnrollmentInstitutionId(''); setEnrollmentProgramme(''); setEnrollmentLevel(''); setShowEnrollmentForm(false);
    } catch (e) { console.error(e); setError('Could not create the education enrollment.'); }
  };

  const publishInstitution = async (institution: EducationInstitution) => {
    if (!currentUser || institution.ownerUid !== currentUser.uid) return;
    try { await updateDoc(doc(db, 'educationInstitutions', institution.id), { status: 'published', updatedAt: new Date().toISOString() }); setInstitutions(items => items.map(i => i.id === institution.id ? { ...i, status: 'published' } : i)); } catch (e) { console.error(e); setError('Could not publish the institution.'); }
  };

  const publishCourse = async (course: EducationCourse) => {
    if (!currentUser || course.ownerUid !== currentUser.uid) return;
    try { await updateDoc(doc(db, 'educationCourses', course.id), { status: 'published', updatedAt: new Date().toISOString() }); setCourses(items => items.map(c => c.id === course.id ? { ...c, status: 'published' } : c)); } catch (e) { console.error(e); setError('Could not publish the course.'); }
  };

  const createCourse = async () => {
    if (!currentUser || !selectedInstitutionId || !courseTitle.trim()) return;
    const ownsInstitution = institutions.some(i => i.id === selectedInstitutionId && i.ownerUid === currentUser.uid);
    if (!ownsInstitution) { setError('Select an institution you own.'); return; }
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'educationCourses'), {
        institutionId: selectedInstitutionId, ownerUid: currentUser.uid, title: courseTitle.trim(),
        description: courseDescription.trim(), status: 'draft', createdAt: now, updatedAt: now,
      });
      setCourseTitle(''); setCourseDescription(''); setShowCourseForm(false);
    } catch (e) { console.error(e); setError('Could not create the course.'); }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600"><GraduationCap className="w-6 h-6" /><span className="text-sm font-semibold">Unique Education</span></div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Learn, teach, and manage education</h1>
          <p className="text-sm text-slate-500 mt-1">A foundation for schools, learners, educators, courses, and education services.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInstitutionForm(v => !v)} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Institution</button>
          <button onClick={() => setShowCourseForm(v => !v)} disabled={!institutions.some(i => i.ownerUid === currentUser?.uid)} className="px-4 py-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Course</button>
          <button onClick={() => setShowEnrollmentForm(v => !v)} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Enroll</button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {(showInstitutionForm || showCourseForm || showEnrollmentForm) && (
        <section className="grid md:grid-cols-2 gap-4">
          {showInstitutionForm && <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold">Create institution profile</h2>
            <input value={institutionName} onChange={e => setInstitutionName(e.target.value)} placeholder="Institution name" className="w-full rounded-xl border p-3" />
            <select value={institutionType} onChange={e => setInstitutionType(e.target.value as EducationInstitution['type'])} className="w-full rounded-xl border p-3">
              <option value="school">School</option><option value="university">University</option><option value="college">College</option><option value="training_center">Training center</option><option value="tutor">Tutor</option><option value="online">Online</option>
            </select>
            <input value={institutionLocation} onChange={e => setInstitutionLocation(e.target.value)} placeholder="City / State / Country" className="w-full rounded-xl border p-3" />
            <button onClick={createInstitution} className="w-full rounded-xl bg-emerald-600 text-white p-3 font-medium">Save draft</button>
          </div>}
          {showCourseForm && <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold">Create course</h2>
            <select value={selectedInstitutionId} onChange={e => setSelectedInstitutionId(e.target.value)} className="w-full rounded-xl border p-3">
              <option value="">Select your institution</option>
              {institutions.filter(i => i.ownerUid === currentUser?.uid).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="Course title" className="w-full rounded-xl border p-3" />
            <textarea value={courseDescription} onChange={e => setCourseDescription(e.target.value)} placeholder="Course description" className="w-full rounded-xl border p-3 min-h-24" />
            <button onClick={createCourse} className="w-full rounded-xl bg-emerald-600 text-white p-3 font-medium">Save draft</button>
          </div>}
        </section>
      )}

      {loading ? <div className="bg-white rounded-2xl p-8 text-center text-slate-500">Loading education data…</div> : (
        <div className="grid lg:grid-cols-3 gap-5">
          <section className="bg-white border rounded-2xl p-5"><School className="w-6 h-6 text-emerald-600" /><h2 className="font-semibold mt-3">Institutions</h2><p className="text-sm text-slate-500 mt-1">Published education providers available on Unique One.</p><div className="mt-4 space-y-3">{institutions.length ? institutions.map(i => <div key={i.id} className="border rounded-xl p-3"><p className="font-medium">{i.name}</p><p className="text-xs text-slate-500">{i.type.replace('_',' ')} · {i.location} · {i.status}</p>{i.ownerUid === currentUser?.uid && i.status === 'draft' && <button onClick={() => publishInstitution(i)} className="mt-2 text-xs font-medium text-emerald-700">Publish institution</button>}</div>) : <p className="text-sm text-slate-500">No published institutions yet.</p>}</div></section>
          <section className="bg-white border rounded-2xl p-5"><Users className="w-6 h-6 text-indigo-600" /><h2 className="font-semibold mt-3">My enrollments</h2><p className="text-sm text-slate-500 mt-1">Your current education relationships.</p><div className="mt-4 space-y-3">{enrollments.length ? enrollments.map(e => <div key={e.id} className="border rounded-xl p-3"><p className="font-medium">{e.programme || 'Education enrollment'}</p><p className="text-xs text-slate-500">{e.level || 'Level not specified'} · {e.status}</p></div>) : <p className="text-sm text-slate-500">No enrollments linked to your account.</p>}</div></section>
          <section className="bg-white border rounded-2xl p-5"><BookOpen className="w-6 h-6 text-amber-600" /><h2 className="font-semibold mt-3">My courses</h2><p className="text-sm text-slate-500 mt-1">Courses you manage as an educator.</p><div className="mt-4 space-y-3">{courses.length ? courses.map(c => <div key={c.id} className="border rounded-xl p-3"><p className="font-medium">{c.title}</p><p className="text-xs text-slate-500">{c.status}{c.description ? ' · '+c.description : ''}</p>{c.status === 'draft' && <button onClick={() => publishCourse(c)} className="mt-2 text-xs font-medium text-emerald-700">Publish course</button>}</div>) : <p className="text-sm text-slate-500">No courses created yet.</p>}</div></section>
        </div>
      )}
    </div>
  );
}

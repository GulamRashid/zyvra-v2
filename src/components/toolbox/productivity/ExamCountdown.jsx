import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Flag, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'zyvra-toolbox-exam-countdown';

function readPlan() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { title: String(value.title || ''), date: String(value.date || '') };
  } catch {
    return { title: '', date: '' };
  }
}

export default function ExamCountdown() {
  const [plan, setPlan] = useState(readPlan);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch { /* Keep the tool usable if storage is unavailable. */ }
  }, [plan]);
  const daysLeft = useMemo(() => {
    if (!plan.date) return null;
    const target = new Date(`${plan.date}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }, [plan.date]);

  return <section className="toolbox-section mini-tool exam-countdown-tool">
    <div className="flex items-center gap-3"><span className="toolbox-icon"><CalendarDays size={20} /></span><div><h2 className="text-base font-extrabold">Exam countdown</h2><p className="text-xs text-slate-500 dark:text-slate-400">Set your next exam date and keep your preparation in view.</p></div></div>
    <label className="grid gap-1 text-xs font-semibold">Exam name
      <input value={plan.title} maxLength={60} placeholder="e.g. SSC CGL" onChange={(event) => setPlan((current) => ({ ...current, title: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
    </label>
    <label className="grid gap-1 text-xs font-semibold">Exam date
      <input type="date" value={plan.date} onChange={(event) => setPlan((current) => ({ ...current, date: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
    </label>
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-50 p-4 dark:bg-slate-900"><div className="flex min-w-0 items-center gap-2"><Flag size={17} className="shrink-0 text-indigo-500" /><strong className="truncate">{plan.title || 'Your next exam'}</strong></div><strong className="shrink-0 text-xl text-indigo-600 dark:text-indigo-300">{daysLeft === null ? '—' : daysLeft < 0 ? 'Passed' : `${daysLeft} days`}</strong></div>
    <button type="button" onClick={() => setPlan({ title: '', date: '' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"><RotateCcw size={14} /> Clear date</button>
  </section>;
}

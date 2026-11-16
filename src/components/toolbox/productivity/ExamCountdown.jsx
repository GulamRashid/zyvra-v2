import { useMemo } from 'react';
import { CalendarDays, Flag, RotateCcw } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import useStudentToolboxData from '../../../hooks/useStudentToolboxData';

export default function ExamCountdown() {
  const { t, language } = useThemeLanguage();
  const [plan, setPlan, syncState] = useStudentToolboxData('exam-countdown', { title: '', date: '' });
  const daysLeft = useMemo(() => {
    if (!plan.date) return null;
    const target = new Date(`${plan.date}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.round((target.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }, [plan.date]);

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  return <section className="toolbox-section mini-tool exam-countdown-tool">
    <div className="flex items-center gap-3"><span className="toolbox-icon"><CalendarDays size={20} /></span><div><h2 className="text-base font-extrabold">{t('tbCountdownTitle')}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{t('tbCountdownDescription')}</p></div></div>
    <label className="grid gap-1 text-xs font-semibold">{t('tbExamName')}
      <input value={plan.title} maxLength={60} placeholder={t('tbExamNameExample')} onChange={(event) => setPlan((current) => ({ ...current, title: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
    </label>
    <label className="grid gap-1 text-xs font-semibold">{t('tbExamDate')}
      <input type="date" value={plan.date} onChange={(event) => setPlan((current) => ({ ...current, date: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
    </label>
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-50 p-4 dark:bg-slate-900"><div className="flex min-w-0 items-center gap-2"><Flag size={17} className="shrink-0 text-indigo-500" /><strong className="truncate">{plan.title || t('tbNextExam')}</strong></div><strong className="shrink-0 text-xl text-indigo-600 dark:text-indigo-300">{daysLeft === null ? '—' : daysLeft < 0 ? t('tbExamPassed') : daysLeft === 0 ? t('tbExamToday') : `${new Intl.NumberFormat(locale).format(daysLeft)} ${t('tbDaysRemaining')}`}</strong></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500" role="status">{t(syncState === 'syncing' ? 'tbSyncing' : syncState === 'synced' ? 'tbSynced' : syncState === 'offline' ? 'tbOfflineLocalSave' : 'tbNotesLocalOnly')}</span><button type="button" onClick={() => setPlan({ title: '', date: '' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"><RotateCcw size={14} /> {t('tbClearExamDate')}</button></div>
  </section>;
}

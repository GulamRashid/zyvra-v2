import { useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import useStudentToolboxData from '../../../hooks/useStudentToolboxData';

function localDate(value = new Date()) {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 10);
}

function nextReviewDate(reviewCount) {
  const intervals = [1, 3, 7, 14, 30];
  const date = new Date();
  date.setDate(date.getDate() + intervals[Math.min(reviewCount, intervals.length - 1)]);
  return localDate(date);
}

export default function MistakeNotebook() {
  const { t, language } = useThemeLanguage();
  const [items, setItems, syncState] = useStudentToolboxData('mistakes', []);
  const [topic, setTopic] = useState('');
  const [mistake, setMistake] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const today = localDate();
  const dueItems = useMemo(() => items.filter((item) => !item.nextReview || item.nextReview <= today).sort((a, b) => String(a.nextReview || '').localeCompare(String(b.nextReview || ''))), [items, today]);

  const addMistake = (event) => {
    event.preventDefault();
    if (!mistake.trim() || !correctAnswer.trim() || items.length >= 100) return;
    setItems((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, topic: topic.trim().slice(0, 60), mistake: mistake.trim().slice(0, 500), correctAnswer: correctAnswer.trim().slice(0, 500), nextReview: today, reviewCount: 0, createdAt: new Date().toISOString() }, ...current]);
    setTopic(''); setMistake(''); setCorrectAnswer('');
  };

  const markReviewed = (item) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, reviewCount: (Number(entry.reviewCount) || 0) + 1, nextReview: nextReviewDate(Number(entry.reviewCount) || 0) } : entry));
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  return <section className="toolbox-section mini-tool">
    <div className="section-heading"><div><div className="eyebrow">{t('tbRevisionEyebrow')}</div><h3>{t('tbMistakeNotebook')}</h3></div><span className="text-xs text-slate-500" role="status">{t(syncState === 'syncing' ? 'tbSyncing' : syncState === 'synced' ? 'tbSynced' : syncState === 'offline' ? 'tbOfflineLocalSave' : 'tbNotesLocalOnly')}</span></div>
    <div className="flex items-center justify-between gap-2 rounded-xl bg-indigo-500/5 p-3 text-sm"><span>{t('tbDueForReview')}</span><strong>{new Intl.NumberFormat(locale).format(dueItems.length)}</strong></div>
    <form onSubmit={addMistake} className="grid gap-2">
      <label className="field-label">{t('tbMistakeTopic')}<input className="text-input" maxLength={60} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={t('tbMistakeTopicHint')} /></label>
      <label className="field-label">{t('tbWhatWentWrong')}<textarea className="sticky-notes-textarea" maxLength={500} value={mistake} onChange={(event) => setMistake(event.target.value)} placeholder={t('tbMistakeHint')} /></label>
      <label className="field-label">{t('tbCorrectMethod')}<textarea className="sticky-notes-textarea" maxLength={500} value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} placeholder={t('tbCorrectMethodHint')} /></label>
      <button type="submit" disabled={!mistake.trim() || !correctAnswer.trim() || items.length >= 100} className="button button-gold min-h-11"><Plus size={15} /> {t('tbSaveMistake')}</button>
      {items.length >= 100 && <p className="field-hint" role="status">{t('tbMistakeLimit')}</p>}
    </form>
    <div className="grid gap-2">{items.length ? items.map((item) => {
      const due = !item.nextReview || item.nextReview <= today;
      return <article key={item.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block break-words">{item.topic || t('tbMistakeTopic')}</strong><small className="text-slate-500">{due ? t('tbReviewNow') : `${t('tbNextReview')} · ${new Date(`${item.nextReview}T00:00:00`).toLocaleDateString(locale)}`}</small></div><button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label={t('tbDeleteMistake')} className="grid min-h-10 min-w-10 place-items-center rounded-lg text-rose-500"><Trash2 size={16} /></button></div>
        <div className="rounded-lg bg-rose-500/5 p-2 text-sm"><b>{t('tbWhatWentWrong')}: </b>{item.mistake}</div>
        <div className="rounded-lg bg-emerald-500/5 p-2 text-sm"><b>{t('tbCorrectMethod')}: </b>{item.correctAnswer}</div>
        {due && <button type="button" onClick={() => markReviewed(item)} className="button button-outline min-h-10 justify-self-start">{Number(item.reviewCount) ? <RotateCcw size={15} /> : <Check size={15} />}{t('tbMarkReviewed')}</button>}
      </article>;
    }) : <div className="empty-content">{t('tbMistakesEmpty')}</div>}</div>
  </section>;
}

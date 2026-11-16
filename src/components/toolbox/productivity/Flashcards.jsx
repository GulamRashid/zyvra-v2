import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Plus, Shuffle } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import useStudentToolboxData from '../../../hooks/useStudentToolboxData';

export default function Flashcards() {
  const { t } = useThemeLanguage();
  const [cards, setCards, syncState] = useStudentToolboxData('flashcards', []);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const activeCard = useMemo(() => cards.length ? cards[((activeIndex % cards.length) + cards.length) % cards.length] : null, [activeIndex, cards]);

  const addCard = (event) => {
    event.preventDefault();
    if (!front.trim() || !back.trim() || cards.length >= 100) return;
    setCards((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, front: front.trim().slice(0, 500), back: back.trim().slice(0, 1000) }]);
    setActiveIndex(cards.length);
    setRevealed(false);
    setFront('');
    setBack('');
  };

  const shuffle = () => {
    setCards((current) => [...current].sort(() => Math.random() - 0.5));
    setActiveIndex(0);
    setRevealed(false);
  };

  const move = (step) => {
    setActiveIndex((current) => (current + step + cards.length) % cards.length);
    setRevealed(false);
  };

  return <section className="toolbox-section mini-tool">
    <div className="section-heading"><div><div className="eyebrow">{t('tbRevisionEyebrow')}</div><h3><BookOpen size={18} /> {t('tbFlashcardsTitle')}</h3></div><span className="text-xs text-slate-500" role="status">{t(syncState === 'syncing' ? 'tbSyncing' : syncState === 'synced' ? 'tbSynced' : syncState === 'offline' ? 'tbOfflineLocalSave' : 'tbNotesLocalOnly')}</span></div>
    {activeCard ? <div className="grid gap-3">
      <button type="button" onClick={() => setRevealed((current) => !current)} aria-label={t('tbFlashcardReveal')} className="grid min-h-48 place-items-center rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 text-center text-lg font-bold leading-relaxed dark:text-slate-100">
        <span><small className="mb-3 block text-xs font-black uppercase tracking-wider text-indigo-500">{t(revealed ? 'tbFlashcardAnswer' : 'tbFlashcardQuestion')}</small>{revealed ? activeCard.back : activeCard.front}</span>
      </button>
      <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => move(-1)} aria-label={t('tbPreviousCard')} className="grid min-h-11 min-w-11 place-items-center rounded-xl border dark:border-slate-700 border-slate-200"><ArrowLeft size={18} /></button><span className="text-sm font-bold">{activeIndex + 1} / {cards.length}</span><button type="button" onClick={() => move(1)} aria-label={t('tbNextCard')} className="grid min-h-11 min-w-11 place-items-center rounded-xl border dark:border-slate-700 border-slate-200"><ArrowRight size={18} /></button><button type="button" onClick={shuffle} className="button button-outline min-h-11"><Shuffle size={15} /> {t('tbShuffle')}</button></div>
      <button type="button" onClick={() => { setCards((current) => current.filter((item) => item.id !== activeCard.id)); setActiveIndex(0); setRevealed(false); }} className="min-h-10 justify-self-end text-xs font-bold text-rose-500">{t('tbDeleteCard')}</button>
    </div> : <div className="empty-content">{t('tbFlashcardsEmpty')}</div>}
    <form onSubmit={addCard} className="grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <label className="field-label">{t('tbFlashcardQuestion')}<textarea className="sticky-notes-textarea" maxLength={500} value={front} onChange={(event) => setFront(event.target.value)} placeholder={t('tbFlashcardQuestionHint')} /></label>
      <label className="field-label">{t('tbFlashcardAnswer')}<textarea className="sticky-notes-textarea" maxLength={1000} value={back} onChange={(event) => setBack(event.target.value)} placeholder={t('tbFlashcardAnswerHint')} /></label>
      <button type="submit" disabled={!front.trim() || !back.trim() || cards.length >= 100} className="button button-gold min-h-11"><Plus size={15} /> {t('tbAddFlashcard')}</button>
      {cards.length >= 100 && <p className="field-hint" role="status">{t('tbFlashcardLimit')}</p>}
    </form>
  </section>;
}

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Plus, Shuffle, Sparkles, Zap } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import useStudentToolboxData from '../../../hooks/useStudentToolboxData';
import { FREE_FLASHCARDS_LIMIT, PRO_FLASHCARDS_LIMIT } from '../../../lib/studentToolbox';

export default function Flashcards({ isPremium = false, onUnlock = null }) {
  const { t } = useThemeLanguage();
  const [cards, setCards, syncState] = useStudentToolboxData('flashcards', []);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const maxLimit = isPremium ? PRO_FLASHCARDS_LIMIT : FREE_FLASHCARDS_LIMIT;
  const isLimitReached = cards.length >= maxLimit;

  const activeCard = useMemo(
    () => (cards.length ? cards[((activeIndex % cards.length) + cards.length) % cards.length] : null),
    [activeIndex, cards]
  );

  const addCard = (event) => {
    event.preventDefault();
    if (!front.trim() || !back.trim()) return;

    if (!isPremium && cards.length >= FREE_FLASHCARDS_LIMIT) {
      if (onUnlock) onUnlock();
      return;
    }

    if (cards.length >= PRO_FLASHCARDS_LIMIT) return;

    setCards((current) => [
      ...current,
      {
        id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        front: front.trim().slice(0, 500),
        back: back.trim().slice(0, 1000)
      }
    ]);
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

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="section-heading flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow">{t('tbRevisionEyebrow')}</div>
          <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900 flex items-center gap-2">
            <BookOpen size={18} /> {t('tbFlashcardsTitle')}
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-semibold" role="status">
          {t(
            syncState === 'syncing'
              ? 'tbSyncing'
              : syncState === 'synced'
              ? 'tbSynced'
              : syncState === 'offline'
              ? 'tbOfflineLocalSave'
              : 'tbNotesLocalOnly'
          )}
        </span>
      </div>

      {/* Tier Quota & Upgrade Banner */}
      {isPremium ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-transparent p-3.5 border border-amber-500/30">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-500 dark:text-amber-400">
            <Sparkles size={16} />
            <span>Pro Flashcards Active</span>
          </div>
          <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
            {cards.length} / {PRO_FLASHCARDS_LIMIT} cards
          </span>
        </div>
      ) : (
        <div className="rounded-2xl dark:bg-slate-800/80 bg-slate-100 p-3.5 border dark:border-slate-700/60 border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="dark:text-slate-300 text-slate-700 flex items-center gap-1.5">
              <span>🎯 Free Tier Quota:</span>
              <strong className="text-indigo-600 dark:text-indigo-400">
                {cards.length} / {FREE_FLASHCARDS_LIMIT} Cards
              </strong>
            </span>
            {onUnlock && (
              <button
                type="button"
                onClick={onUnlock}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-black"
              >
                <Zap size={13} />
                <span>Unlock Unlimited</span>
              </button>
            )}
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all rounded-full ${
                isLimitReached ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, (cards.length / FREE_FLASHCARDS_LIMIT) * 100)}%` }}
            />
          </div>
          {isLimitReached && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-amber-600 dark:text-amber-300 font-semibold">
                Free card limit reached (10/10). Upgrade for unlimited active recall cards!
              </span>
              {onUnlock && (
                <button
                  type="button"
                  onClick={onUnlock}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 text-center"
                >
                  Upgrade
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Card Presentation */}
      {activeCard ? (
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={t('tbFlashcardReveal')}
            className="grid min-h-48 place-items-center rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 text-center text-lg font-bold leading-relaxed dark:text-slate-100 hover:border-indigo-500/40 transition-all cursor-pointer"
          >
            <span>
              <small className="mb-3 block text-xs font-black uppercase tracking-wider text-indigo-500">
                {t(revealed ? 'tbFlashcardAnswer' : 'tbFlashcardQuestion')} (Tap to flip)
              </small>
              {revealed ? activeCard.back : activeCard.front}
            </span>
          </button>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={t('tbPreviousCard')}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl border dark:border-slate-700 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-sm font-bold">
              {activeIndex + 1} / {cards.length}
            </span>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={t('tbNextCard')}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl border dark:border-slate-700 border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={shuffle}
              className="button button-outline min-h-11 flex items-center gap-1.5"
            >
              <Shuffle size={15} /> {t('tbShuffle')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCards((current) => current.filter((item) => item.id !== activeCard.id));
              setActiveIndex(0);
              setRevealed(false);
            }}
            className="min-h-10 justify-self-end text-xs font-bold text-rose-500 hover:underline"
          >
            {t('tbDeleteCard')}
          </button>
        </div>
      ) : (
        <div className="empty-content p-6 rounded-2xl border dark:border-slate-800 border-slate-200 text-center">
          {t('tbFlashcardsEmpty')}
        </div>
      )}

      {/* Add Card Form */}
      <form onSubmit={addCard} className="grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <label className="field-label">
          {t('tbFlashcardQuestion')}
          <textarea
            className="sticky-notes-textarea"
            maxLength={500}
            value={front}
            onChange={(event) => setFront(event.target.value)}
            placeholder={t('tbFlashcardQuestionHint')}
          />
        </label>
        <label className="field-label">
          {t('tbFlashcardAnswer')}
          <textarea
            className="sticky-notes-textarea"
            maxLength={1000}
            value={back}
            onChange={(event) => setBack(event.target.value)}
            placeholder={t('tbFlashcardAnswerHint')}
          />
        </label>

        {isLimitReached && !isPremium ? (
          <button
            type="button"
            onClick={onUnlock}
            className="button bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black min-h-11 shadow-glowGold flex items-center justify-center gap-1.5"
          >
            <Zap size={16} /> Unlock Unlimited Flashcards
          </button>
        ) : (
          <button
            type="submit"
            disabled={!front.trim() || !back.trim()}
            className="button button-gold min-h-11 flex items-center justify-center gap-1.5"
          >
            <Plus size={15} /> {t('tbAddFlashcard')}
          </button>
        )}
      </form>
    </section>
  );
}

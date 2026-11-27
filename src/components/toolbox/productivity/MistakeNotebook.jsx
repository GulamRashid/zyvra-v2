import { useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, Sparkles, Trash2, Zap } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import useStudentToolboxData from '../../../hooks/useStudentToolboxData';
import { FREE_MISTAKES_LIMIT, PRO_MISTAKES_LIMIT, nextReviewDate } from '../../../lib/studentToolbox';

function localDate(value = new Date()) {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 10);
}

export default function MistakeNotebook({ isPremium = false, onUnlock = null }) {
  const { t, language } = useThemeLanguage();
  const isHindi = language === 'hi';
  const [items, setItems, syncState] = useStudentToolboxData('mistakes', []);
  const [topic, setTopic] = useState('');
  const [mistake, setMistake] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const today = localDate();

  const maxLimit = isPremium ? PRO_MISTAKES_LIMIT : FREE_MISTAKES_LIMIT;
  const isLimitReached = items.length >= maxLimit;

  const dueItems = useMemo(
    () =>
      items
        .filter((item) => !item.nextReview || item.nextReview <= today)
        .sort((a, b) => String(a.nextReview || '').localeCompare(String(b.nextReview || ''))),
    [items, today]
  );

  const addMistake = (event) => {
    event.preventDefault();
    if (!mistake.trim() || !correctAnswer.trim()) return;

    if (!isPremium && items.length >= FREE_MISTAKES_LIMIT) {
      if (onUnlock) onUnlock();
      return;
    }

    if (items.length >= PRO_MISTAKES_LIMIT) return;

    setItems((current) => [
      {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        topic: topic.trim().slice(0, 80) || 'General Revision',
        mistake: mistake.trim().slice(0, 500),
        correctAnswer: correctAnswer.trim().slice(0, 600),
        nextReview: today,
        reviewCount: 0,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);

    setTopic('');
    setMistake('');
    setCorrectAnswer('');
  };

  const markReviewed = (item) =>
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              reviewCount: (Number(entry.reviewCount) || 0) + 1,
              nextReview: nextReviewDate(Number(entry.reviewCount) || 0)
            }
          : entry
      )
    );

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="section-heading flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow">{t('tbRevisionEyebrow')}</div>
          <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900 flex items-center gap-2">
            <span>📓</span> {t('tbMistakeNotebook')}
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
            <span>{isHindi ? 'प्रो मिस्टेक वॉल्ट सक्रिय' : 'Pro Mistake Vault Active'}</span>
          </div>
          <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
            {items.length} / {PRO_MISTAKES_LIMIT} {isHindi ? 'सहेजे गए' : 'saved'}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl dark:bg-slate-800/80 bg-slate-100 p-3.5 border dark:border-slate-700/60 border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="dark:text-slate-300 text-slate-700 flex items-center gap-1.5">
              <span>{isHindi ? '🎯 फ्री कोटा:' : '🎯 Free Tier Quota:'}</span>
              <strong className="text-indigo-600 dark:text-indigo-400">
                {items.length} / {FREE_MISTAKES_LIMIT} {isHindi ? 'गलतियां' : 'Mistakes'}
              </strong>
            </span>
            {onUnlock && (
              <button
                type="button"
                onClick={onUnlock}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-black"
              >
                <Zap size={13} />
                <span>{isHindi ? 'अनलॉक करें' : 'Unlock Unlimited'}</span>
              </button>
            )}
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all rounded-full ${
                isLimitReached ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, (items.length / FREE_MISTAKES_LIMIT) * 100)}%` }}
            />
          </div>
          {isLimitReached && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-amber-600 dark:text-amber-300 font-semibold">
                {isHindi
                  ? 'फ्री सीमा पूरी (5/5)। असीमित टेस्ट गलतियां सहेजने के लिए अपग्रेड करें!'
                  : 'Free limit reached (5/5). Upgrade to save unlimited test errors!'}
              </span>
              {onUnlock && (
                <button
                  type="button"
                  onClick={onUnlock}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 text-center"
                >
                  {isHindi ? 'अपग्रेड करें' : 'Upgrade'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Due for Review Widget */}
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-sm">
        <span className="font-semibold dark:text-indigo-200 text-indigo-900">
          {t('tbDueForReview')}
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-black text-xs">
          {new Intl.NumberFormat(locale).format(dueItems.length)}
        </span>
      </div>

      {/* Add Mistake Form */}
      <form onSubmit={addMistake} className="grid gap-2.5">
        <label className="field-label">
          {t('tbMistakeTopic')}
          <input
            className="text-input"
            maxLength={80}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={t('tbMistakeTopicHint')}
          />
        </label>
        <label className="field-label">
          {t('tbWhatWentWrong')}
          <textarea
            className="sticky-notes-textarea"
            maxLength={500}
            value={mistake}
            onChange={(event) => setMistake(event.target.value)}
            placeholder={t('tbMistakeHint')}
          />
        </label>
        <label className="field-label">
          {t('tbCorrectMethod')}
          <textarea
            className="sticky-notes-textarea"
            maxLength={600}
            value={correctAnswer}
            onChange={(event) => setCorrectAnswer(event.target.value)}
            placeholder={t('tbCorrectMethodHint')}
          />
        </label>

        {isLimitReached && !isPremium ? (
          <button
            type="button"
            onClick={onUnlock}
            className="button bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black min-h-11 shadow-glowGold flex items-center justify-center gap-1.5"
          >
            <Zap size={16} /> Unlock Unlimited Mistake Vault
          </button>
        ) : (
          <button
            type="submit"
            disabled={!mistake.trim() || !correctAnswer.trim()}
            className="button button-gold min-h-11 flex items-center justify-center gap-1.5"
          >
            <Plus size={15} /> {t('tbSaveMistake')}
          </button>
        )}
      </form>

      {/* List of Saved Mistakes */}
      <div className="grid gap-3 pt-2">
        {items.length ? (
          items.map((item) => {
            const due = !item.nextReview || item.nextReview <= today;
            return (
              <article
                key={item.id}
                className="grid gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 dark:bg-slate-800/60 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="block break-words text-sm font-bold dark:text-white text-slate-900">
                        {item.topic || t('tbMistakeTopic')}
                      </strong>
                      {(item.entryType === 'review' || item.isCorrect === true) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                          {isHindi ? 'समीक्षा हेतु सहेजा गया' : 'Saved for Review'}
                        </span>
                      )}
                    </div>
                    {item.testTitle && (
                      <span className="text-[10px] text-indigo-500 font-bold block truncate">
                        📝 {item.testTitle}
                      </span>
                    )}
                    <small className="text-slate-500 text-xs">
                      {due
                        ? `⚡ ${t('tbReviewNow')}`
                        : `${t('tbNextReview')} · ${new Date(
                            `${item.nextReview}T00:00:00`
                          ).toLocaleDateString(locale)}`}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                    aria-label={t('tbDeleteMistake')}
                    className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {item.entryType === 'review' || item.isCorrect === true ? (
                  <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    <b className="text-indigo-600 dark:text-indigo-300">{isHindi ? 'प्रश्न / कॉन्सेप्ट:' : 'Question / Concept:'} </b>
                    <span className="whitespace-pre-wrap break-words">
                      {!expandedIds[item.id] && String(item.mistake || '').length > 140
                        ? `${String(item.mistake).slice(0, 140)}…`
                        : item.mistake}
                    </span>
                    {String(item.mistake || '').length > 140 && (
                      <button
                        type="button"
                        onClick={() => setExpandedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="ml-1.5 text-xs font-bold text-indigo-500 hover:underline"
                      >
                        {expandedIds[item.id] ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    <b className="text-rose-600 dark:text-rose-400">{t('tbWhatWentWrong')}: </b>
                    <span className="whitespace-pre-wrap break-words">
                      {!expandedIds[item.id] && String(item.mistake || '').length > 140
                        ? `${String(item.mistake).slice(0, 140)}…`
                        : item.mistake}
                    </span>
                    {String(item.mistake || '').length > 140 && (
                      <button
                        type="button"
                        onClick={() => setExpandedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="ml-1.5 text-xs font-bold text-indigo-500 hover:underline"
                      >
                        {expandedIds[item.id] ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}

                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  <b className="text-emerald-600 dark:text-emerald-400">{t('tbCorrectMethod')}: </b>
                  <span className="whitespace-pre-wrap break-words">{String(item.correctAnswer || '').replace(/^(?:Correct|सही उत्तर)\s*:\s*/i, '')}</span>
                </div>

                {due && (
                  <button
                    type="button"
                    onClick={() => markReviewed(item)}
                    className="button button-outline min-h-10 justify-self-start flex items-center gap-1.5 text-xs font-bold"
                  >
                    {Number(item.reviewCount) ? <RotateCcw size={14} /> : <Check size={14} />}
                    {t('tbMarkReviewed')}
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <div className="empty-content p-6 rounded-2xl border dark:border-slate-800 border-slate-200 text-center">
            {t('tbMistakesEmpty')}
          </div>
        )}
      </div>
    </section>
  );
}

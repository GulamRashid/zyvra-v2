import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid,
  HelpCircle,
  Lock,
  RotateCcw,
  Sparkles,
  Trophy,
  X
} from 'lucide-react';
import MathRenderer from './MathRenderer';
import QuestionFormatter from './QuestionFormatter';
import {
  extractLocalizedDistractorNote,
  extractLocalizedExplanation,
  getOptionEntries,
  getQuestionText,
  hasDevanagari,
  hasLatin,
  normalizeCorrectAnswer,
  normalizeOptionKey,
  sanitizeLiveQuestion
} from '../../lib/tests';
import { supabase } from '../../lib/supabase';
import useModalBack from '../../hooks/useModalBack';

function getStoredHindi(value) {
  return value && typeof value === 'object' ? value.hi || value.text_hi || '' : '';
}

function parseSerializedValue(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeDistractorNotes(value) {
  let parsed = parseSerializedValue(value);
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
    return parsed;
  }
  return {};
}

function getResolvedOptionEntries(currentQuestion) {
  if (!currentQuestion) return [];

  let raw = currentQuestion.options;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      // ignore invalid JSON
    }
  }

  // Handle { en: [...], hi: [...] } parallel arrays
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && (Array.isArray(raw.en) || Array.isArray(raw.hi))) {
    const enArr = Array.isArray(raw.en) ? raw.en : [];
    const hiArr = Array.isArray(raw.hi) ? raw.hi : [];
    const maxLen = Math.max(enArr.length, hiArr.length);
    raw = Array.from({ length: maxLen }, (_, i) => ({
      en: enArr[i] || '',
      hi: hiArr[i] || ''
    }));
  }

  let entries = currentQuestion.options != null ? getOptionEntries(raw) : [];

  // If entries are empty, fallback to flat option_a ... option_e on question
  if (!entries || entries.length === 0) {
    entries = ['A', 'B', 'C', 'D', 'E']
      .filter((key) => {
        const k = key.toLowerCase();
        return (
          currentQuestion[`option_${k}`] !== undefined ||
          currentQuestion[`option_${k}_en`] !== undefined ||
          currentQuestion[`option_${k}_hi`] !== undefined
        );
      })
      .map((key) => {
        const k = key.toLowerCase();
        return [
          key,
          {
            en: currentQuestion[`option_${k}_en`] || currentQuestion[`option_${k}`] || '',
            hi: currentQuestion[`option_${k}_hi`] || currentQuestion[`option_${k}`] || ''
          }
        ];
      });
  }

  return entries;
}

function resolveOptionText(opt, key, currentQuestion, language = 'en') {
  const isEn = String(language).toUpperCase() === 'EN';
  let text = '';

  if (typeof opt === 'string') {
    text = opt;
  } else if (opt && typeof opt === 'object') {
    const enText = String(
      opt.en || opt.EN || opt.text_en || opt.text || opt.label || opt.value || opt.code || opt.title || opt.val || ''
    ).trim();
    const hiText = String(
      opt.hi || opt.HI || opt.text_hi || opt.text || opt.label || opt.value || opt.code || opt.title || opt.val || ''
    ).trim();

    text = isEn ? (enText || hiText) : (hiText || enText);

    // If still empty, check if opt is a matching map like { A: 2, B: 1, C: 4, D: 3 } or { a: "1", b: "2" }
    if (!text) {
      const entries = Object.entries(opt).filter(([k]) => !['id', 'key', 'index'].includes(k.toLowerCase()));
      if (entries.length > 0 && entries.every(([k, v]) => (typeof v === 'string' || typeof v === 'number') && k.length <= 4)) {
        text = entries.map(([k, v]) => `${k.toUpperCase()}-${v}`).join(', ');
      }
    }
  }

  // Fallback to question flat fields if text is still empty
  if (!text && currentQuestion) {
    const k = String(key).toLowerCase();
    const flatEn = String(currentQuestion[`option_${k}_en`] || currentQuestion[`option_${k}`] || '').trim();
    const flatHi = String(currentQuestion[`option_${k}_hi`] || '').trim();
    text = isEn ? (flatEn || flatHi) : (flatHi || flatEn);
  }

  return String(text || '').trim();
}

export default function QuestionPracticeModal({
  questions = [],
  chapterTitle = '',
  subject = '',
  onClose
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const lockedAnswersRef = useRef(new Map());
  const [showExplanationMap, setShowExplanationMap] = useState({});
  const [language, setLanguage] = useState('en');
  const [showSummary, setShowSummary] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleModalBack = useCallback(() => {
    if (paletteOpen) {
      setPaletteOpen(false);
    } else {
      onClose();
    }
  }, [paletteOpen, onClose]);

  useModalBack(true, handleModalBack, 'question-practice');

  const safeQuestions = useMemo(() => {
    return (questions || []).map((question) => {
      const sanitized = sanitizeLiveQuestion({
        ...question,
        options: parseSerializedValue(question?.options),
        distractor_notes: normalizeDistractorNotes(question?.distractor_notes)
      });
      if (!sanitized.correct_answer) {
        console.warn(`[QuestionPracticeModal] Question ${sanitized.id || sanitized.question_id} missing correct_answer. Keys present:`, Object.keys(question || {}));
      }
      return sanitized;
    });
  }, [questions]);

  const [extraAnswerMap, setExtraAnswerMap] = useState({});
  const currentQ = safeQuestions[currentIndex] || null;
  const currentQId = currentQ ? String(currentQ.id || currentIndex) : '';

  useEffect(() => {
    if (!currentQ || !supabase) return;
    const targetId = currentQ.question_id || currentQ.id;
    if (!targetId || currentQ.correct_answer || extraAnswerMap[currentQId]) return;

    supabase
      .from('questions')
      .select('id, correct_answer, explanation, explanation_hi, distractor_notes, distractor_notes_hi')
      .eq('id', targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const ans = normalizeCorrectAnswer(
            data.correct_answer,
            currentQ.options
          );
          if (ans) {
            setExtraAnswerMap((prev) => ({ ...prev, [currentQId]: ans }));
            currentQ.correct_answer = ans;
            currentQ.correct_option = ans;
            if (data.explanation && !currentQ.explanation) currentQ.explanation = data.explanation;
            if (data.explanation_hi && !currentQ.explanation_hi) currentQ.explanation_hi = data.explanation_hi;
            if (data.distractor_notes && (!currentQ.distractor_notes || !Object.keys(currentQ.distractor_notes).length)) {
              currentQ.distractor_notes = normalizeDistractorNotes(data.distractor_notes);
            }
          }
        }
      })
      .catch((err) => console.warn('[QuestionPracticeModal] Answer fallback error:', err));
  }, [currentQId, currentQ, extraAnswerMap]);

  // Close on Escape & Arrow keys for navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && currentIndex < safeQuestions.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentIndex, safeQuestions.length]);

  const optionEntries = useMemo(() => (
    currentQ ? getResolvedOptionEntries(currentQ) : []
  ), [currentQ]);

  const practiceStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    safeQuestions.forEach((q, idx) => {
      const qId = String(q.id || idx);
      const sel = selectedOptions[qId];
      if (sel) {
        const ans = normalizeCorrectAnswer(
          q.correct_answer ?? q.correct_option ?? q.answer ?? extraAnswerMap[qId],
          q.options
        );
        if (ans && String(sel).trim().toUpperCase() === ans) {
          correct += 1;
        } else if (ans) {
          wrong += 1;
        }
      }
    });
    const answered = Object.keys(selectedOptions).length;
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return { correct, wrong, answered, total: safeQuestions.length, accuracy };
  }, [safeQuestions, selectedOptions, extraAnswerMap]);

  if (!currentQ) return null;

  // Resolve question text bilingual
  const qEnCandidate = getQuestionText(currentQ.question_text, 'en')
    || (currentQ.question_en && (hasLatin(currentQ.question_en) || !hasDevanagari(currentQ.question_en)) ? currentQ.question_en : '')
    || (currentQ.question_text_en && (hasLatin(currentQ.question_text_en) || !hasDevanagari(currentQ.question_text_en)) ? currentQ.question_text_en : '')
    || (typeof currentQ.text === 'string' && !hasDevanagari(currentQ.text) ? currentQ.text : '')
    || (typeof currentQ.question_text === 'string' && !hasDevanagari(currentQ.question_text) ? currentQ.question_text : '');

  const questionEnglish = qEnCandidate || (typeof currentQ.question_en === 'string' ? currentQ.question_en : '') || currentQ.text || '';

  const qHiCandidate = (typeof currentQ.question_text_hi === 'string' && currentQ.question_text_hi.trim() ? currentQ.question_text_hi : '')
    || (typeof currentQ.question_hi === 'string' && currentQ.question_hi.trim() ? currentQ.question_hi : '')
    || getStoredHindi(currentQ.question_text)
    || (typeof currentQ.text_hi === 'string' && currentQ.text_hi.trim() ? currentQ.text_hi : '')
    || (typeof currentQ.question_text === 'string' && hasDevanagari(currentQ.question_text) ? currentQ.question_text : '');

  const questionHindi = qHiCandidate || '';

  const displayedQuestionText = language === 'hi'
    ? (questionHindi || questionEnglish)
    : (questionEnglish || questionHindi);

  const selectedOption = selectedOptions[currentQId] || null;
  const isAnswered = selectedOption !== null;
  const correctAnswer = normalizeCorrectAnswer(
    currentQ?.correct_answer ?? currentQ?.correct_option ?? currentQ?.answer ?? extraAnswerMap[currentQId],
    currentQ?.options
  );
  const isCorrect = isAnswered && Boolean(correctAnswer && String(selectedOption).trim().toUpperCase() === correctAnswer);
  const isExplanationShown = showExplanationMap[currentQId] || isAnswered;

  // Explanation text
  const displayedExplanation = extractLocalizedExplanation(
    parseSerializedValue(currentQ?.explanation),
    language,
    currentQ
  );
  const localizedDistractorNotes = Object.entries(currentQ?.distractor_notes || {})
    .map(([key, note]) => [key, extractLocalizedDistractorNote(note, language)])
    .filter(([, note]) => note);

  const handleSelectOption = (key) => {
    if (!currentQId || !key) return;
    // Synchronous Lock Guard & State Guard (First selection locks permanently)
    if (lockedAnswersRef.current.has(currentQId) || selectedOptions[currentQId]) {
      return;
    }
    const normKey = normalizeOptionKey(key);
    lockedAnswersRef.current.set(currentQId, normKey);
    setSelectedOptions((prev) => ({
      ...prev,
      [currentQId]: normKey
    }));
    setShowExplanationMap((prev) => ({
      ...prev,
      [currentQId]: true
    }));
  };

  const answeredCount = Object.keys(selectedOptions).length;

  return (
    <div
      className="modal-backdrop practice-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="practice-runner-modal relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-modal-title"
      >
        {/* Header */}
        <header className="practice-runner-header">
          <div className="practice-runner-title-wrap flex-1 min-w-0">
            <div className="practice-badge">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 id="practice-modal-title" className="practice-title truncate">
                {chapterTitle || 'Question Practice'}
              </h2>
              <div className="practice-subtext truncate flex items-center gap-2">
                {subject && <span className="subject-pill">{subject}</span>}
                <button
                  type="button"
                  onClick={() => setPaletteOpen(!paletteOpen)}
                  className="font-bold underline text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                  title="Jump to question"
                >
                  <span>Q {currentIndex + 1} of {safeQuestions.length}</span>
                  <Grid size={11} />
                </button>
                <span>· {answeredCount} answered</span>
              </div>
            </div>
          </div>

          <div className="practice-header-actions flex-shrink-0 flex items-center gap-1.5 sm:gap-2">
            {answeredCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-colors"
                title="View Practice Summary"
              >
                <Award size={13} />
                <span>Finish</span>
              </button>
            )}

            <div className="native-language-toggle compact-lang-toggle" role="group" aria-label="Language">
              <button
                type="button"
                className={language === 'en' ? 'active' : ''}
                aria-pressed={language === 'en'}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={language === 'hi' ? 'active' : ''}
                aria-pressed={language === 'hi'}
                onClick={() => setLanguage('hi')}
              >
                HI
              </button>
            </div>

            <button
              type="button"
              className="icon-button practice-modal-close"
              aria-label="Close practice"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Quick Question Jump Drawer */}
        {paletteOpen && (
          <div className="p-3 bg-slate-900 border-b border-slate-800 animate-in slide-in-from-top-2 duration-150 z-30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Jump to Question (प्रश्न चुनें):
              </span>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="text-xs text-indigo-400 font-semibold hover:underline"
              >
                Close ✕
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-40 overflow-y-auto p-1">
              {safeQuestions.map((q, idx) => {
                const qId = String(q.id || idx);
                const isCur = idx === currentIndex;
                const sel = selectedOptions[qId];
                const ans = normalizeCorrectAnswer(
                  q.correct_answer ?? q.correct_option ?? q.answer ?? extraAnswerMap[qId],
                  q.options
                );
                const isRight = sel && ans && String(sel).trim().toUpperCase() === ans;
                const isWrong = sel && ans && String(sel).trim().toUpperCase() !== ans;

                let btnBg = 'bg-slate-800 text-slate-300 border-slate-700';
                if (isCur) btnBg = 'border-2 border-indigo-400 text-white font-black bg-indigo-900/60';
                else if (isRight) btnBg = 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50';
                else if (isWrong) btnBg = 'bg-rose-600/30 text-rose-300 border-rose-500/50';
                else if (sel) btnBg = 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50';

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setPaletteOpen(false);
                    }}
                    className={`h-8 rounded-lg text-xs font-bold border flex items-center justify-center transition-all active:scale-95 ${btnBg}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="practice-progress-bar">
          <div
            className="practice-progress-fill"
            style={{ width: `${((currentIndex + 1) / safeQuestions.length) * 100}%` }}
          />
        </div>

        {/* Question Body */}
        <div className="practice-runner-body">
          <div className="practice-question-card">
            <div className="practice-q-num">
              <span>Question {currentIndex + 1}</span>
              {isAnswered && (
                <div className="flex items-center gap-2">
                  {!correctAnswer ? (
                    <span className="practice-result-badge text-amber-600 dark:text-amber-400 text-xs font-semibold">
                      {language === 'hi' ? 'उत्तर की जाँच हो रही है...' : 'Evaluating...'}
                    </span>
                  ) : (
                    <>
                      <span className={`practice-result-badge ${isCorrect ? 'correct' : 'wrong'}`}>
                        {isCorrect
                          ? (language === 'hi' ? 'सही उत्तर ✓' : 'Correct ✓')
                          : (language === 'hi' ? 'गलत उत्तर ✗' : 'Incorrect ✗')}
                      </span>
                      {!isCorrect && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {language === 'hi' ? `सही उत्तर है: ${correctAnswer}` : `Correct answer: ${correctAnswer}`}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="practice-question-text">
              <QuestionFormatter text={displayedQuestionText} />
            </div>

            {/* Options */}
            <div className="quiz-options practice-options">
              {optionEntries.map(([key, opt]) => {
                const optText = resolveOptionText(opt, key, currentQ, language);
                const isSelected = selectedOption === key;
                const isThisCorrect = Boolean(correctAnswer && correctAnswer === key);
                const isThisWrong = Boolean(correctAnswer && isSelected && correctAnswer !== key);

                let optClass = 'quiz-option';
                if (isAnswered) {
                  if (isThisCorrect) {
                    optClass += ' correct-answer';
                  } else if (isThisWrong) {
                    optClass += ' wrong-answer';
                  } else if (isSelected) {
                    optClass += ' selected';
                  }
                  optClass += ' cursor-default';
                } else if (isSelected) {
                  optClass += ' selected';
                }

                return (
                  <button
                    key={key}
                    type="button"
                    className={optClass}
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(key)}
                  >
                    <span className="quiz-option-letter">{key}</span>
                    <span className="quiz-option-text">
                      <MathRenderer>{optText}</MathRenderer>
                    </span>
                    {isAnswered && (
                      isThisCorrect ? (
                        <span className="quiz-option-check text-emerald-600 dark:text-emerald-400 font-bold">
                          <Check size={18} />
                        </span>
                      ) : isSelected ? (
                        <span className="quiz-option-check text-rose-600 dark:text-rose-400 font-bold">
                          <X size={18} />
                        </span>
                      ) : null
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation Section */}
            {isExplanationShown && (displayedExplanation || localizedDistractorNotes.length > 0) && (
              <div className="practice-explanation-card">
                <div className="practice-explanation-header">
                  <BookOpen size={16} />
                  <strong>Explanation & Analysis</strong>
                </div>
                {displayedExplanation && (
                  <div className="practice-explanation-content">
                    <MathRenderer>{displayedExplanation}</MathRenderer>
                  </div>
                )}
                {localizedDistractorNotes.length > 0 && (
                  <div className="practice-distractor-notes">
                    <strong>{language === 'hi' ? 'अतिरिक्त नोट्स' : 'Additional Notes'}:</strong>
                    {localizedDistractorNotes.map(([key, note]) => (
                      <div key={key}><b>Option {key}:</b> {note}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <footer className="practice-runner-footer">
          <div className="practice-footer-left">
            {isAnswered && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 select-none">
                <Lock size={13} />
                <span>{language === 'hi' ? 'उत्तर लॉक है' : 'Answer Locked'}</span>
              </div>
            )}
            {!isAnswered && (
              <button
                type="button"
                className="button button-outline text-xs"
                onClick={() =>
                  setShowExplanationMap((prev) => ({
                    ...prev,
                    [currentQId]: !prev[currentQId]
                  }))
                }
              >
                <HelpCircle size={13} />{' '}
                {showExplanationMap[currentQId] ? 'Hide Answer' : 'Show Answer'}
              </button>
            )}
          </div>

          <div className="practice-footer-right">
            <button
              type="button"
              className="button button-outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            {currentIndex < safeQuestions.length - 1 ? (
              <button
                type="button"
                className="button button-gold"
                onClick={() => setCurrentIndex((i) => Math.min(safeQuestions.length - 1, i + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="button button-gold !bg-emerald-600 hover:!bg-emerald-500 !text-white flex items-center gap-1.5 font-bold shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
                onClick={() => setShowSummary(true)}
              >
                <CheckCircle2 size={16} />
                <span>{language === 'hi' ? 'अभ्यास पूरा करें' : 'Finish Practice'}</span>
              </button>
            )}
          </div>
        </footer>

        {/* Practice Complete Summary Modal */}
        {showSummary && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="max-w-sm w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Trophy size={28} className="text-amber-400" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {language === 'hi' ? 'शानदार! अभ्यास समाप्त हुआ' : 'Great Job! Practice Complete'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {chapterTitle}
                </p>
              </div>

              {/* Score Statistics Cards */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    {language === 'hi' ? 'सही उत्तर' : 'Correct Answers'}
                  </span>
                  <strong className="text-xl font-black text-emerald-400">
                    {practiceStats.correct} <span className="text-xs text-slate-400">/ {practiceStats.total}</span>
                  </strong>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    {language === 'hi' ? 'सटीकता' : 'Accuracy'}
                  </span>
                  <strong className="text-xl font-black text-indigo-400">
                    {practiceStats.accuracy}%
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1 bg-slate-800/40 rounded-xl">
                <span>{language === 'hi' ? 'कुल हल किए' : 'Answered'}: <strong className="text-white">{practiceStats.answered}</strong></span>
                <span>{language === 'hi' ? 'छोड़े गए' : 'Unanswered'}: <strong className="text-amber-400">{practiceStats.total - practiceStats.answered}</strong></span>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSummary(false);
                    setCurrentIndex(0);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>{language === 'hi' ? 'समीक्षा करें (Review Answers)' : 'Review Answers from Q1'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
                >
                  {language === 'hi' ? 'अध्याय पर वापस जाएं' : 'Done · Back to Chapter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

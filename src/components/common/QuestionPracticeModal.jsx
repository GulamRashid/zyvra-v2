import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RotateCcw,
  Sparkles,
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
  sanitizeLiveQuestion
} from '../../lib/tests';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

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
  const parsed = parseSerializedValue(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  return typeof parsed === 'string' && parsed.trim() ? { General: parsed.trim() } : {};
}

export default function QuestionPracticeModal({
  questions = [],
  chapterTitle = '',
  subject = '',
  onClose
}) {
  const { t } = useThemeLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showExplanationMap, setShowExplanationMap] = useState({});
  const [language, setLanguage] = useState('en');

  const safeQuestions = useMemo(() => {
    return (questions || []).map((question) => sanitizeLiveQuestion({
      ...question,
      options: parseSerializedValue(question?.options),
      distractor_notes: normalizeDistractorNotes(question?.distractor_notes)
    }));
  }, [questions]);

  const currentQ = safeQuestions[currentIndex] || null;
  const currentQId = currentQ ? String(currentQ.id || currentIndex) : '';

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

  const optionEntries = getOptionEntries(currentQ.options);
  const selectedOption = selectedOptions[currentQId] || null;
  const isAnswered = selectedOption !== null;
  const correctAnswer = String(currentQ.correct_answer || '').trim().toUpperCase();
  const isCorrect = isAnswered && selectedOption.toUpperCase() === correctAnswer;
  const isExplanationShown = showExplanationMap[currentQId] || isAnswered;

  // Explanation text
  const displayedExplanation = extractLocalizedExplanation(
    parseSerializedValue(currentQ.explanation),
    language,
    currentQ
  );
  const localizedDistractorNotes = Object.entries(currentQ.distractor_notes || {})
    .map(([key, note]) => [key, extractLocalizedDistractorNote(note, language)])
    .filter(([, note]) => note);

  const handleSelectOption = (key) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [currentQId]: key
    }));
    setShowExplanationMap((prev) => ({
      ...prev,
      [currentQId]: true
    }));
  };

  const handleReset = () => {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      delete next[currentQId];
      return next;
    });
    setShowExplanationMap((prev) => {
      const next = { ...prev };
      delete next[currentQId];
      return next;
    });
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
        className="practice-runner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-modal-title"
      >
        {/* Header */}
        <header className="practice-runner-header">
          <div className="practice-runner-title-wrap">
            <div className="practice-badge">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 id="practice-modal-title" className="practice-title">
                {chapterTitle || 'Question Practice'}
              </h2>
              <div className="practice-subtext">
                {subject && <span className="subject-pill">{subject}</span>}
                <span>Question {currentIndex + 1} of {safeQuestions.length}</span>
                <span>· {answeredCount} answered</span>
              </div>
            </div>
          </div>

          <div className="practice-header-actions">
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
              className="icon-button modal-close"
              aria-label="Close practice"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>

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
                <span className={`practice-result-badge ${isCorrect ? 'correct' : 'wrong'}`}>
                  {isCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                </span>
              )}
            </div>

            <div className="practice-question-text">
              <QuestionFormatter text={displayedQuestionText} />
            </div>

            {/* Options */}
            <div className="quiz-options practice-options">
              {optionEntries.map(([key, opt]) => {
                const optEn = getQuestionText(opt, 'en') || getQuestionText(opt?.text, 'en') || (typeof opt === 'string' ? opt : '');
                const optHi = getStoredHindi(opt) || (typeof opt?.text_hi === 'string' ? opt.text_hi : '');
                const optText = language === 'hi' ? (optHi || optEn) : (optEn || optHi);
                const isSelected = selectedOption === key;
                const isThisCorrect = correctAnswer === key;

                let optClass = 'quiz-option';
                if (isAnswered) {
                  if (isThisCorrect) {
                    optClass += ' correct-answer';
                  } else if (isSelected && !isThisCorrect) {
                    optClass += ' wrong-answer';
                  }
                } else if (isSelected) {
                  optClass += ' selected';
                }

                return (
                  <button
                    key={key}
                    type="button"
                    className={optClass}
                    onClick={() => handleSelectOption(key)}
                  >
                    <span className="quiz-option-letter">{key}</span>
                    <span className="quiz-option-text">
                      <MathRenderer content={optText} />
                    </span>
                    {isAnswered && isThisCorrect && (
                      <span className="quiz-option-check text-green-500">
                        <Check size={18} />
                      </span>
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
                    <MathRenderer content={displayedExplanation} />
                  </div>
                )}
                {localizedDistractorNotes.length > 0 && (
                  <div className="practice-distractor-notes">
                    <strong>{language === 'hi' ? 'विकल्प विश्लेषण' : 'Option Analysis'}</strong>
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
              <button
                type="button"
                className="button button-outline text-xs"
                onClick={handleReset}
              >
                <RotateCcw size={13} /> Reset
              </button>
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
            <button
              type="button"
              className="button button-gold"
              disabled={currentIndex >= safeQuestions.length - 1}
              onClick={() => setCurrentIndex((i) => Math.min(safeQuestions.length - 1, i + 1))}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

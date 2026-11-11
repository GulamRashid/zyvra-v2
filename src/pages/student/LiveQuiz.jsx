import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Flag, Grid3X3, ListChecks, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { getOptionEntries, getQuestionText, normalizeRpcObject, sanitizeLiveQuestion, unwrapRpcPayload } from '../../lib/tests';
import { translateText } from '../../lib/translator';

const pendingAttemptStarts = new Map();

function getAttemptId(data) {
  if (typeof data === 'string') return data;
  const result = normalizeRpcObject(data);
  return result.attempt_id || result.id || result.test_attempt_id || result.attempt?.attempt_id || result.attempt?.id || '';
}

function startAttemptOnce(supabase, testId, userId) {
  const key = `${userId}:${testId}`;
  if (pendingAttemptStarts.has(key)) return pendingAttemptStarts.get(key);
  const request = supabase.rpc('start_test_attempt', { p_test_id: testId }).then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  pendingAttemptStarts.set(key, request);
  request.then(() => pendingAttemptStarts.delete(key), () => pendingAttemptStarts.delete(key));
  return request;
}

function getDeadline(test, attempt) {
  const startedAt = attempt.started_at || attempt.created_at;
  if (!startedAt) return Date.now() + Number(test.duration_minutes || 60) * 60_000;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  return Date.now() + Math.max(0, Number(test.duration_minutes || 60) * 60_000 - elapsed);
}

function getRemaining(deadline) {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function getStoredHindi(value) {
  return value && typeof value === 'object' ? value.hi || value.text_hi || '' : '';
}

export default function LiveQuiz() {
  const { testId } = useParams();
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [test, setTest] = useState(null);
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const submitLock = useRef(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [language, setLanguage] = useState('en');
  const [translatedData, setTranslatedData] = useState({});
  const [translatingQuestionId, setTranslatingQuestionId] = useState('');
  const inFlightTranslations = useRef(new Map());
  const question = questions?.[currentIndex] || null;

  const returnTo = location.state?.returnTo || sessionStorage.getItem('last_quiz_return_url') || (test?.chapter_id ? `/chapter/${test.chapter_id}` : '/tests');

  useEffect(() => {
    if (location.state?.returnTo) {
      sessionStorage.setItem('last_quiz_return_url', location.state.returnTo);
    } else if (test?.chapter_id && !sessionStorage.getItem('last_quiz_return_url')) {
      sessionStorage.setItem('last_quiz_return_url', `/chapter/${test.chapter_id}`);
    }
  }, [location.state?.returnTo, test?.chapter_id]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!user) {
        setError({
          message: 'User session not found. Please log in first.',
          technical: ''
        });
        setLoading(false);
        return;
      }
      if (!supabase) {
        setError({
          message: 'Authentication service is currently unavailable.',
          technical: ''
        });
        setLoading(false);
        return;
      }
      const { data: testData, error: testError } = await supabase.from('tests')
        .select('id,title,chapter_id,instructions,pattern,duration_minutes,attempt_limit,positive_marks,negative_marks,mandatory_option_e_penalty,coin_reward_enabled,status')
        .eq('id', testId).maybeSingle();
      if (testError) throw testError;
      if (!testData || !['published', 'live', 'available'].includes(String(testData.status).toLowerCase())) {
        setError({
          message: 'This test is not currently available.',
          technical: ''
        });
        setLoading(false);
        return;
      }
      const storageKey = `zyvra-active-attempt-${user.id}-${testId}`;
      const savedAttempt = sessionStorage.getItem(storageKey);
      let savedAttemptData = {};
      if (savedAttempt) {
        try {
          savedAttemptData = JSON.parse(savedAttempt);
        } catch {
          savedAttemptData = { id: savedAttempt };
        }
      }
      let activeAttemptId = savedAttemptData.id || '';
      let attempt = {};
      if (!activeAttemptId) {
        const attemptData = await startAttemptOnce(supabase, testId, user.id);
        activeAttemptId = getAttemptId(attemptData);
        const attemptResponse = normalizeRpcObject(attemptData);
        attempt = attemptResponse.attempt || attemptResponse;
        if (!activeAttemptId) throw new Error('The server did not return an attempt ID. No quiz was started.');
        savedAttemptData = { id: activeAttemptId, started_at: attempt.started_at || attempt.created_at || null };
        sessionStorage.setItem(storageKey, JSON.stringify(savedAttemptData));
      }
      if (!active) return;
      const { data: questionData, error: questionError } = await supabase.rpc('get_live_test_questions', {
        p_test_id: testId,
        p_attempt_id: activeAttemptId
      });
      if (questionError) throw questionError;
      const payload = unwrapRpcPayload(questionData);
      const questionRows = Array.isArray(payload) ? payload : payload?.questions;
      const safeRows = Array.isArray(questionRows) ? questionRows : [];
      const safeQuestions = safeRows.map(sanitizeLiveQuestion);
      if (active) {
        setTest(testData);
        setAttemptId(activeAttemptId);
        setQuestions(safeQuestions);
        const savedResponses = sessionStorage.getItem(`zyvra-responses-${activeAttemptId}`);
        if (savedResponses) {
          try {
            const parsedResponses = JSON.parse(savedResponses);
            setResponses(parsedResponses && typeof parsedResponses === 'object' && !Array.isArray(parsedResponses) ? parsedResponses : {});
          }
          catch (parseError) { console.error('Unable to restore saved responses:', parseError); }
        }
        const endAt = getDeadline(testData, attempt.started_at ? attempt : savedAttemptData);
        setDeadline(endAt);
        setRemaining(getRemaining(endAt));
        setLoading(false);
      }
    };

    initialize().catch((err) => {
      if (active) {
        console.error('Failed to load test:', err);
        const technical = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || 'Unknown error';
        setError({
          message: 'Something went wrong while loading the test. Please return to the test list and try again.',
          technical
        });
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [testId, user, supabase]);

  useEffect(() => {
    if (language !== 'hi' || !question) return undefined;

    const questionId = String(question.id || question.question_id || currentIndex);
    const entries = [];
    const questionEnglish = question.question_text_en
      || getQuestionText(question.question_text, 'en')
      || question.text
      || '';
    const questionHindi = question.question_text_hi
      || getStoredHindi(question.question_text)
      || question.text_hi
      || '';
    if (!questionHindi && questionEnglish && !translatedData[questionId]?.question) {
      entries.push(['question', questionEnglish]);
    }

    for (const [key, option] of getOptionEntries(question.options)) {
      const optionEnglish = getQuestionText(option, 'en')
        || getQuestionText(option?.text, 'en')
        || (typeof option === 'string' ? option : '');
      const optionHindi = getStoredHindi(option);
      if (!optionHindi && optionEnglish && !translatedData[questionId]?.[`option:${key}`]) {
        entries.push([`option:${key}`, optionEnglish]);
      }
    }
    if (!entries.length) {
      setTranslatingQuestionId((current) => current === questionId ? '' : current);
      return undefined;
    }

    setTranslatingQuestionId(questionId);
    const translations = entries.map(([field, text]) => {
      const cacheKey = `${questionId}:${field}`;
      let request = inFlightTranslations.current.get(cacheKey);
      if (!request) {
        request = translateText(text);
        inFlightTranslations.current.set(cacheKey, request);
        request.finally(() => inFlightTranslations.current.delete(cacheKey));
      }
      return request.then((value) => [field, value]);
    });

    Promise.all(translations).then((values) => {
      setTranslatedData((current) => ({
        ...current,
        [questionId]: { ...current[questionId], ...Object.fromEntries(values) }
      }));
    }).finally(() => {
      setTranslatingQuestionId((current) => current === questionId ? '' : current);
    });
    return undefined;
  }, [language, question, currentIndex, translatedData]);

  useEffect(() => {
    if (!attemptId) return;
    try {
      sessionStorage.setItem(`zyvra-responses-${attemptId}`, JSON.stringify(responses));
    } catch (storageError) {
      console.error('Unable to save in-progress responses locally:', storageError);
    }
  }, [attemptId, responses]);

  const submit = useCallback(async (expired = false) => {
    if (submitLock.current || !attemptId || !supabase) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    setConfirmSubmit(false);
    if (expired) setTimeExpired(true);
    const p_responses = questions.map((question) => ({
      question_id: question.id,
      selected_option: responses[question.id]?.selected_option || null,
      marked_for_review: Boolean(responses[question.id]?.marked_for_review)
    }));
    try {
      const { error: submitError } = await supabase.rpc('submit_test_attempt', {
        p_attempt_id: attemptId,
        p_responses
      });
      if (submitError) throw submitError;
      if (user) sessionStorage.removeItem(`zyvra-active-attempt-${user.id}-${testId}`);
      sessionStorage.removeItem(`zyvra-responses-${attemptId}`);
      navigate(`/quiz/result/${attemptId}`, { replace: true, state: { returnTo } });
    } catch (submitError) {
      submitLock.current = false;
      setSubmitting(false);
      setError({
        message: submitError?.message || 'Your responses could not be submitted. Please retry while this attempt is active.',
        technical: submitError?.message || (typeof submitError === 'object' ? JSON.stringify(submitError) : String(submitError))
      });
    }
  }, [attemptId, supabase, questions, responses, user, testId, navigate, returnTo]);

  useEffect(() => {
    if (!deadline || submitting) return undefined;
    const interval = window.setInterval(() => {
      const next = getRemaining(deadline);
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(interval);
        submit(true);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [deadline, submitting, submit]);

  const displayedQuestion = getQuestionText(question?.question_text, 'en') || question?.text || '';
  const questionId = String(question?.id || question?.question_id || currentIndex);
  const questionTranslations = translatedData[questionId] || {};
  const questionHindi = question?.question_text_hi || getStoredHindi(question?.question_text) || question?.text_hi || questionTranslations.question;
  const displayedQuestionText = language === 'hi' ? questionHindi || displayedQuestion : displayedQuestion;
  const optionEntries = useMemo(() => getOptionEntries(question?.options), [question]);
  const attemptedCount = Object.values(responses || {}).filter((response) => response?.selected_option).length;
  const markedCount = Object.values(responses || {}).filter((response) => response?.marked_for_review).length;
  const formatTime = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const answer = (option) => setResponses((current) => ({ ...current, [question.id]: { ...current[question.id], selected_option: current[question.id]?.selected_option === option ? null : option } }));
  const toggleReview = () => setResponses((current) => ({ ...current, [question.id]: { ...current[question.id], marked_for_review: !current[question.id]?.marked_for_review } }));
  const clearResponse = () => setResponses((current) => ({ ...current, [question.id]: { ...current[question.id], selected_option: null } }));
  const goTo = (index) => { setCurrentIndex(index); setPaletteOpen(false); };
  const confirm = () => {
    if (remaining === 0) submit(true);
    else setConfirmSubmit(true);
  };

  if (loading) return <main className="quiz-loading"><LoadingSkeleton rows={5} /></main>;
  if (error && !questions?.length) {
    const isObject = typeof error === 'object' && error !== null;
    const errorMessage = isObject ? error.message : error;
    const technicalError = isObject ? error.technical : '';

    return (
      <main className="quiz-error-page">
        <div className="quiz-error-card">
          <div className="locked-icon"><LockKeyhole size={23} /></div>
          <h1>{errorMessage === 'User session not found. Please log in first.' ? 'Authentication required' : 'We couldn’t open this test'}</h1>
          <p>{errorMessage}</p>
          {technicalError && (
            <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
              {technicalError}
            </p>
          )}
          <Link className="button button-outline" to={!user ? '/auth' : '/tests'}>
            <ArrowLeft size={15} /> {!user ? 'Log in' : 'Back to tests'}
          </Link>
        </div>
      </main>
    );
  }
  if (test && !questions?.length) return <main className="quiz-error-page"><div className="quiz-error-card"><div className="locked-icon"><ListChecks size={23} /></div><h1>Test not ready</h1><p>No questions available in this test yet.</p><Link className="button button-outline" to={test.chapter_id ? `/chapter/${test.chapter_id}` : '/tests'}><ArrowLeft size={15} /> Back to Chapter</Link></div></main>;
  if (!test || !question) return <main className="quiz-error-page"><div className="quiz-error-card"><div className="locked-icon"><LockKeyhole size={23} /></div><h1>Question unavailable</h1><p>We could not load this question. Please return to the test list and try again.</p><Link className="button button-outline" to="/tests"><ArrowLeft size={15} /> Back to tests</Link></div></main>;

  return <main className="live-quiz">
    {paletteOpen && <button className="drawer-scrim quiz-scrim" aria-label="Close question palette" onClick={() => setPaletteOpen(false)} />}
    <header className="quiz-header">
      <Link to="/tests" className="quiz-brand"><img src="/logo.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" /><span>ZYVRA<span>TEST MODE</span></span></Link>
      <div className="quiz-header-title"><strong>{test?.title}</strong><span>Question {currentIndex + 1} of {questions?.length || 0}</span></div>
      <div className="quiz-header-actions">
        <div className={`quiz-timer ${remaining < 300 ? 'timer-warning' : ''} px-2.5 py-1 text-xs font-mono font-semibold`} aria-live="polite"><Clock3 size={14} /><span className="text-xs font-mono font-semibold">{formatTime(remaining)}</span></div>
        <button className="button button-gold quiz-submit-button hidden md:inline-flex" disabled={submitting} onClick={confirm}>{submitting ? 'Submitting…' : 'Submit test'}</button>
        <button className="icon-button quiz-palette-toggle" onClick={() => setPaletteOpen(true)} aria-label="Open question palette"><Grid3X3 size={18} /></button>
        <div className="native-language-toggle" role="group" aria-label="Test language">
          <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          <button type="button" className={language === 'hi' ? 'active' : ''} aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>HI</button>
        </div>
      </div>
    </header>
    <div className="quiz-instructions">{test?.instructions || 'Choose the best answer. You can mark questions for review and return to them before submitting.'}<span>{attemptedCount}/{questions?.length || 0} answered</span></div>
    {timeExpired && <div className="feedback error-feedback quiz-feedback">Time is up. Your responses are being submitted.</div>}
    {error && <div className="feedback error-feedback quiz-feedback">{typeof error === 'object' ? error.message : error}</div>}
    <div className="quiz-body">
      <section className="quiz-question-panel">
        <div className="quiz-question-meta text-sm font-semibold"><span>QUESTION {String(currentIndex + 1).padStart(2, '0')}</span>{question?.subject && <span className="subject-pill text-xs font-semibold">{question.subject}</span>}{question?.topic && <span className="text-xs">{question.topic}</span>}</div>
        <h1 className="quiz-question-text text-lg sm:text-xl font-medium leading-relaxed" lang={language} aria-busy={translatingQuestionId === questionId}>{displayedQuestionText}{language === 'hi' && !questionHindi && translatingQuestionId === questionId && <LoaderCircle className="translation-inline-spinner" size={14} aria-label="Translating" />}</h1>
        <div className="quiz-options">{optionEntries.map(([key, value]) => {
          const text = getQuestionText(value, 'en') || getQuestionText(value?.text, 'en') || (typeof value === 'string' ? value : '');
          const optionHindi = getStoredHindi(value) || questionTranslations[`option:${key}`];
          const displayedOption = language === 'hi' ? optionHindi || text : text;
          const selected = responses[question.id]?.selected_option === key;
          return <button key={key} className={`quiz-option py-3.5 px-4 min-h-[56px] ${selected ? 'selected' : ''} ${key === 'E' ? 'option-e' : ''}`} onClick={() => answer(key)} aria-pressed={selected}><span className="quiz-option-letter w-8 h-8 min-w-[2rem] text-sm font-bold rounded-full">{key}</span><span className="quiz-option-text text-base sm:text-lg leading-relaxed"><span lang={language}>{displayedOption}{language === 'hi' && !optionHindi && translatingQuestionId === questionId && <LoaderCircle className="translation-inline-spinner" size={12} aria-label="Translating" />}</span></span><span className="quiz-option-check">{selected && <Check size={18} />}</span></button>;
        })}</div>
        <div className="quiz-question-actions"><button className={`review-toggle py-2 px-3 text-sm font-medium ${responses[question.id]?.marked_for_review ? 'marked' : ''}`} onClick={toggleReview}><Flag size={15} /> {responses[question.id]?.marked_for_review ? 'Marked for review' : 'Mark for review'}</button><button className="clear-response py-2 px-3 text-sm font-medium" onClick={clearResponse} disabled={!responses[question.id]?.selected_option}>Clear response</button></div>
        <div className="quiz-navigation">
          <button className="button button-outline min-h-[44px] px-4 text-sm font-medium" onClick={() => goTo(Math.max(0, currentIndex - 1))} disabled={!currentIndex}>
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-sm font-semibold">{currentIndex + 1} <small className="text-xs">/ {questions.length}</small></span>
          {currentIndex === questions.length - 1 ? (
            <button
              type="button"
              className="button button-gold min-h-[44px] px-5 text-sm font-bold shadow-md quiz-bottom-submit"
              disabled={submitting}
              onClick={confirm}
            >
              {submitting ? 'Submitting…' : 'Submit test'}
            </button>
          ) : (
            <button
              type="button"
              className="button button-gold min-h-[44px] px-4 text-sm font-medium"
              onClick={() => goTo(Math.min(questions.length - 1, currentIndex + 1))}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </section>
      <aside className={`quiz-palette ${paletteOpen ? 'palette-open' : ''}`}><div className="palette-heading"><div><div className="eyebrow">YOUR PROGRESS</div><h2>Question palette</h2></div><button className="icon-button palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close palette"><X size={18} /></button></div><div className="palette-legend"><span><i className="legend-attempted" /> Answered</span><span><i className="legend-unattempted" /> Unanswered</span><span><i className="legend-marked" /> Review</span><span><i className="legend-option-e" /> Option E</span></div><div className="palette-grid">{questions.map((item, index) => {
        const response = responses[item.id];
        const isOptionE = response?.selected_option === 'E';
        const state = response?.marked_for_review ? 'marked' : isOptionE ? 'option-e' : response?.selected_option ? 'attempted' : 'unattempted';
        return <button key={item.id} className={`palette-number ${state} ${isOptionE ? 'option-e-selected' : ''} ${currentIndex === index ? 'current' : ''}`} onClick={() => goTo(index)} aria-label={`Question ${index + 1}: ${state}${isOptionE ? ', Option E selected' : ''}`} title={`Question ${index + 1} — ${state}${isOptionE ? ', Option E selected' : ''}`}>{index + 1}</button>;
      })}</div><div className="palette-summary"><span><Check size={14} /> {attemptedCount} answered</span><span><Flag size={14} /> {markedCount} for review</span></div><div className="palette-footer"><span>{questions.length - attemptedCount} unanswered</span><button className="button button-gold" onClick={confirm}>Submit test</button></div></aside>
    </div>
    {confirmSubmit && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title"><button className="modal-close" onClick={() => setConfirmSubmit(false)} aria-label="Close"><X size={18} /></button><div className="locked-icon"><ListChecks size={22} /></div><h2 id="submit-confirm-title">Submit your test?</h2><p>You have answered {attemptedCount} of {questions.length} questions and marked {markedCount} for review. Unanswered questions will be submitted blank.</p>{error && <div className="feedback error-feedback">{typeof error === 'object' ? error.message : error}</div>}<div className="modal-actions"><button className="button button-outline" onClick={() => setConfirmSubmit(false)}>Continue test</button><button className="button button-gold" disabled={submitting} onClick={() => submit(false)}>{submitting ? 'Submitting…' : 'Submit test'}</button></div></section></div>}
    {submitting && <div className="quiz-submitting-overlay"><div className="quiz-submit-spinner" /><span>Submitting your responses securely…</span></div>}
  </main>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  FileText,
  Flag,
  Grid3X3,
  Info,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Target,
  X
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import MathRenderer from '../../components/common/MathRenderer';
import QuestionFormatter from '../../components/common/QuestionFormatter';
import {
  TEST_PATTERNS,
  extractLocalizedDistractorNote,
  extractLocalizedExplanation,
  getOptionEntries,
  getQuestionText,
  hasDevanagari,
  hasLatin,
  normalizeCorrectAnswer,
  normalizeRpcObject,
  sanitizeLiveQuestion,
  unwrapRpcPayload
} from '../../lib/tests';
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

function formatTime(seconds) {
  const safeSecs = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(safeSecs / 3600);
  const mins = Math.floor((safeSecs % 3600) / 60);
  const secs = safeSecs % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getPatternLabel(patternValue) {
  const found = TEST_PATTERNS.find((item) => item.value === patternValue);
  return found ? found.label : patternValue || 'Standard 4-Option';
}

function formatInline(str) {
  if (!str) return '';
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function FormattedInstructions({ text }) {
  if (!text || !text.trim()) {
    return (
      <div className="instructions-default-body">
        <h4 className="instructions-h4">General Instructions</h4>
        <ul className="instructions-list">
          <li>The countdown timer at the top indicates the remaining time available for completing the exam.</li>
          <li>The Question Palette displayed on the right shows the status of every question using distinct CBT colors.</li>
          <li>Click any question number in the palette to navigate to that question directly.</li>
          <li>Click an option to select your answer. You can change your selection or click <strong>Clear response</strong> anytime.</li>
          <li>Click <strong>Mark for review</strong> if you wish to flag a question and revisit it before final submission.</li>
          <li>You may pause your exam and resume later without losing your responses or remaining time.</li>
        </ul>
      </div>
    );
  }

  const lines = text.split('\n');
  const elements = [];
  let currentList = null;
  let listKey = 0;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`list-${listKey++}`} className="instructions-list">
            {currentList.items.map((item, idx) => (
              <li key={idx}>{formatInline(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${listKey++}`} className="instructions-list ordered">
            {currentList.items.map((item, idx) => (
              <li key={idx}>{formatInline(item)}</li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={index} className="instructions-h4">{formatInline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={index} className="instructions-h3">{formatInline(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={index} className="instructions-h2">{formatInline(line.slice(2))}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(line.slice(2));
    } else if (/^\d+\.\s*/.test(line)) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(line.replace(/^\d+\.\s*/, ''));
    } else {
      flushList();
      elements.push(<p key={index} className="instructions-p">{formatInline(line)}</p>);
    }
  });

  flushList();

  return <div className="instructions-parsed-body">{elements}</div>;
}

function PaletteLegend({ compact = false }) {
  return (
    <div className={`cbt-palette-legend ${compact ? 'compact' : ''}`}>
      <div className="legend-item">
        <span className="legend-badge answered">1</span>
        <div className="legend-text">
          <strong>Answered</strong>
          {!compact && <span>You have answered the question.</span>}
        </div>
      </div>
      <div className="legend-item">
        <span className="legend-badge not-answered">2</span>
        <div className="legend-text">
          <strong>Not Answered</strong>
          {!compact && <span>You have not answered the question.</span>}
        </div>
      </div>
      <div className="legend-item">
        <span className="legend-badge marked">3</span>
        <div className="legend-text">
          <strong>Marked for Review</strong>
          {!compact && <span>Marked for review without an answer.</span>}
        </div>
      </div>
      <div className="legend-item">
        <span className="legend-badge answered-marked">
          4<span className="eval-dot" />
        </span>
        <div className="legend-text">
          <strong>Answered & Marked</strong>
          {!compact && <span>Answered & marked for review (will be evaluated).</span>}
        </div>
      </div>
      <div className="legend-item">
        <span className="legend-badge not-visited">5</span>
        <div className="legend-text">
          <strong>Not Visited</strong>
          {!compact && <span>You have not visited the question yet.</span>}
        </div>
      </div>
    </div>
  );
}

export default function LiveQuiz() {
  const { testId } = useParams();
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [test, setTest] = useState(null);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState('');
  const [error, setError] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [startingTest, setStartingTest] = useState(false);
  const [testPhase, setTestPhase] = useState('loading'); // 'loading' | 'instructions' | 'resume_prompt' | 'active'
  const [pausedAttemptData, setPausedAttemptData] = useState(null);

  const submitLock = useRef(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [language, setLanguage] = useState('en');
  const [translatedData, setTranslatedData] = useState({});
  const [translatingQuestionId, setTranslatingQuestionId] = useState('');
  const inFlightTranslations = useRef(new Map());
  const [timeSpent, setTimeSpent] = useState({});

  // Per-question time tracking timer
  useEffect(() => {
    if (testPhase !== 'active' || pausing || confirmSubmit || showPauseModal) return;
    const interval = setInterval(() => {
      const qId = questions?.[currentIndex]?.id;
      if (qId) {
        setTimeSpent((prev) => ({
          ...prev,
          [qId]: (prev[qId] || 0) + 1
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [testPhase, pausing, confirmSubmit, showPauseModal, currentIndex, questions]);

  const question = questions?.[currentIndex] || null;

  const returnTo = location.state?.returnTo
    || sessionStorage.getItem('last_quiz_return_url')
    || (test?.chapter_id ? `/chapter/${test.chapter_id}` : '/tests');

  useEffect(() => {
    if (location.state?.returnTo) {
      sessionStorage.setItem('last_quiz_return_url', location.state.returnTo);
    } else if (test?.chapter_id && !sessionStorage.getItem('last_quiz_return_url')) {
      sessionStorage.setItem('last_quiz_return_url', `/chapter/${test.chapter_id}`);
    }
  }, [location.state?.returnTo, test?.chapter_id]);

  // Synchronous state ref for guaranteed persistence across sudden lifecycle events (unload, hide)
  const stateRef = useRef({
    attemptId: null,
    testId,
    userId: user?.id,
    currentIndex: 0,
    responses: {},
    visitedQuestions: new Set(),
    remaining: 0,
    language: 'en',
    testPhase: 'loading'
  });

  useEffect(() => {
    stateRef.current = {
      attemptId,
      testId,
      userId: user?.id,
      currentIndex,
      responses,
      visitedQuestions,
      remaining,
      language,
      testPhase
    };
  }, [attemptId, testId, user?.id, currentIndex, responses, visitedQuestions, remaining, language, testPhase]);

  // Dual Persistence: Instant LocalStorage Snapshot + Supabase Cloud Upsert
  const saveProgressSnapshot = useCallback((overrides = {}, syncCloud = true) => {
    const cur = stateRef.current;
    const uid = cur.userId;
    const tId = cur.testId;
    const activeAttId = overrides.attemptId ?? cur.attemptId;
    if (!uid || !tId) return null;

    const resp = overrides.responses ?? cur.responses;
    const currIdx = overrides.currentIndex ?? cur.currentIndex;
    const remSecs = overrides.remaining ?? cur.remaining;
    const lang = overrides.language ?? cur.language;
    const visitedArr = overrides.visited
      ? Array.from(overrides.visited)
      : Array.from(cur.visitedQuestions);
    const markedArr = Object.keys(resp).filter((k) => Boolean(resp[k]?.marked_for_review));

    const answersMap = {};
    Object.entries(resp).forEach(([k, v]) => {
      if (v?.selected_option !== undefined && v?.selected_option !== null) {
        answersMap[k] = v.selected_option;
      }
    });

    const snapshot = {
      attemptId: activeAttId,
      testId: tId,
      userId: uid,
      status: overrides.status || 'paused',
      currentIndex: currIdx,
      answers: answersMap,
      responses: resp,
      markedForReview: markedArr,
      visited: visitedArr,
      remainingSeconds: remSecs,
      timeSpent: overrides.timeSpent ?? timeSpent,
      language: lang,
      updatedAt: new Date().toISOString()
    };

    // 1. Instant synchronous dual localStorage persistence
    try {
      localStorage.setItem(`zyvra_test_progress_${uid}_${tId}`, JSON.stringify(snapshot));
      localStorage.setItem(`zyvra-paused-attempt-${uid}-${tId}`, JSON.stringify(snapshot));
      if (activeAttId) {
        localStorage.setItem(`zyvra-active-state-${activeAttId}`, JSON.stringify(snapshot));
      }
    } catch (storageErr) {
      console.warn('LocalStorage save failed:', storageErr);
    }

    // 2. Supabase Cloud Sync
    if (syncCloud && supabase && activeAttId) {
      const cloudPayload = {
        status: overrides.status || 'paused',
        remaining_seconds: remSecs,
        current_question_index: currIdx,
        state_json: snapshot,
        updated_at: new Date().toISOString()
      };
      if (overrides.status === 'paused') {
        cloudPayload.paused_at = new Date().toISOString();
      }
      supabase
        .from('test_attempts')
        .update(cloudPayload)
        .eq('id', activeAttId)
        .then(({ error: syncErr }) => {
          if (syncErr) {
            console.warn('Database attempt update error:', syncErr?.message || syncErr);
          }
        })
        .catch((e) => console.warn('Cloud sync error:', e));
    }

    return snapshot;
  }, [supabase]);

  // Track visited questions automatically
  useEffect(() => {
    if (testPhase !== 'active' || !questions?.[currentIndex]?.id) return;
    const currentQId = questions[currentIndex].id;
    setVisitedQuestions((prev) => {
      if (prev.has(currentQId)) return prev;
      const next = new Set(prev);
      next.add(currentQId);
      return next;
    });
  }, [currentIndex, testPhase, questions]);

  // Initial load: test details, incomplete attempt probe
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

      // 1. Fetch test metadata
      const { data: testData, error: testError } = await supabase
        .from('tests')
        .select('id,title,chapter_id,instructions,pattern,duration_minutes,attempt_limit,positive_marks,negative_marks,mandatory_option_e_penalty,coin_reward_enabled,solution_mode,status')
        .eq('id', testId)
        .maybeSingle();

      if (testError) throw testError;
      if (!testData || !['published', 'live', 'available'].includes(String(testData.status).toLowerCase())) {
        setError({
          message: 'This test is not currently available.',
          technical: ''
        });
        setLoading(false);
        return;
      }

      // 2. Fetch question count
      const { count: qCount } = await supabase
        .from('test_questions')
        .select('id', { count: 'exact', head: true })
        .eq('test_id', testId);

      const totalCount = qCount || 0;
      if (active) {
        setTest(testData);
        setTotalQuestionCount(totalCount);
      }

      // 3. Check for existing incomplete or paused attempt
      const { data: existingAttempts } = await supabase
        .from('test_attempts')
        .select('id, test_id, user_id, status, started_at, completed_at, remaining_seconds, current_question_index, state_json, paused_at, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('test_id', testId)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const dbIncomplete = existingAttempts?.[0] || null;

      // Check localStorage snapshot
      let localSnapshot = null;
      try {
        const rawLocal = localStorage.getItem(`zyvra_test_progress_${user.id}_${testId}`)
          || localStorage.getItem(`zyvra-paused-attempt-${user.id}-${testId}`);
        if (rawLocal) localSnapshot = JSON.parse(rawLocal);
      } catch (_) {}

      const hasResumeAttempt = (dbIncomplete && dbIncomplete.status !== 'completed' && dbIncomplete.status !== 'submitted') || localSnapshot;

      if (hasResumeAttempt) {
        // Paused or in-progress attempt found: pre-load questions and prompt resume
        const activeAttemptId = dbIncomplete?.id || localSnapshot?.attemptId;
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
          setAttemptId(activeAttemptId);
          setQuestions(safeQuestions);

          // Restore state cleanly from DB and LocalStorage
          const stateJson = dbIncomplete?.state_json || {};
          const rawResponses = localSnapshot?.responses || stateJson.responses || {};
          const rawAnswers = localSnapshot?.answers || stateJson.answers || {};
          const rawMarked = localSnapshot?.markedForReview || stateJson.markedForReview || [];
          const markedSet = new Set(Array.isArray(rawMarked) ? rawMarked : Object.keys(rawMarked).filter((k) => rawMarked[k]));

          const restoredResponses = { ...rawResponses };
          Object.entries(rawAnswers).forEach(([qId, opt]) => {
            restoredResponses[qId] = {
              ...(restoredResponses[qId] || {}),
              selected_option: typeof opt === 'object' ? opt?.selected_option : opt
            };
          });
          markedSet.forEach((qId) => {
            restoredResponses[qId] = {
              ...(restoredResponses[qId] || {}),
              marked_for_review: true
            };
          });

          const restoredIndex = localSnapshot?.currentIndex
            ?? dbIncomplete?.current_question_index
            ?? stateJson.currentIndex
            ?? 0;

          const restoredVisited = new Set(
            localSnapshot?.visited
            || localSnapshot?.visitedQuestions
            || stateJson.visited
            || stateJson.visitedQuestions
            || (safeQuestions[0]?.id ? [safeQuestions[0].id] : [])
          );

          const restoredRemaining = localSnapshot?.remainingSeconds
            ?? dbIncomplete?.remaining_seconds
            ?? stateJson.remainingSeconds
            ?? (Number(testData.duration_minutes || 60) * 60);

          const restoredLang = localSnapshot?.language || stateJson.language;
          if (restoredLang) setLanguage(restoredLang);

          setResponses(restoredResponses);
          setCurrentIndex(Math.min(restoredIndex, Math.max(0, safeQuestions.length - 1)));
          setVisitedQuestions(restoredVisited);
          setRemaining(restoredRemaining);

          setPausedAttemptData({
            ...(dbIncomplete || {}),
            attemptId: activeAttemptId,
            answeredCount: Object.values(restoredResponses).filter((r) => r?.selected_option).length,
            remainingSeconds: restoredRemaining,
            totalQuestions: safeQuestions.length,
            lastSavedAt: dbIncomplete?.paused_at || dbIncomplete?.updated_at || localSnapshot?.updatedAt || new Date().toISOString()
          });

          // If navigated with autoResume (e.g. from ChapterDetail Resume button), start immediately
          if (location.state?.autoResume) {
            const endAt = Date.now() + Math.max(10, restoredRemaining) * 1000;
            setDeadline(endAt);
            setTestPhase('active');
          } else {
            setTestPhase('resume_prompt');
          }
          setLoading(false);
        }
      } else {
        // Fresh test attempt: show pre-test instructions screen before timer starts
        if (active) {
          setTestPhase('instructions');
          setLoading(false);
        }
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

    return () => {
      active = false;
    };
  }, [testId, user, supabase]);

  // Start fresh test attempt after declaration
  const handleStartTest = async () => {
    if (startingTest || !user || !supabase || !test) return;
    setStartingTest(true);
    setError(null);

    try {
      const attemptData = await startAttemptOnce(supabase, testId, user.id);
      const activeAttemptId = getAttemptId(attemptData);
      const attemptResponse = normalizeRpcObject(attemptData);
      const attempt = attemptResponse.attempt || attemptResponse;

      if (!activeAttemptId) {
        throw new Error('The server did not return an attempt ID. No quiz was started.');
      }

      const { data: questionData, error: questionError } = await supabase.rpc('get_live_test_questions', {
        p_test_id: testId,
        p_attempt_id: activeAttemptId
      });

      if (questionError) throw questionError;

      const payload = unwrapRpcPayload(questionData);
      const questionRows = Array.isArray(payload) ? payload : payload?.questions;
      const safeRows = Array.isArray(questionRows) ? questionRows : [];
      const safeQuestions = safeRows.map(sanitizeLiveQuestion);

      setAttemptId(activeAttemptId);
      setQuestions(safeQuestions);
      setResponses({});
      setCurrentIndex(0);
      if (safeQuestions.length > 0) {
        setVisitedQuestions(new Set([safeQuestions[0].id]));
      }

      const durationMinutes = Number(test.duration_minutes || 60);
      const totalSecs = durationMinutes * 60;
      const endAt = Date.now() + totalSecs * 1000;
      setDeadline(endAt);
      setRemaining(totalSecs);

      // Save session marker
      sessionStorage.setItem(
        `zyvra-active-attempt-${user.id}-${testId}`,
        JSON.stringify({ id: activeAttemptId, started_at: attempt.started_at || new Date().toISOString() })
      );
      saveProgressSnapshot({
        attemptId: activeAttemptId,
        responses: {},
        currentIndex: 0,
        remaining: totalSecs,
        status: 'in_progress'
      }, true);

      setTestPhase('active');
    } catch (startErr) {
      console.error('Failed to start test attempt:', startErr);
      setError({
        message: 'Could not start examination. ' + (startErr.message || 'Please try again.'),
        technical: startErr.message || String(startErr)
      });
    } finally {
      setStartingTest(false);
    }
  };

  // Resume paused test
  const handleResumeTest = () => {
    if (!remaining || !questions.length) return;
    setError(null);
    const endAt = Date.now() + Math.max(10, remaining) * 1000;
    setDeadline(endAt);
    setTestPhase('active');
  };

  // Pause test & save state
  const pauseAndExit = async () => {
    if (pausing || !attemptId || !supabase) return;
    setPausing(true);
    setPauseError('');

    try {
      const snapshot = saveProgressSnapshot({ status: 'paused' }, true);
      sessionStorage.removeItem(`zyvra-active-attempt-${user?.id}-${testId}`);

      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          status: 'paused',
          remaining_seconds: remaining,
          current_question_index: currentIndex,
          state_json: snapshot,
          paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', attemptId);

      if (updateError) {
        console.warn('Database update error on pause (proceeding with local save):', updateError);
      }

      navigate(returnTo, {
        replace: true,
        state: { notice: 'Test paused. Your responses and remaining time have been saved.' }
      });
    } catch (err) {
      console.error('Error pausing attempt:', err);
      setPauseError('Could not sync progress to cloud. Your progress is saved locally. You may still exit.');
      setPausing(false);
    }
  };

  // Periodic 10s background sync to Supabase
  useEffect(() => {
    if (!attemptId || !supabase || testPhase !== 'active' || submitting || pausing) return undefined;

    const interval = window.setInterval(() => {
      saveProgressSnapshot({ status: 'in_progress' }, true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [attemptId, supabase, testPhase, submitting, pausing, saveProgressSnapshot]);

  // Intercept browser back button, tab hide, and page unload
  useEffect(() => {
    if (testPhase !== 'active') return undefined;

    const handleBeforeUnload = (event) => {
      saveProgressSnapshot({ status: 'paused' }, true);
      event.preventDefault();
      event.returnValue = 'You have an active test. Your progress is saved, but are you sure you want to leave?';
      return event.returnValue;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveProgressSnapshot({ status: 'paused' }, true);
      }
    };

    const handlePageHide = () => {
      saveProgressSnapshot({ status: 'paused' }, true);
    };

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setShowPauseModal(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [testPhase, saveProgressSnapshot]);

  // Hindi translation on question change
  useEffect(() => {
    if (language !== 'hi' || !question) return undefined;

    const questionId = String(question.id || question.question_id || currentIndex);
    const entries = [];
    const questionEnglish = (question.question_en && (hasLatin(question.question_en) || !hasDevanagari(question.question_en)) ? question.question_en : '')
      || (question.question_text_en && (hasLatin(question.question_text_en) || !hasDevanagari(question.question_text_en)) ? question.question_text_en : '')
      || getQuestionText(question.question_text, 'en')
      || (typeof question.text === 'string' && !hasDevanagari(question.text) ? question.text : '')
      || '';
    const questionHindi = (typeof question.question_text_hi === 'string' && question.question_text_hi.trim() ? question.question_text_hi : '')
      || (typeof question.question_hi === 'string' && question.question_hi.trim() ? question.question_hi : '')
      || getStoredHindi(question.question_text)
      || (typeof question.text_hi === 'string' && question.text_hi.trim() ? question.text_hi : '')
      || (typeof question.question_text === 'string' && hasDevanagari(question.question_text) ? question.question_text : '')
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
      setTranslatingQuestionId((current) => (current === questionId ? '' : current));
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

    Promise.all(translations)
      .then((values) => {
        setTranslatedData((current) => ({
          ...current,
          [questionId]: { ...current[questionId], ...Object.fromEntries(values) }
        }));
      })
      .finally(() => {
        setTranslatingQuestionId((current) => (current === questionId ? '' : current));
      });

    return undefined;
  }, [language, question, currentIndex, translatedData]);

  // Local storage auto-save on state change
  useEffect(() => {
    if (!attemptId) return;
    try {
      sessionStorage.setItem(`zyvra-responses-${attemptId}`, JSON.stringify(responses));
      localStorage.setItem(
        `zyvra-active-state-${attemptId}`,
        JSON.stringify({
          responses,
          visitedQuestions: Array.from(visitedQuestions),
          currentIndex,
          remaining,
          updatedAt: Date.now()
        })
      );
    } catch (storageError) {
      console.error('Unable to save in-progress responses locally:', storageError);
    }
  }, [attemptId, responses, visitedQuestions, currentIndex, remaining]);

  // Submit test
  const submit = useCallback(async (expired = false) => {
    if (submitLock.current || !attemptId || !supabase) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    setConfirmSubmit(false);
    setShowPauseModal(false);
    if (expired) setTimeExpired(true);

    const p_responses = questions.map((q) => ({
      question_id: q.id,
      selected_option: responses[q.id]?.selected_option || null,
      marked_for_review: Boolean(responses[q.id]?.marked_for_review),
      time_spent_seconds: timeSpent[q.id] || 0
    }));

    try {
      localStorage.setItem(`zyvra_attempt_timespent_${attemptId}`, JSON.stringify(timeSpent));
      const { error: submitError } = await supabase.rpc('submit_test_attempt', {
        p_attempt_id: attemptId,
        p_responses
      });

      if (submitError) throw submitError;

      if (user) {
        sessionStorage.removeItem(`zyvra-active-attempt-${user.id}-${testId}`);
        localStorage.removeItem(`zyvra-paused-attempt-${user.id}-${testId}`);
        localStorage.removeItem(`zyvra_test_progress_${user.id}_${testId}`);
      }
      sessionStorage.removeItem(`zyvra-responses-${attemptId}`);
      localStorage.removeItem(`zyvra-active-state-${attemptId}`);

      try {
        await supabase
          .from('test_attempts')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', attemptId);
      } catch (markErr) {
        console.warn('Completed status update note:', markErr);
      }

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

  // Countdown timer effect
  useEffect(() => {
    if (testPhase !== 'active' || !deadline || submitting || pausing) return undefined;

    const interval = window.setInterval(() => {
      const next = getRemaining(deadline);
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(interval);
        submit(true);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [testPhase, deadline, submitting, pausing, submit]);

  const questionId = String(question?.id || question?.question_id || currentIndex);
  const questionTranslations = translatedData[questionId] || {};

  // Strict English question resolution
  const qEnCandidate = getQuestionText(question?.question_text, 'en')
    || (question?.question_en && (hasLatin(question.question_en) || !hasDevanagari(question.question_en)) ? question.question_en : '')
    || (question?.question_text_en && (hasLatin(question.question_text_en) || !hasDevanagari(question.question_text_en)) ? question.question_text_en : '')
    || (typeof question?.text === 'string' && !hasDevanagari(question.text) ? question.text : '')
    || (typeof question?.question_text === 'string' && !hasDevanagari(question.question_text) ? question.question_text : '');

  const questionEnglish = qEnCandidate || (typeof question?.question_en === 'string' ? question.question_en : '') || question?.text || '';

  // Strict Hindi question resolution
  const qHiCandidate = (typeof question?.question_text_hi === 'string' && question.question_text_hi.trim() ? question.question_text_hi : '')
    || (typeof question?.question_hi === 'string' && question.question_hi.trim() ? question.question_hi : '')
    || getStoredHindi(question?.question_text)
    || (typeof question?.text_hi === 'string' && question.text_hi.trim() ? question.text_hi : '')
    || (typeof question?.question_text === 'string' && hasDevanagari(question.question_text) ? question.question_text : '')
    || questionTranslations.question
    || '';

  const questionHindi = qHiCandidate || '';

  // When language === 'en', strictly pick English text
  // When language === 'hi', pick Hindi (or translation or fallback to English)
  const displayedQuestionText = language === 'hi'
    ? (questionHindi || questionEnglish)
    : (questionEnglish || questionHindi);

  const optionEntries = useMemo(() => {
    let raw = question?.options;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (_) {}
    }
    if (raw != null) {
      const parsed = getOptionEntries(raw);
      if (parsed.length > 0) return parsed;
    }
    return ['A', 'B', 'C', 'D', 'E']
      .filter((k) => {
        const lower = k.toLowerCase();
        return (
          question?.[`option_${lower}`] !== undefined ||
          question?.[`option_${lower}_en`] !== undefined ||
          question?.[`option_${lower}_hi`] !== undefined
        );
      })
      .map((k) => {
        const lower = k.toLowerCase();
        return [
          k,
          {
            en: question?.[`option_${lower}_en`] || question?.[`option_${lower}`] || '',
            hi: question?.[`option_${lower}_hi`] || question?.[`option_${lower}`] || ''
          }
        ];
      });
  }, [question]);

  const attemptedCount = Object.values(responses || {}).filter((response) => response?.selected_option).length;
  const markedCount = Object.values(responses || {}).filter((response) => response?.marked_for_review).length;

  const answer = (option) => {
    const nextVal = responses[question.id]?.selected_option === option ? null : option;
    const nextResponses = {
      ...responses,
      [question.id]: {
        ...responses[question.id],
        selected_option: nextVal
      }
    };
    setResponses(nextResponses);
    saveProgressSnapshot({ responses: nextResponses }, true);

    // If immediate solution mode and question is missing correct_answer, fetch on-demand securely
    if (test?.solution_mode === 'immediate' && !question?.correct_answer && nextVal && supabase) {
      const targetId = question.question_id || question.id;
      supabase
        .rpc('get_single_question_feedback', {
          p_test_id: testId,
          p_question_id: targetId,
          p_selected_option: nextVal
        })
        .then(({ data: rpcData, error: rpcError }) => {
          if (!rpcError && rpcData?.allowed) {
            const ans = normalizeCorrectAnswer(rpcData.correct_answer, question.options);
            if (ans) {
              question.correct_answer = ans;
              question.correct_option = ans;
              question.answer = ans;
              if (rpcData.explanation) question.explanation = rpcData.explanation;
              if (rpcData.explanation_hi) question.explanation_hi = rpcData.explanation_hi;
              if (rpcData.distractor_notes) question.distractor_notes = rpcData.distractor_notes;
              if (rpcData.distractor_notes_hi) question.distractor_notes_hi = rpcData.distractor_notes_hi;
              setQuestions((prev) => [...prev]);
            }
          } else {
            // Fallback to direct query if RPC is not yet migrated
            supabase
              .from('questions')
              .select('id, correct_answer, explanation, explanation_hi, distractor_notes, distractor_notes_hi')
              .eq('id', targetId)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  const ans = normalizeCorrectAnswer(data.correct_answer, question.options);
                  if (ans) {
                    question.correct_answer = ans;
                    question.correct_option = ans;
                    question.answer = ans;
                    if (data.explanation) question.explanation = data.explanation;
                    if (data.explanation_hi) question.explanation_hi = data.explanation_hi;
                    if (data.distractor_notes) question.distractor_notes = data.distractor_notes;
                    if (data.distractor_notes_hi) question.distractor_notes_hi = data.distractor_notes_hi;
                    setQuestions((prev) => [...prev]);
                  }
                }
              })
              .catch((err) => console.warn('[LiveQuiz:answer] Fallback answer fetch error:', err));
          }
        })
        .catch((err) => console.warn('[LiveQuiz:answer] On-demand answer fetch error:', err));
    }
  };

  const toggleReview = () => {
    const nextResponses = {
      ...responses,
      [question.id]: {
        ...responses[question.id],
        marked_for_review: !responses[question.id]?.marked_for_review
      }
    };
    setResponses(nextResponses);
    saveProgressSnapshot({ responses: nextResponses }, true);
  };

  const clearResponse = () => {
    const nextResponses = {
      ...responses,
      [question.id]: { ...responses[question.id], selected_option: null }
    };
    setResponses(nextResponses);
    saveProgressSnapshot({ responses: nextResponses }, true);
  };

  const goTo = (index) => {
    setCurrentIndex(index);
    setPaletteOpen(false);
    saveProgressSnapshot({ currentIndex: index }, true);
  };

  const confirm = () => {
    if (remaining === 0) submit(true);
    else setConfirmSubmit(true);
  };

  // Loading Screen
  if (loading) {
    return (
      <main className="quiz-loading">
        <LoadingSkeleton rows={5} />
      </main>
    );
  }

  // Error Screen
  if (error && !test) {
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

  // PHASE 1: PRE-TEST INSTRUCTIONS SCREEN (Before Timer Starts)
  if (testPhase === 'instructions') {
    return (
      <main className="quiz-instructions-screen">
        <header className="instructions-header">
          <Link to={returnTo} className="quiz-brand">
            <img src="/logo.png" alt="Zyvra" className="w-8 h-8 rounded-xl object-contain shadow-sm" />
            <span>ZYVRA<span>EXAM INSTRUCTIONS</span></span>
          </Link>
          <Link to={returnTo} className="button button-outline text-xs min-h-[36px]">
            <ArrowLeft size={14} /> Exit to Tests
          </Link>
        </header>

        <div className="instructions-container">
          <div className="instructions-hero">
            <div className="instructions-hero-title">
              <div className="eyebrow">COMPUTER BASED TEST (CBT)</div>
              <h1>{test?.title}</h1>
              <div className="flex flex-wrap gap-2 items-center mt-1">
                <span className="pattern-pill text-xs">{getPatternLabel(test?.pattern)}</span>
                {test?.chapter_id && <span className="subject-pill text-xs">Chapter Test</span>}
              </div>
            </div>

            <div className="instructions-stat-grid">
              <div className="instruction-stat-card">
                <Clock3 className="stat-icon text-gold" size={20} />
                <div>
                  <strong>{test?.duration_minutes || 60} Mins</strong>
                  <span>Total Duration</span>
                </div>
              </div>
              <div className="instruction-stat-card">
                <Target className="stat-icon text-accent" size={20} />
                <div>
                  <strong>{totalQuestionCount || questions?.length || 0} Questions</strong>
                  <span>Total Questions</span>
                </div>
              </div>
              <div className="instruction-stat-card">
                <Award className="stat-icon text-gold" size={20} />
                <div>
                  <strong>{((totalQuestionCount || questions?.length || 0) * (test?.positive_marks || 1)).toFixed(0)} Marks</strong>
                  <span>Maximum Score</span>
                </div>
              </div>
              <div className="instruction-stat-card">
                <ListChecks className="stat-icon text-text" size={20} />
                <div>
                  <strong>+{test?.positive_marks ?? 1} / -{test?.negative_marks ?? 0}</strong>
                  <span>Marking Scheme</span>
                </div>
              </div>
            </div>
          </div>

          {test?.mandatory_option_e_penalty && (
            <div className="bpsc-notice-banner">
              <AlertTriangle size={18} className="text-gold flex-shrink-0" />
              <div>
                <strong>BPSC Mandatory Option E Rule Active:</strong>
                <span> Leaving both an answer and Option E unselected carries a negative penalty of -{test.negative_marks} marks. If unsure, select Option E to avoid penalty.</span>
              </div>
            </div>
          )}

          <div className="instructions-main-panel">
            <section className="instructions-content-section">
              <h2 className="instructions-section-title">
                <Info size={18} className="text-gold" /> Please Read The Instructions Carefully
              </h2>
              <div className="instructions-scrollable">
                <FormattedInstructions text={test?.instructions} />
              </div>
            </section>

            <section className="instructions-legend-section">
              <h3 className="instructions-section-title">
                <Grid3X3 size={18} className="text-gold" /> Question Palette Symbol Guide
              </h3>
              <PaletteLegend compact={false} />
            </section>
          </div>

          <div className="instructions-declaration-card">
            <div className="declaration-language-select">
              <span className="font-semibold text-sm">Default Test Language:</span>
              <div className="native-language-toggle">
                <button
                  type="button"
                  className={language === 'en' ? 'active' : ''}
                  onClick={() => setLanguage('en')}
                >
                  English (EN)
                </button>
                <button
                  type="button"
                  className={language === 'hi' ? 'active' : ''}
                  onClick={() => setLanguage('hi')}
                >
                  Hindi (हिंदी)
                </button>
              </div>
            </div>

            <label className="declaration-checkbox-label">
              <input
                type="checkbox"
                checked={declared}
                onChange={(e) => setDeclared(e.target.checked)}
              />
              <span>
                I have read and understood all the instructions above. All computer hardware allotted to me is in proper working condition. I declare that I will strictly follow all rules and regulations of this examination.
              </span>
            </label>

            {error && (
              <div className="feedback error-feedback mt-3">
                {typeof error === 'object' ? error.message : error}
              </div>
            )}

            <div className="declaration-footer">
              <Link to={returnTo} className="button button-outline">
                Cancel & Exit
              </Link>
              <button
                type="button"
                className="button button-gold start-test-btn"
                disabled={!declared || startingTest}
                onClick={handleStartTest}
              >
                {startingTest ? (
                  <>
                    <LoaderCircle className="animate-spin" size={16} /> Preparing Test…
                  </>
                ) : (
                  <>
                    <Play size={16} /> I Am Ready To Begin (Start Test)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // PHASE 2: RESUME PROMPT SCREEN (Incomplete Attempt Detected)
  if (testPhase === 'resume_prompt') {
    return (
      <main className="quiz-instructions-screen resume-prompt-screen">
        <header className="instructions-header">
          <Link to={returnTo} className="quiz-brand">
            <img src="/logo.png" alt="Zyvra" className="w-8 h-8 rounded-xl object-contain shadow-sm" />
            <span>ZYVRA<span>RESUME TEST</span></span>
          </Link>
          <Link to={returnTo} className="button button-outline text-xs min-h-[36px]">
            <ArrowLeft size={14} /> Exit to Tests
          </Link>
        </header>

        <div className="instructions-container resume-container">
          <div className="resume-hero-card">
            <div className="resume-icon-badge">
              <Clock3 size={32} className="text-gold" />
            </div>
            <h2>Incomplete Test Attempt Detected</h2>
            <p>
              You have a previously paused attempt for <strong>{test?.title}</strong>. Your responses, question progress, and remaining time are preserved.
            </p>

            <div className="resume-stats-grid">
              <div className="resume-stat">
                <span className="stat-label">Time Remaining</span>
                <strong className="stat-value text-gold">{formatTime(remaining)}</strong>
              </div>
              <div className="resume-stat">
                <span className="stat-label">Answered</span>
                <strong className="stat-value text-green">{attemptedCount} of {questions.length}</strong>
              </div>
              <div className="resume-stat">
                <span className="stat-label">Marked for Review</span>
                <strong className="stat-value text-purple">{markedCount}</strong>
              </div>
              <div className="resume-stat">
                <span className="stat-label">Resume From</span>
                <strong className="stat-value">Question {currentIndex + 1}</strong>
              </div>
            </div>

            <div className="resume-actions">
              <button
                type="button"
                className="button button-gold resume-btn-large"
                onClick={handleResumeTest}
              >
                <Play size={18} /> Resume Test Now
              </button>

              <div className="resume-secondary-actions">
                <button
                  type="button"
                  className="button button-outline text-xs"
                  onClick={() => setShowInstructionsModal(true)}
                >
                  <Info size={14} /> View Instructions
                </button>
                <button
                  type="button"
                  className="button button-danger text-xs"
                  onClick={() => setConfirmSubmit(true)}
                >
                  Submit Current Attempt
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Instructions */}
        {showInstructionsModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="instructions-modal-title">
            <section className="instructions-modal">
              <div className="instructions-modal-header">
                <div className="flex items-center gap-2">
                  <Info className="text-gold" size={20} />
                  <h2 id="instructions-modal-title" className="text-base font-bold">Exam Instructions</h2>
                </div>
                <button className="modal-close" onClick={() => setShowInstructionsModal(false)} aria-label="Close instructions">
                  <X size={18} />
                </button>
              </div>
              <div className="instructions-modal-body">
                <FormattedInstructions text={test?.instructions} />
                <h3 className="text-sm font-bold mt-4 mb-2 text-text">Question Palette Legend</h3>
                <PaletteLegend compact={false} />
              </div>
              <div className="instructions-modal-footer">
                <button type="button" className="button button-gold" onClick={() => setShowInstructionsModal(false)}>
                  Close
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Modal: Confirm Submit */}
        {confirmSubmit && (
          <div className="modal-backdrop">
            <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title">
              <button className="modal-close" onClick={() => setConfirmSubmit(false)} aria-label="Close">
                <X size={18} />
              </button>
              <div className="locked-icon"><ListChecks size={22} /></div>
              <h2 id="submit-confirm-title">Submit your test?</h2>
              <p>You have answered {attemptedCount} of {questions.length} questions and marked {markedCount} for review. Unanswered questions will be submitted blank.</p>
              {error && <div className="feedback error-feedback">{typeof error === 'object' ? error.message : error}</div>}
              <div className="modal-actions">
                <button className="button button-outline" onClick={() => setConfirmSubmit(false)}>Cancel</button>
                <button className="button button-gold" disabled={submitting} onClick={() => submit(false)}>
                  {submitting ? 'Submitting…' : 'Confirm Submission'}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  }

  // Not ready fallback
  if (test && !questions?.length) {
    return (
      <main className="quiz-error-page">
        <div className="quiz-error-card">
          <div className="locked-icon"><ListChecks size={23} /></div>
          <h1>Test not ready</h1>
          <p>No questions available in this test yet.</p>
          <Link className="button button-outline" to={test.chapter_id ? `/chapter/${test.chapter_id}` : '/tests'}>
            <ArrowLeft size={15} /> Back to Chapter
          </Link>
        </div>
      </main>
    );
  }

  if (!test || !question) {
    return (
      <main className="quiz-error-page">
        <div className="quiz-error-card">
          <div className="locked-icon"><LockKeyhole size={23} /></div>
          <h1>Question unavailable</h1>
          <p>We could not load this question. Please return to the test list and try again.</p>
          <Link className="button button-outline" to="/tests">
            <ArrowLeft size={15} /> Back to tests
          </Link>
        </div>
      </main>
    );
  }

  // PHASE 3: ACTIVE CBT RUNNER
  return (
    <main className="live-quiz">
      {paletteOpen && (
        <button
          className="drawer-scrim quiz-scrim"
          aria-label="Close question palette"
          onClick={() => setPaletteOpen(false)}
        />
      )}

      {/* CBT 2-Row Header */}
      <header className="quiz-header cbt-two-row-header">
        {/* ROW 1: Compact Brand + Truncated Title on Left | Compact Action Buttons on Right */}
        <div className="quiz-header-top-row">
          <div className="quiz-header-brand-wrap">
            <Link to={returnTo || "/tests"} className="quiz-brand-compact" title="Exit to tests">
              <img src="/logo.png" alt="Zyvra" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain shadow-xs flex-shrink-0" />
            </Link>
            <div className="quiz-title-truncated">
              <strong title={test?.title}>{test?.title || 'Test Mode'}</strong>
            </div>
          </div>

          <div className="quiz-header-actions-compact">
            {/* Info Button: View Instructions */}
            <button
              type="button"
              className="icon-button quiz-info-button"
              onClick={() => setShowInstructionsModal(true)}
              title="View Exam Instructions"
              aria-label="View exam instructions"
            >
              <Info size={16} />
            </button>

            {/* Pause / Exit Button */}
            <button
              type="button"
              className="icon-button quiz-pause-icon-button"
              onClick={() => setShowPauseModal(true)}
              title="Pause and resume later"
              aria-label="Pause test"
            >
              <Pause size={15} />
            </button>

            {/* Language Switcher */}
            <div className="native-language-toggle compact-lang-toggle" role="group" aria-label="Test language">
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

            {/* Submit Test Button (Desktop Header) */}
            <button
              type="button"
              className="button button-gold quiz-submit-button hidden md:inline-flex"
              disabled={submitting}
              onClick={confirm}
            >
              {submitting ? 'Submitting…' : 'Submit test'}
            </button>

            {/* Palette Toggle (Mobile) */}
            <button
              type="button"
              className="icon-button quiz-palette-toggle"
              onClick={() => setPaletteOpen(true)}
              title="Open question palette"
              aria-label="Open question palette"
            >
              <Grid3X3 size={17} />
            </button>
          </div>
        </div>

        {/* ROW 2: Question Counter on Left | Countdown Timer on Right */}
        <div className="quiz-header-sub-bar">
          <div className="quiz-question-counter">
            <span className="counter-label">Question</span>
            <strong className="counter-current">{currentIndex + 1}</strong>
            <span className="counter-divider">of</span>
            <span className="counter-total">{questions?.length || 0}</span>
          </div>

          <div className="quiz-header-sub-right">
            <div
              className={`quiz-timer-pill ${remaining < 300 ? 'timer-warning' : ''}`}
              aria-live="polite"
            >
              <Clock3 size={13} className="timer-icon" />
              <span className="timer-digits">{formatTime(remaining)}</span>
            </div>
          </div>
        </div>

        {/* Thin Progress Bar underneath Row 2 */}
        <div className="quiz-header-progress-track">
          <div
            className="quiz-header-progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, ((currentIndex + 1) / Math.max(1, questions?.length || 1)) * 100))}%`
            }}
          />
        </div>
      </header>

      {/* Note: The inline raw markdown instructions block above Question 1 has been permanently removed */}

      {timeExpired && (
        <div className="feedback error-feedback quiz-feedback">Time is up. Your responses are being submitted.</div>
      )}
      {error && (
        <div className="feedback error-feedback quiz-feedback">
          {typeof error === 'object' ? error.message : error}
        </div>
      )}

      {/* CBT Body */}
      <div className="quiz-body">
        {/* Active Question Panel */}
        <section className="quiz-question-panel">
          {/* Top Horizontal Question Palette (Matching Mockup 1794580723902.png) */}
          <div className="flex items-center gap-1.5 p-2 dark:bg-[#072117]/90 bg-white backdrop-blur-md rounded-2xl border dark:border-emerald-500/20 border-emerald-600/15 mb-3 select-none shadow-sm">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="w-8 h-8 rounded-xl dark:bg-emerald-950/80 bg-slate-100 border dark:border-emerald-500/25 border-slate-300 flex items-center justify-center dark:text-emerald-300 text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-emerald-900 transition-colors shrink-0"
              aria-label="Previous question"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 flex-1 no-scrollbar">
              {questions.map((item, idx) => {
                const qId = item.id;
                const resp = responses[qId];
                const hasAnswer = Boolean(resp?.selected_option);
                const isMarked = Boolean(resp?.marked_for_review);
                const isVisited = visitedQuestions.has(qId) || hasAnswer || isMarked || currentIndex === idx;
                const isCurrent = currentIndex === idx;

                let badgeClasses = 'dark:bg-emerald-950/50 bg-slate-100 border dark:border-emerald-800/40 border-slate-200 dark:text-emerald-400/60 text-slate-600';
                if (isCurrent) {
                  badgeClasses = 'border-2 border-amber-400 bg-amber-400/25 text-amber-800 dark:text-amber-300 ring-2 ring-amber-400/40 font-black shadow-glowGold scale-105';
                } else if (isMarked) {
                  badgeClasses = 'bg-purple-600 border border-purple-400 text-white font-bold';
                } else if (hasAnswer) {
                  badgeClasses = 'bg-[#22c55e] border border-[#22c55e] text-black font-black shadow-sm';
                } else if (isVisited) {
                  badgeClasses = 'bg-red-500/80 border border-red-500 text-white font-bold';
                }

                return (
                  <button
                    key={qId || idx}
                    type="button"
                    onClick={() => goTo(idx)}
                    className={`w-8 h-8 rounded-full text-xs flex items-center justify-center shrink-0 transition-transform hover:scale-110 active:scale-95 ${badgeClasses}`}
                    aria-label={`Question ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => goTo(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
              className="w-8 h-8 rounded-xl dark:bg-emerald-950/80 bg-slate-100 border dark:border-emerald-500/25 border-slate-300 flex items-center justify-center dark:text-emerald-300 text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-emerald-900 transition-colors shrink-0"
              aria-label="Next question"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="quiz-question-meta text-sm font-semibold">
            <span>QUESTION {String(currentIndex + 1).padStart(2, '0')}</span>
            {question?.subject && <span className="subject-pill text-xs font-semibold">{question.subject}</span>}
            {question?.topic && <span className="text-xs">{question.topic}</span>}
          </div>

          <div
            className="quiz-question-text text-lg sm:text-xl font-medium leading-relaxed"
            lang={language}
            aria-busy={translatingQuestionId === questionId}
          >
            <QuestionFormatter text={displayedQuestionText} />
            {language === 'hi' && !questionHindi && translatingQuestionId === questionId && (
              <LoaderCircle className="translation-inline-spinner" size={14} aria-label="Translating" />
            )}
          </div>

          {/* Options */}
          <div className="quiz-options">
            {(() => {
              const currentQuestion = question;
              let entries = currentQuestion?.options ? getOptionEntries(currentQuestion.options) : [];

              // Keep old option_a / option_b only as a fallback if question.options is null / empty
              if (!entries || entries.length === 0) {
                entries = ['A', 'B', 'C', 'D', 'E']
                  .filter((key) => {
                    const k = key.toLowerCase();
                    return currentQuestion?.[`option_${k}`] !== undefined ||
                           currentQuestion?.[`option_${k}_en`] !== undefined ||
                           currentQuestion?.[`option_${k}_hi`] !== undefined;
                  })
                  .map((key) => {
                    const k = key.toLowerCase();
                    return [
                      key,
                      {
                        en: currentQuestion?.[`option_${k}_en`] || currentQuestion?.[`option_${k}`] || '',
                        hi: currentQuestion?.[`option_${k}_hi`] || currentQuestion?.[`option_${k}`] || ''
                      }
                    ];
                  });
              }

              const isEn = String(language).toUpperCase() === 'EN';

              return entries.map(([key, opt]) => {
                let displayedOption = '';
                if (opt && typeof opt === 'object') {
                  const optEn = String(opt.en || opt.EN || opt.En || opt.text_en || opt.text || opt.label || opt.value || opt.code || opt.title || '').trim();
                  const optHi = String(opt.hi || opt.HI || opt.Hi || opt.text_hi || opt.text || opt.label || opt.value || opt.code || opt.title || '').trim();
                  displayedOption = isEn ? (optEn || optHi) : (optHi || optEn);

                  if (!displayedOption) {
                    const dict = Object.entries(opt).filter(([k]) => !['id', 'key', 'index'].includes(k.toLowerCase()));
                    if (dict.length > 0 && dict.every(([k, v]) => (typeof v === 'string' || typeof v === 'number') && k.length <= 4)) {
                      displayedOption = dict.map(([k, v]) => `${k.toUpperCase()}-${v}`).join(', ');
                    }
                  }
                } else if (typeof opt === 'string') {
                  displayedOption = opt;
                } else {
                  const k = key.toLowerCase();
                  const flatEn = String(currentQuestion?.[`option_${k}_en`] || currentQuestion?.[`option_${k}`] || '').trim();
                  const flatHi = String(currentQuestion?.[`option_${k}_hi`] || '').trim();
                  displayedOption = isEn ? (flatEn || flatHi) : (flatHi || flatEn);
                }

                if (!displayedOption && !isEn && questionTranslations[`option:${key}`]) {
                  displayedOption = questionTranslations[`option:${key}`];
                }

                const qCorrectAnswer = normalizeCorrectAnswer(
                  question?.correct_answer ?? question?.correct_option ?? question?.answer,
                  question?.options
                );
                const userSelectedOption = responses[question?.id]?.selected_option;
                const selected = userSelectedOption === key;
                const isImmediate = test?.solution_mode === 'immediate' && Boolean(userSelectedOption);
                const isCorrectAnswer = isImmediate && Boolean(qCorrectAnswer && qCorrectAnswer === key);
                const isWrongSelected = isImmediate && selected && !isCorrectAnswer;

                return (
                  <button
                    key={key}
                    type="button"
                    className={`quiz-option py-3.5 px-4 min-h-[56px] transition-all rounded-2xl ${
                      selected
                        ? 'selected border-2 border-[#22c55e] dark:bg-[#07281b] bg-emerald-50/90 shadow-[0_0_20px_rgba(34,197,94,0.18)]'
                        : 'border dark:border-emerald-500/20 border-slate-200 dark:bg-[#072117]/85 bg-white hover:border-emerald-500/40 shadow-xs'
                    } ${key === 'E' ? 'option-e' : ''} ${isCorrectAnswer ? 'correct-answer' : ''} ${isWrongSelected ? 'wrong-answer' : ''}`}
                    onClick={() => answer(key)}
                    aria-pressed={selected}
                  >
                    <span className={`quiz-option-letter w-8 h-8 min-w-[2rem] text-sm font-black rounded-full flex items-center justify-center ${
                      selected
                        ? 'bg-[#22c55e] text-black shadow-sm'
                        : 'dark:bg-emerald-950/80 bg-slate-100 border dark:border-emerald-500/30 border-slate-300 dark:text-emerald-300 text-slate-700'
                    }`}>
                      {key}
                    </span>
                    <span className="quiz-option-text text-base sm:text-lg leading-relaxed flex-1 dark:text-white text-slate-900">
                      <span lang={language}>
                        <MathRenderer>{displayedOption}</MathRenderer>
                        {!isEn && !displayedOption && translatingQuestionId === questionId && (
                          <LoaderCircle className="translation-inline-spinner" size={12} aria-label="Translating" />
                        )}
                      </span>
                    </span>
                    <span className="quiz-option-check shrink-0">
                      {isImmediate ? (
                        isCorrectAnswer ? (
                          <CheckCircle2 size={20} className="text-[#22c55e]" />
                        ) : isWrongSelected ? (
                          <CircleX size={20} className="text-rose-500" />
                        ) : null
                      ) : (
                        selected && <CheckCircle2 size={20} className="text-[#22c55e]" />
                      )}
                    </span>
                  </button>
                );
              });
            })()}
          </div>

          {/* Immediate Feedback Card in Practice Mode */}
          {test?.solution_mode === 'immediate' && responses[question.id]?.selected_option && (() => {
            const selectedOpt = String(responses[question.id]?.selected_option || '').trim().toUpperCase();
            const correctOpt = normalizeCorrectAnswer(
              question?.correct_answer ?? question?.correct_option ?? question?.answer,
              question?.options
            );
            const isUserCorrect = Boolean(correctOpt && selectedOpt === correctOpt);

            return (
              <div className={`immediate-feedback-card mt-4 p-4 rounded-xl border ${
                isUserCorrect
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              }`}>
                <div className="flex items-center gap-2 mb-2 font-bold text-sm sm:text-base">
                  {isUserCorrect ? (
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={18} /> {language === 'hi' ? 'सही उत्तर!' : 'Correct Answer!'}
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <CircleX size={18} /> {language === 'hi' ? `गलत उत्तर! सही उत्तर है: ${correctOpt || '—'}` : `Incorrect! Correct answer is: ${correctOpt || '—'}`}
                    </span>
                  )}
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {language === 'hi' ? 'अभ्यास मोड' : 'Practice Mode'}
                  </span>
                </div>

                {/* Localized Explanation */}
                {(() => {
                  const expl = extractLocalizedExplanation(question.explanation, language, question);
                  if (!expl) return null;
                  return (
                    <div className="immediate-explanation mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-700/60 text-sm leading-relaxed">
                      <strong className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                        {language === 'hi' ? 'व्याख्या' : 'Explanation'}
                      </strong>
                      <QuestionFormatter text={expl} />
                    </div>
                  );
                })()}

                {/* Localized Distractor Notes / Additional Notes */}
                {(() => {
                  const currentQuestion = question;
                  let notes = currentQuestion?.distractor_notes;
                  if (typeof notes === 'string') {
                    try {
                      notes = JSON.parse(notes);
                    } catch {
                      notes = null;
                    }
                  }
                  const hasNotes =
                    notes &&
                    typeof notes === 'object' &&
                    !Array.isArray(notes) &&
                    Object.keys(notes).length > 0 &&
                    Object.values(notes).some((n) => {
                      if (!n) return false;
                      if (typeof n === 'string') return n.trim().length > 0;
                      if (typeof n === 'object') return Boolean(n.en?.trim() || n.hi?.trim() || n.text?.trim());
                      return true;
                    });

                  if (!hasNotes) return null;

                  const validEntries = Object.entries(notes)
                    .map(([optKey, note]) => [optKey, extractLocalizedDistractorNote(note, language)])
                    .filter(([, locNote]) => Boolean(locNote));

                  if (validEntries.length === 0) return null;

                  return (
                    <div className="immediate-distractor-notes mt-2.5 pt-2.5 border-t border-neutral-200/60 dark:border-neutral-700/60 text-xs text-neutral-700 dark:text-neutral-300">
                      <strong className="block font-semibold mb-1 text-neutral-800 dark:text-neutral-200">
                        {language === 'hi' ? 'अतिरिक्त नोट्स' : 'Additional Notes'}:
                      </strong>
                      <div className="space-y-1">
                        {validEntries.map(([optKey, locNote]) => (
                          <div key={optKey} className="flex items-start gap-1">
                            <span className="font-bold">Option {optKey}:</span>
                            <span>{locNote}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Navigation Controls matching Mockup 1794580723902.png */}
          <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t dark:border-emerald-500/15 border-slate-200">
            <button
              type="button"
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full dark:bg-emerald-950/70 bg-slate-100 border dark:border-emerald-500/25 border-slate-300 dark:text-emerald-300 text-slate-700 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 min-h-[40px]"
              onClick={() => goTo(Math.max(0, currentIndex - 1))}
              disabled={!currentIndex}
            >
              <ChevronLeft size={16} /> <span>Previous</span>
            </button>

            <button
              type="button"
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full dark:bg-emerald-950/70 bg-slate-100 border dark:border-emerald-500/25 border-slate-300 dark:text-emerald-300 text-slate-700 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 min-h-[40px]"
              onClick={clearResponse}
              disabled={!responses[question.id]?.selected_option}
            >
              <RotateCcw size={14} /> <span>Clear</span>
            </button>

            {currentIndex === questions.length - 1 ? (
              <button
                type="button"
                className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-105 active:scale-95 min-h-[40px]"
                disabled={submitting}
                onClick={confirm}
              >
                {submitting ? 'Submitting…' : 'Submit Test'}
              </button>
            ) : (
              <button
                type="button"
                className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-105 active:scale-95 flex items-center gap-1 min-h-[40px]"
                onClick={() => goTo(Math.min(questions.length - 1, currentIndex + 1))}
              >
                <span>Next</span> <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* Bottom Toolbar matching Mockup 1794580723902.png: Question List | Mark for Review | Notes | Report */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 pt-3 mt-3 border-t dark:border-emerald-800/30 border-slate-200">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl dark:text-emerald-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-emerald-950/60 transition-colors min-h-[44px]"
            >
              <Grid3X3 size={16} />
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">Question List</span>
            </button>
            <button
              type="button"
              onClick={toggleReview}
              className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl transition-colors min-h-[44px] ${
                responses[question.id]?.marked_for_review
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40'
                  : 'dark:text-emerald-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-emerald-950/60'
              }`}
            >
              <Bookmark size={16} className={responses[question.id]?.marked_for_review ? 'fill-purple-600 dark:fill-purple-400' : ''} />
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">
                {responses[question.id]?.marked_for_review ? 'Marked' : 'Review'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => alert('Quick notes saved for this question.')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl dark:text-emerald-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-emerald-950/60 transition-colors min-h-[44px]"
            >
              <FileText size={16} />
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">Notes</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Question report flagged for review.')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl dark:text-emerald-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-emerald-950/60 transition-colors min-h-[44px]"
            >
              <AlertTriangle size={16} />
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">Report</span>
            </button>
          </div>
        </section>

        {/* Question Palette Sidebar */}
        <aside className={`quiz-palette ${paletteOpen ? 'palette-open' : ''}`}>
          <div className="palette-heading">
            <div>
              <div className="eyebrow">YOUR PROGRESS</div>
              <h2>Question palette</h2>
            </div>
            <button className="icon-button palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close palette">
              <X size={18} />
            </button>
          </div>

          {/* Standard 5-State Legend in Sidebar */}
          <PaletteLegend compact={true} />

          {/* Question Grid */}
          <div className="palette-grid">
            {questions.map((item, index) => {
              const qId = item.id;
              const response = responses[qId];
              const isOptionE = response?.selected_option === 'E';
              const hasAnswer = Boolean(response?.selected_option);
              const isMarked = Boolean(response?.marked_for_review);
              const isVisited = visitedQuestions.has(qId) || hasAnswer || isMarked || currentIndex === index;

              let stateClass = 'not-visited';
              let stateLabel = 'Not Visited';

              if (hasAnswer && isMarked) {
                stateClass = 'answered-marked';
                stateLabel = 'Answered & Marked for Review';
              } else if (isMarked) {
                stateClass = 'marked';
                stateLabel = 'Marked for Review';
              } else if (hasAnswer) {
                stateClass = 'answered';
                stateLabel = 'Answered';
              } else if (isVisited) {
                stateClass = 'not-answered';
                stateLabel = 'Not Answered';
              }

              return (
                <button
                  key={qId}
                  type="button"
                  className={`palette-number ${stateClass} ${isOptionE ? 'option-e-selected' : ''} ${currentIndex === index ? 'current' : ''}`}
                  onClick={() => goTo(index)}
                  aria-label={`Question ${index + 1}: ${stateLabel}${isOptionE ? ', Option E selected' : ''}`}
                  title={`Question ${index + 1} — ${stateLabel}${isOptionE ? ', Option E selected' : ''}`}
                >
                  {index + 1}
                  {stateClass === 'answered-marked' && <span className="eval-dot" />}
                </button>
              );
            })}
          </div>

          {/* Palette Summary */}
          <div className="palette-summary">
            <span><Check size={14} /> {attemptedCount} answered</span>
            <span><Flag size={14} /> {markedCount} for review</span>
          </div>

          <div className="palette-footer">
            <span>{questions.length - attemptedCount} unanswered</span>
            <button type="button" className="button button-gold" onClick={confirm}>Submit test</button>
          </div>
        </aside>
      </div>

      {/* Modal: Pause / Exit Modal */}
      {showPauseModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pause-modal-title">
          <section className="pause-modal">
            <button className="modal-close" onClick={() => setShowPauseModal(false)} aria-label="Close pause modal">
              <X size={18} />
            </button>
            <div className="pause-icon">
              <Pause size={24} />
            </div>
            <h2 id="pause-modal-title">Pause or Exit Test?</h2>
            <p>
              Your current responses, visited questions, and remaining time ({formatTime(remaining)}) can be saved so you can resume later.
            </p>

            <div className="pause-summary-grid">
              <div className="stat-card">
                <span className="stat-value">{questions.length}</span>
                <span className="stat-label">Total Questions</span>
              </div>
              <div className="stat-card">
                <span className="stat-value text-green">{attemptedCount}</span>
                <span className="stat-label">Answered</span>
              </div>
              <div className="stat-card">
                <span className="stat-value text-salmon">{questions.length - attemptedCount}</span>
                <span className="stat-label">Unanswered</span>
              </div>
              <div className="stat-card">
                <span className="stat-value text-purple">{markedCount}</span>
                <span className="stat-label">Marked for Review</span>
              </div>
            </div>

            {pauseError && <div className="feedback error-feedback">{pauseError}</div>}

            <div className="pause-modal-actions">
              <button
                type="button"
                className="button button-gold"
                disabled={pausing}
                onClick={pauseAndExit}
              >
                {pausing ? 'Saving Progress…' : 'Pause & Save (Resume Later)'}
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={pausing || submitting}
                onClick={() => {
                  setShowPauseModal(false);
                  setConfirmSubmit(true);
                }}
              >
                Submit Test Now
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={pausing}
                onClick={() => setShowPauseModal(false)}
              >
                Continue Test
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal: In-Test Instructions Modal */}
      {showInstructionsModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="in-test-instructions-title">
          <section className="instructions-modal">
            <div className="instructions-modal-header">
              <div className="flex items-center gap-2">
                <Info className="text-gold" size={20} />
                <h2 id="in-test-instructions-title" className="text-base font-bold">Exam Instructions</h2>
              </div>
              <button className="modal-close" onClick={() => setShowInstructionsModal(false)} aria-label="Close instructions">
                <X size={18} />
              </button>
            </div>
            <div className="instructions-modal-body">
              <FormattedInstructions text={test?.instructions} />
              <h3 className="text-sm font-bold mt-4 mb-2 text-text">Question Palette Legend</h3>
              <PaletteLegend compact={false} />
            </div>
            <div className="instructions-modal-footer">
              <button type="button" className="button button-gold" onClick={() => setShowInstructionsModal(false)}>
                Back to Test
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal: Final Submit Confirmation */}
      {confirmSubmit && (
        <div className="modal-backdrop">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title">
            <button className="modal-close" onClick={() => setConfirmSubmit(false)} aria-label="Close">
              <X size={18} />
            </button>
            <div className="locked-icon"><ListChecks size={22} /></div>
            <h2 id="submit-confirm-title">Submit your test?</h2>
            <p>
              You have answered {attemptedCount} of {questions.length} questions and marked {markedCount} for review.
              Unanswered questions will be submitted blank.
            </p>
            {error && <div className="feedback error-feedback">{typeof error === 'object' ? error.message : error}</div>}
            <div className="modal-actions">
              <button type="button" className="button button-outline" onClick={() => setConfirmSubmit(false)}>
                Continue test
              </button>
              <button type="button" className="button button-gold" disabled={submitting} onClick={() => submit(false)}>
                {submitting ? 'Submitting…' : 'Submit test'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Fullscreen Submitting Overlay */}
      {submitting && (
        <div className="quiz-submitting-overlay">
          <div className="quiz-submit-spinner" />
          <span>Submitting your responses securely…</span>
        </div>
      )}
    </main>
  );
}

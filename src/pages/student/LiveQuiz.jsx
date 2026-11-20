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
  Lock,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Target,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
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
  normalizeOptionKey,
  normalizeRpcObject,
  sanitizeLiveQuestion,
  unwrapRpcPayload
} from '../../lib/tests';
import { translateText } from '../../lib/translator';
import { recordStudyActivity } from '../../lib/streak';

const SUBMIT_MODAL_STRINGS = {
  en: {
    title: 'Submit Test Confirmation',
    subtitle: 'Review your question summary below before final submission. Unanswered questions will receive zero marks.',
    answered: 'Answered',
    ansAndMarked: 'Ans & Marked',
    ansAndMarkedNote: 'Evaluated for score',
    markedReview: 'Marked Review',
    notAnswered: 'Not Answered',
    notVisited: 'Not Visited',
    total: 'Total Questions',
    timeRemaining: 'Time Remaining',
    continueBtn: 'Resume Test',
    submitBtn: 'Confirm & Submit',
    submittingBtn: 'Submitting…',
    unansweredWarning: 'You have {count} unanswered question(s). Are you sure you want to submit?',
    offlineBanner: 'Offline Mode: Your selections are saved locally on this device. Cloud sync will automatically resume when internet reconnects.',
    onlineToast: 'Back online! Your progress has been automatically synced to the cloud.'
  },
  hi: {
    title: 'टेस्ट सबमिशन की पुष्टि',
    subtitle: 'अंतिम सबमिशन से पहले अपने प्रश्नों का सारांश देखें। अनुत्तरित प्रश्नों के लिए शून्य अंक मिलेंगे।',
    answered: 'उत्तर दिए',
    ansAndMarked: 'उत्तर व चिह्नित',
    ansAndMarkedNote: 'मूल्यांकन में मान्य',
    markedReview: 'समीक्षा हेतु',
    notAnswered: 'उत्तर नहीं दिए',
    notVisited: 'देखे नहीं गए',
    total: 'कुल प्रश्न',
    timeRemaining: 'शेष समय',
    continueBtn: 'टेस्ट जारी रखें',
    submitBtn: 'पुष्टि करें व सबमिट करें',
    submittingBtn: 'सबमिट हो रहा है…',
    unansweredWarning: 'आपके {count} प्रश्न अनुत्तरित हैं। क्या आप वाकई सबमिट करना चाहते हैं?',
    offlineBanner: 'ऑफलाइन मोड: आपके उत्तर इस डिवाइस पर सुरक्षित हैं। इंटरनेट पुनः कनेक्ट होने पर यह अपने आप सिंक हो जाएंगे।',
    onlineToast: 'इंटरनेट पुनः कनेक्ट हुआ! आपकी प्रगति सर्वर पर सिंक हो गई है।'
  }
};

const pendingAttemptStarts = new Map();
const QUIZ_CACHE_VERSION = 1;

function getQuizCacheKey(userId, testId) {
  return `zyvra-quiz-cache-${userId}-${testId}`;
}

function readQuizCache(userId, testId) {
  if (!userId || !testId) return null;
  const key = getQuizCacheKey(userId, testId);
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      if (parsed?.version === QUIZ_CACHE_VERSION && Array.isArray(parsed.questions)) return parsed;
    } catch {
      // Try the other storage area when one is unavailable or corrupt.
    }
  }
  return null;
}

function writeQuizCache(userId, testId, value) {
  if (!userId || !testId || !Array.isArray(value?.questions)) return;
  const payload = {
    version: QUIZ_CACHE_VERSION,
    test: value.test || null,
    attemptId: value.attemptId || null,
    questions: value.questions,
    cachedAt: new Date().toISOString()
  };
  const key = getQuizCacheKey(userId, testId);
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch (storageError) {
      console.warn('Unable to cache quiz questions locally:', storageError);
    }
  }
}

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
          <li>Click an option to select your answer. In Test Mode, you can freely change your selection or click <strong>Clear Response</strong> anytime before submitting. In Practice Mode, your answer is verified immediately upon selection.</li>
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

function PaletteLegend({ compact = false, stats = null, language = 'en' }) {
  const isHi = language === 'hi';
  return (
    <div className={`cbt-palette-legend ${compact ? 'compact' : ''}`}>
      <div className="legend-item" title="Answered">
        <span className="legend-badge answered">
          {stats ? stats.answered : '1'}
        </span>
        <div className="legend-text">
          <strong>{isHi ? 'उत्तर दिया' : 'Answered'}</strong>
          {!compact && <span>{isHi ? 'आपने इस प्रश्न का उत्तर दिया है।' : 'You have answered the question.'}</span>}
        </div>
      </div>
      <div className="legend-item" title="Not Answered">
        <span className="legend-badge not-answered">
          {stats ? stats.notAnswered : '2'}
        </span>
        <div className="legend-text">
          <strong>{isHi ? 'उत्तर नहीं दिया' : 'Not Answered'}</strong>
          {!compact && <span>{isHi ? 'आपने इस प्रश्न का उत्तर नहीं दिया है।' : 'You have not answered the question.'}</span>}
        </div>
      </div>
      <div className="legend-item" title="Marked for Review">
        <span className="legend-badge marked">
          {stats ? stats.markedOnly : '3'}
        </span>
        <div className="legend-text">
          <strong>{isHi ? 'समीक्षा हेतु' : 'Marked for Review'}</strong>
          {!compact && <span>{isHi ? 'समीक्षा के लिए चिह्नित (बिना उत्तर)।' : 'Marked for review without an answer.'}</span>}
        </div>
      </div>
      <div className="legend-item" title="Answered & Marked for Review">
        <span className="legend-badge answered-marked">
          {stats ? stats.answeredAndMarked : '4'}
          <span className="eval-dot" />
        </span>
        <div className="legend-text">
          <strong>{isHi ? 'उत्तरित व चिह्नित' : 'Ans & Marked'}</strong>
          {!compact && <span>{isHi ? 'उत्तर दिया और समीक्षा के लिए चिह्नित (मूल्यांकन होगा)।' : 'Answered & marked (will be evaluated).'}</span>}
        </div>
      </div>
      <div className="legend-item" title="Not Visited">
        <span className="legend-badge not-visited">
          {stats ? stats.notVisited : '5'}
        </span>
        <div className="legend-text">
          <strong>{isHi ? 'नहीं देखा' : 'Not Visited'}</strong>
          {!compact && <span>{isHi ? 'आपने अभी तक यह प्रश्न नहीं देखा है।' : 'You have not visited the question yet.'}</span>}
        </div>
      </div>
    </div>
  );
}

export default function LiveQuiz() {
  const { testId } = useParams();
  const { user, supabase, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [test, setTest] = useState(null);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const lockedAnswersRef = useRef(new Map());
  const [evaluatingQuestionIds, setEvaluatingQuestionIds] = useState(new Set());
  const [evaluationErrors, setEvaluationErrors] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState('');
  const [error, setError] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [startingTest, setStartingTest] = useState(false);
  const [testPhase, setTestPhase] = useState('loading'); // 'loading' | 'instructions' | 'resume_prompt' | 'active'

  const [toast, setToast] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const [antiCheatWarning, setAntiCheatWarning] = useState('');
  const [feedbackAction, setFeedbackAction] = useState('');
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState('md'); // 'sm' | 'md' | 'lg'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState('all'); // 'all' | 'answered' | 'unanswered' | 'marked'
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const saveProgressSnapshotRef = useRef();
  const onlineToastTimerRef = useRef();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      if (typeof saveProgressSnapshotRef.current === 'function') {
        saveProgressSnapshotRef.current({ status: 'in_progress' }, true);
      }
      if (onlineToastTimerRef.current) clearTimeout(onlineToastTimerRef.current);
      onlineToastTimerRef.current = setTimeout(() => setShowOnlineToast(false), 4500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineToast(false);
    };
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (onlineToastTimerRef.current) clearTimeout(onlineToastTimerRef.current);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch { /* fullscreen ignore */ }
  };

  const submitLock = useRef(false);
  const lastViolationAt = useRef(0);
  const violationCountRef = useRef(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [language, setLanguage] = useState('en');
  const [translatedData, setTranslatedData] = useState({});
  const [translatingQuestionId, setTranslatingQuestionId] = useState('');
  const inFlightTranslations = useRef(new Map());
  const timeSpentRef = useRef({});
  const dropoffEventsRef = useRef([]);
  const overflowMenuRef = useRef(null);
  const overflowTriggerRef = useRef(null);
  const paletteTriggerRef = useRef(null);
  const paletteCloseRef = useRef(null);
  const paletteGridRef = useRef(null);
  const paletteOpenerRef = useRef(null);
  const paletteWasOpenRef = useRef(false);

  useEffect(() => {
    if (!overflowOpen) return undefined;

    const handleOverflowDismiss = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setOverflowOpen(false);
        return;
      }
      if (event.type === 'pointerdown' && !overflowMenuRef.current?.contains(event.target)) {
        setOverflowOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOverflowDismiss);
    document.addEventListener('keydown', handleOverflowDismiss);
    return () => {
      document.removeEventListener('pointerdown', handleOverflowDismiss);
      document.removeEventListener('keydown', handleOverflowDismiss);
    };
  }, [overflowOpen]);

  useEffect(() => {
    if (!paletteOpen) {
      if (paletteWasOpenRef.current) {
        paletteWasOpenRef.current = false;
        paletteOpenerRef.current?.focus();
      }
      return undefined;
    }

    paletteWasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => paletteCloseRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const currentButton = paletteGridRef.current?.querySelector(`[data-question-index="${currentIndex}"]`);
    currentButton?.scrollIntoView({ block: 'nearest' });
  }, [paletteOpen, currentIndex]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Per-question time tracking timer
  useEffect(() => {
    if (testPhase !== 'active' || pausing || confirmSubmit || showPauseModal) return;
    const interval = setInterval(() => {
      const qId = questions?.[currentIndex]?.id;
      if (qId) {
        timeSpentRef.current[qId] = (timeSpentRef.current[qId] || 0) + 1;
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
    testPhase: 'loading',
    violationCount: 0,
    dropoffEvents: []
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
      testPhase,
      violationCount,
      dropoffEvents: dropoffEventsRef.current
    };
  }, [attemptId, testId, user?.id, currentIndex, responses, visitedQuestions, remaining, language, testPhase, violationCount]);

  // Ref for debouncing cloud sync to avoid network congestion during rapid option selections
  const cloudSyncTimeoutRef = useRef(null);

  // Dual Persistence: Instant LocalStorage Snapshot + Debounced Supabase Cloud Upsert
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
    const dropoffEvents = overrides.dropoffEvents ?? cur.dropoffEvents ?? dropoffEventsRef.current;
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
    lockedAnswersRef.current.forEach((val, k) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        answersMap[k] = val;
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
      violationCount: overrides.violationCount ?? cur.violationCount ?? 0,
      dropoffEvents,
      remainingSeconds: remSecs,
      timeSpent: overrides.timeSpent ?? timeSpentRef.current,
      language: lang,
      updatedAt: new Date().toISOString()
    };

    // 1. Instant synchronous dual localStorage persistence (0ms overhead)
    try {
      localStorage.setItem(`zyvra_test_progress_${uid}_${tId}`, JSON.stringify(snapshot));
      localStorage.setItem(`zyvra-paused-attempt-${uid}-${tId}`, JSON.stringify(snapshot));
      if (activeAttId) {
        localStorage.setItem(`zyvra-active-state-${activeAttId}`, JSON.stringify(snapshot));
      }
    } catch (storageErr) {
      console.warn('LocalStorage save failed:', storageErr);
    }

    // 2. Supabase Cloud Sync (Immediate on pause/unload, debounced during rapid question selection)
    if (syncCloud && supabase && activeAttId) {
      const isImmediate = overrides.status === 'paused' || syncCloud === 'immediate';

      const performCloudSync = () => {
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
          .rpc('save_test_attempt_progress', {
            p_attempt_id: activeAttId,
            p_status: cloudPayload.status,
            p_remaining_seconds: cloudPayload.remaining_seconds,
            p_current_question_index: cloudPayload.current_question_index,
            p_state_json: cloudPayload.state_json,
            p_violation_count: snapshot.violationCount
          })
          .then(({ error: syncErr }) => {
            if (syncErr) {
              console.warn('Database attempt update error:', syncErr?.message || syncErr);
            }
          })
          .catch((e) => console.warn('Cloud sync error:', e));
      };

      if (isImmediate) {
        if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
        performCloudSync();
      } else {
        if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
        cloudSyncTimeoutRef.current = setTimeout(performCloudSync, 1800);
      }
    }

    return snapshot;
  }, [supabase]);
  saveProgressSnapshotRef.current = saveProgressSnapshot;

  const recordDropoffEvent = useCallback((type, details = {}) => {
    const cur = stateRef.current;
    if (!cur.userId || !cur.testId || !cur.attemptId) return null;
    const currentQuestion = questions[cur.currentIndex];
    const event = {
      type,
      at: new Date().toISOString(),
      questionId: currentQuestion?.id || null,
      questionIndex: cur.currentIndex,
      section: currentQuestion?.section || currentQuestion?.topic || currentQuestion?.subject || null,
      remainingSeconds: cur.remaining,
      ...details
    };
    const nextEvents = [...dropoffEventsRef.current, event].slice(-50);
    dropoffEventsRef.current = nextEvents;
    stateRef.current.dropoffEvents = nextEvents;
    return saveProgressSnapshot({ status: 'paused', dropoffEvents: nextEvents }, true);
  }, [questions, saveProgressSnapshot]);

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

      const cachedQuiz = readQuizCache(user.id, testId);
      let testData = null;
      let totalCount = 0;
      let latestAttempt = null;

      // 1. Concurrently fetch test metadata, question count, and latest attempt in parallel
      try {
        const [testResult, countResult, attemptResult] = await Promise.all([
          supabase
            .from('tests')
            .select('id,title,chapter_id,instructions,pattern,duration_minutes,attempt_limit,positive_marks,negative_marks,mandatory_option_e_penalty,coin_reward_enabled,solution_mode,status')
            .eq('id', testId)
            .maybeSingle(),
          supabase
            .from('test_questions')
            .select('id', { count: 'exact', head: true })
            .eq('test_id', testId),
          supabase
            .from('test_attempts')
            .select('id, test_id, user_id, status, started_at, completed_at, remaining_seconds, current_question_index, state_json, paused_at, created_at, updated_at')
            .eq('user_id', user.id)
            .eq('test_id', testId)
            .order('created_at', { ascending: false })
            .limit(1)
        ]);

        if (testResult.error && !cachedQuiz?.test) throw testResult.error;
        testData = testResult.data || cachedQuiz?.test;
        totalCount = countResult?.count || 0;
        if (attemptResult?.data?.length > 0) {
          latestAttempt = attemptResult.data[0];
        }
      } catch (loadError) {
        if (!cachedQuiz?.test) throw loadError;
        testData = cachedQuiz.test;
      }

      if (!testData || !['published', 'live', 'available'].includes(String(testData.status).toLowerCase())) {
        setError({
          message: 'This test is not currently available.',
          technical: ''
        });
        setLoading(false);
        return;
      }

      if (active) {
        setTest(testData);
        setTotalQuestionCount(totalCount);
      }

      // If the most recent attempt is already completed or submitted, redirect immediately to result
      const isAttemptCompleted = Boolean(
        latestAttempt && (
          latestAttempt.completed_at ||
          ['completed', 'submitted'].includes(String(latestAttempt.status || '').toLowerCase())
        )
      );

      if (isAttemptCompleted && !location.state?.reattempt) {
        if (active) {
          navigate(`/quiz/result/${latestAttempt.id}`, { replace: true, state: { returnTo } });
          return;
        }
      }

      const dbIncomplete = (latestAttempt && !isAttemptCompleted) ? latestAttempt : null;

      // Check localStorage snapshot
      let localSnapshot = null;
      try {
        const rawLocal = localStorage.getItem(`zyvra_test_progress_${user.id}_${testId}`)
          || localStorage.getItem(`zyvra-paused-attempt-${user.id}-${testId}`);
        if (rawLocal) localSnapshot = JSON.parse(rawLocal);
      } catch { /* fullscreen ignore */ }

      const hasResumeAttempt = (dbIncomplete && dbIncomplete.status !== 'completed' && dbIncomplete.status !== 'submitted')
        || localSnapshot
        || cachedQuiz?.attemptId;

      if (hasResumeAttempt) {
        // Paused or in-progress attempt found: pre-load questions and prompt resume
        const activeAttemptId = dbIncomplete?.id || localSnapshot?.attemptId || cachedQuiz?.attemptId;
        let safeQuestions = [];
        try {
          const { data: questionData, error: questionError } = await supabase.rpc('get_live_test_questions', {
            p_test_id: testId,
            p_attempt_id: activeAttemptId
          });
          if (questionError) throw questionError;
          const payload = unwrapRpcPayload(questionData);
          const questionRows = Array.isArray(payload) ? payload : payload?.questions;
          const safeRows = Array.isArray(questionRows) ? questionRows : [];
          safeQuestions = safeRows.map(sanitizeLiveQuestion);
        } catch (questionError) {
          safeQuestions = cachedQuiz?.questions || [];
          if (!safeQuestions.length) throw questionError;
          console.warn('Using cached quiz questions while offline:', questionError);
        }

        if (active) {
          setAttemptId(activeAttemptId);
          setQuestions(safeQuestions);
          writeQuizCache(user.id, testId, { test: testData, attemptId: activeAttemptId, questions: safeQuestions });

          // Restore state cleanly from DB and LocalStorage
          const stateJson = dbIncomplete?.state_json || {};
          const rawResponses = localSnapshot?.responses || stateJson.responses || {};
          const rawAnswers = localSnapshot?.answers || stateJson.answers || {};
          const rawMarked = localSnapshot?.markedForReview || stateJson.markedForReview || [];
          const markedSet = new Set(Array.isArray(rawMarked) ? rawMarked : Object.keys(rawMarked).filter((k) => rawMarked[k]));

          const restoredResponses = { ...rawResponses };
          lockedAnswersRef.current.clear();
          Object.entries(rawAnswers).forEach(([qId, opt]) => {
            const sel = typeof opt === 'object' ? opt?.selected_option : opt;
            const norm = normalizeOptionKey(sel);
            if (norm) lockedAnswersRef.current.set(qId, norm);
            restoredResponses[qId] = {
              ...(restoredResponses[qId] || {}),
              selected_option: norm || sel
            };
          });
          Object.entries(rawResponses).forEach(([qId, val]) => {
            const sel = val?.selected_option;
            const norm = normalizeOptionKey(sel);
            if (norm) lockedAnswersRef.current.set(qId, norm);
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
          timeSpentRef.current = localSnapshot?.timeSpent || stateJson.timeSpent || {};
          const restoredViolations = Number(localSnapshot?.violationCount ?? stateJson.violationCount ?? 0);
          violationCountRef.current = restoredViolations;
          setViolationCount(restoredViolations);
          dropoffEventsRef.current = Array.isArray(localSnapshot?.dropoffEvents)
            ? localSnapshot.dropoffEvents.slice(-50)
            : Array.isArray(stateJson.dropoffEvents) ? stateJson.dropoffEvents.slice(-50) : [];

          const restoredLang = localSnapshot?.language || stateJson.language;
          if (restoredLang) setLanguage(restoredLang);

          setResponses(restoredResponses);
          setCurrentIndex(Math.min(restoredIndex, Math.max(0, safeQuestions.length - 1)));
          setVisitedQuestions(restoredVisited);
          setRemaining(restoredRemaining);



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
  }, [testId, user, supabase, location.state?.reattempt, location.state?.autoResume, navigate, returnTo]);

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
      writeQuizCache(user.id, testId, { test, attemptId: activeAttemptId, questions: safeQuestions });
      lockedAnswersRef.current.clear();
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
    if (!questions.length) return;
    if (remaining <= 0) {
      submit(true);
      return;
    }
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
      recordDropoffEvent('pause');
      const snapshot = saveProgressSnapshot({ status: 'paused' }, true);
      sessionStorage.removeItem(`zyvra-active-attempt-${user?.id}-${testId}`);

      const { error: updateError } = await supabase.rpc('save_test_attempt_progress', {
        p_attempt_id: attemptId,
        p_status: 'paused',
        p_remaining_seconds: remaining,
        p_current_question_index: currentIndex,
        p_state_json: snapshot,
        p_violation_count: snapshot.violationCount
      });

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
    if (testPhase !== 'active' || submitting || pausing) return undefined;

    const handleBeforeUnload = (event) => {
      recordDropoffEvent('abandon');
      event.preventDefault();
      event.returnValue = 'You have an active test. Your progress is saved, but are you sure you want to leave?';
      return event.returnValue;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordDropoffEvent('tab_switch');
      }
    };

    const handlePageHide = () => {
      recordDropoffEvent('abandon');
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
  }, [testPhase, submitting, pausing, recordDropoffEvent]);

  const recordViolation = useCallback(() => {
    const now = Date.now();
    if (now - lastViolationAt.current < 1500) return;
    lastViolationAt.current = now;
    const nextCount = violationCountRef.current + 1;
    violationCountRef.current = nextCount;
    setViolationCount(nextCount);
    setAntiCheatWarning(`Focus warning: leaving the test window was detected (${nextCount}). Stay on this screen to protect your attempt.`);
    saveProgressSnapshot({ violationCount: nextCount }, true);
  }, [saveProgressSnapshot]);

  useEffect(() => {
    if (testPhase !== 'active') return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') recordViolation();
    };
    const handleWindowBlur = () => recordViolation();
    const preventClipboardShortcuts = (event) => {
      if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', preventClipboardShortcuts, true);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', preventClipboardShortcuts, true);
    };
  }, [testPhase, recordViolation]);

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

  // Local storage auto-save on state change (throttled to user actions; NOT on 1s timer ticks)
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
          remaining: stateRef.current.remaining,
          updatedAt: Date.now()
        })
      );
    } catch (storageError) {
      console.error('Unable to save in-progress responses locally:', storageError);
    }
  }, [attemptId, responses, visitedQuestions, currentIndex]);

  // Submit test with multi-tier network resilience and retry
  const submit = useCallback(async (expired = false) => {
    if (submitLock.current || !attemptId || !supabase) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitFailed(false);
    setError(null);
    setConfirmSubmit(false);
    setShowPauseModal(false);
    if (expired) setTimeExpired(true);

    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
    }

    const curResponses = stateRef.current.responses || responses;
    const p_responses = questions.map((q) => ({
      question_id: q.id,
      selected_option: lockedAnswersRef.current.get(q.id) || curResponses[q.id]?.selected_option || null,
      marked_for_review: Boolean(curResponses[q.id]?.marked_for_review),
      time_spent_seconds: timeSpentRef.current[q.id] || 0
    }));

    // Synchronously back up submission payload in localStorage
    try {
      localStorage.setItem(`zyvra_attempt_timespent_${attemptId}`, JSON.stringify(timeSpentRef.current));
      localStorage.setItem(`zyvra_submitted_backup_${attemptId}`, JSON.stringify(p_responses));
    } catch { /* storage fallback */ }

    let submitSuccess = false;
    let lastError = null;

    // Retry loop: up to 2 attempts for transient connection drops
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { error: submitError } = await supabase.rpc('submit_test_attempt', {
          p_attempt_id: attemptId,
          p_responses
        });

        if (!submitError) {
          submitSuccess = true;
          break;
        }

        // If RPC indicates attempt is already completed or primary key duplicate, treat as fulfilled
        const errMsg = String(submitError?.message || '').toLowerCase();
        if (errMsg.includes('completed') || errMsg.includes('already submitted') || submitError.code === '23505') {
          submitSuccess = true;
          break;
        }
        lastError = submitError;
      } catch (networkErr) {
        lastError = networkErr;
      }

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Verify against server state if RPC reported an error
    if (!submitSuccess) {
      try {
        const { data: verified } = await supabase
          .from('test_attempts')
          .select('id, status, completed_at')
          .eq('id', attemptId)
          .maybeSingle();

        if (verified && (verified.completed_at || ['completed', 'submitted'].includes(String(verified.status).toLowerCase()))) {
          submitSuccess = true;
        }
      } catch { /* ignore verification fallback error */ }
    }

    if (submitSuccess) {
      if (user) {
        sessionStorage.removeItem(`zyvra-active-attempt-${user.id}-${testId}`);
        localStorage.removeItem(`zyvra-paused-attempt-${user.id}-${testId}`);
        localStorage.removeItem(`zyvra_test_progress_${user.id}_${testId}`);
      }
      sessionStorage.removeItem(`zyvra-responses-${attemptId}`);
      localStorage.removeItem(`zyvra-active-state-${attemptId}`);

      if (refreshAccount) {
        refreshAccount();
      }
      recordStudyActivity(supabase, user?.id, 'test_completed');
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('zyvra:coins-updated'));
      }

      navigate(`/quiz/result/${attemptId}`, { replace: true, state: { returnTo } });
    } else {
      submitLock.current = false;
      setSubmitting(false);
      setSubmitFailed(true);
      setError({
        message: lastError?.message || 'Unable to submit your responses due to a network connection issue. Your answers are safely preserved on this device.',
        technical: lastError?.message || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError))
      });
    }
  }, [attemptId, supabase, questions, user, testId, navigate, returnTo, refreshAccount]);

  // Countdown timer effect
  useEffect(() => {
    if (testPhase !== 'active' || !deadline || submitting || pausing) return undefined;

    const checkTimer = () => {
      const next = getRemaining(deadline);
      setRemaining(next);
      if (next === 0) {
        submit(true);
      }
    };

    checkTimer();
    const interval = window.setInterval(checkTimer, 1000);

    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible') {
        checkTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
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
      } catch { /* fullscreen ignore */ }
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

  const stats = useMemo(() => {
    let answered = 0;
    let markedOnly = 0;
    let answeredAndMarked = 0;
    let notVisited = 0;
    let notAnswered = 0;

    (questions || []).forEach((q, idx) => {
      const qId = q.id;
      const resp = responses?.[qId];
      const hasAnswer = Boolean(resp?.selected_option);
      const isMarked = Boolean(resp?.marked_for_review);
      const isVisited = visitedQuestions.has(qId) || hasAnswer || isMarked || currentIndex === idx;

      if (hasAnswer && isMarked) {
        answeredAndMarked += 1;
      } else if (hasAnswer) {
        answered += 1;
      } else if (isMarked) {
        markedOnly += 1;
      } else if (!isVisited) {
        notVisited += 1;
      } else {
        notAnswered += 1;
      }
    });

    const totalAnswered = answered + answeredAndMarked;
    const totalUnanswered = notAnswered + notVisited + markedOnly;

    return {
      answered,
      markedOnly,
      answeredAndMarked,
      notVisited,
      notAnswered,
      totalAnswered,
      totalUnanswered,
      totalQuestions: questions?.length || 0
    };
  }, [questions, responses, visitedQuestions, currentIndex]);

  const attemptedCount = stats.totalAnswered;
  const markedCount = stats.markedOnly + stats.answeredAndMarked;

  const answer = async (option) => {
    if (!question?.id || !option || submitting || pausing) return;
    const qId = question.id;
    const targetQId = question.question_id || question.id;
    const normalizedOpt = normalizeOptionKey(option);
    if (!normalizedOpt) return;

    const isImmediate = test?.solution_mode === 'immediate';

    // 1. PRACTICE MODE GUARD: Strict permanent lock on first selection
    if (isImmediate) {
      if (lockedAnswersRef.current.has(qId) || responses[qId]?.selected_option) {
        return;
      }
      lockedAnswersRef.current.set(qId, normalizedOpt);
    } else {
      // 2. TEST / EXAM MODE: Update selection freely
      lockedAnswersRef.current.set(qId, normalizedOpt);
    }

    // 3. UPDATE RESPONSES & SNAPSHOT
    const nextResponses = {
      ...responses,
      [qId]: {
        ...responses[qId],
        selected_option: normalizedOpt,
        locked_at: new Date().toISOString()
      }
    };
    setResponses(nextResponses);
    saveProgressSnapshot({ responses: nextResponses }, true);

    // 4. PRACTICE MODE: Fetch Authoritative Evaluation Securely
    const hasAuthoritative = Boolean(normalizeCorrectAnswer(
      question?.correct_answer ?? question?.correct_option ?? question?.answer,
      question?.options
    ));

    if (isImmediate && !hasAuthoritative && supabase) {
      setEvaluatingQuestionIds((prev) => new Set(prev).add(qId));
      setEvaluationErrors((prev) => {
        const next = { ...prev };
        delete next[qId];
        return next;
      });

      try {
        let res = null;
        if (attemptId) {
          const { data: rpcAnswerData, error: rpcAnswerErr } = await supabase.rpc('submit_question_answer', {
            p_attempt_id: attemptId,
            p_question_id: targetQId,
            p_selected_option: normalizedOpt
          });
          if (!rpcAnswerErr && rpcAnswerData?.allowed) {
            res = rpcAnswerData;
          }
        }

        if (!res) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_single_question_feedback', {
            p_test_id: testId,
            p_question_id: targetQId,
            p_selected_option: normalizedOpt
          });
          if (!rpcError && rpcData?.allowed) {
            res = rpcData;
          } else if (rpcError) {
            throw rpcError;
          }
        }

        if (res?.allowed) {
          const ans = normalizeCorrectAnswer(res.correct_answer, question.options);
          if (ans) {
            question.correct_answer = ans;
            question.correct_option = ans;
            question.answer = ans;
            if (res.explanation) question.explanation = res.explanation;
            if (res.distractor_notes) question.distractor_notes = res.distractor_notes;
            setQuestions((prev) => [...prev]);
          }
        } else {
          console.warn('[LiveQuiz:answer] Feedback RPC did not return an allowed answer:', res);
        }
      } catch (err) {
        console.warn('[LiveQuiz:answer] Error evaluating answer:', err);
        setEvaluationErrors((prev) => ({
          ...prev,
          [qId]: 'Unable to fetch evaluation. Your answer is safely locked.'
        }));
      } finally {
        setEvaluatingQuestionIds((prev) => {
          const next = new Set(prev);
          next.delete(qId);
          return next;
        });
      }
    } else if (attemptId && supabase) {
      // Test Mode (or immediate with known answer): record updated answer to backend in background
      supabase
        .rpc('submit_question_answer', {
          p_attempt_id: attemptId,
          p_question_id: targetQId,
          p_selected_option: normalizedOpt
        })
        .catch((err) => console.warn('[LiveQuiz:answer] Background answer sync error:', err));
    }
  };

  const clearResponse = useCallback(() => {
    if (!question?.id || submitting || pausing) return;
    const isImmediate = test?.solution_mode === 'immediate';
    if (isImmediate) return; // Cannot clear in immediate practice mode

    const qId = question.id;
    const targetQId = question.question_id || question.id;

    lockedAnswersRef.current.delete(qId);

    const nextResponses = {
      ...responses,
      [qId]: {
        ...responses[qId],
        selected_option: null
      }
    };
    setResponses(nextResponses);
    saveProgressSnapshot({ responses: nextResponses }, true);

    if (attemptId && supabase) {
      supabase
        .rpc('submit_question_answer', {
          p_attempt_id: attemptId,
          p_question_id: targetQId,
          p_selected_option: null
        })
        .catch((err) => console.warn('[LiveQuiz:clearResponse] Background clear sync error:', err));
    }
  }, [question, submitting, pausing, test?.solution_mode, responses, saveProgressSnapshot, attemptId, supabase]);

  const retryEvaluation = async (qId) => {
    const targetQId = question.question_id || question.id;
    const selected = lockedAnswersRef.current.get(qId) || responses[qId]?.selected_option;
    if (!selected || !supabase) return;

    setEvaluatingQuestionIds((prev) => new Set(prev).add(qId));
    setEvaluationErrors((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });

    try {
      let res = null;
      if (attemptId) {
        const { data: rpcAnswerData, error: rpcAnswerErr } = await supabase.rpc('submit_question_answer', {
          p_attempt_id: attemptId,
          p_question_id: targetQId,
          p_selected_option: selected
        });
        if (!rpcAnswerErr && rpcAnswerData?.allowed) {
          res = rpcAnswerData;
        }
      }

      if (!res) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_single_question_feedback', {
          p_test_id: testId,
          p_question_id: targetQId,
          p_selected_option: selected
        });
        if (!rpcError && rpcData?.allowed) {
          res = rpcData;
        } else if (rpcError) {
          throw rpcError;
        }
      }

      if (res?.allowed) {
        const ans = normalizeCorrectAnswer(res.correct_answer, question.options);
        if (ans) {
          question.correct_answer = ans;
          question.correct_option = ans;
          question.answer = ans;
          if (res.explanation) question.explanation = res.explanation;
          if (res.distractor_notes) question.distractor_notes = res.distractor_notes;
          setQuestions((prev) => [...prev]);
        }
      } else {
        throw new Error(res?.error || 'Evaluation not allowed.');
      }
    } catch {
      setEvaluationErrors((prev) => ({
        ...prev,
        [qId]: 'Retry failed. Check your internet connection.'
      }));
    } finally {
      setEvaluatingQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(qId);
        return next;
      });
    }
  };

  const toggleReview = () => {
    if (bookmarkSaving) return;
    const isSavingBookmark = !responses[question.id]?.marked_for_review;
    setBookmarkSaving(true);
    const nextResponses = {
      ...responses,
      [question.id]: {
        ...responses[question.id],
        marked_for_review: !responses[question.id]?.marked_for_review
      }
    };
    setResponses(nextResponses);
    saveProgressSnapshot({ responses: nextResponses }, false);
    try {
      const stored = JSON.parse(localStorage.getItem('zyvra_saved_question_bookmarks') || '[]');
      const bookmarks = Array.isArray(stored) ? stored : [];
      const bookmarkId = `question:${testId}:${question.id}`;
      const nextBookmarks = isSavingBookmark
        ? [
            ...bookmarks.filter((item) => item.id !== bookmarkId),
            {
              id: bookmarkId,
              user_id: user?.id || null,
              type: 'question',
              test_id: testId,
              test_title: test?.title || 'Practice Test',
              question_text: language === 'hi' ? (questionHindi || questionEnglish) : (questionEnglish || questionHindi),
              options: optionEntries.map(([key, option]) => ({
                key,
                text: typeof option === 'string'
                  ? option
                  : (language === 'hi' ? (option?.hi || option?.en || '') : (option?.en || option?.hi || ''))
              })),
              savedAt: new Date().toISOString()
            }
          ]
        : bookmarks.filter((item) => item.id !== bookmarkId);
      localStorage.setItem('zyvra_saved_question_bookmarks', JSON.stringify(nextBookmarks));
    } catch (storageError) {
      console.warn('Unable to persist question bookmark:', storageError);
    }
    setToast(nextResponses[question.id].marked_for_review ? 'Question bookmarked for review.' : 'Bookmark removed.');
    window.setTimeout(() => setBookmarkSaving(false), 250);
  };

  const handleFeedbackAction = (action) => {
    if (feedbackAction) return;
    setFeedbackAction(action);
    setToast(action === 'notes'
      ? 'Quick notes are coming soon for this question.'
      : 'Question reporting is coming soon.');
    window.setTimeout(() => setFeedbackAction(''), 350);
  };

  const goTo = (index) => {
    setCurrentIndex(index);
    setPaletteOpen(false);
    saveProgressSnapshot({ currentIndex: index }, false);
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
            <img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 rounded-xl object-contain shadow-sm" />
            <span>ZYVRA<span>EXAM INSTRUCTIONS</span></span>
          </Link>
          <Link to={returnTo} className="button button-outline text-xs min-h-[36px]">
            <ArrowLeft size={14} /> Exit to Tests
          </Link>
        </header>

      {showOnlineToast && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md transition-all">
          <Wifi size={15} />
          <span>{language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.onlineToast : SUBMIT_MODAL_STRINGS.en.onlineToast}</span>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-500 text-black px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm">
          <WifiOff size={15} />
          <span>{language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.offlineBanner : SUBMIT_MODAL_STRINGS.en.offlineBanner}</span>
        </div>
      )}

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
                <Clock3 className="stat-icon text-accent" size={20} />
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
                <Award className="stat-icon text-accent" size={20} />
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
                <Info size={18} className="text-accent" /> Please Read The Instructions Carefully
              </h2>
              <div className="instructions-scrollable">
                <FormattedInstructions text={test?.instructions} />
              </div>
            </section>

            <section className="instructions-legend-section">
              <h3 className="instructions-section-title">
                <Grid3X3 size={18} className="text-accent" /> Question Palette Symbol Guide
              </h3>
              <PaletteLegend compact={false} language={language} />
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
                className="button button-primary start-test-btn"
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
            <img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 rounded-xl object-contain shadow-sm" />
            <span>ZYVRA<span>RESUME TEST</span></span>
          </Link>
          <Link to={returnTo} className="button button-outline text-xs min-h-[36px]">
            <ArrowLeft size={14} /> Exit to Tests
          </Link>
        </header>

      {showOnlineToast && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md transition-all">
          <Wifi size={15} />
          <span>{language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.onlineToast : SUBMIT_MODAL_STRINGS.en.onlineToast}</span>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-500 text-black px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm">
          <WifiOff size={15} />
          <span>{language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.offlineBanner : SUBMIT_MODAL_STRINGS.en.offlineBanner}</span>
        </div>
      )}

        <div className="instructions-container resume-container">
          <div className="resume-hero-card">
            <div className="resume-icon-badge">
              <Clock3 size={32} className="text-accent" />
            </div>
            <h2>Incomplete Test Attempt Detected</h2>
            <p>
              You have a previously paused attempt for <strong>{test?.title}</strong>. Your responses, question progress, and remaining time are preserved.
            </p>

            <div className="resume-stats-grid">
              <div className="resume-stat">
                <span className="stat-label">Time Remaining</span>
                <strong className="stat-value text-accent">{formatTime(remaining)}</strong>
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
                className="button resume-btn-large bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
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
                  <Info className="text-accent" size={20} />
                  <h2 id="instructions-modal-title" className="text-base font-bold">Exam Instructions</h2>
                </div>
                <button className="modal-close" onClick={() => setShowInstructionsModal(false)} aria-label="Close instructions">
                  <X size={18} />
                </button>
              </div>
              <div className="instructions-modal-body">
                <FormattedInstructions text={test?.instructions} />
                <h3 className="text-sm font-bold mt-4 mb-2 text-text">Question Palette Legend</h3>
                <PaletteLegend compact={false} stats={stats} language={language} />
              </div>
              <div className="instructions-modal-footer">
                <button type="button" className="button button-primary" onClick={() => setShowInstructionsModal(false)}>
                  Close
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Modal: Confirm Submit */}
        {confirmSubmit && (
          <div className="modal-backdrop">
            <section className="confirm-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title-resume">
              <button
                type="button"
                className="modal-close"
                onClick={() => setConfirmSubmit(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-2xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 flex items-center justify-center text-emerald-500 shrink-0">
                  <ListChecks size={22} />
                </div>
                <div>
                  <h2 id="submit-confirm-title-resume" className="text-base sm:text-lg font-black dark:text-white text-slate-900 m-0 text-left">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.title : SUBMIT_MODAL_STRINGS.en.title}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 dark:text-amber-400">
                    <Clock3 size={13} />
                    <span>
                      {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.timeRemaining : SUBMIT_MODAL_STRINGS.en.timeRemaining}:{' '}
                      <strong>{formatTime(remaining)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs dark:text-slate-300 text-slate-600 mb-3 text-left">
                {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.subtitle : SUBMIT_MODAL_STRINGS.en.subtitle}
              </p>

              {/* 5-Status CBT Question Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-3 text-center">
                <div className="p-2.5 rounded-2xl dark:bg-emerald-950/40 bg-emerald-50 border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.answered : SUBMIT_MODAL_STRINGS.en.answered}
                  </span>
                  <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.answered}
                  </strong>
                </div>

                <div className="p-2.5 rounded-2xl dark:bg-indigo-950/40 bg-indigo-50 border border-indigo-500/30">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.ansAndMarked : SUBMIT_MODAL_STRINGS.en.ansAndMarked}
                  </span>
                  <strong className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {stats.answeredAndMarked}
                  </strong>
                  <span className="text-[9px] text-indigo-400 block -mt-0.5">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.ansAndMarkedNote : SUBMIT_MODAL_STRINGS.en.ansAndMarkedNote}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl dark:bg-purple-950/40 bg-purple-50 border border-purple-500/30">
                  <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block truncate">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.markedReview : SUBMIT_MODAL_STRINGS.en.markedReview}
                  </span>
                  <strong className="text-xl font-black text-purple-600 dark:text-purple-400">
                    {stats.markedOnly}
                  </strong>
                </div>

                <div className="p-2.5 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border border-rose-500/30">
                  <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block truncate">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.notAnswered : SUBMIT_MODAL_STRINGS.en.notAnswered}
                  </span>
                  <strong className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {stats.notAnswered}
                  </strong>
                </div>

                <div className="p-2.5 rounded-2xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block truncate">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.notVisited : SUBMIT_MODAL_STRINGS.en.notVisited}
                  </span>
                  <strong className="text-xl font-black dark:text-slate-300 text-slate-700">
                    {stats.notVisited}
                  </strong>
                </div>

                <div className="p-2.5 rounded-2xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block truncate">
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.total : SUBMIT_MODAL_STRINGS.en.total}
                  </span>
                  <strong className="text-xl font-black dark:text-white text-slate-900">
                    {stats.totalQuestions}
                  </strong>
                </div>
              </div>

              {stats.totalUnanswered > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold my-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>
                    {(language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.unansweredWarning : SUBMIT_MODAL_STRINGS.en.unansweredWarning)
                      .replace('{count}', String(stats.totalUnanswered))}
                  </span>
                </div>
              )}

              {error && <div className="feedback error-feedback my-2">{typeof error === 'object' ? error.message : error}</div>}
              <div className="modal-actions pt-2">
                <button type="button" className="button button-outline" onClick={() => setConfirmSubmit(false)}>
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.continueBtn : SUBMIT_MODAL_STRINGS.en.continueBtn}
                </button>
                <button type="button" className="button button-primary" disabled={submitting} onClick={() => submit(false)}>
                  {submitting
                    ? (language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.submittingBtn : SUBMIT_MODAL_STRINGS.en.submittingBtn)
                    : (language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.submitBtn : SUBMIT_MODAL_STRINGS.en.submitBtn)}
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
    <main
      className="live-quiz select-none"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onPaste={(event) => event.preventDefault()}
    >
      {toast && (
        <div className="fixed right-4 top-4 z-[120] rounded-xl border border-indigo-400/30 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg dark:bg-[#1E293B] dark:text-slate-100" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {antiCheatWarning && (
        <div className="fixed inset-x-4 top-4 z-[119] rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 pr-10 text-sm font-semibold text-amber-900 shadow-lg dark:bg-amber-950/90 dark:text-amber-100" role="alert">
          {antiCheatWarning}
          <button type="button" className="absolute right-3 top-2 text-lg" onClick={() => setAntiCheatWarning('')} aria-label="Dismiss focus warning">×</button>
        </div>
      )}
      {paletteOpen && (
        <button
          className="drawer-scrim quiz-scrim"
          aria-label="Close question palette"
          onClick={() => setPaletteOpen(false)}
        />
      )}

      {/* CBT 2-Row Header */}
      <header ref={overflowMenuRef} className="quiz-header cbt-two-row-header">
        {/* ROW 1: Compact Brand + Truncated Title on Left | Compact Action Buttons on Right */}
        <div className="quiz-header-top-row">
          <div className="quiz-header-brand-wrap">
            <Link to={returnTo || "/tests"} className="quiz-brand-compact" title="Exit to tests">
              <img src="/logo-192.png" alt="Zyvra" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain shadow-xs flex-shrink-0" />
            </Link>
            <div className="quiz-title-truncated">
              <strong title={test?.title}>{test?.title || 'Test Mode'}</strong>
            </div>
          </div>

          <div className="quiz-header-actions-compact">
            {/* Font Size Adjuster for Mobile Accessibility */}
            <div className="hidden sm:flex items-center rounded-lg border dark:border-slate-700/60 border-slate-200 bg-slate-50 dark:bg-slate-800/80 p-0.5 text-[11px] font-extrabold" title="Adjust text size">
              <button
                type="button"
                onClick={() => setFontSizeLevel('sm')}
                className={`px-1.5 py-0.5 rounded ${fontSizeLevel === 'sm' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                aria-label="Small text"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel('md')}
                className={`px-1.5 py-0.5 rounded ${fontSizeLevel === 'md' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                aria-label="Normal text"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel('lg')}
                className={`px-1.5 py-0.5 rounded ${fontSizeLevel === 'lg' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
                aria-label="Large text"
              >
                A+
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              className="icon-button hidden sm:inline-flex"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Distraction-free Fullscreen"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

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
              className="button quiz-submit-button hidden md:inline-flex bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
              disabled={submitting}
              onClick={confirm}
            >
              {submitting ? 'Submitting…' : 'Submit test'}
            </button>

            {/* Palette Toggle (Mobile) */}
            <button
              type="button"
              className="icon-button quiz-palette-toggle"
              ref={paletteTriggerRef}
              onClick={() => {
                paletteOpenerRef.current = paletteTriggerRef.current;
                setPaletteOpen(true);
              }}
              title="Open question palette"
              aria-label="Open question palette"
            >
              <Grid3X3 size={17} />
            </button>

            <button
              type="button"
              className="icon-button quiz-overflow-toggle"
              ref={overflowTriggerRef}
              onClick={() => setOverflowOpen((open) => !open)}
              aria-expanded={overflowOpen}
              aria-haspopup="menu"
              aria-label="More test options"
            >
              <span aria-hidden="true">⋯</span>
            </button>
          </div>
        </div>

        {overflowOpen && (
          <div className="quiz-overflow-menu" role="menu" aria-label="More test options">
            <button
              type="button"
              className="quiz-overflow-menu-item"
              role="menuitem"
              onClick={() => {
                setOverflowOpen(false);
                setShowInstructionsModal(true);
              }}
            >
              <Info size={16} /> Instructions
            </button>
            <button
              type="button"
              className="quiz-overflow-menu-item"
              role="menuitem"
              onClick={() => {
                setOverflowOpen(false);
                setShowPauseModal(true);
              }}
            >
              <Pause size={16} /> Pause test
            </button>
            <button
              type="button"
              className="quiz-overflow-menu-item"
              role="menuitem"
              onClick={() => {
                setOverflowOpen(false);
                paletteOpenerRef.current = overflowTriggerRef.current;
                setPaletteOpen(true);
              }}
            >
              <Grid3X3 size={16} /> Question palette
            </button>
          </div>
        )}

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

      {showOnlineToast && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md transition-all">
          <Wifi size={15} />
          <span>{language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.onlineToast : SUBMIT_MODAL_STRINGS.en.onlineToast}</span>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-500 text-black px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm">
          <WifiOff size={15} />
          <span>{language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.offlineBanner : SUBMIT_MODAL_STRINGS.en.offlineBanner}</span>
        </div>
      )}

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
          <div className="flex items-center gap-1.5 p-2 dark:bg-[#1E293B]/90 bg-white backdrop-blur-md rounded-2xl border dark:border-slate-700/60 border-slate-200 mb-3 select-none shadow-sm">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="quiz-mobile-nav-button w-8 h-8 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
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

                let badgeClasses = 'dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 dark:text-slate-400 text-slate-600';
                if (hasAnswer && isMarked) {
                  badgeClasses = 'bg-purple-600 border border-purple-400 text-white font-bold relative';
                } else if (isMarked) {
                  badgeClasses = 'bg-purple-600 border border-purple-400 text-white font-bold';
                } else if (hasAnswer) {
                  badgeClasses = 'bg-[#22c55e] border border-[#22c55e] text-white font-black shadow-sm';
                } else if (isVisited) {
                  badgeClasses = 'bg-rose-500/90 border border-rose-500 text-white font-bold';
                }

                const currentRing = isCurrent
                  ? 'ring-2 ring-indigo-400 ring-offset-2 scale-110 font-black shadow-md z-10 dark:ring-offset-slate-900 ring-offset-white'
                  : '';

                return (
                  <button
                    key={qId || idx}
                    type="button"
                    onClick={() => goTo(idx)}
                    className={`w-8 h-8 rounded-full text-xs flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95 ${badgeClasses} ${currentRing}`}
                    aria-label={`Question ${idx + 1}`}
                  >
                    {idx + 1}
                    {hasAnswer && isMarked && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => goTo(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
              className="quiz-mobile-nav-button w-8 h-8 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
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
            className={`quiz-question-text ${fontSizeLevel === 'sm' ? 'text-base sm:text-lg' : fontSizeLevel === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-medium leading-relaxed select-text`}
            lang={language}
            aria-busy={translatingQuestionId === questionId}
          >
            <QuestionFormatter text={displayedQuestionText} language={language} />
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
                const userSelectedOption = lockedAnswersRef.current.get(question?.id) || responses[question?.id]?.selected_option;
                const isImmediate = test?.solution_mode === 'immediate';
                const isLocked = isImmediate && Boolean(userSelectedOption);
                const isEvaluating = evaluatingQuestionIds.has(question?.id);
                const selected = userSelectedOption === key;
                const hasAuthoritativeKey = Boolean(qCorrectAnswer);
                const isCorrectAnswer = isImmediate && hasAuthoritativeKey && (qCorrectAnswer === key);
                const isWrongSelected = isImmediate && hasAuthoritativeKey && selected && (qCorrectAnswer !== key);

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isLocked || isEvaluating}
                    className={`quiz-option py-3.5 px-4 min-h-[56px] transition-all rounded-2xl touch-manipulation select-none ${
                      selected
                        ? 'selected border-2 border-indigo-500 dark:border-indigo-400 dark:bg-[#312E81] bg-indigo-50 shadow-md'
                        : 'border dark:border-slate-700/60 border-slate-200 dark:bg-[#1E293B] bg-white hover:border-indigo-500/40'
                    } ${key === 'E' ? 'option-e' : ''} ${isCorrectAnswer ? 'correct-answer' : ''} ${isWrongSelected ? 'wrong-answer' : ''} ${isLocked ? 'cursor-default' : ''}`}
                    onClick={() => !isLocked && !isEvaluating && answer(key)}
                    aria-pressed={selected}
                  >
                    <span className={`quiz-option-letter w-8 h-8 min-w-[2rem] text-sm font-black rounded-full flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'dark:bg-slate-800 bg-slate-100 border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700'
                    }`}>
                      {key}
                    </span>
                    <span className={`quiz-option-text ${fontSizeLevel === 'sm' ? 'text-sm sm:text-base' : fontSizeLevel === 'lg' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} leading-relaxed flex-1 dark:text-white text-slate-900`}>
                      <span lang={language}>
                        <MathRenderer>{displayedOption}</MathRenderer>
                        {!isEn && !displayedOption && translatingQuestionId === questionId && (
                          <LoaderCircle className="translation-inline-spinner" size={12} aria-label="Translating" />
                        )}
                      </span>
                    </span>
                    <span className="quiz-option-check shrink-0">
                      {isEvaluating && selected ? (
                        <LoaderCircle size={18} className="animate-spin text-emerald-500" />
                      ) : isImmediate ? (
                        isCorrectAnswer ? (
                          <CheckCircle2 size={20} className="text-[#22c55e]" />
                        ) : isWrongSelected ? (
                          <CircleX size={20} className="text-rose-500" />
                        ) : null
                      ) : (
                        selected && <Check size={18} className="text-indigo-600 dark:text-indigo-400 font-bold" />
                      )}
                    </span>
                  </button>
                );
              });
            })()}
          </div>

          {/* Immediate Feedback Card in Practice Mode */}
          {test?.solution_mode === 'immediate' && (lockedAnswersRef.current.get(question.id) || responses[question.id]?.selected_option) && (() => {
            const selectedOpt = String(lockedAnswersRef.current.get(question.id) || responses[question.id]?.selected_option || '').trim().toUpperCase();
            const correctOpt = normalizeCorrectAnswer(
              question?.correct_answer ?? question?.correct_option ?? question?.answer,
              question?.options
            );
            const isEvaluating = evaluatingQuestionIds.has(question.id);
            const evalError = evaluationErrors[question.id];

            // If evaluating or awaiting authoritative answer key, display evaluating card - NEVER flash incorrect!
            if (isEvaluating || (!correctOpt && !evalError)) {
              return (
                <div className="immediate-feedback-card mt-4 p-4 rounded-xl border bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-700 dark:text-slate-300">
                    <LoaderCircle size={18} className="animate-spin text-emerald-500" />
                    <span>{language === 'hi' ? 'उत्तर की जाँच हो रही है...' : 'Evaluating answer...'}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {language === 'hi' ? 'अभ्यास मोड' : 'Practice Mode'}
                    </span>
                  </div>
                </div>
              );
            }

            if (evalError) {
              return (
                <div className="immediate-feedback-card mt-4 p-4 rounded-xl border bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800">
                  <div className="flex items-center justify-between gap-2 text-sm text-amber-800 dark:text-amber-200">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle size={16} /> {evalError}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-white hover:opacity-90"
                      onClick={() => retryEvaluation(question.id)}
                    >
                      {language === 'hi' ? 'पुनः प्रयास करें' : 'Retry'}
                    </button>
                  </div>
                </div>
              );
            }

            const isUserCorrect = Boolean(correctOpt && selectedOpt === correctOpt);

            return (
              <div className={`immediate-feedback-card mt-4 p-4 rounded-xl border ${
                isUserCorrect
                  ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              }`}>
                <div className="flex items-center gap-2 mb-2 font-bold text-sm sm:text-base">
                  {isUserCorrect ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
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
                  return (
                    <div className="immediate-explanation mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-700/60 text-sm leading-relaxed">
                      <strong className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                        {language === 'hi' ? 'व्याख्या' : 'Explanation'}
                      </strong>
                      {expl ? (
                        <QuestionFormatter text={expl} language={language} />
                      ) : (
                        <p className="text-neutral-500 dark:text-neutral-400">
                          {language === 'hi' ? 'इस प्रश्न की व्याख्या हिंदी में उपलब्ध नहीं है।' : 'No explanation is available for this question yet.'}
                        </p>
                      )}
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
          <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t dark:border-slate-700/60 border-slate-200">
            <button
              type="button"
              className="quiz-mobile-action-button px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 min-h-[40px]"
              onClick={() => goTo(Math.max(0, currentIndex - 1))}
              disabled={!currentIndex}
            >
              <ChevronLeft size={16} /> <span>{language === 'hi' ? 'पीछे' : 'Previous'}</span>
            </button>

            {test?.solution_mode === 'immediate' ? (
              (lockedAnswersRef.current.get(question.id) || responses[question.id]?.selected_option) ? (
                <div
                  className="quiz-mobile-action-button px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full dark:bg-indigo-950/40 bg-indigo-50 border dark:border-indigo-500/25 border-indigo-200 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 min-h-[40px] select-none"
                  title="Answer is permanently locked"
                >
                  <Lock size={13} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{language === 'hi' ? 'उत्तर लॉक है' : 'Answer Locked'}</span>
                </div>
              ) : (
                <div
                  className="quiz-mobile-action-button px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full dark:bg-slate-900/40 bg-slate-100 border dark:border-slate-800 border-slate-300 text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5 min-h-[40px] select-none"
                >
                  <span>{language === 'hi' ? 'अनुत्तरित' : 'Unanswered'}</span>
                </div>
              )
            ) : (
              (lockedAnswersRef.current.get(question.id) || responses[question.id]?.selected_option) ? (
                <div className="flex items-center gap-1.5">
                  <div
                    className="quiz-mobile-action-button px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full dark:bg-emerald-950/40 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 min-h-[40px] select-none"
                  >
                    <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'hi' ? 'उत्तर दिया' : 'Answered'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearResponse}
                    disabled={submitting || pausing}
                    className="quiz-mobile-action-button px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-full dark:bg-rose-950/30 bg-rose-50 border dark:border-rose-800/40 border-rose-200 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold flex items-center gap-1 min-h-[40px] transition-colors"
                    title={language === 'hi' ? 'उत्तर हटाएं' : 'Clear Response'}
                  >
                    <RotateCcw size={12} />
                    <span>{language === 'hi' ? 'उत्तर हटाएं' : 'Clear Response'}</span>
                  </button>
                </div>
              ) : (
                <div
                  className="quiz-mobile-action-button px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full dark:bg-slate-900/40 bg-slate-100 border dark:border-slate-800 border-slate-300 text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5 min-h-[40px] select-none"
                >
                  <span>{language === 'hi' ? 'अनुत्तरित' : 'Unanswered'}</span>
                </div>
              )
            )}

            {currentIndex === questions.length - 1 ? (
              <button
                type="button"
                className="quiz-mobile-action-button px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors min-h-[40px] shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                disabled={submitting}
                onClick={confirm}
              >
                {submitting ? (language === 'hi' ? 'जमा हो रहा है…' : 'Submitting…') : (language === 'hi' ? 'टेस्ट जमा करें' : 'Submit Test')}
              </button>
            ) : (
              <button
                type="button"
                className="quiz-mobile-action-button px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors flex items-center gap-1 min-h-[40px] shadow-glowIndigo"
                onClick={() => goTo(Math.min(questions.length - 1, currentIndex + 1))}
              >
                <span>
                  {responses[question?.id]?.selected_option
                    ? (language === 'hi' ? 'सेव करें और आगे' : 'Save & Next')
                    : (language === 'hi' ? 'आगे' : 'Next')}
                </span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* Bottom Toolbar matching Mockup 1794580723902.png: Question List | Mark for Review | Notes | Report */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 pt-3 mt-3 border-t dark:border-slate-700/60 border-slate-200">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              <Grid3X3 size={16} />
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">
                {language === 'hi' ? 'प्रश्न सूची' : 'Question List'}
              </span>
            </button>
            <button
              type="button"
              onClick={toggleReview}
              disabled={bookmarkSaving}
              className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl transition-colors min-h-[44px] ${
                responses[question.id]?.marked_for_review
                  ? 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-500/30'
                  : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {bookmarkSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Bookmark size={16} className={responses[question.id]?.marked_for_review ? 'fill-amber-400 text-amber-500' : ''} />}
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">
                {responses[question.id]?.marked_for_review ? (language === 'hi' ? 'चिह्नित' : 'Marked') : (language === 'hi' ? 'रिव्यू' : 'Review')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleFeedbackAction('notes')}
              disabled={feedbackAction !== ''}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              {feedbackAction === 'notes' ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">
                {language === 'hi' ? 'नोट्स' : 'Notes'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleFeedbackAction('report')}
              disabled={feedbackAction !== ''}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              {feedbackAction === 'report' ? <LoaderCircle size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
              <span className="text-[9.5px] sm:text-[10px] font-bold mt-1 truncate">
                {language === 'hi' ? 'रिपोर्ट' : 'Report'}
              </span>
            </button>
          </div>
        </section>

        {/* Question Palette Sidebar */}
        <aside className={`quiz-palette ${paletteOpen ? 'palette-open' : ''}`}>
          <div className="palette-heading">
            <div>
              <div className="eyebrow">YOUR PROGRESS</div>
              <h2>Question {currentIndex + 1} of {questions.length}</h2>
            </div>
            <button ref={paletteCloseRef} className="icon-button palette-close" onClick={() => setPaletteOpen(false)} aria-label="Close palette">
              <X size={18} />
            </button>
          </div>

          {/* Standard 5-State Legend in Sidebar */}
          <PaletteLegend compact={true} stats={stats} language={language} />

          {/* Quick Palette Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl my-2 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setPaletteFilter('all')}
              className={`flex-1 py-1 rounded-lg transition-colors text-center ${
                paletteFilter === 'all'
                  ? 'bg-indigo-600 text-white font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setPaletteFilter('answered')}
              className={`flex-1 py-1 rounded-lg transition-colors text-center ${
                paletteFilter === 'answered'
                  ? 'bg-emerald-600 text-white font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Ans ({attemptedCount})
            </button>
            <button
              type="button"
              onClick={() => setPaletteFilter('unanswered')}
              className={`flex-1 py-1 rounded-lg transition-colors text-center ${
                paletteFilter === 'unanswered'
                  ? 'bg-rose-600 text-white font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Unans ({questions.length - attemptedCount})
            </button>
            <button
              type="button"
              onClick={() => setPaletteFilter('marked')}
              className={`flex-1 py-1 rounded-lg transition-colors text-center ${
                paletteFilter === 'marked'
                  ? 'bg-purple-600 text-white font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Review ({markedCount})
            </button>
          </div>

          {/* Question Grid */}
          <div ref={paletteGridRef} className="palette-grid">
            {questions.map((item, index) => {
              const qId = item.id;
              const response = responses[qId];
              const hasAnswer = Boolean(response?.selected_option);
              const isMarked = Boolean(response?.marked_for_review);

              if (paletteFilter === 'answered' && !hasAnswer) return null;
              if (paletteFilter === 'unanswered' && hasAnswer) return null;
              if (paletteFilter === 'marked' && !isMarked) return null;

              const isOptionE = response?.selected_option === 'E';
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
                  data-question-index={index}
                  className={`palette-number ${stateClass} ${isOptionE ? 'option-e-selected' : ''} ${currentIndex === index ? 'current' : ''}`}
                  onClick={() => {
                    goTo(index);
                    setPaletteOpen(false);
                  }}
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
            <button type="button" className="button button-primary" onClick={confirm}>Submit test</button>
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
                className="button button-primary"
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
                <Info className="text-accent" size={20} />
                <h2 id="in-test-instructions-title" className="text-base font-bold">Exam Instructions</h2>
              </div>
              <button className="modal-close" onClick={() => setShowInstructionsModal(false)} aria-label="Close instructions">
                <X size={18} />
              </button>
            </div>
            <div className="instructions-modal-body">
              <FormattedInstructions text={test?.instructions} />
              <h3 className="text-sm font-bold mt-4 mb-2 text-text">Question Palette Legend</h3>
              <PaletteLegend compact={false} stats={stats} language={language} />
            </div>
            <div className="instructions-modal-footer">
              <button type="button" className="button button-primary" onClick={() => setShowInstructionsModal(false)}>
                Back to Test
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal: Final Submit Confirmation */}
      {confirmSubmit && (
        <div className="modal-backdrop">
          <section className="confirm-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title">
            <button
              type="button"
              className="modal-close"
              onClick={() => setConfirmSubmit(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-2xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 flex items-center justify-center text-emerald-500 shrink-0">
                <ListChecks size={22} />
              </div>
              <div>
                <h2 id="submit-confirm-title" className="text-base sm:text-lg font-black dark:text-white text-slate-900 m-0 text-left">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.title : SUBMIT_MODAL_STRINGS.en.title}
                </h2>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 dark:text-amber-400">
                  <Clock3 size={13} />
                  <span>
                    {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.timeRemaining : SUBMIT_MODAL_STRINGS.en.timeRemaining}:{' '}
                    <strong>{formatTime(remaining)}</strong>
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs dark:text-slate-300 text-slate-600 mb-3 text-left">
              {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.subtitle : SUBMIT_MODAL_STRINGS.en.subtitle}
            </p>

            {/* 5-Status CBT Question Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-3 text-center">
              <div className="p-2.5 rounded-2xl dark:bg-emerald-950/40 bg-emerald-50 border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.answered : SUBMIT_MODAL_STRINGS.en.answered}
                </span>
                <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {stats.answered}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl dark:bg-indigo-950/40 bg-indigo-50 border border-indigo-500/30">
                <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.ansAndMarked : SUBMIT_MODAL_STRINGS.en.ansAndMarked}
                </span>
                <strong className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  {stats.answeredAndMarked}
                </strong>
                <span className="text-[9px] text-indigo-400 block -mt-0.5">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.ansAndMarkedNote : SUBMIT_MODAL_STRINGS.en.ansAndMarkedNote}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl dark:bg-purple-950/40 bg-purple-50 border border-purple-500/30">
                <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block truncate">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.markedReview : SUBMIT_MODAL_STRINGS.en.markedReview}
                </span>
                <strong className="text-xl font-black text-purple-600 dark:text-purple-400">
                  {stats.markedOnly}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border border-rose-500/30">
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block truncate">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.notAnswered : SUBMIT_MODAL_STRINGS.en.notAnswered}
                </span>
                <strong className="text-xl font-black text-rose-600 dark:text-rose-400">
                  {stats.notAnswered}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block truncate">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.notVisited : SUBMIT_MODAL_STRINGS.en.notVisited}
                </span>
                <strong className="text-xl font-black dark:text-slate-300 text-slate-700">
                  {stats.notVisited}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block truncate">
                  {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.total : SUBMIT_MODAL_STRINGS.en.total}
                </span>
                <strong className="text-xl font-black dark:text-white text-slate-900">
                  {stats.totalQuestions}
                </strong>
              </div>
            </div>

            {stats.totalUnanswered > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold my-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  {(language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.unansweredWarning : SUBMIT_MODAL_STRINGS.en.unansweredWarning)
                    .replace('{count}', String(stats.totalUnanswered))}
                </span>
              </div>
            )}

            {error && <div className="feedback error-feedback my-2">{typeof error === 'object' ? error.message : error}</div>}
            <div className="modal-actions pt-2">
              <button type="button" className="button button-outline" onClick={() => setConfirmSubmit(false)}>
                {language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.continueBtn : SUBMIT_MODAL_STRINGS.en.continueBtn}
              </button>
              <button type="button" className="button button-primary" disabled={submitting} onClick={() => submit(false)}>
                {submitting
                  ? (language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.submittingBtn : SUBMIT_MODAL_STRINGS.en.submittingBtn)
                  : (language === 'hi' ? SUBMIT_MODAL_STRINGS.hi.submitBtn : SUBMIT_MODAL_STRINGS.en.submitBtn)}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Fullscreen Submitting Overlay & Resilient Retry Modal */}
      {(submitting || submitFailed) && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          {submitting ? (
            <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-slate-900 border border-indigo-500/30 shadow-2xl text-center max-w-xs">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
              <strong className="text-white text-base">Submitting Responses…</strong>
              <span className="text-slate-400 text-xs leading-relaxed">
                {language === 'hi'
                  ? 'आपके उत्तर सर्वर पर सुरक्षित सबमिट किए जा रहे हैं...'
                  : 'Securing your answers and evaluating results...'}
              </span>
            </div>
          ) : (
            <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl">
                ⚠️
              </div>
              <h3 className="text-white font-bold text-base">
                {language === 'hi' ? 'सबमिशन में रुकावट आई' : 'Submission Interrupted'}
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                {error?.message || (language === 'hi'
                  ? 'नेटवर्क धीमा होने के कारण सबमिशन पूरा नहीं हो सका। चिंता न करें, आपके सभी उत्तर सुरक्षित हैं।'
                  : 'Network connection dropped while sending your answers. All your answers are safely preserved on this device.')}
              </p>
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => submit(false)}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={15} />
                  <span>{language === 'hi' ? 'पुनः प्रयास करें (Retry Submission)' : 'Retry Submission Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitFailed(false);
                    setError(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  {language === 'hi' ? 'टेस्ट पर वापस जाएं' : 'Return to Test'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

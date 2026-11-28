import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, Bookmark, BookOpen,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CircleX, Clock3, Coins, Filter, Flame, Headphones, Lightbulb, MinusCircle, Pause, Play, Plus, Printer, RotateCcw, Share2, Sparkles, Square, Swords, Target, Trophy, Volume2, X
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import QuestionFormatter from '../../components/common/QuestionFormatter';
import ZyvraAiGuruModal from '../../components/toolbox/ai/ZyvraAiGuruModal';
import LottiePlayer from '../../components/common/LottiePlayer';
import { celebrationAnimationData } from '../../assets/animations/celebrationData';
import { useAuth } from '../../context/AuthContext';
import { useStudentStats } from '../../context/StudentStatsContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatCount } from '../../lib/formatters';
import { readMistakesLocal, saveMistakeToNotebook } from '../../lib/studentToolbox';
import {
  formatScore,
  getOptionEntries,
  normalizeCorrectAnswer,
  normalizeRpcObject,
  parseStructuredExplanation,
  resolveSolutionStatus,
  unwrapRpcPayload
} from '../../lib/tests';
import { playRealisticSpeech, preloadAudio, stopSpeech } from '../../lib/hybridVoicePlayer';

const TOPIC_LABEL_MAP = {
  statement: 'Statement-Based Analysis',
  match: 'Match the Following',
  assertion_reason: 'Assertion & Reasoning',
  science: 'Science',
  social_science: 'Social Science',
  polity: 'Indian Polity',
  history: 'History',
  geography: 'Geography',
  economics: 'Economics',
  economy: 'Economy',
  biology: 'Biology',
  physics: 'Physics',
  chemistry: 'Chemistry',
  math: 'Mathematics',
  mathematics: 'Mathematics',
  reasoning: 'Reasoning',
  current_affairs: 'Current Affairs',
  bihar_special: 'Bihar Special',
  general_studies: 'General Studies',
  general_concepts: 'General Concepts'
};

function humanizeTopicName(raw) {
  const str = String(raw || '').trim();
  if (!str) return 'General Concepts';
  const key = str.toLowerCase().replace(/[\s-]+/g, '_');
  if (TOPIC_LABEL_MAP[key]) return TOPIC_LABEL_MAP[key];
  if (str.includes('_') || str.includes('-') || str === str.toLowerCase()) {
    return str
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return str;
}

const valueOf = (result, ...keys) => {
  for (const key of keys) {
    if (result && result[key] !== undefined && result[key] !== null) return result[key];
  }
  return 0;
};

function getStoredHindi(value) {
  return value && typeof value === 'object' ? value.hi || value.text_hi || '' : '';
}

function getLocalizedEnglish(value) {
  if (typeof value === 'string') return value;
  return value?.en || value?.text || '';
}

export default function QuizResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, supabase, refreshAccount } = useAuth();
  const { currentStreak } = useStudentStats();
  const { language: appLanguage } = useThemeLanguage();
  const [language, setLanguage] = useState(() => {
    const fromState = location.state?.quizLanguage;
    if (fromState === 'en' || fromState === 'hi') return fromState;
    try {
      const stored = localStorage.getItem(`zyvra_attempt_lang_${attemptId}`) || sessionStorage.getItem(`zyvra_attempt_lang_${attemptId}`);
      if (stored === 'en' || stored === 'hi') return stored;
    } catch {}
    return appLanguage || 'en';
  });

  const rawReturn = location.state?.returnTo || sessionStorage.getItem('last_quiz_return_url');
  const returnTo = (rawReturn && !rawReturn.startsWith('/quiz/')) ? rawReturn : '/tests';

  const [result, setResult] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Tab: 'review' (Question Review) | 'solutions' (Detailed Solutions) | 'analysis' (Topic Analysis) | 'compare' (Compare)
  const [activeTab, setActiveTab] = useState('review');
  const [currentSolutionIndex, setCurrentSolutionIndex] = useState(0);

  // Review List Filter: 'all' | 'correct' | 'incorrect' | 'unattempted'
  const [reviewFilter, setReviewFilter] = useState('all');

  // Solution Explanation Collapsible
  const [explanationExpanded, setExplanationExpanded] = useState(true);

  // Zyvra AI Guru Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiContext, setAiContext] = useState('');
  const aiModalOpenRef = useRef(false);
  aiModalOpenRef.current = aiModalOpen;

  // Intercept Browser & Hardware Back button on Quiz Result page
  useEffect(() => {
    // Push sentinel state so hardware back triggers popstate instead of popping into the completed quiz route
    window.history.pushState({ zyvraPage: 'quiz_result' }, '', window.location.href);

    const handlePopState = () => {
      if (window.__zyvra_suppress_modal_pop) {
        window.__zyvra_suppress_modal_pop = false;
        return;
      }
      // 1. If AI Guru modal is open, dismiss it first without leaving the result page
      if (aiModalOpenRef.current) {
        setAiModalOpen(false);
        window.history.pushState({ zyvraPage: 'quiz_result' }, '', window.location.href);
        return;
      }

      // 2. Otherwise, navigate cleanly to returnTo with replace: true
      // This guarantees the student never sees the quiz submit page again
      navigate(returnTo, { replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, returnTo]);

  // Challenger 1v1 Match State
  const challenger = useMemo(() => {
    if (location.state?.challenger) return location.state.challenger;
    const params = new URLSearchParams(location.search);
    const cName = params.get('cName');
    const cScore = params.get('cScore');
    const cTotal = params.get('cTotal');
    const challengerId = params.get('challengerId');
    if (cName && (cScore !== null || challengerId)) {
      return {
        cName: decodeURIComponent(cName),
        cScore: cScore ? Number(cScore) : 0,
        cTotal: cTotal ? Number(cTotal) : 0,
        challengerId
      };
    }
    try {
      const stored = sessionStorage.getItem(`zyvra_challenge_${attemptId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  }, [location.state, location.search, attemptId]);

  const handleReattemptMistakes = () => {
    const mistakeQuestionIds = solutions
      .filter((item) => resolveSolutionStatus(item).isIncorrect)
      .map((item) => String(item.question?.id || item.id || item.question_id))
      .filter(Boolean);

    if (mistakeQuestionIds.length === 0) return;

    try {
      sessionStorage.setItem('zyvra_mistake_quiz_ids', JSON.stringify(mistakeQuestionIds));
    } catch (e) {
      console.warn('Unable to store mistake question ids:', e);
    }

    navigate(`/quiz/${result?.test_id || ''}?mode=mistakes_only&sourceAttempt=${attemptId}`, {
      state: { reattempt: true, returnTo, mode: 'mistakes_only', mistakeIds: mistakeQuestionIds }
    });
  };

  // Guesswork Risk Analyzer (Tukke ka Sach)
  const guesses = useMemo(() => {
    if (Array.isArray(location.state?.guesses)) return new Set(location.state.guesses.map(String));
    try {
      const stored = sessionStorage.getItem(`zyvra_guesses_${attemptId}`);
      if (stored) return new Set(JSON.parse(stored).map(String));
    } catch {}
    return new Set();
  }, [location.state, attemptId]);

  // Silly Mistake Tags: Map of origIndex -> 'concept' | 'not_missed' | 'hurry'
  const [mistakeTags, setMistakeTags] = useState(() => {
    try {
      const stored = localStorage.getItem(`zyvra_mistake_tags_${attemptId}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const setQuestionMistakeTag = (idx, tag) => {
    setMistakeTags((prev) => {
      const next = { ...prev, [idx]: prev[idx] === tag ? null : tag };
      try {
        localStorage.setItem(`zyvra_mistake_tags_${attemptId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const sillyMistakeSummary = useMemo(() => {
    const entries = Object.entries(mistakeTags).filter(([, v]) => Boolean(v));
    if (!entries.length) return null;
    const totalTagged = entries.length;
    let notMissed = 0;
    let hurry = 0;
    entries.forEach(([, tag]) => {
      if (tag === 'not_missed') notMissed += 1;
      if (tag === 'hurry') hurry += 1;
    });
    const sillyCount = notMissed + hurry;
    const sillyPercent = Math.round((sillyCount / totalTagged) * 100);
    return { totalTagged, sillyCount, sillyPercent };
  }, [mistakeTags]);

  // Audio Walkman State & Speech Synthesis
  const [walkmanOpen, setWalkmanOpen] = useState(false);
  const [walkmanPlaying, setWalkmanPlaying] = useState(false);
  const [walkmanIndex, setWalkmanIndex] = useState(0);

  const mistakeSolutions = useMemo(() => {
    return solutions.filter((item) => !resolveSolutionStatus(item).isCorrect);
  }, [solutions]);

  const speakCurrentMistake = useCallback((idx) => {
    stopSpeech();

    const item = mistakeSolutions[idx];
    if (!item) {
      setWalkmanPlaying(false);
      return;
    }

    const question = item.question || item;
    const qText = language === 'hi'
      ? (question.question_text_hi || getStoredHindi(question.question_text) || question.question_text_en || '')
      : (question.question_text_en || getLocalizedEnglish(question.question_text) || '');
    const correctKey = normalizeCorrectAnswer(item.correct_answer || question.correct_answer, question.options);
    const selected = item.student_selected ?? item.selected_option ?? null;
    const chosenKey = Array.isArray(selected) ? selected[0] : selected;
    const rawExplanation = item.explanation || question.explanation || '';
    const cleanExpl = String(rawExplanation).replace(/[*#_`]/g, '').slice(0, 250);

    const textToSpeak = language === 'hi'
      ? `सवाल नंबर ${idx + 1}. ${qText}. आपका उत्तर था ${chosenKey ? `विकल्प ${chosenKey}` : 'छोड़ा गया'}. सही उत्तर है विकल्प ${correctKey}. मुख्य बिंदु: ${cleanExpl}`
      : `Question ${idx + 1}. ${qText}. Your selection was ${chosenKey ? `Option ${chosenKey}` : 'Skipped'}. The correct answer is Option ${correctKey}. Explanation: ${cleanExpl}`;

    // Background pre-fetch next question's audio so playback transitions with 0ms delay!
    if (idx + 1 < mistakeSolutions.length) {
      const nextItem = mistakeSolutions[idx + 1];
      const nextQ = nextItem.question || nextItem;
      const nextQText = language === 'hi'
        ? (nextQ.question_text_hi || getStoredHindi(nextQ.question_text) || nextQ.question_text_en || '')
        : (nextQ.question_text_en || getLocalizedEnglish(nextQ.question_text) || '');
      const nextCorrectKey = normalizeCorrectAnswer(nextItem.correct_answer || nextQ.correct_answer, nextQ.options);
      const nextSelected = nextItem.student_selected ?? nextItem.selected_option ?? null;
      const nextChosenKey = Array.isArray(nextSelected) ? nextSelected[0] : nextSelected;
      const nextExpl = String(nextItem.explanation || nextQ.explanation || '').replace(/[*#_`]/g, '').slice(0, 250);
      const nextText = language === 'hi'
        ? `सवाल नंबर ${idx + 2}. ${nextQText}. आपका उत्तर था ${nextChosenKey ? `विकल्प ${nextChosenKey}` : 'छोड़ा गया'}. सही उत्तर है विकल्प ${nextCorrectKey}. मुख्य बिंदु: ${nextExpl}`
        : `Question ${idx + 2}. ${nextQText}. Your selection was ${nextChosenKey ? `Option ${nextChosenKey}` : 'Skipped'}. The correct answer is Option ${nextCorrectKey}. Explanation: ${nextExpl}`;
      preloadAudio(nextText, language === 'hi' ? 'hi' : 'en');
    }

    playRealisticSpeech(textToSpeak, {
      lang: language === 'hi' ? 'hi' : 'en',
      onStart: () => setWalkmanPlaying(true),
      onEnd: () => {
        if (idx + 1 < mistakeSolutions.length) {
          setWalkmanIndex(idx + 1);
          speakCurrentMistake(idx + 1);
        } else {
          setWalkmanPlaying(false);
        }
      },
      onError: () => setWalkmanPlaying(false)
    });
  }, [mistakeSolutions, language]);

  const toggleWalkmanPlay = () => {
    if (walkmanPlaying) {
      stopSpeech();
      setWalkmanPlaying(false);
    } else {
      speakCurrentMistake(walkmanIndex);
    }
  };

  const closeWalkman = () => {
    stopSpeech();
    setWalkmanPlaying(false);
    setWalkmanOpen(false);
  };

  // Clean up any ongoing speech on component unmount
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const openAiForQuestion = (solItem) => {
    if (!solItem) return;
    const q = solItem.question || solItem;
    const qText = language === 'hi' ? (q.question_text_hi || q.question_text) : (q.question_text || q.question_text_hi);
    const optionsList = getOptionEntries(q.options || solItem.options);
    const optionsStr = optionsList.map(([k, v]) => {
      const val = typeof v === 'object' ? (language === 'hi' ? v.hi || v.text_hi || v.en || v.text : v.en || v.text) : v;
      return `${k}. ${val}`;
    }).join('\n');
    const correctKey = normalizeCorrectAnswer(solItem.correct_answer || q.correct_answer, q.options || solItem.options);
    const studentSel = solItem.student_selected || solItem.selected_option || solItem.response?.selected_option || null;
    const hasSelection = Boolean(studentSel);

    const contextStr = `Exam: ${result?.test_title || 'Mock Test'}\nQuestion:\n${qText}\n\nOptions:\n${optionsStr}\n\nCorrect Answer: Option ${correctKey}\nStudent Answer: ${hasSelection ? `Option ${studentSel}` : 'Skipped / Unanswered'}`;
    
    const promptStr = !hasSelection
      ? (language === 'hi'
          ? `मैंने यह प्रश्न छोड़ दिया था क्योंकि मुझे इसमें संदेह था। कृपया इसका मूल कॉन्सेप्ट, सही उत्तर (विकल्प ${correctKey}) और इसे परीक्षा में तुरंत हल करने का आसान तरीका समझाएं।`
          : `I skipped this question due to doubt. Please explain the core concept, why Option ${correctKey} is correct, and an easy method to solve it.`)
      : (language === 'hi'
          ? `मैंने इस प्रश्न में विकल्प ${studentSel} चुना जो गलत था, जबकि सही उत्तर विकल्प ${correctKey} है। कृपया मुझे बताएं कि मेरी सोच में क्या चूक हुई, सही उत्तर के पीछे का कॉन्सेप्ट क्या है, और इसे याद रखने की ट्रिक क्या है।`
          : `I selected Option ${studentSel} which was incorrect; the correct answer is Option ${correctKey}. Please explain where my reasoning went wrong, the core concept, and a memory tip to never miss this.`);

    setAiContext(contextStr);
    setAiPrompt(promptStr);
    setAiModalOpen(true);
  };

  // Bookmark state
  const [bookmarked, setBookmarked] = useState(() => {
    try {
      const bm = JSON.parse(localStorage.getItem('zyvra_bookmarks') || '[]');
      return Array.isArray(bm) && bm.some((b) => b.attemptId === attemptId || b.id === attemptId);
    } catch {
      return false;
    }
  });

  const toggleBookmark = () => {
    try {
      const bm = JSON.parse(localStorage.getItem('zyvra_bookmarks') || '[]');
      const list = Array.isArray(bm) ? bm : [];
      let next;
      if (bookmarked) {
        next = list.filter((b) => b.attemptId !== attemptId && b.id !== attemptId);
        setBookmarked(false);
      } else {
        next = [...list, { id: attemptId, attemptId, user_id: user?.id || null, title: result?.title || result?.test_title || 'Quiz Result', type: 'test_result', savedAt: new Date().toISOString() }];
        setBookmarked(true);
      }
      localStorage.setItem('zyvra_bookmarks', JSON.stringify(next));
    } catch (e) {
      console.warn('Unable to toggle bookmark:', e);
    }
  };

  // Peer Benchmarking Stats
  const [peerStats, setPeerStats] = useState(null);
  const [loadingPeerStats, setLoadingPeerStats] = useState(false);

  // Mistake Notebook Sync State
  const [mistakeSavedIds, setMistakeSavedIds] = useState(() => {
    try {
      const list = readMistakesLocal(user?.id);
      return new Set(list.map((item) => String(item.questionId || item.id)));
    } catch {
      return new Set();
    }
  });
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleSaveToMistakeNotebook = async (question, currentParsed, chosenKey, correctKey, isCorrect) => {
    const qId = String(question.id || currentSolution?.question_id || `q-${currentSolutionIndex}`);
    const options = getOptionEntries(question.options);
    const correctOptObj = options.find(([k]) => k === correctKey);
    const chosenOptObj = options.find(([k]) => k === chosenKey);
    const correctText = correctOptObj
      ? (language === 'hi' ? getStoredHindi(correctOptObj[1]) || getLocalizedEnglish(correctOptObj[1]) : getLocalizedEnglish(correctOptObj[1]))
      : '';
    const chosenText = chosenOptObj
      ? (language === 'hi' ? getStoredHindi(chosenOptObj[1]) || getLocalizedEnglish(chosenOptObj[1]) : getLocalizedEnglish(chosenOptObj[1]))
      : '';

    const qText = language === 'hi'
      ? (question.question_text_hi || getStoredHindi(question.question_text) || question.text_hi || question.text || '')
      : (question.question_text_en || getLocalizedEnglish(question.question_text) || question.text || '');

    const mistakeDesc = isCorrect
      ? `Q: ${String(qText).slice(0, 220)}`
      : chosenKey
      ? `Selected: Option ${chosenKey} ("${String(chosenText).slice(0, 80)}")\nQ: ${String(qText).slice(0, 200)}`
      : `Question Skipped / Not Attempted\nQ: ${String(qText).slice(0, 200)}`;

    const correctDesc = `Correct: Option ${correctKey} ("${String(correctText).slice(0, 80)}")\n${(currentParsed?.mainExplanation || '').slice(0, 250)}`;

    const res = await saveMistakeToNotebook({
      userId: user?.id,
      topic: question.subject || result?.title || 'Exam Revision',
      mistake: mistakeDesc,
      correctAnswer: correctDesc,
      questionId: qId,
      testTitle: result?.title || result?.test_title || 'Mock Test',
      entryType: isCorrect ? 'review' : 'mistake',
      isCorrect: Boolean(isCorrect)
    });

    if (res.limitReached) {
      setToastMessage({
        type: 'warning',
        text: language === 'hi'
          ? 'मुफ्त सीमा समाप्त (5/5)। असीमित टेस्ट गलतियां सहेजने के लिए Toolbox में Pro अनलॉक करें!'
          : 'Free Limit Reached (5/5). Unlock Pro in Toolbox for unlimited mistake saves!'
      });
    } else {
      setMistakeSavedIds((prev) => new Set([...prev, qId]));
      setToastMessage({
        type: 'success',
        text: language === 'hi'
          ? '✓ गलती नोटबुक में जोड़ा गया! अंतराल पर दोहराने के लिए तैयार।'
          : '✓ Saved to Mistake Notebook for Spaced Repetition!'
      });
    }
  };

  // Load Attempt Result from Supabase RPC
  useEffect(() => {
    let active = true;
    const loadResult = async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      let resultData = null;
      let answerRows = [];

      try {
        const { data, error: rpcError } = await supabase.rpc('get_test_attempt_result', {
          p_attempt_id: attemptId
        });
        if (rpcError) throw rpcError;

        const payload = unwrapRpcPayload(data);
        const root = normalizeRpcObject(data);
        resultData = Array.isArray(payload) ? root : { ...root, ...payload };
      } catch (rpcErr) {
        console.warn('get_test_attempt_result RPC error, attempting direct attempt fallback:', rpcErr);
        // Direct attempt query fallback for student accounts
        const { data: directAttempt, error: attemptErr } = await supabase
          .from('test_attempts')
          .select('*, tests(*)')
          .eq('id', attemptId)
          .maybeSingle();

        if (attemptErr || !directAttempt) {
          throw rpcErr || attemptErr || new Error('No result returned for this test attempt.');
        }

        resultData = {
          attempt_id: directAttempt.id,
          test_id: directAttempt.test_id,
          test_title: directAttempt.tests?.title || 'Test Result',
          score: directAttempt.score || 0,
          total_marks: directAttempt.max_score || directAttempt.total_marks || 0,
          percentage: directAttempt.percentage || 0,
          total_questions: directAttempt.total_questions || 0,
          attempted_count: directAttempt.attempted_count || 0,
          correct_count: directAttempt.correct_count || 0,
          incorrect_count: directAttempt.incorrect_count || 0,
          skipped_with_e_count: directAttempt.skipped_with_e_count || 0,
          time_spent_seconds: directAttempt.time_spent_seconds || 0,
          solutions: [],
          details_unavailable: true
        };
      }

      if (!resultData || !Object.keys(resultData).length) {
        throw new Error('No result returned for this test attempt.');
      }

      answerRows =
        resultData.solutions ||
        resultData.questions ||
        resultData.answers ||
        [];

      if (!active) return;
      setResult(resultData);
      if (resultData.peer_stats) {
        setPeerStats(resultData.peer_stats);
      }
      setSolutions(Array.isArray(answerRows) ? answerRows : []);
      refreshAccount().catch((err) => console.error('Account refresh error:', err));
      setLoading(false);
    };

    loadResult().catch((err) => {
      if (active) {
        setError(getFriendlyErrorMessage(err, 'Unable to load test result.'));
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [supabase, attemptId, refreshAccount]);

  // Processed scorecard numbers
  const scorecard = useMemo(() => {
    return result ? (result.scorecard || result.summary || result) : {};
  }, [result]);
  const score = Number(valueOf(scorecard, 'score', 'total_score', 'final_score')) || 0;
  const totalMarks = Number(valueOf(scorecard, 'total_marks', 'max_score', 'max_marks')) || 0;
  const rawPercentage = Number(valueOf(scorecard, 'percentage', 'score_percentage'));
  const percentage = rawPercentage > 0 && rawPercentage <= 1
    ? Math.round(rawPercentage * 100)
    : (rawPercentage || (totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0));

  // Load Peer Benchmark Data if not provided by result
  useEffect(() => {
    let active = true;
    if (result?.peer_stats) {
      setPeerStats(result.peer_stats);
      return;
    }

    const testId = result?.test_id;
    if (!testId || !supabase) return;

    setLoadingPeerStats(true);
    const fetchPeerStats = async () => {
      try {
        const { data: rpcStats, error: rpcErr } = await supabase.rpc('get_test_peer_benchmarks', {
          p_attempt_id: attemptId
        });
        if (!rpcErr && rpcStats) {
          if (active) setPeerStats(rpcStats);
          return;
        }

        // Direct table query fallback
        const { data: attempts, error: fetchErr } = await supabase
          .from('test_attempts')
          .select('id, user_id, score, status, submitted_at, completed_at, created_at')
          .eq('test_id', testId)
          .in('status', ['submitted', 'completed', 'graded', 'finished']);

        if (!fetchErr && Array.isArray(attempts) && attempts.length > 0) {
          const userScore = Number(valueOf(scorecard, 'score', 'total_score', 'final_score')) || 0;
          const latestByStudent = new Map();
          attempts.forEach((attempt) => {
            if (!attempt.user_id || attempt.user_id === user?.id) return;
            const timestamp = Date.parse(attempt.submitted_at || attempt.completed_at || attempt.created_at || '') || 0;
            const previous = latestByStudent.get(attempt.user_id);
            if (!previous || timestamp > previous.timestamp) {
              latestByStudent.set(attempt.user_id, { score: Number(attempt.score) || 0, timestamp });
            }
          });
          const peers = Array.from(latestByStudent.values());
          const peerCount = peers.length;
          const avgScore = peerCount
            ? Math.round((peers.reduce((sum, peer) => sum + peer.score, 0) / peerCount) * 10) / 10
            : userScore;
          const percentile = peerCount
            ? Math.round((peers.filter((peer) => peer.score <= userScore).length / peerCount) * 100)
            : 100;

          if (active) {
            setPeerStats({
              total_attempts: peerCount + 1,
              average_score: avgScore,
              percentile,
              score_diff: Math.round((userScore - avgScore) * 10) / 10
            });
          }
        }
      } catch (e) {
        console.warn('Unable to load peer stats:', e);
      } finally {
        if (active) setLoadingPeerStats(false);
      }
    };

    fetchPeerStats();
    return () => { active = false; };
  }, [result?.peer_stats, result?.test_id, attemptId, supabase, scorecard, user?.id]);

  const currentSolution = solutions[currentSolutionIndex] || null;
  const totalQuestions = Number(valueOf(scorecard, 'total_questions', 'question_count')) || solutions.length;

  // Calculated stats across questions
  const stats = useMemo(() => {
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    solutions.forEach((item) => {
      const status = resolveSolutionStatus(item);
      if (status.isCorrect) correctCount += 1;
      else if (status.isIncorrect) incorrectCount += 1;
      else unattemptedCount += 1;
    });

    if (solutions.length === 0) {
      return {
        correctCount: Number(valueOf(scorecard, 'correct_count', 'correct')) || 0,
        incorrectCount: Number(valueOf(scorecard, 'incorrect_count', 'incorrect')) || 0,
        unattemptedCount: Number(valueOf(scorecard, 'unattempted_count', 'skipped_with_e_count', 'skipped_count', 'unanswered_count')) || Math.max(0, totalQuestions - (Number(valueOf(scorecard, 'attempted_count')) || 0))
      };
    }

    return { correctCount, incorrectCount, unattemptedCount };
  }, [solutions, scorecard, totalQuestions]);

  // Guesswork Risk Analyzer Report
  const guessworkReport = useMemo(() => {
    if (!guesses.size || !solutions.length) return null;
    let guessedCorrect = 0;
    let guessedIncorrect = 0;

    solutions.forEach((item, idx) => {
      const qId = String(item.question?.id || item.id || item.question_id || `q-${idx}`);
      if (!guesses.has(qId)) return;

      const status = resolveSolutionStatus(item);
      if (status.isCorrect) guessedCorrect += 1;
      else if (status.isIncorrect) guessedIncorrect += 1;
    });

    const totalGuessed = guessedCorrect + guessedIncorrect;
    if (totalGuessed === 0) return null;

    const marksPerQuestion = totalMarks > 0 && totalQuestions > 0 ? totalMarks / totalQuestions : 1;
    const penaltyPerQuestion = marksPerQuestion / 3;
    const gainedMarks = Math.round((guessedCorrect * marksPerQuestion + Number.EPSILON) * 10) / 10;
    const lostMarks = Math.round((guessedIncorrect * penaltyPerQuestion + Number.EPSILON) * 10) / 10;
    const netMarks = Math.round((gainedMarks - lostMarks + Number.EPSILON) * 10) / 10;
    const accuracy = Math.round((guessedCorrect / totalGuessed) * 100);

    return { totalGuessed, guessedCorrect, guessedIncorrect, gainedMarks, lostMarks, netMarks, accuracy };
  }, [guesses, solutions, totalMarks, totalQuestions]);

  // Auto-save Mistakes to Notebook (Auto Mistake Bank)
  const autoSavedRef = useRef(false);
  useEffect(() => {
    if (!solutions.length || autoSavedRef.current || !user?.id) return;
    autoSavedRef.current = true;

    const wrongList = solutions.filter((item) => resolveSolutionStatus(item).isIncorrect);

    if (wrongList.length > 0) {
      const toSave = wrongList.slice(0, 10);
      Promise.all(toSave.map(async (item, idx) => {
        const question = item.question || item;
        const qId = String(question.id || item.question_id || `q-${idx}`);
        const status = resolveSolutionStatus(item);

        await saveMistakeToNotebook({
          userId: user.id,
          topic: question.subject || result?.title || 'Exam Revision',
          mistake: `Selected: Option ${status.chosenKey || 'None'}\nQ: ${(question.question_text || question.text || '').slice(0, 150)}`,
          correctAnswer: `Correct: Option ${status.correctKey || 'N/A'}\n${(item.explanation || '').slice(0, 150)}`,
          questionId: qId,
          testTitle: result?.test_title || 'Mock Test'
        }).catch(() => {});

        return qId;
      })).then((savedIds) => {
        setMistakeSavedIds((prev) => new Set([...prev, ...savedIds.filter(Boolean)]));
      });
    }
  }, [solutions, user?.id, result]);

  // Stored per-question time fallback from LiveQuiz localStorage
  const storedTimeMap = useMemo(() => {
    try {
      const raw = localStorage.getItem(`zyvra_attempt_timespent_${attemptId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [attemptId]);

  // Helper to resolve per-question time_spent_seconds
  const getQuestionTimeSpent = (item) => {
    const qId = item?.question_id || item?.question?.id || item?.id;
    const dbTime = Number(item?.time_spent_seconds || 0);
    if (dbTime > 0) return dbTime;
    const localTime = qId ? Number(storedTimeMap?.[qId] || 0) : 0;
    return localTime > 0 ? localTime : 0;
  };

  // Topic Analysis Aggregate: Real Question Grouping by Tags/Subject/Topic + Time
  const topicAnalysis = useMemo(() => {
    const map = new Map();
    solutions.forEach((item) => {
      const question = item.question || item;
      let topic = null;
      const rawTags = question.tags;
      let tagsList = [];
      if (Array.isArray(rawTags)) {
        tagsList = rawTags;
      } else if (typeof rawTags === 'string') {
        try {
          const parsed = JSON.parse(rawTags);
          if (Array.isArray(parsed)) tagsList = parsed;
          else tagsList = rawTags.split(',').map((s) => s.trim());
        } catch {
          tagsList = rawTags.split(',').map((s) => s.trim());
        }
      }

      const genericTagSet = new Set(['both', 'practice_only', 'test_only', 'mcq', 'statement', 'match', 'assertion_reason', 'bpsc', 'upsc', 'ncert', 'a', 'b', 'c', 'd', 'e']);
      const validTags = tagsList
        .map((t) => String(t || '').trim())
        .filter((t) => t.length > 1 && !genericTagSet.has(t.toLowerCase()));

      if (validTags.length > 0) {
        topic = humanizeTopicName(validTags[0]);
      } else {
        topic = humanizeTopicName(question.topic || question.subject || result?.chapter_title || result?.test_title || 'General Concepts');
      }

      if (!map.has(topic)) {
        map.set(topic, { total: 0, correct: 0, incorrect: 0, unattempted: 0, timeSpent: 0 });
      }
      const entry = map.get(topic);
      entry.total += 1;
      entry.timeSpent += getQuestionTimeSpent(item);

      const status = resolveSolutionStatus(item);

      if (status.isCorrect) entry.correct += 1;
      else if (status.isIncorrect) entry.incorrect += 1;
      else entry.unattempted += 1;
    });

    if (map.size === 0) {
      return [];
    }

    return Array.from(map.entries()).map(([topic, data]) => ({
      topic,
      ...data,
      avgTime: data.total > 0 ? Math.round(data.timeSpent / data.total) : 0,
      accuracy: Math.round((data.correct / Math.max(1, data.total)) * 100)
    })).sort((a, b) => b.total - a.total);
  }, [solutions, result, storedTimeMap]);

  // Difficulty Breakdown: Easy / Medium / Hard / Standard
  const difficultyAnalysis = useMemo(() => {
    const map = new Map();
    solutions.forEach((item) => {
      const question = item.question || item;
      const rawDiff = String(question.difficulty || question.difficulty_level || item.difficulty || '').trim().toLowerCase();
      let label = 'Standard';
      if (['easy', 'basic', 'beginner', 'simple'].includes(rawDiff)) label = 'Easy';
      else if (['medium', 'moderate', 'intermediate'].includes(rawDiff)) label = 'Medium';
      else if (['hard', 'difficult', 'tough', 'advanced'].includes(rawDiff)) label = 'Hard';

      if (!map.has(label)) {
        map.set(label, { difficulty: label, total: 0, correct: 0, incorrect: 0, unattempted: 0, timeSpent: 0 });
      }
      const entry = map.get(label);
      entry.total += 1;
      entry.timeSpent += getQuestionTimeSpent(item);

      const status = resolveSolutionStatus(item);
      if (status.isCorrect) entry.correct += 1;
      else if (status.isIncorrect) entry.incorrect += 1;
      else entry.unattempted += 1;
    });

    const order = { Easy: 1, Medium: 2, Hard: 3, Standard: 4 };
    return Array.from(map.values())
      .map((d) => ({
        ...d,
        avgTime: d.total > 0 ? Math.round(d.timeSpent / d.total) : 0,
        accuracy: Math.round((d.correct / Math.max(1, d.total)) * 100)
      }))
      .sort((a, b) => (order[a.difficulty] || 9) - (order[b.difficulty] || 9));
  }, [solutions, storedTimeMap]);

  // Per-question time breakdown
  const questionTimingRows = useMemo(() => {
    return solutions.map((item, idx) => {
      const question = item.question || item;
      const status = resolveSolutionStatus(item);
      const timeSpent = getQuestionTimeSpent(item);
      const rawDiff = String(question.difficulty || question.difficulty_level || item.difficulty || '').trim();
      const topic = humanizeTopicName(question.topic || question.subject || 'General');
      return {
        index: idx,
        timeSpent,
        topic,
        difficulty: rawDiff ? rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase() : 'Standard',
        status
      };
    });
  }, [solutions, storedTimeMap]);

  // Filtered Questions for Review List
  const filteredSolutions = useMemo(() => {
    return solutions.filter((item) => {
      const status = resolveSolutionStatus(item);
      if (reviewFilter === 'correct') return status.isCorrect;
      if (reviewFilter === 'incorrect') return status.isIncorrect;
      if (reviewFilter === 'unattempted') return status.isUnattempted;
      return true;
    });
  }, [solutions, reviewFilter]);

  // Current Solution Parsing
  const currentParsed = useMemo(() => {
    if (!currentSolution) return null;
    const question = currentSolution.question || currentSolution;
    const rawExplanation = currentSolution.explanation || question.explanation || '';
    const distractorNotes = question.distractor_notes;
    const reference = question.reference || question.source;

    return parseStructuredExplanation(rawExplanation, distractorNotes, reference, language, question);
  }, [currentSolution, language]);

  const testTitle = result?.test_title || result?.title || 'Human Physiology • Chapter Test';

  const handleWhatsAppChallenge = () => {
    const studentName = user?.user_metadata?.full_name || user?.user_metadata?.name || (appLanguage === 'hi' ? 'आपके साथी छात्र' : 'Your study partner');
    const challengeUrl = `${window.location.origin}/quiz/${result?.test_id || ''}?challengerId=${attemptId}&cName=${encodeURIComponent(studentName)}&cScore=${formatScore(score)}&cTotal=${totalMarks || totalQuestions}`;
    
    const msg = appLanguage === 'hi'
      ? `🔥 मैंने Zyvra पर '${testTitle}' में ${formatScore(score)}/${totalMarks || totalQuestions} (${percentage}%) अंक प्राप्त किए!\n\nक्या तुम मुझे 1v1 मुकाबले में हरा सकते हो? यहाँ क्लिक करके ठीक यही टेस्ट दो और अपने स्कोर की तुलना करो:\n${challengeUrl}`
      : `🔥 I scored ${formatScore(score)}/${totalMarks || totalQuestions} (${percentage}%) in '${testTitle}' on Zyvra!\n\nCan you beat my score? Click the link to take the exact same test in a 1v1 challenge:\n${challengeUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <main className="min-h-screen dark:bg-[#0B1120] bg-slate-50 flex items-center justify-center p-6 dark:text-white text-slate-800">
        <LoadingSkeleton rows={6} />
      </main>
    );
  }

  if (error && !result) {
    return (
      <main className="min-h-screen dark:bg-[#0B1120] bg-slate-50 flex items-center justify-center p-6 dark:text-white text-slate-800">
        <div className="dark:bg-[#1E293B] bg-white border dark:border-red-500/30 border-red-300 rounded-3xl p-6 max-w-md text-center shadow-sm">
          <AlertCircle size={28} className="mx-auto text-red-500 mb-2" />
          <h2 className="text-lg font-bold">Result Unavailable</h2>
          <p className="text-xs dark:text-slate-400 text-slate-600 mt-1 mb-4">{error}</p>
          <Link to="/tests" replace className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back to Tests
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-900 transition-colors duration-200 overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 dark:bg-[#0B1120]/95 bg-white/95 backdrop-blur-md border-b dark:border-slate-800 border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/tests', { replace: true })}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-white text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Back to tests"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-xl leading-none">⚡</span>
              <div>
                <span className="dark:text-white text-slate-900 font-black tracking-wider text-xs sm:text-sm block">Zyvra</span>
                <span className="dark:text-slate-400 text-slate-600 text-[10px] font-bold block truncate max-w-[170px] sm:max-w-xs">
                  {testTitle}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={appLanguage === 'hi' ? 'प्रिंट या PDF सेव करें' : 'Print / Save PDF Cheat Sheet'}
              aria-label="Print sheet"
            >
              <Printer size={15} />
            </button>
            <button
              type="button"
              onClick={toggleBookmark}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark result'}
            >
              <Bookmark size={15} className={bookmarked ? 'fill-amber-400 text-amber-500' : ''} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: testTitle, url: window.location.href }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Share"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6">
        {/* Navigation Tabs (Review Questions | Solutions | Topic Analysis | Compare) */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl dark:bg-[#1E293B]/90 bg-white border dark:border-slate-700/60 border-slate-200 backdrop-blur-md overflow-x-auto select-none shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`flex-1 min-w-[75px] sm:min-w-[110px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'review'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{appLanguage === 'hi' ? 'समीक्षा' : 'Review'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('solutions')}
            className={`flex-1 min-w-[75px] sm:min-w-[110px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'solutions'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Lightbulb size={14} />
            <span>{appLanguage === 'hi' ? 'समाधान' : 'Solutions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 min-w-[85px] sm:min-w-[120px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'analysis'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 size={14} />
            <span>{appLanguage === 'hi' ? 'विश्लेषण' : 'Analysis'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`flex-1 min-w-[75px] sm:min-w-[100px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'compare'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Trophy size={14} />
            <span>{appLanguage === 'hi' ? 'तुलना' : 'Compare'}</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: QUESTION REVIEW */}
        {/* ======================================================== */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {/* 1v1 Challenger Battle Result Card (When in a 1v1 Match) */}
            {challenger && (
              <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 uppercase tracking-wider flex items-center gap-1">
                    <Swords size={13} />
                    <span>1v1 मुकाबला परिणाम</span>
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {score > challenger.cScore ? 'आप जीत गए!' : score === challenger.cScore ? 'मुकाबला टाई रहा!' : 'चैलेंजर आगे रहा'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-2xl dark:bg-slate-900/80 bg-white/90 border dark:border-slate-800 border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">चैलेंजर ({challenger.cName})</span>
                    <span className="text-xl sm:text-2xl font-black dark:text-white text-slate-900">{formatScore(challenger.cScore)}</span>
                    <span className="text-[11px] text-slate-400 block font-semibold">/ {challenger.cTotal || totalMarks || totalQuestions}</span>
                  </div>

                  <div className={`p-3 rounded-2xl border text-center ${score >= challenger.cScore ? 'dark:bg-emerald-950/40 bg-emerald-50/80 border-emerald-500/40' : 'dark:bg-slate-900/80 bg-white/90 dark:border-slate-800 border-slate-200'}`}>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">आप (You)</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-500 dark:text-emerald-400">{formatScore(score)}</span>
                    <span className="text-[11px] text-slate-400 block font-semibold">/ {totalMarks || totalQuestions}</span>
                  </div>
                </div>

                <p className="text-xs font-bold text-center dark:text-amber-300 text-amber-800">
                  {score > challenger.cScore
                    ? `अद्भुत प्रदर्शन! आपने ${challenger.cName} को ${formatScore(Math.abs(score - challenger.cScore))} अंकों से पछाड़ दिया!`
                    : score === challenger.cScore
                    ? `दोनों के बीच बराबरी की टक्कर! दोनों ने ${formatScore(score)} अंक प्राप्त किए।`
                    : `कड़ा मुकाबला! ${challenger.cName} आपसे ${formatScore(Math.abs(challenger.cScore - score))} अंक आगे रहे। दोबारा प्रयास करके स्कोर बीट करें!`}
                </p>
              </div>
            )}

            {/* Score Ring Gauge + Honest Result Summary */}
            <div className="relative overflow-hidden dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm transition-all">
              {/* Lottie Confetti Burst for Good Scores Only */}
              {percentage >= 60 && (
                <div className="absolute -top-4 -right-4 sm:right-10 pointer-events-none z-0 opacity-80">
                  <LottiePlayer
                    animationData={celebrationAnimationData}
                    className="w-36 h-36 sm:w-44 sm:h-44"
                    loop={false}
                  />
                </div>
              )}

              {(() => {
                const clampedPct = Math.max(0, Math.min(100, Number(percentage) || 0));
                const radius = 32;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (clampedPct / 100) * circumference;
                const ringColor = clampedPct >= 75 ? '#10b981' : clampedPct >= 45 ? '#f59e0b' : '#f43f5e';
                const weakestCount = topicAnalysis.filter((t) => t.accuracy < 60).length;
                const totalSeconds = Number(result?.time_spent_seconds || 0) || solutions.reduce((sum, s) => sum + getQuestionTimeSpent(s), 0);
                const timeLabel = totalSeconds >= 60
                  ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
                  : totalSeconds > 0 ? `${totalSeconds}s` : null;

                const headline = percentage >= 80
                  ? (appLanguage === 'hi' ? 'शानदार प्रदर्शन!' : 'Excellent Mastery!')
                  : percentage >= 50
                  ? (appLanguage === 'hi' ? 'अच्छा प्रयास — अब 80%+ का लक्ष्य' : 'Solid Effort — Let’s Push Past 80%')
                  : (appLanguage === 'hi'
                      ? `${percentage}% — आइए कमज़ोर टॉपिक्स सुधारें`
                      : `${percentage}% — Let’s Fix ${weakestCount > 0 ? `Your ${weakestCount} Weakest Topic${weakestCount > 1 ? 's' : ''}` : 'Your Mistakes'}`);

                return (
                  <>
                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        {/* SVG Score Ring Gauge */}
                        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                            <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200 dark:text-slate-800" />
                            <circle
                              cx="40"
                              cy="40"
                              r={radius}
                              fill="none"
                              stroke={ringColor}
                              strokeWidth="7"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                            />
                          </svg>
                          <span className="absolute text-sm font-black dark:text-white text-slate-900 tabular-nums">
                            {percentage}%
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h2 className="text-base sm:text-xl font-black dark:text-white text-slate-900 tracking-tight">
                            {headline}
                          </h2>
                          <p className="text-xs sm:text-sm font-semibold dark:text-slate-300 text-slate-700">
                            {percentage >= 80
                              ? (appLanguage === 'hi' ? 'आपकी तैयारी बहुत मजबूत है। अगली श्रेणी की ओर बढ़ें।' : 'Strong accuracy across sections. Keep the momentum going.')
                              : percentage >= 50
                              ? (appLanguage === 'hi' ? 'गलत प्रश्नों को दोहराकर स्कोर 80%+ तक ले जाएं।' : 'Review your incorrect answers below to lock in these concepts.')
                              : (appLanguage === 'hi' ? 'अभी हार न मानें — गलत सवालों का दोबारा अभ्यास और समाधान देखें।' : 'Focus on reviewing solutions and retrying the questions you missed.')}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-bold">
                            {timeLabel && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                <Clock3 size={12} /> {timeLabel}
                              </span>
                            )}
                            {currentStreak > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
                                <Flame size={12} /> {currentStreak}d {appLanguage === 'hi' ? 'स्ट्रीक' : 'Streak'}
                              </span>
                            )}
                            {peerStats?.percentile !== undefined && peerStats.total_attempts > 1 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                                <Target size={12} /> {peerStats.percentile}% {appLanguage === 'hi' ? 'परसेंटाइल' : 'Percentile'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Coins Earned Badge (only when actually credited) */}
                      {Number(result?.coins_awarded || 0) > 0 && (
                        <div className="w-full sm:w-auto flex items-center sm:flex-col items-end justify-between sm:justify-center p-2.5 sm:px-4 sm:py-2 rounded-2xl bg-amber-500/10 border border-amber-400/30 shadow-xs shrink-0">
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black text-xs sm:text-sm">
                            <Coins size={16} className="text-amber-500" />
                            <span>+{Number(result.coins_awarded)} ZYVRA {appLanguage === 'hi' ? 'कॉइन्स' : 'Coins'}</span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-700/80 dark:text-amber-300/80">
                            {appLanguage === 'hi' ? 'वॉलेट में जोड़े गए' : 'Added to Wallet'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Primary Recovery CTAs Above the Fold */}
                    <div className="relative z-10 mt-4 pt-3.5 border-t dark:border-slate-800 border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {stats.incorrectCount > 0 ? (
                        <button
                          type="button"
                          onClick={handleReattemptMistakes}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] shadow-sm cursor-pointer"
                        >
                          <RotateCcw size={15} />
                          <span>
                            {appLanguage === 'hi'
                              ? `कमज़ोर सवाल सुधारें (${stats.incorrectCount} गलत)`
                              : `Retry Weakest Topics (${stats.incorrectCount} Mistakes)`}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setCurrentSolutionIndex(0); setActiveTab('solutions'); }}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] shadow-sm cursor-pointer"
                        >
                          <BookOpen size={15} />
                          <span>{appLanguage === 'hi' ? 'विस्तृत समाधान देखें' : 'View Detailed Solutions'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setCurrentSolutionIndex(0); setActiveTab('solutions'); }}
                        className="py-2.5 px-4 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                      >
                        <BookOpen size={15} />
                        <span>{appLanguage === 'hi' ? 'समाधान' : 'Solutions'}</span>
                      </button>

                      <Link
                        to={`/quiz/${result?.test_id || ''}`}
                        state={{ reattempt: true, returnTo }}
                        className="py-2.5 px-4 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <RotateCcw size={15} />
                        <span>{appLanguage === 'hi' ? 'पूरा टेस्ट दोबारा दें' : 'Full Re-attempt'}</span>
                      </Link>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* WhatsApp 1v1 Challenge Action Card */}
            <div className="p-3.5 sm:p-4 rounded-3xl dark:bg-emerald-950/20 bg-emerald-50/60 border border-emerald-500/25 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all hover:border-emerald-500/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Swords size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider border border-emerald-500/30">
                      {appLanguage === 'hi' ? '1v1 मुकाबला' : '1v1 Challenge'}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate mt-0.5">
                    {appLanguage === 'hi' ? 'किसी दोस्त को WhatsApp पर चुनौती दें' : 'Challenge a Study Partner on WhatsApp'}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate">
                    {appLanguage === 'hi' ? 'दोस्त ठीक यही टेस्ट देगा और दोनों का स्कोर सीधे आमने-सामने तुलना होगा।' : 'Your friend solves the exact same test to compare scores head-to-head.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWhatsAppChallenge}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shrink-0 shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              >
                <Share2 size={15} />
                <span>{appLanguage === 'hi' ? 'चुनौती भेजें' : 'Send Challenge'}</span>
              </button>
            </div>

            {/* Scorecard Grid */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3 dark:bg-[#1E293B]/85 bg-white backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm">
              <div className="text-center">
                <div className="text-[9px] sm:text-[10px] font-bold dark:text-slate-400 text-slate-500 uppercase">{appLanguage === 'hi' ? 'आपका स्कोर' : 'Your Score'}</div>
                <div className="text-base sm:text-2xl font-black dark:text-white text-slate-900 mt-0.5">
                  {formatScore(score)} <span className="text-xs font-semibold dark:text-slate-400 text-slate-500">/ {totalMarks || totalQuestions}</span>
                </div>
                <span className="inline-block mt-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {percentage}%
                </span>
              </div>

              <div className="text-center border-l dark:border-slate-700/60 border-slate-200">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                  <CheckCircle2 size={13} />
                </div>
                <div className="text-base sm:text-xl font-black dark:text-white text-slate-900">{stats.correctCount}</div>
                <div className="text-[9px] sm:text-[10px] font-semibold dark:text-slate-400 text-slate-500">{appLanguage === 'hi' ? 'सही' : 'Correct'}</div>
              </div>

              <div className="text-center border-l dark:border-slate-700/60 border-slate-200">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-1">
                  <CircleX size={13} />
                </div>
                <div className="text-base sm:text-xl font-black dark:text-white text-slate-900">{stats.incorrectCount}</div>
                <div className="text-[9px] sm:text-[10px] font-semibold dark:text-slate-400 text-slate-500">{appLanguage === 'hi' ? 'गलत' : 'Incorrect'}</div>
              </div>

              <div className="text-center border-l dark:border-slate-700/60 border-slate-200">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-500/20 text-neutral-400 flex items-center justify-center mx-auto mb-1">
                  <MinusCircle size={13} />
                </div>
                <div className="text-base sm:text-xl font-black dark:text-white text-slate-900">{stats.unattemptedCount}</div>
                <div className="text-[9px] sm:text-[10px] font-semibold dark:text-slate-400 text-slate-500">{appLanguage === 'hi' ? 'छोड़े गए' : 'Skipped'}</div>
              </div>
            </div>

            {/* Guesswork Risk Analyzer Card (Tukke ka Sach) */}
            {guessworkReport && (
              <div className="p-4 rounded-3xl dark:bg-amber-950/20 bg-amber-50/60 border border-amber-500/25 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-amber-500" />
                    <h4 className="text-xs sm:text-sm font-black dark:text-amber-300 text-amber-800 uppercase tracking-wide">
                      {appLanguage === 'hi' ? 'तुक्के का सच (Guesswork Risk Analyzer)' : 'Guesswork Risk Analyzer'}
                    </h4>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${guessworkReport.netMarks >= 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'}`}>
                    {guessworkReport.netMarks >= 0 ? `+${guessworkReport.netMarks} Net Gain` : `${guessworkReport.netMarks} Net Loss`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-xl dark:bg-slate-900/60 bg-white/80 border dark:border-slate-800 border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 block">{appLanguage === 'hi' ? 'कुल तुक्के' : 'Guessed'}</span>
                    <span className="text-base sm:text-lg font-black dark:text-white text-slate-900">{guessworkReport.totalGuessed}</span>
                  </div>
                  <div className="p-2 rounded-xl dark:bg-emerald-950/30 bg-emerald-50/80 border dark:border-emerald-800/40 border-emerald-200 text-emerald-700 dark:text-emerald-300">
                    <span className="text-[10px] font-bold block">{appLanguage === 'hi' ? 'सही (+अंक)' : 'Correct (+)'}</span>
                    <span className="text-base sm:text-lg font-black">+{guessworkReport.gainedMarks}</span>
                  </div>
                  <div className="p-2 rounded-xl dark:bg-rose-950/30 bg-rose-50/80 border dark:border-rose-800/40 border-rose-200 text-rose-700 dark:text-rose-300">
                    <span className="text-[10px] font-bold block">{appLanguage === 'hi' ? 'गलत (-पेनल्टी)' : 'Wrong (-)'}</span>
                    <span className="text-base sm:text-lg font-black">-{guessworkReport.lostMarks}</span>
                  </div>
                </div>

                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 pt-0.5">
                  {guessworkReport.netMarks >= 0
                    ? (appLanguage === 'hi' ? '✓ तुक्के से आपको शुद्ध लाभ हुआ, लेकिन वास्तविक परीक्षा में नेगेटिव मार्किंग से सावधान रहें।' : '✓ Guesses gave a positive return, but stay cautious of negative marking.')
                    : (appLanguage === 'hi' ? '⚠️ तुक्कों की वजह से आपके अंक कट गए! परीक्षा में अनिश्चित सवालों को छोड़ने का अभ्यास करें।' : '⚠️ Negative marking reduced your total score! Practice leaving doubtful questions.')}
                </p>
              </div>
            )}

            {/* Silly Mistake X-Ray Diagnostic Card */}
            {sillyMistakeSummary && sillyMistakeSummary.sillyCount > 0 && (
              <div className="p-3.5 sm:p-4 rounded-3xl dark:bg-indigo-950/20 bg-indigo-50/60 border border-indigo-500/25 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Lightbulb size={20} className="text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <strong className="block text-xs sm:text-sm font-black dark:text-indigo-300 text-indigo-950 truncate">
                      {appLanguage === 'hi' ? 'सिल्ली मिस्टेक डायग्नोस्टिक (X-Ray)' : 'Silly Mistake Diagnostic'}
                    </strong>
                    <span className="text-[11px] dark:text-slate-300 text-slate-600 block">
                      {appLanguage === 'hi'
                        ? `आपकी ${sillyMistakeSummary.sillyPercent}% गलतियां केवल जल्दबाजी या 'नहीं' न पढ़ने की वजह से हुईं!`
                        : `${sillyMistakeSummary.sillyPercent}% of your mistakes were purely due to rush or missing 'NOT' in questions!`}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-600 text-white shrink-0 shadow-xs">
                  +{sillyMistakeSummary.sillyCount * 2} {appLanguage === 'hi' ? 'अंक बच सकते हैं' : 'Marks Saveable'}
                </span>
              </div>
            )}

            {/* Question Review Section Header with Filter, Language Toggle & Walkman */}
            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold dark:text-white text-slate-900">{language === 'hi' ? 'प्रश्नों की समीक्षा' : 'Question Review'}</h3>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Shared EN / HI Language Toggle */}
                <div className="flex items-center gap-1 p-1 rounded-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-extrabold">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2.5 py-1 rounded-full transition-colors ${
                      language === 'en' ? 'bg-indigo-600 text-white' : 'dark:text-slate-400 text-slate-600'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('hi')}
                    className={`px-2.5 py-1 rounded-full transition-colors ${
                      language === 'hi' ? 'bg-indigo-600 text-white' : 'dark:text-slate-400 text-slate-600'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>

                {/* Audio Walkman Toggle Button */}
                {mistakeSolutions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setWalkmanOpen(true);
                      speakCurrentMistake(0);
                    }}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-all min-h-[44px] cursor-pointer"
                    title="Listen to mistakes in audio format"
                  >
                    <Headphones size={14} className="text-indigo-500" />
                    <span>{language === 'hi' ? 'गलतियां सुनें' : 'Audio Walkman'}</span>
                  </button>
                )}

                <Filter size={13} className="dark:text-slate-400 text-slate-500" />
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value)}
                  className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-800 text-xs font-bold focus:outline-none min-h-[44px]"
                >
                  <option value="all">{language === 'hi' ? 'सभी' : 'All'} ({solutions.length})</option>
                  <option value="correct">{language === 'hi' ? 'सही' : 'Correct'} ({stats.correctCount})</option>
                  <option value="incorrect">{language === 'hi' ? 'गलत' : 'Incorrect'} ({stats.incorrectCount})</option>
                  <option value="unattempted">{language === 'hi' ? 'छोड़े गए' : 'Skipped'} ({stats.unattemptedCount})</option>
                </select>
              </div>
            </div>

            {/* Question Review List */}
            <div className="space-y-2.5">
              {solutions.length === 0 && (
                <div className="p-5 text-center text-xs dark:text-slate-300 text-slate-600 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-amber-500/30 border-amber-200">
                  Your score is saved, but question-by-question review could not be loaded. Please reopen this result in a moment.
                </div>
              )}
              {filteredSolutions.map((item, idx) => {
                const question = item.question || item;
                const origIndex = solutions.indexOf(item);
                const qEn = question.question_text_en || getLocalizedEnglish(question.question_text) || question.text || '';
                const qHi = question.question_text_hi || getStoredHindi(question.question_text) || '';
                const qText = (language === 'hi' ? (qHi || qEn) : (qEn || qHi)) || 'Question text';

                const status = resolveSolutionStatus(item);
                const chosenKey = status.chosenKey;
                const correctKey = status.correctKey;
                const hasSelection = status.hasSelection;
                const isCorrect = status.isCorrect;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      setCurrentSolutionIndex(origIndex);
                      setActiveTab('solutions');
                    }}
                    className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/40 transition-all cursor-pointer flex flex-col gap-2.5 group shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2.5 sm:gap-3 w-full">
                      <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : hasSelection
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'dark:bg-slate-800 bg-slate-100 text-slate-400 border dark:border-slate-700 border-slate-300'
                        }`}>
                          Q{origIndex + 1}
                        </span>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold dark:text-white text-slate-900 line-clamp-2 leading-relaxed">
                            {qText}
                          </p>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold">
                            {hasSelection ? (
                              <span className="px-2 py-0.5 rounded-md dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-200 dark:text-slate-300 text-slate-700">
                                {language === 'hi' ? 'आपका' : 'Your'}: {chosenKey}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-200 text-slate-400">
                                {language === 'hi' ? 'छोड़ा' : 'Skipped'}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md dark:bg-emerald-500/15 bg-emerald-50 border dark:border-emerald-500/30 border-emerald-200 text-emerald-600 dark:text-emerald-400">
                              {language === 'hi' ? 'उत्तर' : 'Ans'}: {correctKey || 'B'} ✓
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {isCorrect ? (
                          <span className="px-2 sm:px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check size={12} strokeWidth={3} /> {language === 'hi' ? 'सही' : 'Correct'}
                          </span>
                        ) : hasSelection ? (
                          <span className="px-2 sm:px-2.5 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                            <CircleX size={12} /> {language === 'hi' ? 'गलत' : 'Incorrect'}
                          </span>
                        ) : (
                          <span className="px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold dark:bg-slate-800 bg-slate-100 text-slate-400 border dark:border-slate-700 border-slate-200">
                            {language === 'hi' ? 'छोड़ा' : 'Skipped'}
                          </span>
                        )}
                        <ChevronRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Doubt-to-Confidence 1-Click AI Guru Bridge for Incorrect & Skipped questions */}
                    {!isCorrect && (
                      <div className="pt-2 border-t dark:border-slate-800/80 border-slate-100 space-y-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAiForQuestion(item);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all active:scale-[0.98] group/btn cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Sparkles size={13} className="text-amber-500 shrink-0" />
                            <span className="truncate">
                              {appLanguage === 'hi' ? '1-क्लिक में डाउट क्लियर करें → AI Guru से समझें' : 'Clear Doubt in 1-Click with AI Guru'}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 group-hover/btn:translate-x-0.5 transition-transform shrink-0">
                            {appLanguage === 'hi' ? 'पूछें →' : 'Ask →'}
                          </span>
                        </button>

                        {/* Silly Mistake X-Ray 1-Tap Reason Tags for Incorrect Questions */}
                        {hasSelection && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] font-bold text-slate-400">
                              {appLanguage === 'hi' ? 'गलती का कारण:' : 'Reason:'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuestionMistakeTag(origIndex, 'concept');
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                mistakeTags[origIndex] === 'concept'
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xs'
                                  : 'dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-600 border-slate-300 dark:border-slate-700 hover:border-indigo-500/40'
                              }`}
                            >
                              {appLanguage === 'hi' ? 'कॉन्सेप्ट' : 'Concept'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuestionMistakeTag(origIndex, 'not_missed');
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                mistakeTags[origIndex] === 'not_missed'
                                  ? 'bg-amber-600 text-white border-amber-500 shadow-2xs'
                                  : 'dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-600 border-slate-300 dark:border-slate-700 hover:border-amber-500/40'
                              }`}
                            >
                              {appLanguage === 'hi' ? "'नहीं' छूटा" : "Missed 'NOT'"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuestionMistakeTag(origIndex, 'hurry');
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                mistakeTags[origIndex] === 'hurry'
                                  ? 'bg-rose-600 text-white border-rose-500 shadow-2xs'
                                  : 'dark:bg-slate-800 bg-slate-100 dark:text-slate-400 text-slate-600 border-slate-300 dark:border-slate-700 hover:border-rose-500/40'
                              }`}
                            >
                              {appLanguage === 'hi' ? 'जल्दबाजी' : 'Rushed'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Sticky Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              {stats.incorrectCount > 0 && (
                <button
                  type="button"
                  onClick={handleReattemptMistakes}
                  className="w-full sm:flex-1 py-3 rounded-full bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 min-h-[44px] shadow-sm cursor-pointer"
                >
                  <RotateCcw size={15} />
                  <span>
                    {appLanguage === 'hi'
                      ? `सिर्फ ${stats.incorrectCount} गलत सवाल दोबारा हल करें`
                      : `Re-attempt ${stats.incorrectCount} Mistakes Only`}
                  </span>
                </button>
              )}

              <Link
                to={`/quiz/${result?.test_id || ''}`}
                state={{ reattempt: true, returnTo }}
                className="w-full sm:flex-1 py-3 rounded-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-800 hover:text-black dark:hover:text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] shadow-sm"
              >
                <RotateCcw size={15} />
                <span>{appLanguage === 'hi' ? 'पूरा टेस्ट दोबारा दें' : 'Full Re-attempt'}</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setCurrentSolutionIndex(0);
                  setActiveTab('solutions');
                }}
                className="w-full sm:flex-1 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>{appLanguage === 'hi' ? 'विस्तृत समाधान देखें' : 'View Detailed Solutions'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: DETAILED SOLUTIONS (Matching Mockup 1794580723887.png) */}
        {/* ======================================================== */}
        {activeTab === 'solutions' && currentSolution && (
          <div className="space-y-4">
            {/* Top Question Palette with Arrows & Language Switcher */}
            <div className="p-2.5 dark:bg-[#1E293B]/90 bg-white shadow-sm backdrop-blur-md rounded-2xl border dark:border-slate-700/60 border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setCurrentSolutionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentSolutionIndex === 0}
                  className="w-8 h-8 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 flex-1 no-scrollbar">
                  {solutions.map((item, idx) => {
                    const status = resolveSolutionStatus(item);
                    const hasSelection = status.hasSelection;
                    const isCorrect = status.isCorrect;
                    const isCurrent = currentSolutionIndex === idx;

                    let badgeClasses = 'dark:bg-slate-800 bg-slate-200 dark:text-slate-400 text-slate-600 dark:border-slate-700 border-slate-300';
                    if (isCurrent) {
                      badgeClasses = 'border-2 border-indigo-500 bg-indigo-500/25 text-indigo-400 ring-2 ring-indigo-400/40 font-black scale-105';
                    } else if (isCorrect) {
                      badgeClasses = 'bg-emerald-500 text-slate-950 font-black';
                    } else if (hasSelection) {
                      badgeClasses = 'bg-red-500/80 text-white font-bold';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentSolutionIndex(idx)}
                        className={`w-8 h-8 rounded-full text-xs flex items-center justify-center shrink-0 transition-transform hover:scale-110 ${badgeClasses}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentSolutionIndex((prev) => Math.min(solutions.length - 1, prev + 1))}
                  disabled={currentSolutionIndex === solutions.length - 1}
                  className="w-8 h-8 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center dark:text-slate-300 text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 shrink-0">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    language === 'en' ? 'bg-indigo-600 text-white' : 'dark:text-slate-400 text-slate-600'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    language === 'hi' ? 'bg-indigo-600 text-white' : 'dark:text-slate-400 text-slate-600'
                  }`}
                >
                  HI
                </button>
              </div>
            </div>

            {/* Question & Options Card */}
            {(() => {
              const question = currentSolution.question || currentSolution;
              const options = getOptionEntries(question.options);
              const status = resolveSolutionStatus(currentSolution);
              const chosenKey = status.chosenKey;
              const correctKey = status.correctKey || 'B';
              const hasSelection = status.hasSelection;
              const isCorrect = status.isCorrect;
              const qId = String(question.id || currentSolution?.question_id || `q-${currentSolutionIndex}`);
              const isSavedInMistakes = mistakeSavedIds.has(qId);

              const qEn = question.question_text_en || getLocalizedEnglish(question.question_text) || question.text || '';
              const qHi = question.question_text_hi || getStoredHindi(question.question_text) || question.text_hi || '';
              const displayedQuestionText = language === 'hi' ? (qHi || qEn) : (qEn || qHi);

              return (
                <div className="space-y-3.5">
                  <div className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-3xl p-4 sm:p-6 space-y-4">
                    {/* Meta tag */}
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-300 text-indigo-800 border dark:border-indigo-500/30 border-indigo-300">
                        Q{currentSolutionIndex + 1}
                      </span>
                      <span className="text-xs font-bold dark:text-slate-400 text-slate-600 flex items-center gap-1">
                        <BookOpen size={13} />
                        <span>{question.subject || 'Human Physiology'}</span>
                      </span>
                    </div>

                    {/* Localized Question Text */}
                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-lg font-bold dark:text-white text-slate-900 leading-relaxed">
                        <QuestionFormatter text={displayedQuestionText} language={language} />
                      </h3>
                    </div>

                    {/* Options list with High-Fidelity Status Highlights */}
                    <div className="space-y-2 pt-1">
                      {options.map(([key, opt]) => {
                        const optEn = getLocalizedEnglish(opt);
                        const optHi = getStoredHindi(opt);
                        const displayedOpt = language === 'hi' ? (optHi || optEn) : (optEn || optHi);
                        const isThisCorrect = key === correctKey;
                        const isThisSelected = chosenKey === key;

                        let optionClasses = 'border dark:border-slate-700/60 border-slate-200 dark:bg-slate-900/60 bg-slate-50 dark:text-slate-200 text-slate-800';
                        let badgeClasses = 'dark:bg-slate-800 bg-slate-200 border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700';

                        if (isThisCorrect) {
                          optionClasses = 'border-2 border-emerald-500 dark:bg-emerald-500/10 bg-emerald-50/90 dark:text-white text-slate-900 shadow-xs';
                          badgeClasses = 'bg-emerald-500 text-slate-950 font-black border-emerald-500';
                        } else if (isThisSelected && !isThisCorrect) {
                          optionClasses = 'border-2 border-red-500/80 dark:bg-red-950/40 bg-red-50 dark:text-red-100 text-red-900';
                          badgeClasses = 'bg-red-500 text-white font-black border-red-500';
                        }

                        return (
                          <div
                            key={key}
                            className={`p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all ${optionClasses}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${badgeClasses}`}>
                                {key}
                              </span>
                              <div className="text-xs sm:text-sm font-semibold leading-relaxed flex-1" lang={language}>
                                <QuestionFormatter text={displayedOpt} language={language} />
                              </div>
                            </div>

                            {isThisCorrect && (
                              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                            )}
                            {isThisSelected && !isThisCorrect && (
                              <CircleX size={20} className="text-red-500 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Correct Answer Confirmation Bar (Matching Mockup 1794580723887.png) */}
                  <div className="p-3.5 rounded-2xl dark:bg-[#1E293B]/90 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-400">
                      <CheckCircle2 size={18} />
                      <span>
                        {language === 'hi' ? `सही उत्तर: ${correctKey}` : `Correct Answer: Option ${correctKey}`}
                      </span>
                    </div>

                    <div className="text-xs font-semibold dark:text-slate-300 text-slate-700">
                      {hasSelection ? (
                        <span>
                          {language === 'hi' ? 'आपका उत्तर: ' : 'Your answer: '}
                          <strong>{chosenKey}</strong> ({language === 'hi' ? (isCorrect ? '✓ सही' : '✗ गलत') : (isCorrect ? '✓ Correct' : '✗ Incorrect')})
                        </span>
                      ) : (
                        <span className="text-slate-400">Not Attempted</span>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Mistake Notebook Action Bar (Mobile First) */}
                  <div className="p-3 sm:p-3.5 rounded-2xl dark:bg-indigo-950/40 bg-indigo-50/80 border dark:border-indigo-500/30 border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BookOpen size={18} className="text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <strong className="block text-xs sm:text-sm font-bold dark:text-indigo-200 text-indigo-950 truncate">
                          {language === 'hi' ? 'गलती नोटबुक (Mistake Vault)' : 'Mistake Notebook Revision'}
                        </strong>
                        <span className="text-[11px] dark:text-slate-400 text-slate-600 block truncate">
                          {language === 'hi'
                            ? 'इस सवाल को अंतराल पर दोहराने (Spaced Repetition) के लिए सहेजें'
                            : 'Save this question to revise at smart intervals'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveToMistakeNotebook(question, currentParsed, chosenKey, correctKey, isCorrect)}
                      disabled={isSavedInMistakes}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 min-h-[44px] ${
                        isSavedInMistakes
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs active:scale-95'
                      }`}
                    >
                      {isSavedInMistakes ? (
                        <>
                          <Check size={14} strokeWidth={3} />
                          <span>{language === 'hi' ? 'सहेजा गया' : 'Saved'}</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} strokeWidth={3} />
                          <span>{language === 'hi' ? 'नोटबुक में जोड़ें' : 'Save to Mistakes'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Structured Explanation Box (Matching Mockup 1794580723887.png) */}
                  <div className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4">
                    {/* Header */}
                    <div
                      onClick={() => setExplanationExpanded(!explanationExpanded)}
                      className="flex items-center justify-between cursor-pointer select-none flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-2 text-sm sm:text-base font-black dark:text-amber-300 text-amber-700">
                        <Lightbulb size={18} className="text-amber-500" />
                        <span>{language === 'hi' ? 'व्याख्या (Explanation)' : 'Detailed Explanation'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAiForQuestion(currentSolution);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title="Ask Zyvra AI Guru for deep explanation or shortcut"
                        >
                          <Sparkles size={12} className="text-amber-500" />
                          <span>{language === 'hi' ? 'AI से समझें' : 'Explain with AI'}</span>
                        </button>
                        {explanationExpanded ? <ChevronUp size={18} className="dark:text-slate-400 text-slate-600" /> : <ChevronDown size={18} className="dark:text-slate-400 text-slate-600" />}
                      </div>
                    </div>

                    {explanationExpanded && currentParsed && (
                      <div className="space-y-4 pt-1 text-xs sm:text-sm leading-relaxed dark:text-slate-300 text-slate-700 font-medium">
                        {/* Main explanation body */}
                        <div className="p-3.5 dark:bg-slate-900/60 bg-slate-50 rounded-2xl border dark:border-slate-700/50 border-slate-200">
                          <QuestionFormatter text={currentParsed.mainExplanation || 'Explanation details for this question.'} language={language} />
                        </div>

                        {/* Why other options are wrong section (Matching Mockup 1794580723887.png) */}
                        {Object.keys(currentParsed.distractorNotes).length > 0 && (
                          <div className="p-4 rounded-2xl dark:bg-slate-900/80 bg-amber-50/60 border dark:border-slate-700/60 border-amber-200 space-y-2.5">
                            <h4 className="text-xs font-black dark:text-amber-400 text-amber-800 flex items-center gap-1.5 uppercase tracking-wide">
                              <Target size={14} />
                              <span>{language === 'hi' ? 'अन्य विकल्प क्यों गलत हैं?' : 'Why other options are wrong'}</span>
                            </h4>
                            <div className="space-y-2">
                              {Object.entries(currentParsed.distractorNotes).map(([optKey, reason]) => (
                                <div key={optKey} className="flex items-start gap-2 text-xs">
                                  <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                    {optKey}
                                  </span>
                                  <span className="dark:text-slate-300 text-slate-700 font-medium">
                                    <strong className="dark:text-white text-slate-900">Option {optKey}:</strong> <QuestionFormatter text={reason} language={language} className="inline" />
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reference / Source Box (Matching Mockup 1794580723887.png) */}
                        {currentParsed.reference && (
                          <div className="p-3 rounded-2xl dark:bg-slate-900/60 bg-indigo-50/50 border dark:border-slate-700/60 border-indigo-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <BookOpen size={16} className="text-amber-500 shrink-0" />
                              <div>
                                <span className="text-[10px] font-bold dark:text-amber-400 text-amber-700 uppercase tracking-wider block">
                                  {language === 'hi' ? 'स्रोत (Reference)' : 'Reference'}
                                </span>
                                <span className="text-xs dark:text-white text-slate-900 font-medium">
                                  {currentParsed.reference}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={16} className="dark:text-slate-500 text-slate-400 shrink-0" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Navigation Controls */}
                  <div className="pt-2 flex items-center justify-between gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentSolutionIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentSolutionIndex === 0}
                      className="px-3 sm:px-4 py-2.5 rounded-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 hover:text-black dark:hover:text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 min-h-[44px]"
                    >
                      <ChevronLeft size={16} /> <span className="hidden xs:inline">Previous</span>
                    </button>

                    <Link
                      to="/tests"
                      className="px-3 sm:px-4 py-2.5 rounded-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700 hover:text-black dark:hover:text-white font-bold text-xs flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Target size={14} /> <span>Practice Hub</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setCurrentSolutionIndex((prev) => Math.min(solutions.length - 1, prev + 1))}
                      disabled={currentSolutionIndex === solutions.length - 1}
                      className="px-4 sm:px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-xs hover:bg-indigo-500 transition-colors flex items-center gap-1 min-h-[44px]"
                    >
                      <span>Next</span> <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === 'solutions' && !currentSolution && (
          <div className="p-6 text-center text-sm dark:text-slate-300 text-slate-600 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200">
            Detailed solutions are unavailable for this result. Your submitted score is saved; reopen the result to try again.
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: TOPIC, DIFFICULTY & TIME ANALYSIS */}
        {/* ======================================================== */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 backdrop-blur-md">
              <h3 className="text-base font-extrabold dark:text-white text-slate-900 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-400" />
                <span>{language === 'hi' ? 'विषय, कठिनाई और समय विश्लेषण' : 'Topic, Difficulty & Time Breakdown'}</span>
              </h3>
              <p className="text-xs dark:text-slate-400 text-slate-600 mt-1">
                {language === 'hi'
                  ? 'प्रत्येक विषय, कठिनाई स्तर और प्रश्न पर बिताए गए समय का विवरण देखें।'
                  : 'Pinpoint strengths, difficulty accuracy, and per-question time from this test attempt.'}
              </p>
            </div>

            {/* 1. Topic Breakdown */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                {language === 'hi' ? 'विषयवार प्रदर्शन' : 'Topic Breakdown'}
              </h4>
              {topicAnalysis.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-bold dark:text-white text-slate-900 tracking-tight">{item.topic}</h4>
                    <div className="flex items-center gap-2">
                      {item.timeSpent > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full dark:bg-slate-800 bg-slate-100 text-slate-600 dark:text-slate-300 border dark:border-slate-700 border-slate-200">
                          {item.avgTime}s / Q
                        </span>
                      )}
                      {item.accuracy < 50 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          {language === 'hi' ? 'कमज़ोर क्षेत्र' : 'Needs Revision'}
                        </span>
                      )}
                      <span className={`text-xs font-black ${item.accuracy >= 70 ? 'text-emerald-400' : item.accuracy >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500'}`}>
                        {item.accuracy}% Accuracy
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 dark:bg-slate-900 bg-slate-200 rounded-full overflow-hidden border dark:border-slate-700 border-slate-300">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        item.accuracy >= 70
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : item.accuracy >= 50
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                          : 'bg-gradient-to-r from-red-500 to-rose-400'
                      }`}
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] dark:text-slate-400 text-slate-600 font-medium">
                    <span>{item.correct} of {item.total} Solved Correctly</span>
                    <span>{item.incorrect} Incorrect • {item.unattempted} Skipped</span>
                  </div>
                </div>
              ))}
              {topicAnalysis.length === 0 && (
                <div className="p-6 text-center text-xs dark:text-slate-400 text-slate-500 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200">
                  {solutions.length === 0 ? 'Topic analysis could not be loaded for this result.' : 'No topic tags are available for this attempt.'}
                </div>
              )}
            </div>

            {/* 2. Difficulty Breakdown */}
            {difficultyAnalysis.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  {language === 'hi' ? 'कठिनाई स्तर विश्लेषण' : 'Difficulty Breakdown'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {difficultyAnalysis.map((diff) => (
                    <div
                      key={diff.difficulty}
                      className="p-3.5 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black dark:text-white text-slate-900">{diff.difficulty}</span>
                        <span className={`text-xs font-black ${diff.accuracy >= 70 ? 'text-emerald-500' : diff.accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {diff.accuracy}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 dark:bg-slate-900 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${diff.accuracy >= 70 ? 'bg-emerald-500' : diff.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${diff.accuracy}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] dark:text-slate-400 text-slate-600 font-medium">
                        <span>{diff.correct}/{diff.total} Correct</span>
                        <span>{diff.timeSpent > 0 ? `${diff.avgTime}s avg` : `${diff.incorrect} Wrong`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Per-Question Time Breakdown */}
            {questionTimingRows.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  {language === 'hi' ? 'प्रति प्रश्न समय विवरण' : 'Per-Question Time Breakdown'}
                </h4>
                <div className="rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 divide-y dark:divide-slate-800 divide-slate-100 overflow-hidden">
                  {questionTimingRows.map((row) => {
                    const maxTime = Math.max(1, ...questionTimingRows.map((r) => r.timeSpent));
                    const barWidth = row.timeSpent > 0 ? Math.max(6, Math.round((row.timeSpent / maxTime) * 100)) : 0;
                    return (
                      <button
                        key={row.index}
                        type="button"
                        onClick={() => {
                          setCurrentSolutionIndex(row.index);
                          setActiveTab('solutions');
                        }}
                        className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                            row.status.isCorrect
                              ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                              : row.status.isIncorrect
                              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                              : 'dark:bg-slate-800 bg-slate-100 text-slate-400 border dark:border-slate-700 border-slate-200'
                          }`}>
                            Q{row.index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold dark:text-slate-200 text-slate-800 truncate">
                              <span className="truncate">{row.topic}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                                {row.difficulty}
                              </span>
                            </div>
                            {row.timeSpent > 0 && (
                              <div className="mt-1 w-full max-w-[180px] h-1.5 rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${barWidth}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-black tabular-nums dark:text-slate-300 text-slate-700 shrink-0">
                          {row.timeSpent > 0 ? (row.timeSpent >= 60 ? `${Math.floor(row.timeSpent / 60)}m ${row.timeSpent % 60}s` : `${row.timeSpent}s`) : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: COMPARE BENCHMARKS */}
        {/* ======================================================== */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 backdrop-blur-md">
              <h3 className="text-base font-extrabold dark:text-white text-slate-900 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <span>Peer Benchmarking & Rank Analysis</span>
              </h3>
              <p className="text-xs dark:text-slate-400 text-slate-600 mt-1">
                See how your speed, accuracy, and score compare with other aspirants.
              </p>
            </div>

            {loadingPeerStats ? (
              <div className="p-8 text-center">
                <LoadingSkeleton rows={3} />
              </div>
            ) : (() => {
              const totalAttempts = Number(peerStats?.total_attempts ?? 1);
              const hasEnoughPeers = totalAttempts >= 3;
              const sumSolutionTime = questionTimingRows.reduce((sum, r) => sum + r.timeSpent, 0);
              const timeSpent = Math.max(
                Number(result?.time_spent_seconds || 0),
                Number(scorecard?.time_spent_seconds || 0),
                sumSolutionTime
              );
              const divisor = totalQuestions > 0 ? totalQuestions : Math.max(1, solutions.length);
              const avgTimePerQuestion = timeSpent > 0 && divisor > 0 ? Math.round(timeSpent / divisor) : null;
              const userScore = score;
              const avgScore = peerStats?.average_score;
              const scoreDiff = peerStats?.score_diff ?? 0;
              const percentile = peerStats?.percentile;
              const highestScore = peerStats?.highest_score;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  {/* Card 1: Percentile */}
                  <div className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center flex flex-col justify-between min-h-[110px]">
                    <div className="text-[10px] sm:text-xs uppercase font-bold dark:text-slate-400 text-slate-500">Your Percentile</div>
                    <div className="text-base sm:text-xl font-black dark:text-amber-400 text-amber-600 my-1">
                      {hasEnoughPeers && percentile !== undefined && percentile !== null ? `${percentile}%` : 'Not enough data yet'}
                    </div>
                    <span className="text-[11px] font-semibold dark:text-indigo-400 text-indigo-600">
                      {hasEnoughPeers
                        ? `Top ${Math.max(1, Math.round(100 - Number(percentile || 0)))}% (${formatCount(totalAttempts, 'attempt')})`
                        : `${totalAttempts}/3 attempts recorded`}
                    </span>
                  </div>

                  {/* Card 2: Average Score */}
                  <div className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center flex flex-col justify-between min-h-[110px]">
                    <div className="text-[10px] sm:text-xs uppercase font-bold dark:text-slate-400 text-slate-500">Average Score</div>
                    <div className="text-base sm:text-xl font-black dark:text-white text-slate-900 my-1">
                      {hasEnoughPeers && avgScore !== undefined && avgScore !== null ? avgScore : 'Not enough data yet'}
                    </div>
                    <span className={`text-[11px] font-semibold ${!hasEnoughPeers ? 'dark:text-slate-400 text-slate-500' : scoreDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {hasEnoughPeers ? `${scoreDiff >= 0 ? `+${scoreDiff}` : scoreDiff} vs Avg` : `Your score: ${userScore}`}
                    </span>
                  </div>

                  {/* Card 3: Topper vs You */}
                  <div className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center flex flex-col justify-between min-h-[110px]">
                    <div className="text-[10px] sm:text-xs uppercase font-bold dark:text-slate-400 text-slate-500">Topper vs You</div>
                    <div className="text-base sm:text-xl font-black text-amber-500 dark:text-amber-400 my-1">
                      {hasEnoughPeers && highestScore !== undefined && highestScore !== null ? (
                        <>{score} <span className="text-xs font-semibold text-slate-400">vs {highestScore}</span></>
                      ) : (
                        'Not enough data yet'
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {hasEnoughPeers && highestScore !== undefined && highestScore !== null
                        ? (score >= highestScore ? 'You are the Topper!' : `Diff: -${Math.max(0, highestScore - score)} marks`)
                        : 'Needs 3+ peer attempts'}
                    </span>
                  </div>

                  {/* Card 4: Avg Time / Question */}
                  <div className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center flex flex-col justify-between min-h-[110px]">
                    <div className="text-[10px] sm:text-xs uppercase font-bold dark:text-slate-400 text-slate-500">Avg Time / Q</div>
                    <div className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 my-1">
                      {avgTimePerQuestion !== null ? `${avgTimePerQuestion}s` : '—'}
                    </div>
                    <span className="text-[11px] font-semibold dark:text-slate-400 text-slate-500">
                      {avgTimePerQuestion === null
                        ? 'Timing unavailable'
                        : avgTimePerQuestion <= 35
                        ? 'Fast & Steady'
                        : avgTimePerQuestion <= 70
                        ? 'Optimal Pace'
                        : 'Moderate Pace'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <aside
          aria-live="polite"
          className={`fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 max-w-sm mx-auto sm:mx-0 z-50 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-bold border transition-all ${
            toastMessage.type === 'warning'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-emerald-600 text-white border-emerald-400'
          }`}
        >
          {toastMessage.type === 'warning' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </aside>
      )}

      {/* Floating Audio Walkman Controller */}
      {walkmanOpen && mistakeSolutions.length > 0 && (
        <aside
          aria-label="Audio Walkman"
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50 p-3 sm:p-4 rounded-3xl dark:bg-slate-900/95 bg-white/95 backdrop-blur-md border dark:border-indigo-500/40 border-indigo-200 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Headphones size={20} className={walkmanPlaying ? 'text-indigo-400' : ''} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                {appLanguage === 'hi' ? 'ऑडियो वॉकमेन' : 'Mistakes Walkman'} ({walkmanIndex + 1}/{mistakeSolutions.length})
              </span>
              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate block">
                {walkmanPlaying ? (appLanguage === 'hi' ? 'गलतियां सुनाई जा रही हैं...' : 'Speaking mistake details...') : (appLanguage === 'hi' ? 'प्ले दबाएं' : 'Paused')}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const prev = Math.max(0, walkmanIndex - 1);
                setWalkmanIndex(prev);
                speakCurrentMistake(prev);
              }}
              disabled={walkmanIndex === 0}
              className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
              aria-label="Previous mistake"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={toggleWalkmanPlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
              aria-label={walkmanPlaying ? 'Pause' : 'Play'}
            >
              {walkmanPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                const next = Math.min(mistakeSolutions.length - 1, walkmanIndex + 1);
                setWalkmanIndex(next);
                speakCurrentMistake(next);
              }}
              disabled={walkmanIndex >= mistakeSolutions.length - 1}
              className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
              aria-label="Next mistake"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={closeWalkman}
              className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer ml-1"
              aria-label="Close Walkman"
            >
              <X size={15} />
            </button>
          </div>
        </aside>
      )}

      {/* Zyvra AI Guru Doubt Modal */}
      <ZyvraAiGuruModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        initialPrompt={aiPrompt}
        initialContext={aiContext}
        examTitle={result?.test_title}
      />
    </div>
  );
}

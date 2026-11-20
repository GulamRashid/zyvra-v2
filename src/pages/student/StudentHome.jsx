import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronRight,
  Compass,
  Flame,
  GraduationCap,
  Play,
  Sparkles,
  Target,
  Trophy,
  WalletCards,
  Wrench,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import OnboardingModal from './OnboardingModal';
import HeroCarousel from '../../components/student/HeroCarousel';
import ShareAndEarnCard from '../../components/common/ShareAndEarnCard';
import ContentIcon from '../../components/common/ContentIcon';
import DailyStreakModal from '../../components/student/DailyStreakModal';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getExamCategory, isPublished, sortContentItems } from '../../lib/content';
import { getRecommendedPractice } from '../../lib/recommendations';
import { getAnsweredQuestionCount } from '../../lib/tests';
import { syncAttemptsWithStreak, calculateStreakData, getStoredActivityDates, toLocalDateString } from '../../lib/streak';

function isComplete(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at);
}

function localDateKey(date = new Date()) {
  return toLocalDateString(date);
}

function loadSavedChapter(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`zyvra_last_chapter_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Quick Utility 4-Tile Row with bilingual support
const quickActionTiles = [
  {
    id: 'leaderboard',
    titleEn: 'Ranks',
    titleHi: 'लीडरबोर्ड',
    subtitle: 'Top ranks',
    path: '/analytics',
    icon: Trophy,
    color: 'text-amber-500'
  },
  {
    id: 'bookmarks',
    titleEn: 'Bookmarks',
    titleHi: 'बुकमार्क्स',
    subtitle: 'Saved questions',
    path: '/bookmarks',
    icon: Bookmark,
    color: 'text-indigo-500'
  },
  {
    id: 'wallet',
    titleEn: 'Wallet',
    titleHi: 'सिक्के / वॉलेट',
    subtitle: 'Your coins',
    path: '/wallet',
    icon: WalletCards,
    color: 'text-emerald-500'
  },
  {
    id: 'ai-guru',
    titleEn: 'AI Guru',
    titleHi: 'AI गुरु डाउट',
    subtitle: 'Instant doubts',
    path: '/toolbox',
    icon: Sparkles,
    color: 'text-amber-500'
  }
];

export default function StudentHome() {
  const { profile, profileError, guest, user, supabase, refreshAccount } = useAuth();
  const { language } = useThemeLanguage();
  const { exams, chapters } = useContentCatalog();

  const [attempts, setAttempts] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [resumeAttempt, setResumeAttempt] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(Boolean(supabase && user));
  const [dashboardError, setDashboardError] = useState('');
  const [overviewRetry, setOverviewRetry] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // User Greeting Info
  const fullName = profile?.full_name || profile?.name || user?.user_metadata?.full_name || '';
  const firstName = fullName ? fullName.split(' ')[0] : 'Learner';

  // Time-based greeting
  const greetingPhrase = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'hi' ? 'शुभ प्रभात' : 'Good Morning';
    if (hour < 17) return language === 'hi' ? 'शुभ दोपहर' : 'Good Afternoon';
    if (hour < 21) return language === 'hi' ? 'शुभ संध्या' : 'Good Evening';
    return language === 'hi' ? 'शुभ रात्रि' : 'Good Night';
  }, [language]);

  // Saved chapter from local storage
  const [savedChapter, setSavedChapter] = useState(() => loadSavedChapter(user?.id));

  useEffect(() => {
    if (user && supabase) {
      refreshAccount().catch((err) => console.error('Unable to refresh account:', err));
    }
  }, [user, supabase, refreshAccount]);

  useEffect(() => {
    setSavedChapter(loadSavedChapter(user?.id));
  }, [user?.id]);

  // Load test attempts & available tests strictly from Supabase
  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      if (!supabase) {
        setDashboardLoading(false);
        return;
      }
      setDashboardLoading(true);
      setDashboardError('');

      try {
        let attemptsQuery = supabase
          .from('test_attempts')
          .select('id, test_id, score, total_questions, status, started_at, completed_at, responses, submitted_at, finished_at')
          .order('started_at', { ascending: false });

        if (user?.id) {
          attemptsQuery = attemptsQuery.eq('user_id', user.id);
        }

        const [attemptsRes, testsRes] = await Promise.all([
          attemptsQuery,
          supabase
            .from('tests')
            .select('id, title, duration_minutes, total_marks, is_published, created_at, chapter_id, coin_reward_enabled')
            .eq('is_published', true)
        ]);

        if (!active) return;

        if (attemptsRes.error) {
          console.warn('Dashboard attempts query error:', attemptsRes.error);
        }
        if (testsRes.error) {
          console.warn('Dashboard tests query error:', testsRes.error);
        }

        const loadedAttempts = attemptsRes.data || [];
        const loadedTests = testsRes.data || [];

        setAllAttempts(loadedAttempts);
        setAvailableTests(loadedTests);

        // Resume candidate: latest in-progress attempt that hasn't expired
        const inProgress = loadedAttempts.find((a) => {
          const status = String(a.status || '').toLowerCase();
          return status === 'in_progress' || status === 'paused' || status === 'active';
        });

        if (inProgress) {
          const matchedTest = loadedTests.find((t) => t.id === inProgress.test_id);
          if (matchedTest) {
            setResumeAttempt({ ...inProgress, testTitle: matchedTest.title });
          } else {
            setResumeAttempt(null);
          }
        } else {
          setResumeAttempt(null);
        }

        // Completed attempts for scoring & activity
        const completedAttempts = loadedAttempts.filter(isComplete);
        setAttempts(completedAttempts);

        // Sync attempts with study streak
        if (user?.id) {
          syncAttemptsWithStreak(supabase, user.id, loadedAttempts);
        }
      } catch (err) {
        console.error('Overview loading failed:', err);
        if (active) {
          setDashboardError('Could not load dashboard data.');
        }
      } finally {
        if (active) setDashboardLoading(false);
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, [supabase, user?.id, overviewRetry]);

  // Compute Daily Questions Target Progress
  const dailyTarget = Number(profile?.daily_goal_target || 20);

  const todayQuestionsSolved = useMemo(() => {
    const todayKey = localDateKey();
    let count = 0;

    for (const attempt of allAttempts) {
      const attemptDate = attempt.started_at || attempt.completed_at || attempt.submitted_at;
      if (attemptDate && localDateKey(new Date(attemptDate)) === todayKey) {
        count += getAnsweredQuestionCount(attempt);
      }
    }
    return count;
  }, [allAttempts]);

  const goalPercent = Math.min(100, Math.round((todayQuestionsSolved / Math.max(1, dailyTarget)) * 100));

  // Study Streak Data
  const [streakData, setStreakData] = useState(() => {
    const dates = getStoredActivityDates(user?.id || 'guest');
    const data = calculateStreakData(dates);
    if (profile?.current_streak && Number(profile.current_streak) > data.currentStreak) {
      data.currentStreak = Number(profile.current_streak);
    }
    return data;
  });

  const [streakModalOpen, setStreakModalOpen] = useState(false);

  useEffect(() => {
    const updateStreak = () => {
      const dates = getStoredActivityDates(user?.id || 'guest');
      const data = calculateStreakData(dates);
      if (profile?.current_streak && Number(profile.current_streak) > data.currentStreak) {
        data.currentStreak = Number(profile.current_streak);
      }
      setStreakData(data);
    };
    updateStreak();

    if (typeof window !== 'undefined') {
      window.addEventListener('zyvra:streak-updated', updateStreak);
      return () => window.removeEventListener('zyvra:streak-updated', updateStreak);
    }
  }, [user?.id, profile?.current_streak]);

  const streak = Number(streakData?.currentStreak || 0);

  // Circular progress ring calculation
  const ringRadius = 12;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (goalPercent / 100) * ringCircumference;

  // Real Continue learning item resolution
  const continueItem = useMemo(() => {
    if (resumeAttempt) {
      return {
        title: resumeAttempt.testTitle || 'Resume Incomplete Test',
        subtitle: 'Continue from your last session',
        progress: 50,
        path: `/quiz/${resumeAttempt.test_id}`,
        isTest: true
      };
    }
    if (attempts.length > 0) {
      const last = attempts[0];
      const matchedTest = availableTests.find((t) => t.id === last.test_id);
      return {
        title: matchedTest?.title || 'Recent Practice Test',
        subtitle: `Score: ${last.score || 0}/${last.total_questions || 0}`,
        progress: 100,
        path: `/quiz/result/${last.id}`,
        isTest: true
      };
    }
    if (savedChapter) {
      return {
        title: savedChapter.title,
        subtitle: `${savedChapter.folderTitle || 'Chapter Practice'}`,
        progress: 25,
        path: `/chapter/${savedChapter.id}`,
        isTest: false
      };
    }
    if (availableTests.length > 0) {
      const firstTest = availableTests[0];
      return {
        title: firstTest.title,
        subtitle: 'Take your first test to track progress',
        progress: 0,
        path: `/quiz/${firstTest.id}`,
        isTest: true
      };
    }
    if (chapters.length > 0) {
      const firstChapter = chapters[0];
      return {
        title: firstChapter.title,
        subtitle: firstChapter.subject || 'Chapter Practice',
        progress: 0,
        path: `/chapter/${firstChapter.id}`,
        isTest: false
      };
    }
    return {
      title: 'Explore Available Exams',
      subtitle: 'Browse through syllabus and practice questions',
      progress: 0,
      path: '/explore',
      isTest: false
    };
  }, [resumeAttempt, attempts, availableTests, savedChapter, chapters]);

  const recommendation = useMemo(() => getRecommendedPractice({
    attempts: allAttempts,
    tests: availableTests,
    chapters
  }), [allAttempts, availableTests, chapters]);

  // Real Dynamic Exams mapped strictly from Database
  const dynamicExams = useMemo(() => {
    const published = exams.filter(isPublished);
    const sorted = sortContentItems(published);
    const totalFreeCount = chapters.filter((c) => c.access_mode === 'free' && isPublished(c)).length;

    return sorted.map((exam) => ({
      id: exam.id,
      title: exam.title,
      category: getExamCategory(exam),
      freeCount: totalFreeCount,
      subtitle: exam.description || 'Chapter tests & practice questions',
      icon: exam.icon_url || exam.icon || 'GraduationCap',
      path: `/explore/${exam.slug || exam.id}`
    }));
  }, [exams, chapters]);

  const shouldShowOnboarding = Boolean(
    user && !guest && profile &&
    (profile.onboarding_completed === false || profile.onboarding_completed === null)
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-800 dark:text-slate-100">
      {shouldShowOnboarding && <OnboardingModal />}

      {/* ======================================================== */}
      {/* 1. MINIMALIST GREETING & INTEGRATED STREAK/GOAL BAR     */}
      {/* ======================================================== */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight dark:text-white text-slate-900 flex items-center gap-2">
            <span>{greetingPhrase}, {firstName}</span>
            <span className="text-amber-500 select-none">⚡</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium dark:text-slate-400 text-slate-500 mt-0.5">
            {language === 'hi'
              ? 'अपनी तैयारी जारी रखें और लक्ष्य के करीब पहुँचें।'
              : 'Keep the streak, stay ahead in your preparation.'}
          </p>
        </div>

        {/* Integrated Floating Streak & Target Bar */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Study Streak Pill */}
          <button
            type="button"
            onClick={() => setStreakModalOpen(true)}
            className="px-3 py-1.5 rounded-2xl dark:bg-[#1E293B]/90 bg-white border dark:border-slate-800 border-slate-200/90 shadow-xs flex items-center gap-2 text-left hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            aria-label="View study streak"
          >
            <div className="w-7 h-7 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Flame size={15} className={`text-orange-500 ${streak > 0 ? 'fill-orange-500 animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="text-xs font-black dark:text-orange-400 text-orange-600 leading-none">
                {profileError ? '—' : streak} {language === 'hi' ? 'दिन' : 'Days'}
              </div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {streakData?.isActiveToday
                  ? (language === 'hi' ? '✓ आज पूर्ण' : 'active')
                  : (language === 'hi' ? 'अध्ययन स्ट्रीक' : 'Streak')}
              </div>
            </div>
          </button>

          {/* Today's Daily Target Pill */}
          <div className="px-3 py-1.5 rounded-2xl dark:bg-[#1E293B]/90 bg-white border dark:border-slate-800 border-slate-200/90 shadow-xs flex items-center gap-2">
            <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
              <svg className="w-7 h-7 -rotate-90 transform" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r={ringRadius} className="dark:stroke-slate-800 stroke-slate-200" strokeWidth="2.8" fill="none" />
                <circle
                  cx="16" cy="16" r={ringRadius}
                  className="stroke-amber-500 transition-all duration-700 ease-out"
                  strokeWidth="2.8"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black dark:text-amber-400 text-amber-600">
                {profileError ? '0' : goalPercent}%
              </span>
            </div>
            <div>
              <div className="text-xs font-black dark:text-white text-slate-900 leading-none">
                {profileError ? '—' : todayQuestionsSolved} / {dailyTarget}
              </div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {language === 'hi' ? 'आज का लक्ष्य' : 'Daily Goal'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Streak & Loss-Aversion Engagement Banner */}
      {streakData?.streakAtRisk && !streakData?.isActiveToday && streak > 0 ? (
        <div className="flex items-center justify-between gap-3 p-3 sm:px-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/10 border border-orange-500/30 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0 animate-bounce">🔥</span>
            <div className="min-w-0">
              <strong className="block text-orange-600 dark:text-orange-400 font-black truncate">
                {language === 'hi' ? `आपकी ${streak} दिन की स्ट्रीक दांव पर है!` : `Your ${streak}-day streak is at risk!`}
              </strong>
              <span className="text-slate-600 dark:text-slate-400 text-[11px] truncate block">
                {language === 'hi' ? 'आज 1 टेस्ट या अभ्यास पूरा करें और स्ट्रीक को सुरक्षित रखें।' : 'Complete 1 quick test or practice to save your streak.'}
              </span>
            </div>
          </div>
          <Link
            to="/tests"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black text-xs shrink-0 shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            {language === 'hi' ? 'स्ट्रीक बचाएं' : 'Save Streak'}
          </Link>
        </div>
      ) : goalPercent >= 100 ? (
        <div className="flex items-center justify-between gap-2 p-3 sm:px-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-bold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🎉</span>
            <span className="truncate">
              {language === 'hi'
                ? `अद्भुत निरंतरता! आज का लक्ष्य पूर्ण हुआ (${todayQuestionsSolved}/${dailyTarget} सवाल)।`
                : `Goal Achieved! (${todayQuestionsSolved}/${dailyTarget} questions solved today).`}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shrink-0">
            {language === 'hi' ? '✓ सुरक्षित' : '✓ Secured'}
          </span>
        </div>
      ) : streakData?.nextMilestone && streak > 0 ? (
        <button
          type="button"
          onClick={() => setStreakModalOpen(true)}
          className="w-full text-left flex items-center justify-between gap-2 p-2.5 sm:px-3.5 rounded-2xl dark:bg-[#1E293B]/70 bg-white border dark:border-slate-800 border-slate-200 text-xs shadow-xs hover:border-amber-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
            <span className="text-sm shrink-0">{streakData.nextMilestone.icon}</span>
            <span className="text-[11px] truncate">
              {language === 'hi' ? 'अगला माइलस्टोन:' : 'Next Milestone:'}{' '}
              <strong className="text-amber-500 group-hover:underline">
                {language === 'hi' ? streakData.nextMilestone.labelHi : streakData.nextMilestone.labelEn}
              </strong>{' '}
              ({streakData.nextMilestone.days - streak} {language === 'hi' ? 'दिन बाकी' : 'days left'})
            </span>
          </div>
          <span className="text-[10px] font-black text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
            +{streakData.nextMilestone.bonusCoins}c
          </span>
        </button>
      ) : null}

      {/* ======================================================== */}
      {/* 2. RESTRAINED TOP PROMOTIONAL BANNER CAROUSEL           */}
      {/* ======================================================== */}
      <section aria-label="Featured Announcements">
        <HeroCarousel />
      </section>

      {dashboardError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
          <span>{dashboardError}</span>
          <button
            type="button"
            className="shrink-0 min-h-[38px] rounded-xl border border-rose-300 px-3 py-1 text-xs font-bold hover:bg-rose-100 dark:border-rose-400/40 dark:hover:bg-rose-950/50"
            onClick={() => setOverviewRetry((count) => count + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PRIMARY 4-PILLAR STUDY GATEWAYS (MINIMALIST & SPACIOUS) */}
      {/* ======================================================== */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* 1. My Courses */}
        <Link
          to="/purchases"
          className="p-3.5 sm:p-4 rounded-3xl dark:bg-[#111827]/85 bg-white border dark:border-slate-800/80 border-slate-200/80 hover:border-indigo-500/60 flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
              {language === 'hi' ? 'मेरे कोर्सेज' : 'My Courses'}
            </h4>
            <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
              {language === 'hi' ? 'खरीदे गए विषय व पास' : 'Enrolled & unlocked'}
            </p>
          </div>
        </Link>

        {/* 2. Mock Tests */}
        <Link
          to="/tests?tab=tests"
          className="p-3.5 sm:p-4 rounded-3xl dark:bg-[#111827]/85 bg-white border dark:border-slate-800/80 border-slate-200/80 hover:border-emerald-500/60 flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Target size={20} />
            </div>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">
              {language === 'hi' ? 'मॉक टेस्ट्स' : 'Mock Tests'}
            </h4>
            <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
              {language === 'hi' ? 'फुल टेस्ट्स व टाइमर' : 'Timed exam mocks'}
            </p>
          </div>
        </Link>

        {/* 3. Explore Syllabus */}
        <Link
          to="/explore"
          className="p-3.5 sm:p-4 rounded-3xl dark:bg-[#111827]/85 bg-white border dark:border-slate-800/80 border-slate-200/80 hover:border-amber-500/60 flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Compass size={20} />
            </div>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-tight">
              {language === 'hi' ? 'पूरा सिलेबस' : 'Explore Exams'}
            </h4>
            <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
              {language === 'hi' ? 'सभी परीक्षाओं के फोल्डर्स' : 'All syllabus & notes'}
            </p>
          </div>
        </Link>

        {/* 4. Study Toolbox */}
        <Link
          to="/toolbox"
          className="p-3.5 sm:p-4 rounded-3xl dark:bg-[#111827]/85 bg-white border dark:border-slate-800/80 border-slate-200/80 hover:border-cyan-500/60 flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Wrench size={20} />
            </div>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors leading-tight">
              {language === 'hi' ? 'स्टडी टूल्स' : 'Study Toolbox'}
            </h4>
            <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
              {language === 'hi' ? 'नोट्स, AI व टाइमर' : 'Notes, AI & timer'}
            </p>
          </div>
        </Link>
      </section>

      {/* ======================================================== */}
      {/* 4. QUICK UTILITY 4-TILE STRIP                           */}
      {/* ======================================================== */}
      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {quickActionTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.id}
              to={tile.path}
              className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl dark:bg-[#111827]/70 bg-white border dark:border-slate-800/80 border-slate-200/80 hover:border-slate-400/40 text-center transition-all active:scale-95 group shadow-xs"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-1 shrink-0 dark:bg-slate-800/80 bg-slate-100 group-hover:scale-110 transition-transform">
                <Icon size={16} className={tile.color} />
              </div>
              <span className="text-[10px] sm:text-xs font-bold dark:text-slate-200 text-slate-800 tracking-tight leading-tight truncate max-w-full">
                {language === 'hi' ? tile.titleHi : tile.titleEn}
              </span>
            </Link>
          );
        })}
      </section>

      {/* ======================================================== */}
      {/* 5. RECOMMENDED PRACTICE OR CONTINUE WHERE YOU LEFT     */}
      {/* ======================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>
              {recommendation
                ? (language === 'hi' ? 'आज का अनुशंसित अभ्यास' : 'Recommended For Today')
                : (language === 'hi' ? 'जारी रखें' : 'Continue Where You Left')}
            </span>
          </h3>
          <Link
            to="/tests"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
          >
            <span>{language === 'hi' ? 'सभी देखें' : 'View All'}</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {dashboardLoading ? (
          <div className="dark:bg-[#111827]/80 bg-white border dark:border-slate-800 border-slate-200 rounded-3xl p-4 sm:p-5 min-h-[90px] animate-pulse">
            <div className="h-4 w-1/2 rounded bg-indigo-500/10" />
            <div className="mt-2.5 h-3 w-1/3 rounded bg-indigo-500/10" />
          </div>
        ) : recommendation ? (
          <div className="dark:bg-[#111827]/80 bg-white border dark:border-slate-800/80 border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {language === 'hi' ? 'लक्ष्य आधारित टेस्ट' : 'Daily Goal Recommendation'}
                </div>
                <h4 className="text-sm sm:text-base font-black dark:text-white text-slate-900 truncate mt-0.5">
                  {recommendation.title}
                </h4>
                <p className="text-xs dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
                  {recommendation.chapterTitle} · {recommendation.durationMinutes} min
                </p>
              </div>
              <Link
                to={recommendation.path}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2 text-xs sm:text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95 transition-all"
              >
                <span>{recommendation.kind === 'resume' ? (language === 'hi' ? 'जारी रखें' : 'Resume') : (language === 'hi' ? 'शुरू करें' : 'Start')}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="dark:bg-[#111827]/80 bg-white border dark:border-slate-800/80 border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">
                    {continueItem.title}
                  </h4>
                  <p className="text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate">
                    {continueItem.subtitle}
                  </p>
                  <div className="w-full max-w-xs h-1.5 dark:bg-slate-800 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${continueItem.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <Link
                to={continueItem.path}
                className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs"
                aria-label="Continue learning"
              >
                <Play size={15} fill="currentColor" className="ml-0.5 text-white" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 6. AVAILABLE EXAMS (MINIMALIST CARDS)                    */}
      {/* ======================================================== */}
      {dynamicExams.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'hi' ? 'उपलब्ध परीक्षाएं' : 'Available Exams'}
            </h3>
            <Link
              to="/explore"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <span>{language === 'hi' ? 'सभी देखें' : 'View All'}</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {dynamicExams.map((exam) => (
              <Link
                key={exam.id}
                to={exam.path}
                className="p-4 rounded-3xl dark:bg-[#111827]/85 bg-white border dark:border-slate-800/80 border-slate-200/80 hover:border-indigo-500/50 flex flex-col justify-between transition-all hover:scale-[1.01] active:scale-[0.98] shadow-xs group min-h-[105px]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center border bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 p-1.5">
                    <ContentIcon icon={exam.icon} className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {exam.category}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <h4 className="text-xs sm:text-sm font-extrabold dark:text-white text-slate-900 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {exam.title}
                    </h4>
                    {exam.freeCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-[9px] shrink-0 border border-emerald-500/25">
                        {exam.freeCount} Free
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium dark:text-slate-400 text-slate-500 mt-0.5 line-clamp-1">
                    {exam.subtitle}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Referral Share Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700/60 border-slate-300 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors z-10"
            >
              <X size={18} />
            </button>
            <ShareAndEarnCard />
          </div>
        </div>
      )}

      {/* Daily Study Streak Detail Modal */}
      <DailyStreakModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streakData={streakData}
      />
    </div>
  );
}

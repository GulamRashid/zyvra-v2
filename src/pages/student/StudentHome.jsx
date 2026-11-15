import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Play,
  Target,
  Trophy,
  WalletCards
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';
import OnboardingModal from './OnboardingModal';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getRecommendedPractice } from '../../lib/recommendations';

function isComplete(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at);
}

function localDateKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getStreak(attempts) {
  if (!attempts || attempts.length === 0) return 0;
  const days = new Set();
  attempts.forEach((a) => {
    const ts = a.completed_at || a.submitted_at || a.finished_at || a.created_at;
    if (ts) days.add(localDateKey(ts));
  });
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = localDateKey(cursor);
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
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

// Quick Action 5-Tile Row
const quickActionTiles = [
  {
    id: 'mock',
    title: 'Mock Test',
    subtitle: 'Full length',
    path: '/tests?tab=tests',
    icon: Target,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-400 text-indigo-700'
  },
  {
    id: 'leaderboard',
    title: 'Ranks',
    subtitle: 'Top ranks',
    path: '/analytics',
    icon: Trophy,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-400 text-indigo-700'
  },
  {
    id: 'bookmarks',
    title: 'Bookmarks',
    subtitle: 'Saved questions',
    path: '/bookmarks',
    icon: Bookmark,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-amber-500/20 bg-amber-100 dark:text-amber-400 text-amber-700'
  },
  {
    id: 'wallet',
    title: 'Wallet',
    subtitle: 'Your coins',
    path: '/wallet',
    icon: WalletCards,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-amber-500/20 bg-amber-100 dark:text-amber-400 text-amber-700'
  }
];

export default function StudentHome() {
  const { profile, profileError, coinBalance, guest, user, supabase, refreshAccount } = useAuth();
  const { t, language } = useThemeLanguage();
  const { exams, folders, chapters } = useContentCatalog();

  const [attempts, setAttempts] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [resumeAttempt, setResumeAttempt] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(Boolean(supabase && user));
  const [dashboardError, setDashboardError] = useState('');
  const [overviewRetry, setOverviewRetry] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  // User Greeting Info
  const fullName = profile?.full_name || profile?.name || user?.user_metadata?.full_name || '';
  const firstName = fullName ? fullName.split(' ')[0] : 'Learner';

  // Time-based greeting
  const greetingPhrase = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'hi' ? 'शुभ प्रभात' : 'Good Morning';
    if (hour < 17) return language === 'hi' ? 'शुभ दोपहर' : 'Good Afternoon';
    return language === 'hi' ? 'शुभ संध्या' : 'Good Evening';
  }, [language]);

  // Saved chapter from local storage
  const [savedChapter, setSavedChapter] = useState(() => loadSavedChapter(user?.id));

  useEffect(() => {
    if (user && supabase) {
      refreshAccount().catch((err) => console.error('Unable to refresh account:', err));
    }
  }, [user?.id, supabase, refreshAccount]);

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
      setDashboardError('');
      try {
        const { data: tests, error: testsError } = await supabase
          .from('tests')
          .select('id,title,chapter_id,status,duration_minutes,is_free,coin_reward_enabled')
          .in('status', ['published', 'live', 'available']);
        if (testsError) throw testsError;

        if (!active) return;
        setAvailableTests(tests || []);

        if (!user) {
          setAllAttempts([]);
          setDashboardLoading(false);
          return;
        }

        const { data: rows, error: attemptsError } = await supabase
          .from('test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200);
        if (attemptsError) throw attemptsError;

        if (!active) return;
        const userAttempts = rows || [];
        setAllAttempts(userAttempts);
        setAttempts(userAttempts.filter(isComplete));

        const incomplete = userAttempts.find(
          (a) => !isComplete(a) && (a.state_json || a.answers || a.responses)
        );

        if (incomplete) {
          const matchedTest = (tests || []).find((t) => t.id === incomplete.test_id);
          setResumeAttempt({
            ...incomplete,
            testTitle: matchedTest?.title || 'Practice Test'
          });
        } else {
          setResumeAttempt(null);
        }
      } catch (err) {
        console.error('Error loading study overview:', err);
        if (active) {
          setDashboardError('Could not load your study overview. Please try again.');
        }
      } finally {
        if (active) setDashboardLoading(false);
      }
    };

    loadOverview();
    return () => { active = false; };
  }, [supabase, user, overviewRetry]);

  // Dynamic Hero Banners built strictly from actual DB records
  const dynamicBanners = useMemo(() => {
    if (exams && exams.length > 0) {
      return exams.map((exam, idx) => ({
        id: exam.id,
        tag: idx === 0 ? 'FEATURED EXAM SERIES' : 'POPULAR CHOICE',
        title: exam.title,
        subtitle: exam.description || 'Structured Chapter Practice & Mock Tests',
        exam: exam.title,
        path: `/explore/${exam.slug || exam.id}`,
        buttonText: 'Start Learning',
        badgeText: exam.title.slice(0, 5).toUpperCase(),
      }));
    }
    return [
      {
        id: 'default',
        tag: 'WELCOME TO ZYVRA',
        title: 'Master Your Competitive Exams',
        subtitle: 'High-yield MCQs with structured explanations and instant analytics',
        exam: 'General Preparation',
        path: '/tests',
        buttonText: 'Explore Tests',
        badgeText: 'ZYVRA',
      }
    ];
  }, [exams]);

  // Carousel auto-rotate
  useEffect(() => {
    if (dynamicBanners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % dynamicBanners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [dynamicBanners.length]);

  // Real Streak (No fake baseline)
  const streak = useMemo(() => {
    const computed = getStreak(attempts);
    return Math.max(computed, Number(profile?.current_streak || 0));
  }, [attempts, profile?.current_streak]);

  // Real Daily Target & Questions Solved
  const dailyTarget = Number(profile?.daily_goal_target || 50);
  const todayKey = localDateKey();
  const todayQuestionsSolved = useMemo(() => {
    const todayAttempts = attempts.filter((att) => {
      const ts = att.completed_at || att.submitted_at || att.finished_at || att.created_at;
      return ts ? localDateKey(ts) === todayKey : false;
    });
    return todayAttempts.reduce((sum, att) => {
      const answered = Number(att.answered_count || att.total_questions || att.total_answered || 0);
      return sum + answered;
    }, 0);
  }, [attempts, todayKey]);

  const goalPercent = dailyTarget > 0 ? Math.min(100, Math.round((todayQuestionsSolved / dailyTarget) * 100)) : 0;

  // Circular progress ring calculation
  const ringRadius = 24;
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
    return exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      subtitle: exam.description || 'Chapter tests & practice questions',
      badge: exam.icon === 'GraduationCap' ? '🎓' : exam.icon === 'BookOpen' ? '📖' : '🏛️',
      color: 'dark:bg-[#1E293B] bg-white',
      borderColor: 'dark:border-slate-700/60 border-slate-200',
      badgeBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      path: `/explore/${exam.slug || exam.id}`
    }));
  }, [exams]);

  const shouldShowOnboarding = Boolean(
    user && !guest && profile &&
    (profile.onboarding_completed === false || profile.onboarding_completed === null)
  );

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-800 transition-colors duration-200 overflow-x-hidden">
      {shouldShowOnboarding && <OnboardingModal />}

      {/* Top Ambient Tech/Data Grid Aura */}
      <div className="relative">
        <MountainSunsetAura height={120} showSun={true} />

        {/* Greeting Header overlaid on Tech Banner */}
        <div className="px-3.5 sm:px-6 pt-4 pb-2 relative z-10 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight dark:text-white text-slate-900 flex items-center gap-2">
                <span>{greetingPhrase}, {firstName}</span>
                <span className="text-amber-500 select-none">⚡</span>
              </h1>
              <p className="dark:text-slate-400 text-slate-600 text-xs sm:text-sm mt-1 font-medium">
                {language === 'hi'
                  ? 'अपनी तैयारी जारी रखें और लक्ष्य के करीब पहुँचें।'
                  : 'Keep the streak, stay ahead in your preparation.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 max-w-5xl mx-auto flex flex-col space-y-5 sm:space-y-6 -mt-2 relative z-10">
        {dashboardError && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
            <span>{dashboardError}</span>
            <button
              type="button"
              className="shrink-0 min-h-[44px] rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 dark:border-rose-400/40 dark:hover:bg-rose-950/50"
              onClick={() => setOverviewRetry((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {/* Streak & Today's Goal Glassmorphic Panel (Dopamine Trigger Card) */}
        <section className="order-0 dark:bg-[#1E293B]/90 bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-6 sm:p-8 transition-colors duration-200 shadow-md">
          <div className="grid grid-cols-2 divide-x dark:divide-slate-700/50 divide-slate-200">
            {/* Left: Study Streak - Vibrant Orange Trigger */}
            <div className="flex items-center gap-2.5 sm:gap-3 pr-2 sm:pr-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(249,115,22,0.25)]">
                <Flame className={`w-5 h-5 sm:w-6 sm:h-6 ${streak > 0 ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-neutral-500'}`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-black dark:text-orange-400 text-orange-600 tracking-tight flex items-baseline gap-1">
                  {profileError ? '—' : streak} <span className="text-xs sm:text-sm font-bold dark:text-amber-300 text-amber-700">{language === 'hi' ? 'दिन' : 'Days'}</span>
                </div>
                <div className="text-xs font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider truncate">
                  {language === 'hi' ? 'अध्ययन स्ट्रीक' : 'Study Streak'}
                </div>
              </div>
            </div>

            {/* Right: Today's Goal - Bright Amber Trigger */}
            <div className="flex items-center justify-between pl-2.5 sm:pl-4">
              <div className="min-w-0 pr-1">
                <div className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {profileError ? '—' : todayQuestionsSolved} <span className="text-xs dark:text-slate-400 text-slate-500 font-normal">{profileError ? '' : `/ ${dailyTarget}`}</span>
                </div>
                <div className="text-xs font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider truncate">
                  {language === 'hi' ? 'आज का लक्ष्य' : "Today's Target"}
                </div>
              </div>

              {/* Circular SVG Progress Ring with Bright Amber Accent */}
              <div className="relative w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                <svg className="w-11 h-11 sm:w-14 sm:h-14 -rotate-90 transform" viewBox="0 0 56 56">
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    className="dark:stroke-slate-800 stroke-slate-200"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    className="dark:stroke-amber-400 stroke-amber-500 transition-all duration-700 ease-out"
                    strokeWidth="4"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-black dark:text-amber-400 text-amber-600">
                  {profileError ? '—' : `${goalPercent}%`}
                </div>
              </div>
            </div>
          </div>
          {profileError && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              <span>Profile data abhi load nahi ho paya.</span>
              <button
                type="button"
                className="min-h-[44px] shrink-0 rounded-lg border border-indigo-400/30 px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-200"
                onClick={() => refreshAccount().catch((error) => console.error('Unable to retry profile data:', error))}
              >
                Try again
              </button>
            </div>
          )}
        </section>

        {/* Hero Banner Carousel (Built from Real Exams in DB) */}
        <section className="order-2 relative overflow-hidden rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-indigo-500/25 border-slate-200 p-6 sm:p-8 transition-colors duration-200 shadow-md">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-lg">
              <span className="inline-block text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30">
                {dynamicBanners[activeSlide]?.tag}
              </span>
              <h2 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                {dynamicBanners[activeSlide]?.title}
              </h2>
              <p className="text-sm dark:text-slate-300 text-slate-600 font-medium line-clamp-2">
                {dynamicBanners[activeSlide]?.subtitle}
              </p>
              <div className="pt-2">
                <Link
                  to={dynamicBanners[activeSlide]?.path}
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white font-extrabold text-sm transition-colors min-h-[44px] shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                >
                  <span>{dynamicBanners[activeSlide]?.buttonText}</span>
                  <ArrowRight size={15} strokeWidth={2.5} />
                </Link>
              </div>
            </div>

            {/* Right Side Exam Pill Card */}
            <div className="hidden sm:flex items-center justify-center relative w-40 h-32 shrink-0">
              <div className="w-28 h-24 dark:bg-[#0F172A] bg-slate-50 border dark:border-indigo-500/20 border-slate-200 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {dynamicBanners[activeSlide]?.badgeText}
                  </span>
                  <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <div className="text-xs dark:text-slate-300 text-slate-700 font-bold truncate">
                  {dynamicBanners[activeSlide]?.exam}
                </div>
              </div>
            </div>
          </div>

          {/* Carousel Dot Indicators */}
          {dynamicBanners.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-4">
              {dynamicBanners.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${idx + 1}`}
                  onClick={() => setActiveSlide(idx)}
                  className={`transition-all duration-300 rounded-full h-1.5 ${
                    activeSlide === idx
                      ? 'w-6 dark:bg-white bg-indigo-600 shadow-sm'
                      : 'w-1.5 dark:bg-slate-700 bg-slate-300 hover:bg-indigo-400'
                  }`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick Action 5-Tile Row */}
        <section className="order-3">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {quickActionTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.id}
                  to={tile.path}
                  className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-colors text-center group min-h-[68px] ${tile.bg}`}
                >
                  <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-1 sm:mb-2 shrink-0 ${tile.iconBg}`}>
                    <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <span className="min-h-[2rem] text-xs sm:text-sm font-bold dark:text-white text-slate-800 tracking-tight leading-tight line-clamp-2">
                    {tile.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recommended practice / Continue Where You Left Section */}
        <section className="order-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-lg font-bold dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
              <span>{recommendation
                ? (language === 'hi' ? 'आज का सुझाव' : 'Recommended for today')
                : (language === 'hi' ? 'जहाँ से छोड़ा था वहाँ से शुरू करें' : 'Continue Where You Left')}</span>
            </h3>
            <Link
              to="/tests"
              className="text-sm font-semibold dark:text-indigo-400 text-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors min-h-[32px]"
            >
              <span>{recommendation
                ? (language === 'hi' ? 'दूसरा लक्ष्य चुनें' : 'Choose another goal')
                : (language === 'hi' ? 'सभी देखें' : 'View All')}</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {dashboardLoading ? (
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-6 sm:p-8 min-h-[148px] animate-pulse">
              <div className="h-5 w-2/3 rounded bg-indigo-500/10" />
              <div className="mt-4 h-4 w-1/2 rounded bg-indigo-500/10" />
              <div className="mt-5 h-10 w-32 rounded-xl bg-indigo-500/10" />
            </div>
          ) : recommendation ? (
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-6 sm:p-8 transition-colors shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {language === 'hi' ? 'आज का recommended' : 'Today’s recommended'}
                  </div>
                  <h4 className="mt-2 text-base sm:text-lg font-bold dark:text-white text-slate-900 truncate">
                    {recommendation.title}
                  </h4>
                  <p className="mt-1 text-sm dark:text-slate-300 text-slate-600 font-medium truncate">
                    {recommendation.chapterTitle} · {recommendation.durationMinutes} min
                  </p>
                  {recommendation.test.coin_reward_enabled && (
                    <p className="mt-2 text-sm text-amber-500 dark:text-amber-400 font-semibold">
                      🪙 Rewards enabled for qualifying attempts.
                    </p>
                  )}
                </div>
                <Link
                  to={recommendation.path}
                  className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all ${
                    recommendation.kind === 'resume'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.25)]'
                  }`}
                >
                  {recommendation.kind === 'resume' ? 'Resume' : 'Start'}
                  <ArrowRight size={15} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-6 sm:p-8 flex items-center justify-between gap-3 sm:gap-4 transition-colors shadow-sm">
              <div className="flex items-center gap-3 sm:gap-3.5 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs sm:text-base font-bold dark:text-white text-slate-900 truncate">
                    {continueItem.title}
                  </h4>
                  <div className="text-xs dark:text-slate-400 text-slate-600 font-medium truncate">
                    {continueItem.subtitle}
                  </div>
                  <div className="w-full max-w-xs h-1.5 dark:bg-slate-800 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${continueItem.progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-xs font-black dark:text-amber-400 text-amber-600">
                  {continueItem.progress}%
                </span>
                <Link
                  to={continueItem.path}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors shadow-sm"
                  aria-label="Continue learning"
                >
                  <Play size={16} fill="currentColor" className="ml-0.5 text-white" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Explore Exams Section (Strictly Real DB Exams) */}
        {dynamicExams.length > 0 && (
          <section className="order-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-lg font-bold dark:text-white text-slate-900 tracking-tight">
                {language === 'hi' ? 'उपलब्ध परीक्षाएं' : 'Available Exams'}
              </h3>
              <Link
                to="/explore"
                className="text-sm font-semibold dark:text-indigo-400 text-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors min-h-[32px]"
              >
                <span>{language === 'hi' ? 'सभी देखें' : 'View All'}</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {dynamicExams.map((exam) => (
                <Link
                  key={exam.id}
                  to={exam.path}
                  className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-colors hover:border-indigo-500 group min-h-[120px]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg border bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                      {exam.badge}
                    </div>
                    <ChevronRight size={16} className="text-slate-400 dark:text-white/40 group-hover:text-slate-800 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold dark:text-white text-slate-900 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {exam.title}
                    </h4>
                    <p className="text-xs font-medium dark:text-slate-400 text-slate-600 mt-0.5 line-clamp-2">
                      {exam.subtitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

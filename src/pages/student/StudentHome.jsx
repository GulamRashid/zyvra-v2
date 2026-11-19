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
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getExamCategory, isPublished, sortContentItems } from '../../lib/content';
import { getRecommendedPractice } from '../../lib/recommendations';
import { getAnsweredQuestionCount } from '../../lib/tests';

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

// Quick Action 4-Tile Row with bilingual support
const quickActionTiles = [
  {
    id: 'leaderboard',
    titleEn: 'Ranks',
    titleHi: 'लीडरबोर्ड',
    subtitle: 'Top ranks',
    path: '/analytics',
    icon: Trophy,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-amber-500/20 bg-amber-100 dark:text-amber-400 text-amber-700'
  },
  {
    id: 'bookmarks',
    titleEn: 'Bookmarks',
    titleHi: 'बुकमार्क्स',
    subtitle: 'Saved questions',
    path: '/bookmarks',
    icon: Bookmark,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-400 text-indigo-700'
  },
  {
    id: 'wallet',
    titleEn: 'Wallet',
    titleHi: 'सिक्के / वॉलेट',
    subtitle: 'Your coins',
    path: '/wallet',
    icon: WalletCards,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-400 text-emerald-700'
  },
  {
    id: 'practice',
    titleEn: 'Practice',
    titleHi: 'अभ्यास',
    subtitle: 'Chapter practice',
    path: '/tests',
    icon: BookOpen,
    bg: 'dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-200 text-slate-800',
    iconBg: 'dark:bg-purple-500/20 bg-purple-100 dark:text-purple-400 text-purple-700'
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
    return language === 'hi' ? 'शुभ संध्या' : 'Good Evening';
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
      return sum + getAnsweredQuestionCount(att);
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

  // Real Dynamic Exams mapped strictly from Database with natural sorting & categorization
  const dynamicExams = useMemo(() => {
    const published = exams.filter(isPublished);
    const sorted = sortContentItems(published);
    return sorted.map((exam) => ({
      id: exam.id,
      title: exam.title,
      category: getExamCategory(exam),
      subtitle: exam.description || 'Chapter tests & practice questions',
      icon: exam.icon_url || exam.icon || 'GraduationCap',
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

      {/* Top Hero Promotional Banner */}
      <section className="px-3.5 sm:px-6 pt-3 sm:pt-4 max-w-5xl mx-auto" aria-label="Featured Announcements">
        <HeroCarousel />
      </section>

      {/* Greeting Header */}
      <div className="px-3.5 sm:px-6 pt-3 pb-1 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight dark:text-white text-slate-900 flex items-center gap-2">
              <span>{greetingPhrase}, {firstName}</span>
              <span className="text-amber-500 select-none">⚡</span>
            </h1>
            <p className="dark:text-slate-400 text-slate-600 text-xs sm:text-sm mt-0.5 font-medium">
              {language === 'hi'
                ? 'अपनी तैयारी जारी रखें और लक्ष्य के करीब पहुँचें।'
                : 'Keep the streak, stay ahead in your preparation.'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 max-w-5xl mx-auto flex flex-col space-y-5 sm:space-y-6 pt-1 relative z-10">
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
        <section className="order-0 dark:bg-[#1E293B]/90 bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-3.5 sm:p-6 lg:p-8 transition-colors duration-200 shadow-md">
          <div className="grid grid-cols-2 divide-x dark:divide-slate-700/50 divide-slate-200">
            {/* Left: Study Streak - Vibrant Orange Trigger */}
            <div className="flex items-center gap-2 sm:gap-3 pr-1.5 sm:pr-3">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(249,115,22,0.25)]">
                <Flame className={`w-4 h-4 sm:w-6 sm:h-6 ${streak > 0 ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-neutral-500'}`} />
              </div>
              <div className="min-w-0">
                <div className="text-base sm:text-2xl font-black dark:text-orange-400 text-orange-600 tracking-tight flex items-baseline gap-1">
                  {profileError ? '—' : streak} <span className="text-[11px] sm:text-sm font-bold dark:text-amber-300 text-amber-700">{language === 'hi' ? 'दिन' : 'Days'}</span>
                </div>
                <div className="text-[10px] sm:text-xs font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider truncate">
                  {language === 'hi' ? 'अध्ययन स्ट्रीक' : 'Study Streak'}
                </div>
              </div>
            </div>

            {/* Right: Today's Goal - Bright Amber Trigger */}
            <div className="flex items-center justify-between pl-2 sm:pl-4">
              <div className="min-w-0 pr-1">
                <div className="text-base sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {profileError ? '—' : todayQuestionsSolved} <span className="text-[10px] sm:text-xs dark:text-slate-400 text-slate-500 font-normal">{profileError ? '' : `/ ${dailyTarget}`}</span>
                </div>
                <div className="text-[10px] sm:text-xs font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider truncate">
                  {language === 'hi' ? 'आज का लक्ष्य' : "Today's Target"}
                </div>
              </div>

              {/* Circular SVG Progress Ring with Bright Amber Accent */}
              <div className="relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                <svg className="w-10 h-10 sm:w-14 sm:h-14 -rotate-90 transform" viewBox="0 0 56 56">
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
                <div className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-black dark:text-amber-400 text-amber-600">
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

        {/* Primary 4-Track Study Gateways (Clear, Intuitive, No Confusing Duplicates) */}
        <section className="order-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. My Courses Gateway */}
          <Link
            to="/purchases"
            className="p-3 sm:p-4 rounded-2xl dark:bg-gradient-to-br dark:from-indigo-950/40 dark:to-slate-900 bg-gradient-to-br from-indigo-50/90 to-white border dark:border-indigo-500/30 border-indigo-200/90 hover:border-indigo-500 flex flex-col justify-between gap-2.5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <GraduationCap size={19} />
              </div>
              <ArrowRight size={14} className="text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
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

          {/* 2. Mock Tests Gateway */}
          <Link
            to="/tests?tab=tests"
            className="p-3 sm:p-4 rounded-2xl dark:bg-gradient-to-br dark:from-emerald-950/40 dark:to-slate-900 bg-gradient-to-br from-emerald-50/90 to-white border dark:border-emerald-500/30 border-emerald-200/90 hover:border-emerald-500 flex flex-col justify-between gap-2.5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Target size={19} />
              </div>
              <ArrowRight size={14} className="text-emerald-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">
                {language === 'hi' ? 'मॉक टेस्ट्स' : 'Mock Tests'}
              </h4>
              <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
                {language === 'hi' ? 'फुल टेस्ट्स व टाइमर' : 'Real timed exam mocks'}
              </p>
            </div>
          </Link>

          {/* 3. Explore Syllabus Gateway */}
          <Link
            to="/explore"
            className="p-3 sm:p-4 rounded-2xl dark:bg-gradient-to-br dark:from-amber-950/40 dark:to-slate-900 bg-gradient-to-br from-amber-50/90 to-white border dark:border-amber-500/30 border-amber-200/90 hover:border-amber-500 flex flex-col justify-between gap-2.5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Compass size={19} />
              </div>
              <ArrowRight size={14} className="text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
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

          {/* 4. Study Toolbox Gateway */}
          <Link
            to="/toolbox"
            className="p-3 sm:p-4 rounded-2xl dark:bg-gradient-to-br dark:from-cyan-950/40 dark:to-slate-900 bg-gradient-to-br from-cyan-50/90 to-white border dark:border-cyan-500/30 border-cyan-200/90 hover:border-cyan-500 flex flex-col justify-between gap-2.5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Wrench size={19} />
              </div>
              <ArrowRight size={14} className="text-cyan-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors leading-tight">
                {language === 'hi' ? 'स्टडी टूल्स' : 'Study Toolbox'}
              </h4>
              <p className="text-[10px] sm:text-[11px] dark:text-slate-400 text-slate-500 font-medium truncate mt-0.5">
                {language === 'hi' ? 'नोट्स, फॉर्मूला व टाइमर' : 'Notes, formulas & timer'}
              </p>
            </div>
          </Link>
        </section>

        {/* Quick Utility 4-Tile Row */}
        <section className="order-2">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {quickActionTiles.map((tile) => {
              const Icon = tile.icon;
              const content = (
                <>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-1 sm:mb-1.5 shrink-0 ${tile.iconBg}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="min-h-[1.75rem] text-[11px] sm:text-xs font-bold dark:text-white text-slate-800 tracking-tight leading-tight line-clamp-2">
                    {language === 'hi' ? tile.titleHi : tile.titleEn}
                  </span>
                </>
              );

              if (tile.isAction) {
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={tile.action}
                    className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border transition-colors text-center group min-h-[64px] active:scale-95 ${tile.bg}`}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link
                  key={tile.id}
                  to={tile.path}
                  className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border transition-colors text-center group min-h-[64px] active:scale-95 ${tile.bg}`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recommended practice / Continue Where You Left Section */}
        <section className="order-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-base font-bold dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
              <span>{recommendation
                ? (language === 'hi' ? 'आज का अनुशंसित अभ्यास' : 'Recommended For Today')
                : (language === 'hi' ? 'जहाँ से छोड़ा था वहाँ से शुरू करें' : 'Continue Where You Left')}</span>
            </h3>
            <Link
              to="/tests"
              className="text-xs sm:text-sm font-semibold dark:text-indigo-400 text-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors min-h-[32px]"
            >
              <span>{recommendation
                ? (language === 'hi' ? 'अन्य टेस्ट देखें' : 'Choose another goal')
                : (language === 'hi' ? 'सभी देखें' : 'View All')}</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {dashboardLoading ? (
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-2xl p-3.5 sm:p-5 min-h-[120px] animate-pulse">
              <div className="h-4 w-2/3 rounded bg-indigo-500/10" />
              <div className="mt-3 h-3.5 w-1/2 rounded bg-indigo-500/10" />
              <div className="mt-4 h-9 w-28 rounded-xl bg-indigo-500/10" />
            </div>
          ) : recommendation ? (
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-2xl p-3.5 sm:p-5 transition-colors shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {language === 'hi' ? 'आज का अनुशंसित टेस्ट' : 'Recommended For Today'}
                  </div>
                  <h4 className="mt-1 text-sm sm:text-base font-bold dark:text-white text-slate-900 truncate">
                    {recommendation.title}
                  </h4>
                  <p className="mt-0.5 text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium truncate">
                    {recommendation.chapterTitle} · {recommendation.durationMinutes} min
                  </p>
                  {recommendation.test.coin_reward_enabled && (
                    <p className="mt-1 text-xs text-amber-500 dark:text-amber-400 font-semibold">
                      🪙 {language === 'hi' ? 'टेस्ट पूरा करने पर कॉइन रिवार्ड्स उपलब्ध हैं' : 'Rewards enabled for qualifying attempts.'}
                    </p>
                  )}
                </div>
                <Link
                  to={recommendation.path}
                  className={`inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-black transition-all ${
                    recommendation.kind === 'resume'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-glowIndigo'
                  }`}
                >
                  {recommendation.kind === 'resume'
                    ? (language === 'hi' ? 'जारी रखें' : 'Resume')
                    : (language === 'hi' ? 'शुरू करें' : 'Start')}
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between gap-3 transition-colors shadow-sm">
              <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">
                    {continueItem.title}
                  </h4>
                  <div className="text-[11px] sm:text-xs dark:text-slate-400 text-slate-600 font-medium truncate">
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
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-black dark:text-amber-400 text-amber-600">
                  {continueItem.progress}%
                </span>
                <Link
                  to={continueItem.path}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors shadow-sm"
                  aria-label="Continue learning"
                >
                  <Play size={14} fill="currentColor" className="ml-0.5 text-white" />
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
                  className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between transition-colors hover:border-indigo-500 group min-h-[110px] shadow-xs"
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 p-1.5">
                      <ContentIcon icon={exam.icon} className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {exam.category}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold dark:text-white text-slate-900 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {exam.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs font-medium dark:text-slate-400 text-slate-600 mt-0.5 line-clamp-2">
                      {exam.subtitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

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
    </div>
  );
}

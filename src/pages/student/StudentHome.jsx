import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coins,
  Compass,
  FileText,
  Flame,
  GraduationCap,
  HelpCircle,
  Layers,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';
import OnboardingModal from './OnboardingModal';

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
    id: 'practice',
    title: 'Practice',
    subtitle: 'Chapter MCQs',
    path: '/tests',
    icon: ClipboardList,
    bg: 'bg-emerald-950/70 border-emerald-500/25 text-emerald-400',
    iconBg: 'bg-emerald-500/20 text-emerald-300'
  },
  {
    id: 'mock',
    title: 'Mock Test',
    subtitle: 'Full length',
    path: '/tests?tab=tests',
    icon: Target,
    bg: 'bg-teal-950/70 border-teal-500/25 text-teal-400',
    iconBg: 'bg-teal-500/20 text-teal-300'
  },
  {
    id: 'toolbox',
    title: 'Toolbox',
    subtitle: 'Study tools',
    path: '/toolbox',
    icon: Layers,
    bg: 'bg-emerald-950/70 border-emerald-500/25 text-emerald-400',
    iconBg: 'bg-emerald-500/20 text-emerald-300'
  },
  {
    id: 'performance',
    title: 'Performance',
    subtitle: 'Analytics & rank',
    path: '/analytics',
    icon: TrendingUp,
    bg: 'bg-cyan-950/70 border-cyan-500/25 text-cyan-400',
    iconBg: 'bg-cyan-500/20 text-cyan-300'
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    subtitle: 'Top ranks',
    path: '/analytics',
    icon: Trophy,
    bg: 'bg-amber-950/70 border-amber-500/25 text-amber-400',
    iconBg: 'bg-amber-500/20 text-amber-300'
  }
];

export default function StudentHome() {
  const { profile, coinBalance, guest, user, supabase, refreshAccount } = useAuth();
  const { t, language } = useThemeLanguage();
  const { exams, folders, chapters } = useContentCatalog();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [resumeAttempt, setResumeAttempt] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(Boolean(supabase && user));
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
      try {
        const { data: tests } = await supabase
          .from('tests')
          .select('id,title,chapter_id,status,duration_minutes,is_free,price')
          .in('status', ['published', 'live', 'available']);

        if (!active) return;
        setAvailableTests(tests || []);

        if (!user) {
          setDashboardLoading(false);
          return;
        }

        const { data: rows } = await supabase
          .from('test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (!active) return;
        const userAttempts = rows || [];
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
      } finally {
        if (active) setDashboardLoading(false);
      }
    };

    loadOverview();
    return () => { active = false; };
  }, [supabase, user]);

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
        gradient: 'from-emerald-950/80 via-emerald-900/40 to-teal-950/70'
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
        gradient: 'from-emerald-950/80 via-emerald-900/40 to-teal-950/70'
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
        path: `/quiz/${last.test_id}/result`,
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

  // Real Dynamic Exams mapped strictly from Database
  const dynamicExams = useMemo(() => {
    return exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      subtitle: exam.description || 'Chapter tests & practice questions',
      badge: exam.icon === 'GraduationCap' ? '🎓' : exam.icon === 'BookOpen' ? '📖' : '🏛️',
      color: 'from-emerald-950 to-[#072418]',
      borderColor: 'border-emerald-500/30',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      path: `/explore/${exam.slug || exam.id}`
    }));
  }, [exams]);

  const shouldShowOnboarding = Boolean(
    user && !guest && profile &&
    (profile.onboarding_completed === false || profile.onboarding_completed === null)
  );

  return (
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] pb-28 md:pb-12">
      {shouldShowOnboarding && <OnboardingModal />}

      {/* Top Ambient Mountain Aura */}
      <div className="relative">
        <MountainSunsetAura height={190} showSun={true} />

        {/* Greeting Header overlaid on Mountain Banner */}
        <div className="px-4 sm:px-6 pt-4 pb-2 relative z-10 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>{greetingPhrase}, {firstName}</span>
                <span className="text-amber-400 select-none">👋</span>
              </h1>
              <p className="text-emerald-300/80 text-xs sm:text-sm mt-1 font-medium">
                {language === 'hi'
                  ? 'अपनी तैयारी जारी रखें और लक्ष्य के करीब पहुँचें।'
                  : 'Keep the streak, stay ahead in your preparation.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 max-w-5xl mx-auto space-y-6 -mt-2 relative z-10">
        {/* Streak & Today's Goal Glassmorphic Panel */}
        <section className="bg-[#072117]/85 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div className="grid grid-cols-2 divide-x divide-emerald-800/40">
            {/* Left: Study Streak */}
            <div className="flex items-center gap-3 pr-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-600/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                <Flame className={`w-6 h-6 ${streak > 0 ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-neutral-500'}`} />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
                  {streak} <span className="text-sm font-semibold text-emerald-200/90">{language === 'hi' ? 'दिन' : 'Days'}</span>
                </div>
                <div className="text-[11px] sm:text-xs font-medium text-emerald-400/80">
                  {language === 'hi' ? 'अध्ययन स्ट्रीक' : 'Study Streak'}
                </div>
              </div>
            </div>

            {/* Right: Today's Goal */}
            <div className="flex items-center justify-between pl-3 sm:pl-4">
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {todayQuestionsSolved} <span className="text-xs text-neutral-400 font-normal">/ {dailyTarget}</span>
                </div>
                <div className="text-[11px] sm:text-xs font-medium text-emerald-400/80 truncate">
                  {language === 'hi' ? 'आज का लक्ष्य' : "Today's Target"}
                </div>
              </div>

              {/* Circular SVG Progress Ring */}
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 56 56">
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    className="stroke-emerald-950/80"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    className="stroke-emerald-400 transition-all duration-700 ease-out"
                    strokeWidth="4"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                  {goalPercent}%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hero Banner Carousel (Built from Real Exams in DB) */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#06261c] via-[#083526] to-[#041a12] border border-emerald-500/25 p-5 sm:p-7 shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-lg">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {dynamicBanners[activeSlide]?.tag}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {dynamicBanners[activeSlide]?.title}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200/80 font-medium line-clamp-2">
                {dynamicBanners[activeSlide]?.subtitle}
              </p>
              <div className="pt-2">
                <Link
                  to={dynamicBanners[activeSlide]?.path}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-extrabold text-sm shadow-[0_4px_20px_rgba(245,197,66,0.35)] transition-transform hover:scale-105 active:scale-95"
                >
                  <span>{dynamicBanners[activeSlide]?.buttonText}</span>
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
            </div>

            {/* Right Side Exam Pill Card */}
            <div className="hidden sm:flex items-center justify-center relative w-40 h-32 shrink-0">
              <div className="w-28 h-24 bg-gradient-to-br from-[#0c3829] to-[#062117] border border-emerald-400/30 rounded-2xl p-3 flex flex-col justify-between shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400">
                    {dynamicBanners[activeSlide]?.badgeText}
                  </span>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
                <div className="text-[10px] text-emerald-300/80 font-bold truncate">
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
                      ? 'w-6 bg-white shadow-sm'
                      : 'w-1.5 bg-emerald-700/50 hover:bg-emerald-600/70'
                  }`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick Action 5-Tile Row */}
        <section>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {quickActionTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.id}
                  to={tile.path}
                  className={`flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-2xl border transition-all duration-200 hover:scale-105 active:scale-95 text-center group ${tile.bg}`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-1.5 sm:mb-2 shadow-inner transition-transform group-hover:scale-110 ${tile.iconBg}`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-white tracking-tight line-clamp-1">
                    {tile.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Continue Where You Left Section */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{language === 'hi' ? 'जहाँ से छोड़ा था वहाँ से शुरू करें' : 'Continue Where You Left'}</span>
            </h3>
            <Link
              to="/tests"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <span>{language === 'hi' ? 'सभी देखें' : 'View All'}</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="bg-[#072117]/85 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:border-emerald-500/40">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600/30 to-teal-700/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <h4 className="text-sm sm:text-base font-bold text-white truncate">
                  {continueItem.title}
                </h4>
                <div className="text-xs text-emerald-400/80 font-medium">
                  {continueItem.subtitle}
                </div>
                {/* Progress bar */}
                <div className="w-full max-w-xs h-1.5 bg-emerald-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-[#22c55e] rounded-full transition-all duration-500"
                    style={{ width: `${continueItem.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Progress % and Play Button */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-extrabold text-emerald-300">
                {continueItem.progress}%
              </span>
              <Link
                to={continueItem.path}
                className="w-10 h-10 rounded-full bg-[#22c55e] hover:bg-emerald-400 text-black flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-transform hover:scale-110 active:scale-95"
                aria-label="Continue learning"
              >
                <Play size={18} fill="currentColor" className="ml-0.5 text-black" />
              </Link>
            </div>
          </div>
        </section>

        {/* Explore Exams Section (Strictly Real DB Exams) */}
        {dynamicExams.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {language === 'hi' ? 'उपलब्ध परीक्षाएं' : 'Available Exams'}
              </h3>
              <Link
                to="/explore"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
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
                  className="bg-gradient-to-br from-emerald-950 to-[#072418] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] hover:border-emerald-400 active:scale-98 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg border bg-amber-500/20 text-amber-300 border-amber-500/30">
                      {exam.badge}
                    </div>
                    <ChevronRight size={16} className="text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                      {exam.title}
                    </h4>
                    <p className="text-[11px] font-medium text-emerald-400/80 mt-0.5 line-clamp-2">
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

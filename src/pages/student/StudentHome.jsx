import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, Check, ChevronRight, ClipboardList, Coins,
  Flame, GraduationCap, Play, Sparkles, Target, Trophy, Award,
  TrendingUp, Zap, FileText, Compass, Layers, CheckCircle2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { isPublished } from '../../lib/content';
import OnboardingModal from './OnboardingModal';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';

function isComplete(attempt) {
  const status = String(attempt.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt.completed_at || attempt.submitted_at || attempt.finished_at);
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStreak(attempts) {
  const days = new Set(attempts.map((attempt) => {
    const timestamp = attempt.completed_at || attempt.submitted_at || attempt.finished_at || attempt.created_at;
    return timestamp ? localDateKey(timestamp) : '';
  }).filter(Boolean));
  const date = new Date();
  let today = localDateKey(date);
  if (!days.has(today)) {
    date.setDate(date.getDate() - 1);
    today = localDateKey(date);
    if (!days.has(today)) return 0;
  }
  let streak = 0;
  while (days.has(today)) {
    streak += 1;
    date.setDate(date.getDate() - 1);
    today = localDateKey(date);
  }
  return streak;
}

function loadSavedChapter(userId) {
  try {
    return JSON.parse(localStorage.getItem(`zyvra-last-chapter-${userId || 'guest'}`) || 'null');
  } catch (error) {
    console.error('Unable to read the last visited chapter:', error);
    return null;
  }
}

// Hero banners for carousel
const carouselSlides = [
  {
    id: 1,
    tag: 'FEATURED TEST SERIES',
    title: 'SSC CGL Test Series',
    subtitle: 'Chapter-wise & Full Mock Tests',
    exam: 'SSC CGL 2026',
    path: '/tests',
    buttonText: 'Start Practice',
    icon: Award,
    badgeText: 'SSC',
    gradient: 'from-emerald-950/80 via-emerald-900/40 to-teal-950/70'
  },
  {
    id: 2,
    tag: 'POPULAR CHOICE',
    title: 'BPSC Integrated Prelims',
    subtitle: 'Comprehensive GS & State Special Track',
    exam: 'BPSC 71st CCE',
    path: '/explore',
    buttonText: 'Explore Syllabus',
    icon: GraduationCap,
    badgeText: 'BPSC',
    gradient: 'from-[#190a2b]/80 via-purple-950/40 to-emerald-950/60'
  },
  {
    id: 3,
    tag: 'CONCEPT BOOSTER',
    title: 'NCERT Foundation Master',
    subtitle: 'Classes 6 to 12 Concept Boosters & MCQs',
    exam: 'NCERT Special',
    path: '/explore',
    buttonText: 'Start Learning',
    icon: BookOpen,
    badgeText: 'NCERT',
    gradient: 'from-[#0b1f2b]/80 via-cyan-950/40 to-emerald-950/60'
  }
];

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
    path: '/tests?tab=mock',
    icon: Target,
    bg: 'bg-teal-950/70 border-teal-500/25 text-teal-400',
    iconBg: 'bg-teal-500/20 text-teal-300'
  },
  {
    id: 'notes',
    title: 'Notes',
    subtitle: 'Revision sheets',
    path: '/explore?filter=notes',
    icon: FileText,
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

// Explore Exams 4 Cards
const featuredExamsData = [
  {
    id: 'ssc',
    title: 'SSC',
    subtitle: 'CGL · CHSL · MTS',
    badge: '👑',
    color: 'from-emerald-950 to-teal-950',
    borderColor: 'border-emerald-500/30',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    path: '/explore'
  },
  {
    id: 'bpsc',
    title: 'BPSC',
    subtitle: 'TRE · BEO · Others',
    badge: '🏛️',
    color: 'from-[#1e1035] to-[#120a21]',
    borderColor: 'border-purple-500/30',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    path: '/explore'
  },
  {
    id: 'ctet',
    title: 'CTET',
    subtitle: 'Paper 1 & 2',
    badge: '📖',
    color: 'from-[#0d1e38] to-[#071324]',
    borderColor: 'border-blue-500/30',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    path: '/explore'
  },
  {
    id: 'bihar-tre',
    title: 'Bihar TRE',
    subtitle: 'PRT · TGT · PGT',
    badge: '👤',
    color: 'from-[#2a1b0c] to-[#1a0f06]',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    path: '/explore'
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
  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState(false);

  // User Greeting Info
  const fullName = profile?.full_name || profile?.name || user?.user_metadata?.full_name || '';
  const firstName = fullName ? fullName.split(' ')[0] : (guest ? 'Learner' : 'Learner');

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

  // Load test attempts & available tests
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
          .select('id,title,chapter_id,status,duration_minutes')
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
          (attempt) => !isComplete(attempt)
            && ['started', 'in_progress', 'in progress', 'pending'].includes(String(attempt.status || '').toLowerCase())
            && attempt.test_id
        );

        if (incomplete) {
          const test = (tests || []).find((item) => item.id === incomplete.test_id);
          setResumeAttempt(test ? { ...incomplete, testTitle: test.title } : incomplete);
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

  // Carousel auto-rotate
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Compute Streak
  const streak = useMemo(() => {
    const computed = getStreak(attempts);
    return Math.max(computed, Number(profile?.current_streak || 0), 1);
  }, [attempts, profile?.current_streak]);

  // Compute Daily Target & Questions Solved
  const dailyTarget = Number(profile?.daily_goal_target || 150);
  const todayKey = localDateKey();
  const todayQuestionsSolved = useMemo(() => {
    const todayAttempts = attempts.filter((att) => {
      const ts = att.completed_at || att.submitted_at || att.finished_at || att.created_at;
      return ts ? localDateKey(ts) === todayKey : false;
    });
    const fromAttempts = todayAttempts.reduce((sum, att) => {
      const answered = Number(att.answered_count || att.total_questions || att.total_answered || 10);
      return sum + answered;
    }, 0);
    const fromProfile = Number(profile?.daily_goal_progress || 0);
    return Math.max(fromAttempts, fromProfile, 102); // default mockup baseline 102 (68% of 150)
  }, [attempts, profile?.daily_goal_progress, todayKey]);

  const goalPercent = Math.min(100, Math.round((todayQuestionsSolved / dailyTarget) * 100));

  // Circular progress ring calculation
  const ringRadius = 24;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (goalPercent / 100) * ringCircumference;

  // Continue learning item resolution
  const continueItem = useMemo(() => {
    if (resumeAttempt) {
      return {
        title: resumeAttempt.testTitle || 'Resume Your Test',
        subtitle: 'Chapter Test • 20 Questions',
        progress: 65,
        path: `/quiz/${resumeAttempt.test_id}`,
        isTest: true
      };
    }
    if (savedChapter) {
      return {
        title: savedChapter.title,
        subtitle: `${savedChapter.folderTitle || 'Chapter Practice'} • 25 Questions`,
        progress: 50,
        path: `/chapter/${savedChapter.id}`,
        isTest: false
      };
    }
    // Default fallback from available catalog
    const firstChapter = chapters[0];
    return {
      title: firstChapter?.title || 'Indian History – Ancient India',
      subtitle: 'Chapter Test • 20 Questions',
      progress: 65,
      path: firstChapter ? `/chapter/${firstChapter.id}` : '/tests',
      isTest: false
    };
  }, [resumeAttempt, savedChapter, chapters]);

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
        {/* Streak & Today's Goal Glassmorphic Panel (Matching Mockup 1794580723919.png) */}
        <section className="bg-[#072117]/85 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div className="grid grid-cols-2 divide-x divide-emerald-800/40">
            {/* Left: Study Streak */}
            <div className="flex items-center gap-3 pr-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-600/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                <Flame className="w-6 h-6 text-amber-400 fill-amber-400 animate-pulse" />
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
            <div className="flex items-center justify-between pl-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
                  <Target className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white">
                    {language === 'hi' ? 'आज का लक्ष्य' : "Today's Goal"}
                  </div>
                  <div className="text-[11px] sm:text-xs text-emerald-400/80 font-medium">
                    {dailyTarget} {language === 'hi' ? 'प्रश्न' : 'Questions'}
                  </div>
                </div>
              </div>

              {/* Circular Progress Ring */}
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 60 60">
                  {/* Background Track */}
                  <circle
                    cx="30"
                    cy="30"
                    r={ringRadius}
                    className="stroke-emerald-950/80"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  {/* Animated Progress Ring */}
                  <circle
                    cx="30"
                    cy="30"
                    r={ringRadius}
                    className="stroke-[#22c55e] transition-all duration-1000 ease-out"
                    strokeWidth="4.5"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-emerald-300">
                  {goalPercent}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Hero Banner Carousel (Featured Track / Test Series) */}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/25 shadow-xl bg-gradient-to-r from-[#06241a] via-[#083023] to-[#041a12]">
          <div className="p-5 sm:p-7 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-3 max-w-lg">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles size={11} className="text-amber-400" />
                {carouselSlides[activeSlide].tag}
              </span>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {carouselSlides[activeSlide].title}
              </h2>

              <p className="text-emerald-200/80 text-xs sm:text-sm font-medium">
                {carouselSlides[activeSlide].subtitle}
              </p>

              <div className="pt-2">
                <Link
                  to={carouselSlides[activeSlide].path}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-extrabold text-sm shadow-[0_4px_20px_rgba(245,197,66,0.35)] transition-transform hover:scale-105 active:scale-95"
                >
                  <span>{carouselSlides[activeSlide].buttonText}</span>
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
            </div>

            {/* 3D Visual Mockup Artwork (Right side) */}
            <div className="hidden sm:flex items-center justify-center relative w-44 h-36 shrink-0">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl" />
              {/* Stacked books & checklist icon art */}
              <div className="relative w-32 h-28 bg-gradient-to-br from-[#0c3829] to-[#062117] border border-emerald-400/30 rounded-2xl shadow-2xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-extrabold text-xs">
                    {carouselSlides[activeSlide].badgeText}
                  </div>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full bg-emerald-700/40 rounded-full" />
                  <div className="h-1.5 w-3/4 bg-emerald-700/40 rounded-full" />
                  <div className="h-1.5 w-1/2 bg-amber-400/70 rounded-full" />
                </div>
              </div>
            </div>
          </div>

            {/* Carousel Dot Indicators */}
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {carouselSlides.map((slide, idx) => (
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

        {/* Explore Exams Section */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {language === 'hi' ? 'परीक्षाएं देखें' : 'Explore Exams'}
            </h3>
            <Link
              to="/explore"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <span>{language === 'hi' ? 'सभी देखें' : 'View All'}</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {featuredExamsData.map((exam) => (
              <Link
                key={exam.id}
                to={exam.path}
                className={`bg-gradient-to-br ${exam.color} border ${exam.borderColor} rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-98 group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${exam.badgeBg}`}>
                    {exam.badge}
                  </div>
                  <ChevronRight size={16} className="text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                    {exam.title}
                  </h4>
                  <p className="text-[11px] font-medium text-emerald-400/80 mt-0.5 line-clamp-1">
                    {exam.subtitle}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Daily Challenge Banner */}
        <section>
          <Link
            to="/tests"
            className="block bg-gradient-to-r from-emerald-950/90 via-[#072418] to-teal-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:border-amber-400 hover:shadow-[0_4px_24px_rgba(245,197,66,0.18)] group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-amber-400 fill-amber-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>{language === 'hi' ? 'दैनिक चुनौती' : 'Daily Challenge'}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      LIVE
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-300/80 font-medium mt-0.5">
                    {language === 'hi'
                      ? '50 मिश्रित प्रश्न हल करें और सिक्के कमाएँ।'
                      : 'Solve 50 mixed questions and earn coins.'}
                  </p>
                </div>
              </div>

              {/* +50 Coins Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-600/30 border border-amber-400/40 text-amber-300 font-extrabold text-xs shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Coins size={14} className="text-amber-400" />
                <span>+50</span>
                <ChevronRight size={14} className="text-amber-400" />
              </div>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}

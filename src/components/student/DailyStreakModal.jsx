import { useEffect } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Flame,
  Sparkles,
  Trophy,
  X,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useModalBack from '../../hooks/useModalBack';
import LottiePlayer from '../common/LottiePlayer';
import { streakFlameAnimationData } from '../../assets/animations/streakFlameData';

export default function DailyStreakModal({ isOpen, onClose, streakData }) {
  useModalBack(isOpen, onClose, 'daily-streak');
  const { language } = useThemeLanguage();
  const navigate = useNavigate();
  const isHi = language === 'hi';

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !streakData) return null;

  const {
    currentStreak = 0,
    longestStreak = 0,
    isActiveToday = false,
    streakAtRisk = false,
    last7Days = [],
    milestones = [],
    nextMilestone = null,
    milestonePercent = 0,
    totalActiveDays = 0,
    motivationalMessageEn = '',
    motivationalMessageHi = ''
  } = streakData;

  const handleStartPractice = () => {
    onClose();
    navigate('/tests');
  };

  const handleExploreTools = () => {
    onClose();
    navigate('/toolbox');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[min(32rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-2xl p-4 sm:p-6 text-left dark:text-slate-100 text-slate-800 transition-all custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={isHi ? 'बंद करें' : 'Close'}
        >
          <X size={20} />
        </button>

        {/* Hero Section: Flame & Current Streak */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="relative mb-3">
            {currentStreak > 0 && (
              <div className="absolute -inset-4 flex items-center justify-center pointer-events-none z-0">
                <LottiePlayer
                  animationData={streakFlameAnimationData}
                  className="w-32 h-32 opacity-85"
                  loop={true}
                />
              </div>
            )}
            <div className={`relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105 ${
              currentStreak > 0
                ? 'bg-gradient-to-tr from-orange-500 via-amber-500 to-yellow-400 shadow-orange-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-500'
            }`}>
              <Flame
                size={48}
                className={currentStreak > 0 ? 'text-white fill-white animate-pulse' : 'text-slate-500'}
              />
            </div>
            {currentStreak > 0 && (
              <span className="relative z-20 absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-neutral-950 text-amber-400 border border-amber-400/40 shadow-md flex items-center gap-1">
                <Sparkles size={12} /> {currentStreak}d
              </span>
            )}
          </div>

          <h2 id="streak-modal-title" className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white text-slate-900">
            {currentStreak} {isHi ? 'दिन की अध्ययन स्ट्रीक' : 'Day Study Streak'}
          </h2>

          {/* Dynamic Status Badge */}
          <div className="mt-2.5">
            {isActiveToday ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>{isHi ? 'आज की स्ट्रीक पूरी हो गई!' : 'Streak Secured for Today!'}</span>
              </div>
            ) : streakAtRisk ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-sm animate-pulse">
                <Clock size={14} className="text-amber-500" />
                <span>{isHi ? 'आज का अभ्यास बाकी है • स्ट्रीक बढ़ाएं' : 'Pending Today • Study to Keep Alive'}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-400 shadow-sm">
                <Zap size={14} className="text-indigo-500" />
                <span>{isHi ? 'आज से नई स्ट्रीक शुरू करें' : 'Start Your Streak Today'}</span>
              </div>
            )}
          </div>

          <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm">
            {isHi ? motivationalMessageHi : motivationalMessageEn}
          </p>
        </div>

        {/* 7-Day Rolling Calendar Tracker */}
        <div className="mt-3 p-4 rounded-2xl dark:bg-slate-900/80 bg-slate-50 border dark:border-slate-800 border-slate-200">
          <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {isHi ? 'पिछले 7 दिन की सक्रियता' : 'Past 7 Days Activity'}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {isHi ? 'दैनिक लक्ष्य: 1 सत्र' : 'Goal: 1 session/day'}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
            {last7Days.map((day) => (
              <div
                key={day.date}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                  day.isToday
                    ? 'ring-2 ring-orange-500 dark:bg-orange-500/10 bg-orange-50'
                    : 'dark:bg-slate-800/60 bg-white border dark:border-slate-700/50 border-slate-200'
                }`}
              >
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {isHi ? day.dayNameHi : day.dayNameEn}
                </span>
                <span className="text-xs font-black my-1 dark:text-slate-200 text-slate-800">
                  {day.dayNum}
                </span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  day.studied
                    ? 'bg-orange-500 text-white shadow-xs'
                    : day.isToday
                    ? 'border-2 border-dashed border-amber-400 text-amber-500'
                    : 'bg-slate-200 dark:bg-slate-700 text-transparent'
                }`}>
                  {day.studied ? (
                    <Flame size={12} className="fill-white" />
                  ) : day.isToday ? (
                    <Clock size={10} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Stats: Longest Streak & Total Active Days */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Trophy size={18} />
            </div>
            <div>
              <div className="text-lg font-black dark:text-white text-slate-900">{longestStreak} {isHi ? 'दिन' : 'days'}</div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isHi ? 'सर्वश्रेष्ठ रिकॉर्ड' : 'Longest Streak'}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shrink-0">
              <Award size={18} />
            </div>
            <div>
              <div className="text-lg font-black dark:text-white text-slate-900">{totalActiveDays} {isHi ? 'दिन' : 'days'}</div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isHi ? 'कुल अध्ययन दिवस' : 'Total Active Days'}
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Journey & Coin Rewards */}
        <div className="mt-4 p-4 rounded-2xl dark:bg-slate-900/80 bg-slate-50 border dark:border-slate-800 border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              {isHi ? 'अगला लक्ष्य' : 'Next Milestone'}: {isHi ? nextMilestone?.labelHi : nextMilestone?.labelEn} ({nextMilestone?.days} {isHi ? 'दिन' : 'days'})
            </span>
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Coins size={13} /> +{nextMilestone?.bonusCoins} {isHi ? 'सिक्के' : 'Coins'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${milestonePercent}%` }}
            />
          </div>

          {/* Milestone Badges Pills */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
            {milestones.map((m) => (
              <div
                key={m.days}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
                  m.unlocked
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                    : 'dark:bg-slate-800/40 bg-white border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                }`}
              >
                <span className="text-base mb-0.5">{m.icon}</span>
                <span>{m.days} {isHi ? 'दिन' : 'days'}</span>
                {m.unlocked ? (
                  <span className="text-[9px] text-emerald-500 font-black mt-0.5">✓ {isHi ? 'अनलॉक' : 'Done'}</span>
                ) : (
                  <span className="text-[9px] text-slate-400 mt-0.5">+{m.bonusCoins}c</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Non-Shaming Philosophy Notice */}
        <div className="mt-4 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">🌱</span>
          <p className="leading-relaxed">
            {isHi
              ? 'बिना किसी तनाव के अपनी गति से तैयारी करें। कभी कोई दिन छूट भी जाए तो कोई बात नहीं—आपका ज्ञान और समर्पण हमेशा बना रहता है। जब चाहें नई स्ट्रीक शुरू करें!'
              : 'Consistent daily revision builds long-term memory. If life gets in the way and you miss a day, never worry—your progress remains secure and you can resume anytime!'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleStartPractice}
            className="flex-1 py-3 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 transition-all text-center flex items-center justify-center gap-2"
          >
            <Flame size={16} className="fill-white" />
            {isHi ? 'आज का टेस्ट / अभ्यास करें' : "Start Today's Practice"}
          </button>
          <button
            type="button"
            onClick={handleExploreTools}
            className="py-3 px-4 rounded-xl font-bold text-sm dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-center"
          >
            {isHi ? 'स्टडी टूल्स देखें' : 'Study Tools'}
          </button>
        </div>
      </div>
    </div>
  );
}

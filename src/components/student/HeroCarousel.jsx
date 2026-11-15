import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Calendar,
  Coins,
  ArrowRight,
  CheckCircle2,
  Share2,
  Target,
  Trophy,
  Rocket,
  Flame
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import DailyChallengeModal from '../common/DailyChallengeModal';

const PRESET_ICONS = {
  target: { Icon: Target, color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30' },
  trophy: { Icon: Trophy, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  rocket: { Icon: Rocket, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' },
  coins: { Icon: Coins, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  sale: { Icon: Flame, color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' }
};

export default function HeroCarousel({ onOpenReferral }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState([]);
  const [qotdData, setQotdData] = useState(null);
  const [isQotdModalOpen, setIsQotdModalOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Touch swipe support
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  // 1. Fetch Question of the Day status
  const fetchQotd = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_today_daily_challenge');
      if (!error && data) {
        setQotdData(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Fetch Active Promotional Banners
  const fetchBanners = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBanners(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchQotd();
    fetchBanners();
  }, [fetchQotd, fetchBanners]);

  // Total slides = 1 (QotD) + banners.length + 1 (Refer & Earn)
  const totalSlides = 1 + banners.length + 1;

  // Auto-advance timer (5 seconds)
  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, totalSlides]);

  // Touch Swipe Handlers
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    const delta = touchStartXRef.current - touchEndXRef.current;
    if (delta > 45) {
      // Swipe left -> Next slide
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    } else if (delta < -45) {
      // Swipe right -> Prev slide
      setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    }
  };

  // Called when student finishes daily challenge
  const handleChallengeCompleted = (result) => {
    setQotdData((prev) => ({
      ...prev,
      attempted: true,
      attempt: {
        is_correct: result.is_correct,
        coins_awarded: result.coins_awarded
      }
    }));
  };

  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-md transition-colors select-none h-[155px] sm:h-[165px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Subtle Tech / Geometric SVG Grid Pattern in background */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08] pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-grid)" />
          </svg>
        </div>

        {/* Ambient Gradient Corner Glow */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-gradient-to-br from-indigo-500/20 to-amber-500/10 blur-2xl pointer-events-none" />

        {/* Slide Viewport */}
        <div className="relative z-10 h-full p-4 sm:p-5 flex flex-col justify-between">
          {/* SLIDE 0: Question of the Day (QotD) */}
          {currentSlide === 0 && (
            <div className="flex items-center justify-between gap-3 h-full">
              <div className="space-y-1.5 max-w-sm sm:max-w-md min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles size={11} />
                    <span>DAILY CHALLENGE</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 flex items-center gap-0.5">
                    <Coins size={12} />
                    <span>+{qotdData?.reward_coins || 10} Coins</span>
                  </span>
                </div>

                <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight leading-tight line-clamp-1">
                  {qotdData?.attempted
                    ? "Today's Challenge Completed!"
                    : "Question of the Day"}
                </h2>

                <p className="text-xs dark:text-slate-300 text-slate-600 line-clamp-1 font-medium">
                  {qotdData?.attempted
                    ? (qotdData.attempt?.is_correct
                        ? `🎉 Answered correctly (+${qotdData.attempt?.coins_awarded || 10} Coins earned). Tap to review.`
                        : "Attempted. Review the solution and explanations.")
                    : (qotdData?.question?.subject
                        ? `${qotdData.question.subject}: ${qotdData.question.question_text?.slice(0, 70)}...`
                        : "Test your skills with today's challenge and earn bonus coins.")}
                </p>

                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsQotdModalOpen(true)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 shadow-sm ${
                      qotdData?.attempted
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.35)]'
                    }`}
                  >
                    {qotdData?.attempted ? (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        <span>Review Solution</span>
                      </>
                    ) : (
                      <>
                        <span>Solve Now</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Hero Graphic */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl dark:bg-[#0F172A] bg-slate-50 border dark:border-slate-700/80 border-slate-200 flex items-center justify-center shrink-0 p-2 shadow-inner">
                {qotdData?.attempted ? (
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 animate-pulse" />
                ) : (
                  <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
                )}
              </div>
            </div>
          )}

          {/* SLIDES 1 to N: Dynamic Promotional Banners */}
          {currentSlide > 0 && currentSlide <= banners.length && (() => {
            const banner = banners[currentSlide - 1];
            if (!banner) return null;

            const presetObj = PRESET_ICONS[banner.preset_icon] || PRESET_ICONS.target;
            const PresetIcon = presetObj.Icon;

            return (
              <div className="flex items-center justify-between gap-3 h-full">
                <div className="space-y-1.5 max-w-sm sm:max-w-md min-w-0">
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {banner.badge_text || 'PROMO'}
                  </span>

                  <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight leading-tight line-clamp-1">
                    {banner.title}
                  </h2>

                  {banner.subtitle && (
                    <p className="text-xs dark:text-slate-300 text-slate-600 line-clamp-1 font-medium">
                      {banner.subtitle}
                    </p>
                  )}

                  <div className="pt-0.5">
                    <Link
                      to={banner.cta_link || '/explore'}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all active:scale-95 shadow-[0_0_15px_rgba(79,70,229,0.35)]"
                    >
                      <span>{banner.cta_text || 'Explore Now'}</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>

                {/* Right Hero Graphic */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl dark:bg-[#0F172A] bg-slate-50 border dark:border-slate-700/80 border-slate-200 flex items-center justify-center shrink-0 p-2 shadow-inner">
                  {banner.graphic_type === 'custom' && banner.custom_image_url ? (
                    <img
                      src={banner.custom_image_url}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <PresetIcon className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
                  )}
                </div>
              </div>
            );
          })()}

          {/* FINAL SLIDE: Refer & Earn Modal Trigger */}
          {currentSlide === totalSlides - 1 && (
            <div className="flex items-center justify-between gap-3 h-full">
              <div className="space-y-1.5 max-w-sm sm:max-w-md min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Coins size={11} />
                    <span>REFER & EARN</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-400">
                    +50 Coins per friend
                  </span>
                </div>

                <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight leading-tight line-clamp-1">
                  Invite Friends & Learn Together
                </h2>

                <p className="text-xs dark:text-slate-300 text-slate-600 line-clamp-1 font-medium">
                  Share your link with fellow exam aspirants. You both get rewarded instantly!
                </p>

                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenReferral) {
                        onOpenReferral();
                      } else {
                        window.location.href = '/profile';
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all active:scale-95 shadow-md"
                  >
                    <Share2 size={12} strokeWidth={2.5} />
                    <span>Share Invite Link</span>
                  </button>
                </div>
              </div>

              {/* Right Hero Graphic */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl dark:bg-[#0F172A] bg-slate-50 border dark:border-slate-700/80 border-slate-200 flex items-center justify-center shrink-0 p-2 shadow-inner">
                <Coins className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 animate-bounce" />
              </div>
            </div>
          )}

          {/* Bottom Pagination Dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all duration-300 rounded-full h-1.5 ${
                  currentSlide === idx
                    ? 'w-6 bg-indigo-500 dark:bg-white shadow-sm'
                    : 'w-1.5 dark:bg-slate-700 bg-slate-300 hover:bg-indigo-400'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Daily Challenge Interactive Modal */}
      <DailyChallengeModal
        isOpen={isQotdModalOpen}
        onClose={() => setIsQotdModalOpen(false)}
        initialChallenge={qotdData}
        onChallengeCompleted={handleChallengeCompleted}
      />
    </>
  );
}

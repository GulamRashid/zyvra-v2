import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Target,
  Trophy,
  Rocket,
  Coins,
  Flame,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PRESET_ICONS = {
  target: { Icon: Target, color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30' },
  trophy: { Icon: Trophy, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  rocket: { Icon: Rocket, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' },
  coins: { Icon: Coins, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  sale: { Icon: Flame, color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' }
};

const DEFAULT_BANNER = {
  id: 'default-course-banner',
  badge_text: 'ALL EXAMS SYLLABUS',
  title: 'Target Your Exam With Structured Study Modules',
  subtitle: 'Chapter notes, high-yield practice questions, and timed mock tests designed for rankers.',
  cta_text: 'Explore Exams',
  cta_link: '/explore',
  banner_mode: 'card',
  graphic_type: 'preset',
  preset_icon: 'target'
};

export default function HeroCarousel() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  // Touch swipe support
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);
  const isSwipingRef = useRef(false);

  // Fetch Active Promotional Banners strictly from Supabase
  const fetchBanners = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setBanners(data);
      } else {
        setBanners([]);
      }
    } catch (err) {
      console.error('Failed to load promotional banners:', err);
      setBanners([]);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Slides array: use active banners from DB or fallback default banner
  const slides = banners.length > 0 ? banners : [DEFAULT_BANNER];
  const totalSlides = slides.length;

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
    touchEndXRef.current = e.targetTouches[0].clientX;
    isSwipingRef.current = false;
    setIsPaused(true);
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
    if (Math.abs(touchStartXRef.current - touchEndXRef.current) > 10) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    const delta = touchStartXRef.current - touchEndXRef.current;
    if (delta > 45) {
      // Swiped left -> next slide
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    } else if (delta < -45) {
      // Swiped right -> prev slide
      setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    }
    setTimeout(() => {
      isSwipingRef.current = false;
    }, 50);
  };

  // Full-Banner Click Redirect
  const handleBannerClick = (banner) => {
    if (isSwipingRef.current) return;
    const link = banner?.cta_link || '/explore';
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      navigate(link);
    }
  };

  const activeBanner = slides[currentSlide] || slides[0];
  const isFullImage = activeBanner.banner_mode === 'full_image' && Boolean(activeBanner.custom_image_url);
  const presetObj = PRESET_ICONS[activeBanner.preset_icon] || PRESET_ICONS.target;
  const PresetIcon = presetObj.Icon;

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={activeBanner.title || 'Promotional Banner'}
      onClick={() => handleBannerClick(activeBanner)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBannerClick(activeBanner);
        }
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group relative overflow-hidden rounded-2xl w-full h-[165px] sm:h-[185px] md:h-[220px] lg:h-[235px] cursor-pointer select-none transition-all duration-300 shadow-md hover:shadow-xl dark:shadow-indigo-950/40 border dark:border-indigo-500/25 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {/* FULL-BLEED IMAGE BANNER MODE */}
      {isFullImage ? (
        <div className="relative w-full h-full bg-slate-900 overflow-hidden">
          <img
            src={activeBanner.custom_image_url}
            alt={activeBanner.title || 'Promotional banner'}
            className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500 ease-out"
          />
          {/* Subtle bottom gradient to ensure pagination dots are always visible */}
          {totalSlides > 1 && (
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
          )}
        </div>
      ) : (
        /* TEXT + ICON CARD BANNER MODE */
        <div className="relative w-full h-full dark:bg-gradient-to-br dark:from-[#1E293B] dark:via-[#0F172A] dark:to-[#0B1120] bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 sm:p-6 md:p-8 flex items-center justify-between gap-4 overflow-hidden">
          {/* Subtle Tech / Geometric SVG Grid Pattern in background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="promo-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#promo-grid)" />
            </svg>
          </div>

          {/* Ambient Corner Glow */}
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-gradient-to-br from-indigo-500/30 to-amber-500/20 blur-3xl pointer-events-none" />

          {/* Left Text Content */}
          <div className="relative z-10 max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl flex flex-col justify-between h-full py-0.5">
            <div className="space-y-1 sm:space-y-2">
              {activeBanner.badge_text && (
                <span className="inline-flex items-center text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-xs">
                  {activeBanner.badge_text}
                </span>
              )}

              <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight leading-snug line-clamp-2 drop-shadow-sm">
                {activeBanner.title}
              </h2>

              {activeBanner.subtitle && (
                <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 font-medium max-w-md">
                  {activeBanner.subtitle}
                </p>
              )}
            </div>

            {/* Clickable CTA Pill */}
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white font-black text-xs sm:text-sm transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                <span>{activeBanner.cta_text || 'Explore Now'}</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>

          {/* Right Hero Graphic / Icon */}
          <div className="relative z-10 w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl dark:bg-slate-900/60 bg-white/10 border border-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 p-2 shadow-inner group-hover:scale-105 transition-transform duration-300">
            {activeBanner.graphic_type === 'custom' && activeBanner.custom_image_url ? (
              <img
                src={activeBanner.custom_image_url}
                alt=""
                className="max-w-full max-h-full object-contain filter drop-shadow-md"
              />
            ) : (
              <PresetIcon className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
            )}
          </div>
        </div>
      )}

      {/* Manual Prev / Next arrows for desktop hover */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous Banner"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-xs border border-white/15"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next Banner"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlide((prev) => (prev + 1) % totalSlides);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-xs border border-white/15"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Subtle Pagination Dots */}
      {totalSlides > 1 && (
        <div
          className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide(idx);
              }}
              className={`transition-all duration-300 rounded-full h-1.5 ${
                currentSlide === idx
                  ? 'w-6 bg-white shadow-sm'
                  : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

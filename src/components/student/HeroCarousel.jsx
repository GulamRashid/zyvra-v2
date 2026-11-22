import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const DEFAULT_BANNER = {
  id: 'default-course-banner',
  badge_text: 'ALL EXAMS SYLLABUS',
  title: 'Target Your Exam With Structured Study Modules',
  subtitle: 'Chapter notes, high-yield practice questions, and timed mock tests designed for rankers.',
  cta_text: 'Explore Exams',
  cta_link: '/explore',
  show_text_overlay: true
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

  // Slides array: active banners from DB or fallback default banner
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
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    } else if (delta < -45) {
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
  const hasCustomImage = Boolean(activeBanner.custom_image_url);
  // Mode A (Text Overlay) vs Mode B (Pure Artwork + Button Only)
  const showTextOverlay = activeBanner.show_text_overlay !== false && activeBanner.banner_mode !== 'full_image';

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
      {/* 1. FULL-BLEED BACKGROUND IMAGE (SVG, PNG, WebP) */}
      {hasCustomImage ? (
        <img
          src={activeBanner.custom_image_url}
          alt={activeBanner.title || 'Banner Artwork'}
          className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-[1.015] transition-transform duration-500 ease-out pointer-events-none"
        />
      ) : (
        /* Fallback Clean Geometric Tech Gradient */
        <div className="absolute inset-0 dark:bg-gradient-to-br dark:from-[#1E293B] dark:via-[#0F172A] dark:to-[#0B1120] bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 pointer-events-none">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="banner-tech-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#banner-tech-grid)" />
            </svg>
          </div>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
      )}

      {/* 2. MODE A: BACKGROUND + TEXT + BUTTON OVERLAY */}
      {showTextOverlay ? (
        <>
          {/* Dark gradient scrim over the background image for high contrast readability */}
          {hasCustomImage && (
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent pointer-events-none" />
          )}

          {/* Text and Action Content (No right icon box!) */}
          <div className="relative z-10 w-full h-full p-4 sm:p-6 md:p-8 flex flex-col justify-between max-w-xl md:max-w-2xl">
            <div className="space-y-1 sm:space-y-2">
              {activeBanner.badge_text && (
                <span className="inline-flex items-center text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-xs">
                  {activeBanner.badge_text}
                </span>
              )}

              <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight leading-snug line-clamp-2 drop-shadow-md">
                {activeBanner.title}
              </h2>

              {activeBanner.subtitle && (
                <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 font-medium max-w-lg drop-shadow-sm">
                  {activeBanner.subtitle}
                </p>
              )}
            </div>

            {/* CTA Action Pill */}
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-sm">
                <span>{activeBanner.cta_text || 'Explore Now'}</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>
        </>
      ) : (
        /* 3. MODE B: PURE ARTWORK + BUTTON ONLY (Unobstructed full graphic) */
        <>
          {/* Subtle bottom shadow to anchor pagination dots and button */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 via-black/25 to-transparent pointer-events-none" />

          {/* Floating Compact Action Button */}
          <div className="absolute bottom-3 left-4 sm:left-6 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/95 group-hover:bg-indigo-500 text-white font-bold text-xs shadow-lg backdrop-blur-xs transition-all">
              <span>{activeBanner.cta_text || 'Explore Now'}</span>
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </>
      )}

      {/* Desktop Prev / Next Navigation Arrows */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous Banner"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
            }}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-xs border border-white/20"
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-xs border border-white/20"
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

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  Layers,
  Mail,
  Menu,
  Moon,
  Sun,
  X
} from 'lucide-react';
import HeroMotionGraphic from '../../components/landing/HeroMotionGraphic';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';

const DEFAULT_CATALOG = {
  ncertPrice: 194,
  chaptersCount: 244,
  testsCount: 174,
  freeTestsCount: 15,
  fullPassPrice: 499,
  fullPassDays: 365,
  toolsCount: 6,
  loaded: false
};

export default function LandingPage() {
  const { user } = useAuth();
  const { resolvedTheme, setTheme, language, setLanguage } = useThemeLanguage();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG);

  const isDark = resolvedTheme === 'dark';
  const isHindi = language === 'hi';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // One-time section reveal without blocking initial paint
  useEffect(() => {
    const elements = document.querySelectorAll('.landing-reveal');
    if (!elements.length || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Live catalog stats & prices from Supabase (anon-readable published tables)
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    async function loadLiveCatalog() {
      try {
        const [examsRes, chaptersRes, testsRes, fullPassRes] = await Promise.all([
          supabase.from('exams').select('id, slug, title, price, status').eq('status', 'published'),
          supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('tests').select('id, is_free').eq('status', 'published'),
          supabase.from('platform_settings').select('value').eq('key', 'full_pass_config').maybeSingle()
        ]);

        if (!active) return;

        const ncertExam = (examsRes.data || []).find((row) => row.slug === 'ncert');
        const allTests = testsRes.data || [];
        const freeTests = allTests.filter((t) => Boolean(t.is_free)).length;
        const fp = fullPassRes.data?.value || {};

        setCatalog({
          ncertPrice: ncertExam?.price != null ? Number(ncertExam.price) : DEFAULT_CATALOG.ncertPrice,
          chaptersCount: typeof chaptersRes.count === 'number' && chaptersRes.count > 0 ? chaptersRes.count : DEFAULT_CATALOG.chaptersCount,
          testsCount: allTests.length > 0 ? allTests.length : DEFAULT_CATALOG.testsCount,
          freeTestsCount: freeTests > 0 ? freeTests : DEFAULT_CATALOG.freeTestsCount,
          fullPassPrice: fp.price != null ? Number(fp.price) : DEFAULT_CATALOG.fullPassPrice,
          fullPassDays: fp.validity_days != null ? Number(fp.validity_days) : DEFAULT_CATALOG.fullPassDays,
          toolsCount: Array.isArray(fp.included_tool_ids) && fp.included_tool_ids.length > 0
            ? fp.included_tool_ids.length
            : DEFAULT_CATALOG.toolsCount,
          loaded: true
        });
      } catch {
        // Keep truthful fallback metrics silently when offline
      }
    }

    loadLiveCatalog();
    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const pageBg = isDark ? 'bg-[#0B1120] text-slate-100' : 'bg-[#F8FAFC] text-slate-900';
  const surfaceBg = isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const bodyText = isDark ? 'text-slate-300' : 'text-slate-600';
  const headingText = isDark ? 'text-white' : 'text-slate-900';

  const primaryCtaLabel = isHindi ? 'मुफ़्त अभ्यास शुरू करें' : 'Start Practicing Free';
  const secondaryCtaLabel = isHindi ? 'निःशुल्क सैंपल और सिलेबस देखें' : 'Try Free Sample & Syllabus';

  const features = [
    {
      icon: BookOpen,
      titleEn: 'Bilingual Practice & Timed Tests',
      titleHi: 'द्विभाषी अभ्यास व समयबद्ध टेस्ट',
      descEn: 'Switch cleanly between English and academic Hindi on every question, check solutions instantly in Practice Mode, or simulate full timed exams.',
      descHi: 'हर प्रश्न पर अंग्रेजी और शुद्ध हिंदी के बीच आसानी से बदलें। प्रैक्टिस मोड में तुरंत उत्तर जाँचें या समयबद्ध टेस्ट का अनुभव लें।'
    },
    {
      icon: Layers,
      titleEn: 'Syllabus Tracker & Mistake Notebook',
      titleHi: 'सिलेबस ट्रैकर और मिस्टेक नोटबुक',
      descEn: 'See chapter-by-chapter completion status (Done, In Progress, Weak), review best scores, and automatically revisit incorrect answers.',
      descHi: 'प्रत्येक अध्याय की स्थिति (पूर्ण, प्रगति पर, कमजोर) देखें, अपना सर्वश्रेष्ठ स्कोर जाँचें और गलत हुए प्रश्नों का दोबारा अभ्यास करें।'
    },
    {
      icon: Compass,
      titleEn: 'Focused Study Toolbox',
      titleHi: 'समेकित अध्ययन टूलबॉक्स',
      descEn: 'Includes Polity Articles reference, Formula Sheet, Flashcards, Pomodoro Timer, Scientific Calculator, and Map Explorer inside one workspace.',
      descHi: 'एक ही स्थान पर अनुच्छेद संदर्भ, सूत्र पुस्तिका, फ्लैशकार्ड, पोमोडोरो टाइमर, वैज्ञानिक कैलकुलेटर और मानचित्र एक्सप्लोरर उपलब्ध हैं।'
    }
  ];

  const faqs = [
    {
      qEn: 'Can I try free tests before purchasing anything?',
      qHi: 'क्या मैं बिना खरीदारी किए मुफ़्त टेस्ट आज़मा सकता हूँ?',
      aEn: `Yes. ${catalog.freeTestsCount} free sample chapter tests in the NCERT series are open to attempt without payment. You can inspect the interface, bilingual quality, and syllabus tracker before deciding to unlock more chapters.`,
      aHi: `हाँ। एनसीईआरटी सीरीज़ में ${catalog.freeTestsCount} निःशुल्क सैंपल टेस्ट बिना किसी शुल्क के उपलब्ध हैं। आप भुगतान से पहले इंटरफ़ेस, द्विभाषी प्रश्न गुणवत्ता और सिलेबस ट्रैकर देख सकते हैं।`
    },
    {
      qEn: 'Which exams are live right now and what is coming next?',
      qHi: 'अभी कौन-सी परीक्षाएँ लाइव हैं और आगे क्या आने वाला है?',
      aEn: `NCERT Foundation (Classes 6–12, ${catalog.chaptersCount} chapters and ${catalog.testsCount} tests) is live today at ₹${catalog.ncertPrice}. All-Access Full Pass (₹${catalog.fullPassPrice} for ${catalog.fullPassDays} days) unlocks all live modules and ${catalog.toolsCount} study tools. BPSC CCE and SSC CGL/CHSL series are under preparation and clearly marked Coming Soon.`,
      aHi: `एनसीईआरटी फाउंडेशन (कक्षा 6–12, ${catalog.chaptersCount} अध्याय और ${catalog.testsCount} टेस्ट) अभी ₹${catalog.ncertPrice} में लाइव है। ऑल-एक्सेस फुल पास (₹${catalog.fullPassPrice}, ${catalog.fullPassDays} दिन) में सभी लाइव मॉड्यूल व ${catalog.toolsCount} स्टडी टूल्स शामिल हैं। BPSC और SSC सीरीज़ निर्माणाधीन हैं।`
    },
    {
      qEn: 'Can I switch between English and Hindi during a test?',
      qHi: 'क्या मैं टेस्ट के दौरान हिंदी और अंग्रेजी बदल सकता हूँ?',
      aEn: 'Yes. Every published question carries both English and standard exam-grade Hindi translations. You can toggle language from the top bar without losing your answers.',
      aHi: 'हाँ। प्रत्येक प्रकाशित प्रश्न में अंग्रेजी और मानक परीक्षा-स्तरीय हिंदी अनुवाद उपलब्ध है। आप बिना उत्तर खोए शीर्ष बार से भाषा बदल सकते हैं।'
    },
    {
      qEn: 'What happens if my internet connection drops mid-test?',
      qHi: 'अगर टेस्ट के बीच में इंटरनेट बंद हो जाए तो क्या होगा?',
      aEn: 'Your selected responses and timer state are saved locally during the session so you do not lose work on brief connection drops, and sync once connectivity returns.',
      aHi: 'सत्र के दौरान आपके उत्तर और टाइमर की स्थिति डिवाइस में सुरक्षित रहती है ताकि अस्थायी नेटवर्क बाधा पर आपका प्रयास नष्ट न हो।'
    },
    {
      qEn: 'How many devices can I use with one ZYVRA account?',
      qHi: 'एक ZYVRA खाते को मैं कितने उपकरणों पर उपयोग कर सकता हूँ?',
      aEn: 'Each account supports up to two personal devices concurrently (for example, your phone and laptop), helping keep your progress and purchases synced securely.',
      aHi: 'एक छात्र खाता एक साथ अधिकतम दो व्यक्तिगत उपकरणों (जैसे फोन और लैपटॉप) पर लॉग इन रह सकता है, जिससे आपकी प्रगति सुरक्षित रूप से सिंक रहती है।'
    }
  ];

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-200 selection:bg-indigo-600 selection:text-white ${pageBg}`}>
      {/* Sticky Minimal Navigation */}
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-200 ${
          scrolled
            ? isDark
              ? 'bg-[#0B1120]/90 backdrop-blur-md border-slate-800 shadow-sm'
              : 'bg-white/90 backdrop-blur-md border-slate-200 shadow-sm'
            : isDark
              ? 'bg-[#0B1120] border-slate-800/70'
              : 'bg-[#F8FAFC] border-slate-200/70'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 min-h-[44px] group">
            <img
              src="/logo-192.png"
              alt="ZYVRA"
              className="w-8 h-8 rounded-xl object-contain border border-slate-200/60 dark:border-slate-700"
            />
            <span className={`text-base sm:text-lg font-extrabold tracking-tight ${headingText}`}>
              ZYVRA
            </span>
          </Link>

          <nav className={`hidden md:flex items-center gap-7 text-sm font-medium ${bodyText}`} aria-label="Primary navigation">
            <a href="#exams" className={`py-2 transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
              {isHindi ? 'परीक्षाएँ' : 'Exams'}
            </a>
            <a href="#features" className={`py-2 transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
              {isHindi ? 'विशेषताएँ' : 'Features'}
            </a>
            <a href="#about" className={`py-2 transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
              {isHindi ? 'हमारे बारे में' : 'About'}
            </a>
            <a href="#faq" className={`py-2 transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
              {isHindi ? 'सवाल-जवाब' : 'FAQ'}
            </a>
          </nav>

          {/* Desktop Controls */}
          <div className="hidden sm:flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              aria-label="Toggle language"
            >
              {isHindi ? 'English' : 'हिंदी'}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <span>{isHindi ? 'डैशबोर्ड खोलें' : 'Go to Dashboard'}</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <Link
                  to="/auth?mode=signin"
                  className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold inline-flex items-center transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isHindi ? 'साइन इन' : 'Sign In'}
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>{primaryCtaLabel}</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Controls (>= 44x44px touch targets) */}
          <div className="flex sm:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
              }`}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xs font-bold transition-colors ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
              aria-label="Toggle language"
            >
              {isHindi ? 'EN' : 'हिं'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className={`sm:hidden border-t px-4 py-4 space-y-2 ${isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
            <a
              href="#exams"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium ${bodyText}`}
            >
              {isHindi ? 'परीक्षाएँ' : 'Exams'}
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium ${bodyText}`}
            >
              {isHindi ? 'विशेषताएँ' : 'Features'}
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium ${bodyText}`}
            >
              {isHindi ? 'हमारे बारे में' : 'About'}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium ${bodyText}`}
            >
              {isHindi ? 'सवाल-जवाब' : 'FAQ'}
            </a>
            <div className={`pt-3 mt-2 border-t flex flex-col gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/home');
                  }}
                  className="min-h-[44px] w-full rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <span>{isHindi ? 'डैशबोर्ड खोलें' : 'Go to Dashboard'}</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <>
                  <Link
                    to="/auth?mode=signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[44px] w-full rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <span>{primaryCtaLabel}</span>
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    to="/auth?mode=signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`min-h-[44px] w-full rounded-xl border text-sm font-semibold flex items-center justify-center ${
                      isDark ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800'
                    }`}
                  >
                    {isHindi ? 'साइन इन' : 'Sign In'}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section: Editorial Minimalist Layout + Interactive Quiz Preview */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 sm:pt-14 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-5 landing-hero-enter">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-tight bg-indigo-50/80 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800/70 dark:text-indigo-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true" />
                <span>
                  {isHindi
                    ? 'एनसीईआरटी कक्षा 6–12 · अध्याय-वार अभ्यास'
                    : 'NCERT Class 6–12 · Chapter-Wise Practice'}
                </span>
              </div>

              <h1 className={`text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.14] ${headingText}`}>
                {isHindi
                  ? 'असली परीक्षा जैसा अभ्यास, सीधे अध्याय के अनुसार।'
                  : 'Practice every NCERT chapter like a real exam.'}
              </h1>

              <p className={`text-base sm:text-lg leading-relaxed max-w-xl ${bodyText}`}>
                {isHindi
                  ? 'द्विभाषी हिंदी-अंग्रेजी प्रश्न, प्रैक्टिस मोड में तुरंत समाधान, सिलेबस ट्रैकर और मिस्टेक नोटबुक — बिना किसी अनावश्यक शोर के।'
                  : 'Bilingual English and Hindi questions, instant Practice Mode checks, a chapter-by-chapter Syllabus Tracker, and a Mistake Notebook in one distraction-free workspace.'}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  to={user ? '/home' : '/auth?mode=signup'}
                  className="min-h-[48px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all duration-150 hover:-translate-y-0.5"
                >
                  <span>{user ? (isHindi ? 'डैशबोर्ड खोलें' : 'Go to Dashboard') : primaryCtaLabel}</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/explore/ncert"
                  className={`min-h-[48px] px-5 rounded-xl border text-sm font-semibold inline-flex items-center justify-center transition-colors ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {secondaryCtaLabel}
                </Link>
              </div>

              {/* Honest Verifiable Facts Strip */}
              <div className={`pt-4 border-t grid grid-cols-3 gap-3 sm:gap-6 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                <div>
                  <div className={`text-lg sm:text-xl font-bold ${headingText}`}>4,000+</div>
                  <div className={`text-xs ${mutedText}`}>
                    {isHindi ? 'द्विभाषी प्रश्न' : 'Bilingual Questions'}
                  </div>
                </div>
                <div>
                  <div className={`text-lg sm:text-xl font-bold ${headingText}`}>{catalog.chaptersCount}</div>
                  <div className={`text-xs ${mutedText}`}>
                    {isHindi ? 'एनसीईआरटी अध्याय' : 'Published Chapters'}
                  </div>
                </div>
                <div>
                  <div className={`text-lg sm:text-xl font-bold ${headingText}`}>{catalog.testsCount}</div>
                  <div className={`text-xs ${mutedText}`}>
                    {isHindi ? 'मॉक व अभ्यास सेट' : 'Chapter Tests'}
                  </div>
                </div>
              </div>
            </div>

            {/* Real Interactive Quiz Card Preview */}
            <div className="lg:col-span-6 landing-hero-enter">
              <HeroMotionGraphic isDark={isDark} isHindi={isHindi} />
            </div>
          </div>
        </section>

        {/* Live Exam Catalog & Transparent Pricing */}
        <section id="exams" className={`py-14 sm:py-18 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200/80'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 landing-reveal">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {isHindi ? 'कोर्स और मूल्य' : 'Exam Series & Pricing'}
              </p>
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${headingText}`}>
                {isHindi ? 'स्पष्ट पाठ्यक्रम और पारदर्शी शुल्क' : 'Live catalog with transparent pricing'}
              </h2>
              <p className={`text-sm sm:text-base ${bodyText}`}>
                {isHindi
                  ? 'निःशुल्क सैंपल टेस्ट से शुरुआत करें। केवल वही मॉड्यूल अनलॉक करें जिनकी आपको आवश्यकता है।'
                  : 'Start with free sample chapter tests. Only published series show live prices and counts; upcoming tracks are marked clearly.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Live Exam 1: NCERT Foundation */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between gap-5 ${surfaceBg}`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                        {isHindi ? 'लाइव · कक्षा 6–12' : 'Live · Class 6–12'}
                      </span>
                      <h3 className={`mt-2 text-lg font-bold ${headingText}`}>
                        {isHindi ? 'NCERT संपूर्ण टेस्ट सीरीज़' : 'NCERT Foundation Series'}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xl font-extrabold ${headingText}`}>₹{catalog.ncertPrice}</div>
                      <div className={`text-[11px] ${mutedText}`}>{isHindi ? 'एकमुश्त' : 'Full series'}</div>
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed ${bodyText}`}>
                    {isHindi
                      ? 'इतिहास, भूगोल, राजव्यवस्था, अर्थशास्त्र और विज्ञान के अध्याय-वार द्विभाषी प्रश्न व व्याख्या।'
                      : 'Complete chapter-wise NCERT question bank across History, Geography, Polity, Economy, and Science with bilingual explanations.'}
                  </p>
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium ${mutedText}`}>
                    <span>{catalog.chaptersCount} {isHindi ? 'अध्याय' : 'Chapters'}</span>
                    <span>•</span>
                    <span>{catalog.testsCount} {isHindi ? 'टेस्ट' : 'Tests'}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {catalog.freeTestsCount} {isHindi ? 'निःशुल्क सैंपल' : 'Free Samples'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    to="/explore/ncert"
                    className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>{isHindi ? 'NCERT सिलेबस देखें' : 'Open NCERT Series'}</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    to="/syllabus/ncert"
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center transition-colors ${
                      isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isHindi ? 'सिलेबस ट्रैकर' : 'View Syllabus'}
                  </Link>
                </div>
              </div>

              {/* Live Plan 2: All-Access Full Pass */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between gap-5 ${surfaceBg} ${isDark ? 'ring-1 ring-indigo-500/30' : 'ring-1 ring-indigo-600/15'}`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                        {isHindi ? `${catalog.fullPassDays} दिन वैधता` : `${catalog.fullPassDays}-Day Access`}
                      </span>
                      <h3 className={`mt-2 text-lg font-bold ${headingText}`}>
                        {isHindi ? 'ऑल-एक्सेस फुल पास' : 'All-Access Full Pass'}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xl font-extrabold ${headingText}`}>₹{catalog.fullPassPrice}</div>
                      <div className={`text-[11px] ${mutedText}`}>/ {catalog.fullPassDays} {isHindi ? 'दिन' : 'days'}</div>
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed ${bodyText}`}>
                    {isHindi
                      ? `सभी लाइव टेस्ट सीरीज़ और ${catalog.toolsCount} स्टडी टूल्स (पॉलिटी अनुच्छेद, फॉर्मूला शीट, फ्लैशकार्ड, मिस्टेक नोटबुक व मैप एक्सप्लोरर) का पूरा एक्सेस।`
                      : `Unlocks every live test series plus all ${catalog.toolsCount} built-in Study Toolbox utilities including Polity Articles, Formula Sheet, Flashcards, and Geo Map Explorer.`}
                  </p>
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium ${mutedText}`}>
                    <span>{isHindi ? 'सभी लाइव परीक्षाएँ' : 'All Live Exams'}</span>
                    <span>•</span>
                    <span>{catalog.toolsCount} {isHindi ? 'स्टडी टूल्स' : 'Pro Study Tools'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    to="/explore"
                    className={`min-h-[44px] px-4 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      isDark
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    <span>{isHindi ? 'प्लान व सभी कोर्स देखें' : 'View Plans & Catalog'}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Upcoming Exam 3: BPSC CCE (Honest Coming Soon - archived in DB) */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between gap-4 ${surfaceBg}`}>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-base font-bold ${headingText}`}>
                      {isHindi ? 'BPSC CCE प्रीलिम्स सीरीज़' : 'BPSC CCE Prelims Series'}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {isHindi ? 'जल्द आ रहा है' : 'Coming Soon'}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${bodyText}`}>
                    {isHindi
                      ? 'BPSC 5-विकल्प व बिहार-विशेष प्रश्नों की सीरीज़ तैयार की जा रही है। तब तक NCERT GS से अपनी नींव मज़बूत करें।'
                      : 'Dedicated 5-option and Bihar-special mock tests are under preparation. Build your core GS foundation with the live NCERT series in the meantime.'}
                  </p>
                </div>
                <div>
                  <Link
                    to="/explore/ncert"
                    className={`inline-flex items-center gap-1.5 min-h-[44px] text-xs font-semibold ${
                      isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    <span>{isHindi ? 'निःशुल्क NCERT सैंपल आज़माएँ' : 'Try free NCERT sample meanwhile'}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Upcoming Exam 4: SSC CGL / CHSL (Honest Coming Soon - archived in DB) */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between gap-4 ${surfaceBg}`}>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-base font-bold ${headingText}`}>
                      {isHindi ? 'SSC CGL / CHSL सीरीज़' : 'SSC CGL / CHSL Series'}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {isHindi ? 'जल्द आ रहा है' : 'Coming Soon'}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${bodyText}`}>
                    {isHindi
                      ? 'SSC टियर-1 व टियर-2 के अनुभागीय अभ्यास सेट निर्माणाधीन हैं। अभी आप NCERT विज्ञान, इतिहास और राजव्यवस्था का अभ्यास कर सकते हैं।'
                      : 'Sectional practice sets for SSC Tier 1 & Tier 2 are in development. Start practicing general awareness right away through NCERT Science, Polity, and History.'}
                  </p>
                </div>
                <div>
                  <Link
                    to="/explore"
                    className={`inline-flex items-center gap-1.5 min-h-[44px] text-xs font-semibold ${
                      isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    <span>{isHindi ? 'उपलब्ध टेस्ट देखें' : 'Browse available tests'}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features (Clean 3 Cards) */}
        <section id="features" className={`py-14 sm:py-18 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200/80'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 landing-reveal">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {isHindi ? 'प्लेटफ़ॉर्म की विशेषताएँ' : 'Built for Focus'}
              </p>
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${headingText}`}>
                {isHindi ? 'गंभीर अभ्यास के लिए आवश्यक हर सुविधा' : 'Everything needed for disciplined practice'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {features.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.titleEn} className={`rounded-2xl border p-6 space-y-3 ${surfaceBg}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <h3 className={`text-base font-bold ${headingText}`}>
                      {isHindi ? item.titleHi : item.titleEn}
                    </h3>
                    <p className={`text-sm leading-relaxed ${bodyText}`}>
                      {isHindi ? item.descHi : item.descEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* About & Direct Support Section */}
        <section id="about" className={`py-14 sm:py-16 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200/80'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 landing-reveal">
            <div className={`rounded-2xl sm:rounded-3xl border p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center ${surfaceBg}`}>
              <div className="md:col-span-8 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {isHindi ? 'ZYVRA के बारे में' : 'About ZYVRA'}
                </p>
                <h2 className={`text-xl sm:text-2xl font-bold ${headingText}`}>
                  {isHindi
                    ? 'अभ्यर्थियों के लिए साफ़, सटीक और भरोसेमंद अभ्यास मंच'
                    : 'A straightforward exam practice workspace built around NCERT & state PSC rigor.'}
                </h2>
                <p className={`text-sm leading-relaxed ${bodyText}`}>
                  {isHindi
                    ? 'ZYVRA को इस उद्देश्य से बनाया गया है कि छात्र बिना किसी सोशल फीड या झूठे दावों के, अध्याय-वार प्रश्न हल कर सकें, अपनी कमजोरियाँ पहचान सकें और परीक्षा कक्ष के वास्तविक माहौल में अभ्यास कर सकें।'
                    : 'ZYVRA focuses on analytical statement questions, authentic Hindi-English terminology, and measurable chapter progress instead of noisy feeds or inflated numbers. Every unlocked module includes dual-device sync and clear explanations.'}
                </p>
              </div>
              <div className="md:col-span-4 space-y-3 md:border-l md:pl-6 border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 size={17} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span className={bodyText}>
                    {isHindi ? 'सीधी सहायता और फीडबैक:' : 'Questions or billing support:'}
                  </span>
                </div>
                <a
                  href="mailto:zyvra.education@gmail.com"
                  className={`min-h-[44px] px-4 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                    isDark
                      ? 'border-slate-700 bg-slate-800/60 text-slate-100 hover:border-indigo-500/60'
                      : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-indigo-300'
                  }`}
                >
                  <Mail size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>zyvra.education@gmail.com</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className={`py-14 sm:py-16 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200/80'}`}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6 landing-reveal">
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                FAQ
              </p>
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${headingText}`}>
                {isHindi ? 'अक्सर पूछे जाने वाले प्रश्न' : 'Frequently Asked Questions'}
              </h2>
            </div>

            <div className="space-y-2.5">
              {faqs.map((faq, idx) => {
                const open = activeFaq === idx;
                return (
                  <div key={faq.qEn} className={`rounded-2xl border overflow-hidden ${surfaceBg}`}>
                    <button
                      type="button"
                      onClick={() => setActiveFaq(open ? -1 : idx)}
                      aria-expanded={open}
                      className="w-full min-h-[52px] px-5 py-3.5 text-left flex items-center justify-between gap-4"
                    >
                      <span className={`text-sm font-semibold ${headingText}`}>
                        {isHindi ? faq.qHi : faq.qEn}
                      </span>
                      <ChevronDown
                        size={17}
                        className={`shrink-0 transition-transform duration-200 ${mutedText} ${open ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`}
                      />
                    </button>
                    {open && (
                      <div className={`px-5 pb-4 pt-1 text-sm leading-relaxed border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'} ${bodyText}`}>
                        {isHindi ? faq.aHi : faq.aEn}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Simple Closing Action Band */}
        <section className={`py-12 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200/80'}`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4 landing-reveal">
            <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${headingText}`}>
              {isHindi ? 'अपना पहला अध्याय टेस्ट अभी शुरू करें।' : 'Start your first chapter test today.'}
            </h2>
            <p className={`text-sm sm:text-base max-w-xl mx-auto ${bodyText}`}>
              {isHindi
                ? `${catalog.freeTestsCount} निःशुल्क सैंपल टेस्ट उपलब्ध हैं। एक मिनट में खाता बनाएँ और तुरंत अभ्यास शुरू करें।`
                : `Begin with ${catalog.freeTestsCount} free sample tests from the NCERT series and track your chapter accuracy as you practice.`}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
              <Link
                to={user ? '/home' : '/auth?mode=signup'}
                className="min-h-[48px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>{user ? (isHindi ? 'डैशबोर्ड खोलें' : 'Go to Dashboard') : primaryCtaLabel}</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/explore/ncert"
                className={`min-h-[48px] px-5 rounded-xl border text-sm font-semibold inline-flex items-center justify-center transition-colors ${
                  isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {secondaryCtaLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Complete Footer: About, Contact, Legal, Platform */}
      <footer className={`border-t py-10 text-xs ${isDark ? 'border-slate-800 bg-[#070B14] text-slate-400' : 'border-slate-200 bg-white text-slate-600'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <img src="/logo-192.png" alt="ZYVRA" className="w-7 h-7 rounded-lg object-contain" />
              <span className={`text-sm font-bold ${headingText}`}>ZYVRA</span>
            </div>
            <p className="leading-relaxed">
              {isHindi
                ? 'एनसीईआरटी व प्रतियोगी परीक्षाओं के लिए स्वच्छ, द्विभाषी कंप्यूटर-आधारित अभ्यास मंच।'
                : 'Clean, bilingual chapter-wise CBT exam preparation for NCERT and competitive exams.'}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
              {isHindi ? 'प्लेटफ़ॉर्म' : 'Platform'}
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/explore/ncert" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'NCERT सीरीज़' : 'NCERT Series'}</Link></li>
              <li><Link to="/explore" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'सभी परीक्षाएँ' : 'All Exams & Plans'}</Link></li>
              <li><Link to="/syllabus" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'सिलेबस ट्रैकर' : 'Syllabus Tracker'}</Link></li>
              <li><Link to="/auth?mode=signin" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'साइन इन' : 'Sign In'}</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
              {isHindi ? 'कंपनी व सहायता' : 'About & Contact'}
            </h3>
            <ul className="space-y-1.5">
              <li><a href="#about" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'हमारे बारे में' : 'About ZYVRA'}</a></li>
              <li><a href="#faq" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'सवाल-जवाब' : 'FAQ'}</a></li>
              <li>
                <a href="mailto:zyvra.education@gmail.com" className="inline-flex items-center gap-1.5 min-h-[36px] font-medium hover:underline">
                  <Mail size={13} className="shrink-0" />
                  <span>zyvra.education@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${headingText}`}>
              {isHindi ? 'नीतियाँ' : 'Legal'}
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/privacy" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'गोपनीयता नीति' : 'Privacy Policy'}</Link></li>
              <li><Link to="/terms" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'सेवा की शर्तें' : 'Terms of Service'}</Link></li>
              <li><Link to="/refunds" className="inline-flex items-center min-h-[36px] hover:underline">{isHindi ? 'रिफंड नीति' : 'Refund Policy'}</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© {new Date().getFullYear()} ZYVRA Learning Platform.</p>
          <p>{isHindi ? 'संपर्क: zyvra.education@gmail.com' : 'Contact: zyvra.education@gmail.com'}</p>
        </div>
      </footer>
    </div>
  );
}

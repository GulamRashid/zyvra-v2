import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Coins,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  X
} from 'lucide-react';
import HeroMotionGraphic from '../../components/landing/HeroMotionGraphic';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, setTheme, language, setLanguage } = useThemeLanguage();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDark = theme === 'dark';
  const isHindi = language === 'hi';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const faqs = [
    {
      qEn: 'What makes ZYVRA different from typical quiz apps?',
      qHi: 'ZYVRA सामान्य क्विज ऐप्स से अलग क्यों है?',
      aEn: 'ZYVRA is engineered specifically as a high-fidelity Computer-Based Test (CBT) engine that mirrors the exact user interface of official exam bodies (like BPSC 5-option format, negative marking, section timer, offline sync). It also features script-integrity bilingual routing, detailed KaTeX formulas, and built-in student productivity tools.',
      aHi: 'ZYVRA को विशेष रूप से वास्तविक सरकारी प्रतियोगी परीक्षाओं (BPSC 5-विकल्प पैटर्न, नेगेटिव मार्किंग, सेक्शनल टाइमर, और ऑफलाइन सिंक) के बिल्कुल वास्तविक CBT इंटरफेस की तरह तैयार किया गया है। इसमें बिना किसी फॉन्ट त्रुटि के शुद्ध हिंदी व अंग्रेजी, KaTeX गणितीय सूत्र, और छात्रों के लिए समर्पित प्रोडक्टिविटी टूलबॉक्स मिलता है।'
    },
    {
      qEn: 'Does ZYVRA support BPSC 5-option negative marking tests?',
      qHi: 'क्या ZYVRA में BPSC 5-विकल्प व नेगेटिव मार्किंग वाले टेस्ट उपलब्ध हैं?',
      aEn: 'Yes! ZYVRA has native support for both standard 4-option (A-D) and BPSC 5-option (A-E) formats, including Option E rules ("None of the above / More than one of the above") with official negative marking calculation (-1/3rd or -1/4th).',
      aHi: 'हाँ! ZYVRA में 4-विकल्प (A-D) और BPSC 5-विकल्प (A-E) दोनों फॉर्मेट्स का 100% आधिकारिक सपोर्ट है, जिसमें विकल्प E ("उपर्युक्त में से कोई नहीं / एक से अधिक") और 1/3 या 1/4 नेगेटिव मार्किंग शामिल है।'
    },
    {
      qEn: 'What happens if my internet connection drops during an exam?',
      qHi: 'अगर टेस्ट देते समय इंटरनेट कट जाए तो क्या मेरा टेस्ट सबमिट हो जाएगा?',
      aEn: 'ZYVRA features zero-data-loss offline resilience. All your test questions and selected answers are cached in local browser storage. You can continue answering offline without interruption. The moment your connection restores, your progress automatically syncs with the cloud.',
      aHi: 'ZYVRA में ज़ीरो डेटा लॉस की सुरक्षा है। आपके सारे सवाल और चुने हुए उत्तर डिवाइस पर सुरक्षित रहते हैं। इंटरनेट जाने पर भी आप पूरा टेस्ट दे सकते हैं। जैसे ही इंटरनेट वापस आएगा, आपका सारा टेस्ट बिना किसी नुकसान के क्लाउड से ऑटो-सिंक हो जाता है।'
    },
    {
      qEn: 'How does the Coin Rewards & Referral program work?',
      qHi: 'कॉइन रिवॉर्ड और रेफरल प्रोग्राम कैसे काम करता है?',
      aEn: 'You earn ZYVRA Coins every time you complete tests, maintain study streaks, and invite friends. You can redeem your coins directly at checkout to unlock premium test series, chapters, and productivity tools completely free without paying real money.',
      aHi: 'हर बार जब आप टेस्ट पूरा करते हैं, अपनी डेली स्टडी स्ट्रीक बनाए रखते हैं, या दोस्तों को इनवाइट करते हैं, तो आपको ZYVRA कॉइन्स मिलते हैं। इन कॉइन्स से आप बिना पैसे खर्च किए पेड टेस्ट सीरीज़, चैप्टर्स और टूल्स अनलॉक कर सकते हैं।'
    },
    {
      qEn: 'Can I use ZYVRA on mobile as an app?',
      qHi: 'क्या मैं ZYVRA को मोबाइल पर एक ऐप की तरह इस्तेमाल कर सकता हूँ?',
      aEn: 'Yes! ZYVRA is a Progressive Web App (PWA). You can install it straight from Chrome/Safari to your home screen with one tap. It opens full screen with lightning speed and works smoothly even on low network conditions.',
      aHi: 'हाँ! ZYVRA एक अत्याधुनिक PWA (प्रोग्रेसिव वेब ऐप) है। आप इसे सीधे ब्राउज़र से अपने मोबाइल होम स्क्रीन पर इंस्टॉल कर सकते हैं। यह बिना प्ले स्टोर के झंझट के एक असली ऐप की तरह फुल स्क्रीन में बहुत तेज़ी से चलता है।'
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-200 selection:bg-indigo-500 selection:text-white font-sans relative overflow-x-hidden ${
      isDark ? 'bg-[#070B14] text-slate-100' : 'bg-[#F8FAFC] text-slate-800'
    }`}>
      {/* Background Glow Orbs - Contained strictly to avoid mobile horizontal canvas stretch */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        {isDark ? (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] max-w-[100vw] h-[550px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-emerald-500/10 blur-[130px] rounded-full animate-landing-glow" />
            <div className="absolute top-[45%] -left-[100px] sm:-left-[200px] w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full" />
            <div className="absolute top-[65%] -right-[100px] sm:-right-[200px] w-[550px] h-[550px] bg-indigo-500/10 blur-[140px] rounded-full" />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] max-w-[100vw] h-[450px] bg-gradient-to-tr from-indigo-200/50 via-sky-100/60 to-emerald-100/50 blur-[100px] rounded-full" />
            <div className="absolute top-[40%] -left-[100px] sm:-left-[150px] w-[450px] h-[450px] bg-indigo-100/50 blur-[100px] rounded-full" />
          </>
        )}
      </div>

      {/* Decorative Grid Pattern */}
      <div
        className={`fixed inset-0 pointer-events-none -z-10 ${isDark ? 'opacity-[0.035]' : 'opacity-[0.03]'}`}
        style={{
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)'
            : 'radial-gradient(rgba(15, 23, 42, 0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* STICKY HEADER */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? isDark
              ? 'bg-[#0B1120]/90 backdrop-blur-xl border-b border-indigo-500/15 shadow-xl shadow-black/40 py-3'
              : 'bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              <div className={`w-full h-full rounded-[14px] flex items-center justify-center overflow-hidden ${
                isDark ? 'bg-[#0B1120]' : 'bg-white'
              }`}>
                <img src="/logo.png" alt="ZYVRA Logo" className="w-7 h-7 object-contain group-hover:scale-105 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`font-black text-xl tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ZYVRA
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  CBT 2.0
                </span>
              </div>
              <span className={`text-[10px] font-semibold tracking-wide hidden sm:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Next-Gen Exam Prep
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className={`hidden md:flex items-center gap-8 text-sm font-semibold ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <a href="#features" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-indigo-600'}`}>
              {isHindi ? 'विशेषताएं' : 'Features'}
            </a>
            <a href="#cbt-engine" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-indigo-600'}`}>
              {isHindi ? 'CBT इंजन' : 'CBT Engine'}
            </a>
            <a href="#exams" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-indigo-600'}`}>
              {isHindi ? 'परीक्षाएं' : 'Exams'}
            </a>
            <a href="#toolbox" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-indigo-600'}`}>
              {isHindi ? 'टूलबॉक्स' : 'Toolbox'}
            </a>
            <a href="#faq" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-indigo-600'}`}>
              {isHindi ? 'सामान्य प्रश्न' : 'FAQ'}
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors flex items-center justify-center ${
                isDark
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-amber-400'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                isDark
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
              }`}
              title="Toggle Language"
            >
              <span className="text-amber-500">🌐</span>
              <span>{isHindi ? 'English' : 'हिंदी'}</span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <span>{isHindi ? 'डैशबोर्ड खोलें' : 'Go to Dashboard'}</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <Link
                  to="/auth?mode=signin"
                  className={`px-4 py-2 rounded-xl border font-bold text-xs transition-all shadow-sm ${
                    isDark
                      ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-indigo-500/50 text-white'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  {isHindi ? 'साइन इन करें' : 'Sign In'}
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:scale-[1.03] active:scale-95"
                >
                  <Sparkles size={13} className="text-amber-300" />
                  <span>{isHindi ? 'मुफ़्त शुरू करें' : 'Get Started Free'}</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-700'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border text-xs font-black transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {isHindi ? 'EN' : 'HI'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
              }`}
              aria-label="Open navigation menu"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className={`sm:hidden px-4 pt-3 pb-6 border-b space-y-4 animate-in slide-in-from-top-4 duration-200 ${
            isDark ? 'bg-[#0B1120] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
          }`}>
            <div className="flex flex-col space-y-2 text-sm font-semibold">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-indigo-500/10">
                {isHindi ? 'विशेषताएं' : 'Features'}
              </a>
              <a href="#cbt-engine" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-indigo-500/10">
                {isHindi ? 'CBT इंजन' : 'CBT Engine'}
              </a>
              <a href="#exams" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-indigo-500/10">
                {isHindi ? 'परीक्षाएं' : 'Exams'}
              </a>
              <a href="#toolbox" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-indigo-500/10">
                {isHindi ? 'टूलबॉक्स' : 'Toolbox'}
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 rounded-lg hover:bg-indigo-500/10">
                {isHindi ? 'सामान्य प्रश्न' : 'FAQ'}
              </a>
            </div>

            <div className={`pt-2 border-t flex flex-col gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {user ? (
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); navigate('/home'); }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm text-center flex items-center justify-center gap-2"
                >
                  <span>{isHindi ? 'डैशबोर्ड खोलें' : 'Go to Dashboard'}</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <>
                  <Link
                    to="/auth?mode=signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full py-2.5 min-h-[44px] flex items-center justify-center rounded-xl border font-bold text-sm text-center ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'
                    }`}
                  >
                    {isHindi ? 'साइन इन करें' : 'Sign In'}
                  </Link>
                  <Link
                    to="/auth?mode=signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 text-white font-bold text-sm text-center shadow-lg shadow-indigo-600/30"
                  >
                    {isHindi ? 'मुफ़्त रजिस्ट्रेशन करें' : 'Get Started Free'}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* CLEAN & ATTRACTIVE HERO SECTION */}
      <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Clear Value Prop & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Pill Badge */}
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm ${
              isDark
                ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
                : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{isHindi ? '⚡ सरकारी परीक्षा की असली CBT तैयारी' : '⚡ Next-Gen CBT Exam Preparation Engine'}</span>
            </div>

            {/* Headline */}
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {isHindi ? (
                <>
                  असली परीक्षा जैसा <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">CBT माहौल</span>, हर सवाल पर गहरी पकड़।
                </>
              ) : (
                <>
                  Master Competitive Exams with <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">Real CBT Precision</span>.
                </>
              )}
            </h1>

            {/* Subtitle with High Contrast */}
            <p className={`text-base sm:text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium ${
              isDark ? 'text-slate-200' : 'text-slate-600'
            }`}>
              {isHindi
                ? 'BPSC 5-विकल्प अनिवार्य रूल, नेगेटिव मार्किंग, शुद्ध द्विभाषी व्याख्या, ज़ीरो डेटा लॉस ऑफलाइन सिंक और छात्रों के लिए स्मार्ट टूलबॉक्स — सब कुछ एक ही जगह।'
                : 'Experience official BPSC 5-option patterns, multi-statement assertion questions, in-depth bilingual explanations, offline-resilient auto-sync, and student productivity tools engineered for serious aspirants.'}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to={user ? '/home' : '/auth?mode=signup'}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.03] active:scale-95 group"
              >
                <span>{user ? (isHindi ? 'डैशबोर्ड में जाएं' : 'Open Student Dashboard') : (isHindi ? 'मुफ़्त टेस्ट देना शुरू करें' : 'Start Practicing Free')}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/explore"
                className={`w-full sm:w-auto px-6 py-4 rounded-2xl border font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
                  isDark
                    ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-100 hover:border-indigo-500/50'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-sm hover:border-indigo-400'
                }`}
              >
                <span>{isHindi ? 'उपलब्ध परीक्षाएं देखें' : 'Explore All Exams'}</span>
                <span className="text-amber-500">✨</span>
              </Link>
            </div>

            {/* Micro Social Proof */}
            <div className={`flex items-center justify-center lg:justify-start gap-6 pt-3 text-xs font-semibold ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>{isHindi ? 'क्रेडिट कार्ड की ज़रूरत नहीं' : 'No Credit Card Required'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span>{isHindi ? '100% फ्री प्रैक्टिस टियर' : 'Free Tier Available'}</span>
              </div>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <Star size={15} className="text-amber-400 fill-amber-400" />
                <span>4.9/5 Rating</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Impact Aspirant Command Center & Orbital Motion Graphic */}
          <div className="lg:col-span-5 relative flex items-center justify-center py-4 lg:py-0">
            <HeroMotionGraphic isDark={isDark} isHindi={isHindi} />
          </div>
        </div>
      </section>

      {/* STATS TICKER STRIP */}
      <section className={`border-y py-8 transition-colors ${
        isDark ? 'border-indigo-500/15 bg-slate-950/70' : 'border-slate-200 bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-500 to-sky-500 bg-clip-text text-transparent">
                10,000+
              </div>
              <div className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'द्विभाषी प्रामाणिक सवाल' : 'Curated Bilingual Questions'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                100%
              </div>
              <div className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'ऑफलाइन डेटा सुरक्षा (Zero Loss)' : 'Offline Data Resilient'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                5-Option
              </div>
              <div className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'BPSC व स्टेट PCS पैटर्न' : 'BPSC & State PCS CBT'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                0ms
              </div>
              <div className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'सुपरफास्ट रिस्पॉन्स टाइम' : 'Lightning-Fast CBT Response'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES SHOWCASE */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
            isDark ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
          }`}>
            {isHindi ? 'अत्याधुनिक सुविधाएं' : 'Engineered for Toppers'}
          </span>
          <h2 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isHindi ? 'हर वह फीचर जो परीक्षा हॉल में बढ़त दिलाए' : 'Everything You Need to Rank at the Top'}
          </h2>
          <p className={`text-sm sm:text-base font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {isHindi
              ? 'साधारण पीडीएफ और क्विज ऐप को छोड़िए। ZYVRA आपको परीक्षा के दिन की हर चुनौती के लिए पूरी तरह तैयार करता है।'
              : 'Move beyond static PDFs and outdated test engines. ZYVRA replicates real testing conditions with precision analytics.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature Card 1 */}
          <div className={`p-6 rounded-3xl border transition-all hover:-translate-y-1 group ${
            isDark
              ? 'bg-slate-900/70 border-indigo-500/20 hover:border-indigo-500/40'
              : 'bg-white border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-md'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 mb-5 group-hover:scale-110 transition-transform">
              <Target size={24} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isHindi ? 'वास्तविक CBT इंटरफेस' : 'True-to-Life CBT Interface'}
            </h3>
            <p className={`text-xs sm:text-sm leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {isHindi
                ? '5-स्टेटस कलर पैलेट (Answered, Marked, Unanswered, Not Visited), सेक्शन स्विचिंग, और लाइव टाइमर के साथ बिल्कुल आधिकारिक परीक्षा जैसा अहसास।'
                : 'Exact color status palettes (Answered, Marked for Review, Not Visited), section-wise countdown, and instant lock prevention.'}
            </p>
          </div>

          {/* Feature Card 2 */}
          <div className={`p-6 rounded-3xl border transition-all hover:-translate-y-1 group ${
            isDark
              ? 'bg-slate-900/70 border-emerald-500/20 hover:border-emerald-500/40'
              : 'bg-white border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-md'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-5 group-hover:scale-110 transition-transform">
              <BookOpen size={24} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isHindi ? 'स्क्रिप्ट-इंटीग्रिटी द्विभाषी इंजन' : 'Bilingual Script Integrity'}
            </h3>
            <p className={`text-xs sm:text-sm leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {isHindi
                ? 'अंग्रेजी स्लॉट में कोई टूटी-फूटी हिंदी नहीं, और हिंदी स्लॉट में शुद्ध देवनागरी। बीच टेस्ट में किसी भी सवाल की भाषा एक क्लिक में बदलें।'
                : 'Zero font corruption or mixed language garble. Clean English and authentic Devanagari Hindi with instant one-click switching.'}
            </p>
          </div>

          {/* Feature Card 3 */}
          <div className={`p-6 rounded-3xl border transition-all hover:-translate-y-1 group ${
            isDark
              ? 'bg-slate-900/70 border-amber-500/20 hover:border-amber-500/40'
              : 'bg-white border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-md'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isHindi ? '100% ऑफलाइन ऑटो-सिंक' : 'Zero-Loss Offline Auto-Sync'}
            </h3>
            <p className={`text-xs sm:text-sm leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {isHindi
                ? 'इंटरनेट कटने पर भी टेस्ट कभी नहीं रुकेगा। आपके सभी रिस्पॉन्स डिवाइस पर सुरक्षित रहते हैं और कनेक्शन आते ही बैकग्राउंड में सिंक हो जाते हैं।'
                : 'Never lose a test to network drops. Progress is recorded synchronously in local storage and seamlessly synced back on reconnect.'}
            </p>
          </div>
        </div>
      </section>

      {/* EXAMS WE COVER */}
      <section id="exams" className={`py-20 border-y transition-colors ${
        isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/70 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              isDark ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              {isHindi ? 'कवर की जाने वाली परीक्षाएं' : 'Targeted Exam Series'}
            </span>
            <h2 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isHindi ? 'शीर्ष प्रतियोगी परीक्षाओं के लिए विशेष टेस्ट' : 'Curated for Top Competitive Exams'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Exam 1 */}
            <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/40'
                : 'bg-white border-slate-200 hover:border-indigo-400 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">🏛️</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
                  5-Option BPSC
                </span>
              </div>
              <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>BPSC 70th & 71st CCE</h4>
              <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'प्रिलिम्स GS, बिहार विशेष, और करंट अफेयर्स विद 5वां विकल्प नियम।' : 'Prelims GS, Bihar Special, and Current Affairs with mandatory Option E rule.'}
              </p>
            </div>

            {/* Exam 2 */}
            <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                : 'bg-white border-slate-200 hover:border-emerald-400 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">⚡</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  State PCS
                </span>
              </div>
              <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>UPPSC & MPPSC Prelims</h4>
              <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'स्टेट स्पेशल सामान्य अध्ययन, इतिहास, भूगोल, और संविधान।' : 'General Studies, History, Polity, Geography & State-specific Special GK.'}
              </p>
            </div>

            {/* Exam 3 */}
            <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40'
                : 'bg-white border-slate-200 hover:border-amber-400 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">🚄</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  SSC / Railway
                </span>
              </div>
              <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>SSC CGL, CHSL & RRB NTPC</h4>
              <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'रीजनिंग, मैथ, जनरल अवेयरनेस और इंग्लिश के हाई-स्पीड स्पीड टेस्ट।' : 'High-speed sectional CBT mocks for Quantitative Aptitude, Reasoning & GA.'}
              </p>
            </div>

            {/* Exam 4 */}
            <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 hover:border-purple-500/40'
                : 'bg-white border-slate-200 hover:border-purple-400 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎓</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-500 border border-purple-500/30">
                  Teaching / CTET
                </span>
              </div>
              <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Bihar TRE & CTET</h4>
              <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {isHindi ? 'शिक्षक भर्ती परीक्षा और बाल विकास, सामाजिक विज्ञान मॉक टेस्ट।' : 'Teacher recruitment exams, Child Pedagogy, Social Science & Language tests.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STUDENT PRODUCTIVITY TOOLBOX SPOTLIGHT */}
      <section id="toolbox" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              isDark ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              {isHindi ? 'इन-बिल्ट स्टूडेंट टूलबॉक्स' : 'Productivity Suite'}
            </span>
            <h2 className={`text-3xl sm:text-4xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isHindi ? (
                <>पढ़ाई में फोकस और निरंतरता के लिए <span className="text-amber-500">स्मार्ट टूल्स</span></>
              ) : (
                <>Smart Study Tools Built Directly into Your <span className="text-amber-500">Workflow</span></>
              )}
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {isHindi
                ? 'आपको अलग से पोमोडोरो या नोट्स ऐप डाउनलोड करने की ज़रूरत नहीं है। ZYVRA के अंदर ही सारे उत्पादकता टूल्स मौजूद हैं:'
                : 'No need to switch between multiple productivity apps. Everything you need to retain information and stay focused is right here:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <span className="text-2xl">⏱️</span>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Pomodoro Timer</h4>
                  <p className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>25m focus & 5m break cycles</p>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <span className="text-2xl">🧮</span>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Smart Calculator</h4>
                  <p className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Fractions, % and Permutations</p>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <span className="text-2xl">📓</span>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Mistake Notebook</h4>
                  <p className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Auto-save wrong questions</p>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <span className="text-2xl">🃏</span>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Smart Flashcards</h4>
                  <p className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Memorize articles & formulas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-4 ${
              isDark
                ? 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border-amber-500/25 shadow-amber-950/20'
                : 'bg-white border-amber-200 shadow-amber-100/40'
            }`}>
              <div className={`flex items-center justify-between pb-3 border-b ${
                isDark ? 'border-slate-800' : 'border-slate-100'
              }`}>
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-amber-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                    {isHindi ? 'ZYVRA कॉइन्स व रिवॉर्ड्स' : 'Coin Rewards & Free Unlocks'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold text-[10px]">
                  {isHindi ? '100% फ्री कमाई' : 'Earn as You Learn'}
                </span>
              </div>
              <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
                {isHindi
                  ? 'रोज़ाना टेस्ट पूरा करने और दोस्तों को रेफर करने पर ZYVRA कॉइन्स पाएं। इन कॉइन्स को सीधे चेकआउट पर भुनाकर पेड टेस्ट सीरीज और चैप्टर्स को मुफ़्त में अनलॉक करें।'
                  : 'Earn coins through daily test completion, maintaining revision streaks, and sharing referral links. Redeem coins at checkout to unlock paid content for free.'}
              </p>
              <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs ${
                isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                  🪙
                </div>
                <div className="flex-1">
                  <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Daily Streak Bonus</div>
                  <div className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>+50 Coins per completed test session</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className={`py-20 border-t transition-colors ${
        isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/60 border-slate-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3">
            <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              isDark ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
            }`}>
              FAQ
            </span>
            <h2 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isHindi ? 'अक्सर पूछे जाने वाले सवाल' : 'Frequently Asked Questions'}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className={`rounded-2xl border overflow-hidden transition-colors ${
                    isDark
                      ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? -1 : index)}
                    className={`w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-sm sm:text-base ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    <span>{isHindi ? faq.qHi : faq.qEn}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-indigo-500' : isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className={`px-4 pb-5 sm:px-5 text-xs sm:text-sm leading-relaxed border-t pt-3 font-medium ${
                      isDark ? 'border-slate-800 text-slate-200' : 'border-slate-100 text-slate-600'
                    }`}>
                      {isHindi ? faq.aHi : faq.aEn}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL HIGH-CONVERTING CTA BANNER */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className={`relative rounded-3xl p-8 sm:p-12 overflow-hidden border shadow-2xl space-y-6 ${
          isDark
            ? 'bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950/80 border-indigo-500/40 shadow-indigo-950/60 text-white'
            : 'bg-gradient-to-r from-indigo-50 via-white to-emerald-50 border-indigo-200 shadow-indigo-100 text-slate-900'
        }`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 text-xs font-bold">
            <Sparkles size={13} />
            <span>{isHindi ? 'अपनी तैयारी को टॉप रैंक में बदलें' : 'Accelerate Your Exam Preparation'}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black max-w-2xl mx-auto leading-tight">
            {isHindi
              ? 'सपनों की सरकारी नौकरी के लिए आज ही शुरू करें।'
              : 'Join Thousands of Serious Aspirants on ZYVRA.'}
          </h2>

          <p className={`text-sm sm:text-base max-w-xl mx-auto font-medium ${
            isDark ? 'text-slate-200' : 'text-slate-600'
          }`}>
            {isHindi
              ? 'बिना किसी रुकावट के मुफ़्त टेस्ट दें, अपनी कमज़ोरियों को पहचानें और वास्तविक CBT परीक्षा का अनुभव लें।'
              : 'Experience official-grade mock tests, get instant diagnostic scorecards, and study with complete focus.'}
          </p>

          <div className="pt-2">
            <Link
              to={user ? '/home' : '/auth?mode=signup'}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <span>{user ? (isHindi ? 'डैशबोर्ड पर जाएं' : 'Open Dashboard') : (isHindi ? 'निःशुल्क अकाउंट बनाएं (30 सेकंड)' : 'Create Free Account (30s)')}</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={`border-t py-12 text-xs transition-colors ${
        isDark ? 'border-slate-800 bg-[#070B14] text-slate-400' : 'border-slate-200 bg-white text-slate-600'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZYVRA" className="w-6 h-6 object-contain" />
            <span className={`font-black tracking-wider text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>ZYVRA</span>
            <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
            <span className="font-medium">© {new Date().getFullYear()} ZYVRA Prep. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 font-semibold text-xs sm:text-sm">
            <Link to="/explore" className={`min-h-[44px] flex items-center px-2.5 py-1.5 rounded-lg transition-colors ${isDark ? 'hover:text-white hover:bg-slate-800/60' : 'hover:text-indigo-600 hover:bg-slate-100'}`}>{isHindi ? 'परीक्षाएं' : 'Exams'}</Link>
            <Link to="/tests" className={`min-h-[44px] flex items-center px-2.5 py-1.5 rounded-lg transition-colors ${isDark ? 'hover:text-white hover:bg-slate-800/60' : 'hover:text-indigo-600 hover:bg-slate-100'}`}>{isHindi ? 'टेस्ट हब' : 'Tests'}</Link>
            <Link to="/toolbox" className={`min-h-[44px] flex items-center px-2.5 py-1.5 rounded-lg transition-colors ${isDark ? 'hover:text-white hover:bg-slate-800/60' : 'hover:text-indigo-600 hover:bg-slate-100'}`}>{isHindi ? 'टूलबॉक्स' : 'Toolbox'}</Link>
            <Link to="/auth?mode=signin" className={`min-h-[44px] flex items-center px-2.5 py-1.5 rounded-lg transition-colors ${isDark ? 'hover:text-white hover:bg-slate-800/60' : 'hover:text-indigo-600 hover:bg-slate-100'}`}>{isHindi ? 'लॉगिन' : 'Sign In'}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  X,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function LandingPage() {
  const { user } = useAuth();
  const { language, setLanguage } = useThemeLanguage();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDemoOption, setSelectedDemoOption] = useState('B');
  const [demoSubmitted, setDemoSubmitted] = useState(true);
  const [demoLang, setDemoLang] = useState('hi');
  const [activeFaq, setActiveFaq] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHindi = language === 'hi';

  const demoQuestion = {
    en: {
      question: 'Which Article of the Constitution of India guarantees "Equality before the law" and "Equal protection of the laws"?',
      options: [
        { key: 'A', text: 'Article 12 — Definition of State' },
        { key: 'B', text: 'Article 14 — Right to Equality' },
        { key: 'C', text: 'Article 19 — Protection of Freedom' },
        { key: 'D', text: 'Article 21 — Protection of Life and Liberty' },
        { key: 'E', text: 'None of the above / More than one of the above (BPSC Pattern)' }
      ],
      correct: 'B',
      explanation: 'Article 14 states that the State shall not deny to any person equality before the law or the equal protection of the laws within the territory of India. This right is conferred on all persons, whether citizens or foreigners.'
    },
    hi: {
      question: 'भारतीय संविधान का कौन सा अनुच्छेद "विधि के समक्ष समता" एवं "विधियों के समान संरक्षण" की गारंटी प्रदान करता है?',
      options: [
        { key: 'A', text: 'अनुच्छेद 12 — राज्य की परिभाषा' },
        { key: 'B', text: 'अनुच्छेद 14 — समता का अधिकार' },
        { key: 'C', text: 'अनुच्छेद 19 — स्वतंत्रता का संरक्षण' },
        { key: 'D', text: 'अनुच्छेद 21 — प्राण और दैहिक स्वतंत्रता' },
        { key: 'E', text: 'उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक (BPSC)' }
      ],
      correct: 'B',
      explanation: 'अनुच्छेद 14 के अनुसार राज्य भारत के राज्यक्षेत्र में किसी व्यक्ति को विधि के समक्ष समता से या विधियों के समान संरक्षण से वंचित नहीं करेगा। यह अधिकार नागरिकों और विदेशियों दोनों को प्राप्त है।'
    }
  };

  const currentDemo = demoQuestion[demoLang];

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
    <div className="min-h-screen bg-[#070B14] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans relative overflow-x-hidden">
      {/* Background Glow Orbs */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-emerald-500/10 blur-[130px] rounded-full pointer-events-none -z-10 animate-landing-glow" />
      <div className="fixed top-[45%] -left-[200px] w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed top-[65%] -right-[200px] w-[550px] h-[550px] bg-indigo-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Decorative Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* STICKY GLASS HEADER */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0B1120]/85 backdrop-blur-xl border-b border-indigo-500/15 shadow-xl shadow-black/40 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              <div className="w-full h-full bg-[#0B1120] rounded-[14px] flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="ZYVRA Logo" className="w-7 h-7 object-contain group-hover:scale-105 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-wider text-white bg-clip-text">
                  ZYVRA
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CBT 2.0
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
                Next-Gen Exam Prep
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">
              {isHindi ? 'विशेषताएं' : 'Features'}
            </a>
            <a href="#cbt-engine" className="hover:text-white transition-colors">
              {isHindi ? 'CBT इंजन' : 'CBT Engine'}
            </a>
            <a href="#exams" className="hover:text-white transition-colors">
              {isHindi ? 'परीक्षाएं' : 'Exams'}
            </a>
            <a href="#toolbox" className="hover:text-white transition-colors">
              {isHindi ? 'टूलबॉक्स' : 'Toolbox'}
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              {isHindi ? 'सामान्य प्रश्न' : 'FAQ'}
            </a>
          </nav>

          {/* Header Action Buttons (Sign In / Sign Up) */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Language Toggle */}
            <button
              type="button"
              onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-bold text-slate-300 transition-colors flex items-center gap-1.5"
              title="Toggle Language"
            >
              <span className="text-amber-400">🌐</span>
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
                  className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 text-white font-bold text-xs transition-all shadow-sm"
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

          {/* Mobile Hamburger Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
              className="p-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
            >
              {isHindi ? 'EN' : 'HI'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              aria-label="Open navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 pt-3 pb-6 bg-[#0B1120] border-b border-slate-800 space-y-4 animate-in slide-in-from-top-4 duration-200">
            <div className="flex flex-col space-y-2 text-sm font-semibold text-slate-300">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1.5 px-3 rounded-lg hover:bg-slate-800">
                {isHindi ? 'विशेषताएं' : 'Features'}
              </a>
              <a href="#cbt-engine" onClick={() => setMobileMenuOpen(false)} className="py-1.5 px-3 rounded-lg hover:bg-slate-800">
                {isHindi ? 'CBT इंजन' : 'CBT Engine'}
              </a>
              <a href="#exams" onClick={() => setMobileMenuOpen(false)} className="py-1.5 px-3 rounded-lg hover:bg-slate-800">
                {isHindi ? 'परीक्षाएं' : 'Exams'}
              </a>
              <a href="#toolbox" onClick={() => setMobileMenuOpen(false)} className="py-1.5 px-3 rounded-lg hover:bg-slate-800">
                {isHindi ? 'टूलबॉक्स' : 'Toolbox'}
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-1.5 px-3 rounded-lg hover:bg-slate-800">
                {isHindi ? 'सामान्य प्रश्न' : 'FAQ'}
              </a>
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
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
                    className="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm text-center"
                  >
                    {isHindi ? 'साइन इन करें' : 'Sign In'}
                  </Link>
                  <Link
                    to="/auth?mode=signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 text-white font-bold text-sm text-center shadow-lg shadow-indigo-600/30"
                  >
                    {isHindi ? 'मुफ़्त रजिस्ट्रेशन करें' : 'Get Started Free'}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Pulsing Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-bold text-indigo-300 shadow-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{isHindi ? '⚡ सरकारी परीक्षा की असली CBT तैयारी' : '⚡ Next-Gen CBT Exam Preparation Engine'}</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
              {isHindi ? (
                <>
                  असली परीक्षा जैसा <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">CBT माहौल</span>, हर सवाल पर गहरी पकड़।
                </>
              ) : (
                <>
                  Master Competitive Exams with <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">Real CBT Precision</span>.
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              {isHindi
                ? 'BPSC 5-विकल्प अनिवार्य रूल, नेगेटिव मार्किंग, शुद्ध द्विभाषी व्याख्या, ज़ीरो डेटा लॉस ऑफलाइन सिंक और छात्रों के लिए स्मार्ट टूलबॉक्स — सब कुछ एक ही जगह।'
                : 'Experience official BPSC 5-option patterns, multi-statement assertion questions, in-depth bilingual explanations, offline-resilient auto-sync, and student productivity tools engineered for toppers.'}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to={user ? '/home' : '/auth?mode=signup'}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.03] active:scale-95 group"
              >
                <span>{user ? (isHindi ? 'डैशबोर्ड में जाएं' : 'Open Student Dashboard') : (isHindi ? 'मुफ़्त टेस्ट देना शुरू करें' : 'Start Practicing Free')}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#demo-section"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 text-slate-200 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all"
              >
                <span>{isHindi ? 'लाइव CBT डेमो देखें' : 'Try Interactive Demo'}</span>
                <span className="text-amber-400">✨</span>
              </a>
            </div>

            {/* Micro Social Proof */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>{isHindi ? 'कोई क्रेडिट कार्ड नहीं' : 'No Credit Card Needed'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span>{isHindi ? '100% फ्री प्रैक्टिस टियर' : 'Free Tier Available'}</span>
              </div>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                <span>4.9/5 Aspirant Rating</span>
              </div>
            </div>
          </div>

          {/* Right Column: Floating Interactive Mock CBT Interface (Motion Graphic) */}
          <div className="lg:col-span-5 relative" id="demo-section">
            {/* Decorative Glow Ring */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/30 via-emerald-500/20 to-purple-500/30 blur-xl opacity-75 -z-10 animate-landing-glow" />

            {/* Interactive Mock CBT Card */}
            <div className="relative rounded-3xl bg-slate-900/95 border border-indigo-500/30 shadow-2xl shadow-indigo-950/80 p-5 space-y-4 backdrop-blur-xl animate-landing-float">
              {/* CBT Mock Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-black text-indigo-400 tracking-wider">LIVE CBT SIMULATION</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDemoLang(demoLang === 'hi' ? 'en' : 'hi')}
                    className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 hover:bg-slate-700"
                  >
                    {demoLang === 'hi' ? 'Switch to English' : 'हिंदी में देखें'}
                  </button>
                  <div className="flex items-center gap-1 font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25 text-[11px]">
                    <Clock size={12} />
                    <span>01:44:28</span>
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">Question 14 of 150</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">Polity · Medium</span>
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {currentDemo.question}
                </p>
              </div>

              {/* Options List */}
              <div className="space-y-2 pt-1">
                {currentDemo.options.map((opt) => {
                  const isSelected = selectedDemoOption === opt.key;
                  const isCorrect = demoSubmitted && opt.key === currentDemo.correct;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setSelectedDemoOption(opt.key);
                        setDemoSubmitted(true);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
                        isCorrect
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold shadow-md shadow-emerald-500/10'
                          : isSelected
                            ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-500 text-slate-950'
                            : isSelected
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                        }`}>
                          {opt.key}
                        </span>
                        <span className="truncate">{opt.text}</span>
                      </div>
                      {isCorrect && <Check size={14} className="text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Instant Explanation Card */}
              {demoSubmitted && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-emerald-500/30 text-[11px] space-y-1.5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={13} />
                      {demoLang === 'hi' ? 'सटीक व्याख्या (Explanation)' : 'Detailed Analysis'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">KaTeX Ready</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {currentDemo.explanation}
                  </p>
                </div>
              )}

              {/* Floating Performance Pill */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Zap size={13} /> 0ms Lag Instant CBT Locking
                </span>
                <span className="text-slate-500">Auto-saved Locally 🔒</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS TICKER STRIP */}
      <section className="border-y border-indigo-500/15 bg-slate-950/70 backdrop-blur-md py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
                10,000+
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {isHindi ? 'द्विभाषी प्रामाणिक सवाल' : 'Curated Bilingual Questions'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                100%
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {isHindi ? 'ऑफलाइन डेटा सुरक्षा (Zero Loss)' : 'Offline Data Resilient'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                5-Option
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {isHindi ? 'BPSC व स्टेट PCS पैटर्न' : 'BPSC & State PCS CBT'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                0ms
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {isHindi ? 'सुपरफास्ट रिस्पॉन्स टाइम' : 'Lightning-Fast CBT Response'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES SHOWCASE */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-black uppercase tracking-widest text-indigo-400 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            {isHindi ? 'अत्याधुनिक सुविधाएं' : 'Engineered for Toppers'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            {isHindi ? 'हर वह फीचर जो परीक्षा हॉल में बढ़त दिलाए' : 'Everything You Need to Rank at the Top'}
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            {isHindi
              ? 'साधारण पीडीएफ और क्विज ऐप को छोड़िए। ZYVRA आपको परीक्षा के दिन की हर चुनौती के लिए पूरी तरह तैयार करता है।'
              : 'Move beyond static PDFs and outdated test engines. ZYVRA replicates real testing conditions with precision analytics.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature Card 1 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-indigo-500/20 hover:border-indigo-500/40 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-110 transition-transform">
              <Target size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {isHindi ? 'वास्तविक CBT इंटरफेस' : 'True-to-Life CBT Interface'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {isHindi
                ? '5-स्टेटस कलर पैलेट (Answered, Marked, Unanswered, Not Visited), सेक्शन स्विचिंग, और लाइव टाइमर के साथ बिल्कुल आधिकारिक परीक्षा जैसा अहसास।'
                : 'Exact color status palettes (Answered, Marked for Review, Not Visited), section-wise countdown, and instant lock prevention.'}
            </p>
          </div>

          {/* Feature Card 2 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
              <BookOpen size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {isHindi ? 'स्क्रिप्ट-इंटीग्रिटी द्विभाषी इंजन' : 'Bilingual Script Integrity'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {isHindi
                ? 'अंग्रेजी स्लॉट में कोई टूटी-फूटी हिंदी नहीं, और हिंदी स्लॉट में शुद्ध देवनागरी। बीच टेस्ट में किसी भी सवाल की भाषा एक क्लिक में बदलें।'
                : 'Zero font corruption or mixed language garble. Clean English and authentic Devanagari Hindi with instant one-click switching.'}
            </p>
          </div>

          {/* Feature Card 3 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-amber-500/20 hover:border-amber-500/40 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {isHindi ? '100% ऑफलाइन ऑटो-सिंक' : 'Zero-Loss Offline Auto-Sync'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {isHindi
                ? 'इंटरनेट कटने पर भी टेस्ट कभी नहीं रुकेगा। आपके सभी रिस्पॉन्स डिवाइस पर सुरक्षित रहते हैं और कनेक्शन आते ही बैकग्राउंड में सिंक हो जाते हैं।'
                : 'Never lose a test to network drops. Progress is recorded synchronously in local storage and seamlessly synced back on reconnect.'}
            </p>
          </div>
        </div>
      </section>

      {/* EXAMS WE COVER */}
      <section id="exams" className="py-20 bg-slate-950/60 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {isHindi ? 'कवर की जाने वाली परीक्षाएं' : 'Targeted Exam Series'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              {isHindi ? 'शीर्ष प्रतियोगी परीक्षाओं के लिए विशेष टेस्ट' : 'Curated for Top Competitive Exams'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Exam 1 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🏛️</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  5-Option BPSC
                </span>
              </div>
              <h4 className="text-base font-bold text-white">BPSC 70th & 71th CCE</h4>
              <p className="text-xs text-slate-400">
                {isHindi ? 'प्रिलिम्स GS, बिहार विशेष, और करंट अफेयर्स विद 5वां विकल्प नियम।' : 'Prelims GS, Bihar Special, and Current Affairs with mandatory Option E rule.'}
              </p>
            </div>

            {/* Exam 2 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">⚡</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  State PCS
                </span>
              </div>
              <h4 className="text-base font-bold text-white">UPPSC & MPPSC Prelims</h4>
              <p className="text-xs text-slate-400">
                {isHindi ? 'स्टेट स्पेशल सामान्य अध्ययन, इतिहास, भूगोल, और संविधान।' : 'General Studies, History, Polity, Geography & State-specific Special GK.'}
              </p>
            </div>

            {/* Exam 3 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🚄</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  SSC / Railway
                </span>
              </div>
              <h4 className="text-base font-bold text-white">SSC CGL, CHSL & RRB NTPC</h4>
              <p className="text-xs text-slate-400">
                {isHindi ? 'रीजनिंग, मैथ, जनरल अवेयरनेस और इंग्लिश के हाई-स्पीड स्पीड टेस्ट।' : 'High-speed sectional CBT mocks for Quantitative Aptitude, Reasoning & GA.'}
              </p>
            </div>

            {/* Exam 4 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎓</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  Teaching / CTET
                </span>
              </div>
              <h4 className="text-base font-bold text-white">Bihar TRE & CTET</h4>
              <p className="text-xs text-slate-400">
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
            <span className="text-xs font-black uppercase tracking-widest text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              {isHindi ? 'इन-बिल्ट स्टूडेंट टूलबॉक्स' : 'Productivity Suite'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              {isHindi ? (
                <>पढ़ाई में फोकस और निरंतरता के लिए <span className="text-amber-400">स्मार्ट टूल्स</span></>
              ) : (
                <>Smart Study Tools Built Directly into Your <span className="text-amber-400">Workflow</span></>
              )}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {isHindi
                ? 'आपको अलग से पोमोडोरो या नोट्स ऐप डाउनलोड करने की ज़रूरत नहीं है। ZYVRA के अंदर ही सारे उत्पादकता टूल्स मौजूद हैं:'
                : 'No need to switch between multiple productivity apps. Everything you need to retain information and stay focused is right here:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xl">⏱️</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Pomodoro Timer</h4>
                  <p className="text-[11px] text-slate-400">25m focus & 5m break cycles</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xl">🧮</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Smart Calculator</h4>
                  <p className="text-[11px] text-slate-400">Fractions, % and Permutations</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xl">📓</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Mistake Notebook</h4>
                  <p className="text-[11px] text-slate-400">Auto-save wrong questions</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xl">🃏</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Smart Flashcards</h4>
                  <p className="text-[11px] text-slate-400">Memorize constitutional articles</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-amber-500/25 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                    {isHindi ? 'ZYVRA कॉइन्स व रिवॉर्ड्स' : 'Coin Rewards & Free Unlocks'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                  {isHindi ? '100% फ्री कमाई' : 'Earn as You Learn'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isHindi
                  ? 'रोज़ाना टेस्ट पूरा करने और दोस्तों को रेफर करने पर ZYVRA कॉइन्स पाएं। इन कॉइन्स को सीधे चेकआउट पर भुनाकर पेड टेस्ट सीरीज और चैप्टर्स को मुफ़्त में अनलॉक करें।'
                  : 'Earn coins through daily test completion, maintaining revision streaks, and sharing referral links. Redeem coins at checkout to unlock paid content for free.'}
              </p>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  🪙
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Daily Streak Bonus</div>
                  <div className="text-[10px] text-slate-400">+50 Coins per completed test session</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-20 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              {isHindi ? 'अक्सर पूछे जाने वाले सवाल' : 'Frequently Asked Questions'}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-colors hover:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? -1 : index)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white"
                  >
                    <span>{isHindi ? faq.qHi : faq.qEn}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
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
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-indigo-900/80 via-slate-900 to-emerald-950/80 border border-indigo-500/40 shadow-2xl shadow-indigo-950/60 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Sparkles size={13} />
            <span>{isHindi ? 'अपनी तैयारी को टॉप रैंक में बदलें' : 'Accelerate Your Exam Preparation'}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white max-w-2xl mx-auto leading-tight">
            {isHindi
              ? 'सपनों की सरकारी नौकरी के लिए आज ही शुरू करें।'
              : 'Join Thousands of Serious Aspirants on ZYVRA.'}
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
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
      <footer className="border-t border-slate-800 bg-[#070B14] py-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZYVRA" className="w-6 h-6 object-contain" />
            <span className="font-black text-white tracking-wider text-sm">ZYVRA</span>
            <span className="text-slate-600">|</span>
            <span>© {new Date().getFullYear()} ZYVRA Prep. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/explore" className="hover:text-white transition-colors">{isHindi ? 'परीक्षाएं' : 'Exams'}</Link>
            <Link to="/tests" className="hover:text-white transition-colors">{isHindi ? 'टेस्ट हब' : 'Tests'}</Link>
            <Link to="/toolbox" className="hover:text-white transition-colors">{isHindi ? 'टूलबॉक्स' : 'Toolbox'}</Link>
            <Link to="/auth?mode=signin" className="hover:text-white transition-colors">{isHindi ? 'लॉगिन' : 'Sign In'}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

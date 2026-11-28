import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, RotateCcw } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function LegalPage() {
  const location = useLocation();
  const { resolvedTheme } = useThemeLanguage();
  const isDark = resolvedTheme === 'dark';

  const path = location.pathname.toLowerCase();
  const isTerms = path.includes('/terms');
  const isRefunds = path.includes('/refund') || path.includes('/cancellation');
  const activeTab = isRefunds ? 'refunds' : isTerms ? 'terms' : 'privacy';

  const cardClass = isDark
    ? 'p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2'
    : 'p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2';
  const headingClass = isDark ? 'text-white' : 'text-slate-900';
  const subtextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const bodyClass = isDark ? 'text-slate-300' : 'text-slate-700';

  return (
    <div className={`min-h-screen py-8 sm:py-10 px-4 sm:px-6 transition-colors ${isDark ? 'bg-[#0B1120] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className={`inline-flex items-center gap-2 min-h-[44px] px-2 text-xs font-bold transition-colors ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
            >
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <Link
              to="/auth"
              className={`inline-flex items-center min-h-[44px] px-2 text-xs font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Sign In
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              to="/privacy"
              className={`inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeTab === 'privacy'
                  ? (isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200')
                  : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className={`inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeTab === 'terms'
                  ? (isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200')
                  : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
              }`}
            >
              Terms of Service
            </Link>
            <Link
              to="/refunds"
              className={`inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeTab === 'refunds'
                  ? (isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200')
                  : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
              }`}
            >
              Refund Policy
            </Link>
          </div>
        </div>

        {activeTab === 'privacy' && (
          <article className={`max-w-none space-y-4 text-xs sm:text-sm leading-relaxed ${bodyClass}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h1 className={`text-xl sm:text-2xl font-black m-0 ${headingClass}`}>Privacy Policy</h1>
                <p className={`text-xs m-0 ${subtextClass}`}>Effective Date: November 2026 · Zyvra Learning Platform</p>
              </div>
            </div>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                1. Information We Collect
              </h2>
              <p className={bodyClass}>
                When you create an account on <strong className={headingClass}>Zyvra</strong> (via Email OTP or Google Sign-In), we collect basic profile details: your name, email address, profile picture (if provided), and optional mobile number. We also record your learning progress, test attempts, bookmarks, and coin transactions.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                2. How We Use Your Information
              </h2>
              <p className={bodyClass}>
                Your data is strictly used to deliver personalized test preparation, evaluate mock tests, save your mistakes in the Mistake Notebook, track daily streaks, and communicate important exam updates or coupon discounts via WhatsApp/email.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                3. Data Security & Storage
              </h2>
              <p className={bodyClass}>
                All account credentials, tokens, and payment transactions are secured using industry-standard 256-bit SSL encryption via Supabase and Razorpay. We never sell, rent, or trade your personal data to third-party advertisers.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                4. Your Rights
              </h2>
              <p className={bodyClass}>
                You can review, modify, or update your personal details (such as full name and WhatsApp number) at any time from your Student Profile page. For account inquiries, contact support at <strong className={headingClass}>zyvra.education@gmail.com</strong>.
              </p>
            </section>
          </article>
        )}

        {activeTab === 'terms' && (
          <article className={`max-w-none space-y-4 text-xs sm:text-sm leading-relaxed ${bodyClass}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-amber-500/10 border border-amber-400/30 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-600'}`}>
                <FileText size={20} />
              </div>
              <div>
                <h1 className={`text-xl sm:text-2xl font-black m-0 ${headingClass}`}>Terms of Service</h1>
                <p className={`text-xs m-0 ${subtextClass}`}>Effective Date: November 2026 · Zyvra Learning Platform</p>
              </div>
            </div>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                1. Acceptance of Terms
              </h2>
              <p className={bodyClass}>
                By registering on or using <strong className={headingClass}>Zyvra</strong> (accessible via www.zyvra.me), you agree to comply with these terms, our community guidelines, and applicable laws governing digital educational services.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                2. User Account & Device Limit
              </h2>
              <p className={bodyClass}>
                To safeguard paid course content and question banks, each student account is permitted to be actively logged into a maximum of two personal devices concurrently. Sharing accounts or attempting automated data scraping is strictly prohibited.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                3. Purchases & Content Validity
              </h2>
              <p className={bodyClass}>
                Paid folders, test series, or All-Access Full Passes grant access for the specific duration designated at checkout (such as 365 days for the Full Pass). Zyvra Coins redeemed at checkout apply instant discounts according to platform rules.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                4. Intellectual Property
              </h2>
              <p className={bodyClass}>
                All study notes, test questions, analytical tools, and explanations are the intellectual property of Zyvra. Content is licensed for individual, non-commercial educational use only.
              </p>
            </section>
          </article>
        )}

        {activeTab === 'refunds' && (
          <article className={`max-w-none space-y-4 text-xs sm:text-sm leading-relaxed ${bodyClass}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10 border border-indigo-400/30 text-indigo-400' : 'bg-indigo-50 border border-indigo-200 text-indigo-600'}`}>
                <RotateCcw size={20} />
              </div>
              <div>
                <h1 className={`text-xl sm:text-2xl font-black m-0 ${headingClass}`}>Cancellation & Refund Policy</h1>
                <p className={`text-xs m-0 ${subtextClass}`}>Effective Date: November 2026 · Zyvra Learning Platform</p>
              </div>
            </div>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                1. Instant Digital Access
              </h2>
              <p className={bodyClass}>
                All course materials, mock test series, and study tool subscriptions on Zyvra are digital educational goods. Access is unlocked automatically and immediately upon successful payment verification. Because digital content and mock test questions are delivered immediately, standard purchases are non-refundable once unlocked.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                2. Duplicate Payment & Technical Errors
              </h2>
              <p className={bodyClass}>
                In case your bank account was debited multiple times due to a network glitch or session drop, or if payment was captured without immediate course activation, our automated system or support team will reconcile the transaction. Any verified duplicate charge will be refunded 100% back to your original payment method within 5 to 7 business days.
              </p>
            </section>

            <section className={cardClass}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${headingClass}`}>
                <CheckCircle2 size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                3. How to Request Assistance
              </h2>
              <p className={bodyClass}>
                If you experience any billing discrepancies, please contact our help desk via in-app Support Chat or email us at <strong className={headingClass}>zyvra.education@gmail.com</strong> with your registered email, mobile number, and Razorpay Payment ID.
              </p>
            </section>
          </article>
        )}
      </div>
    </div>
  );
}

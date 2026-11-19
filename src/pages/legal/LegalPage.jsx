import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

export default function LegalPage() {
  const location = useLocation();
  const isTerms = location.pathname.includes('/terms');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Login</span>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <Link
              to="/privacy"
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                !isTerms ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                isTerms ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Terms of Service
            </Link>
          </div>
        </div>

        {!isTerms ? (
          <article className="prose prose-invert max-w-none space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white m-0">Privacy Policy</h1>
                <p className="text-xs text-slate-400 m-0">Effective Date: November 2026 · Zyvra Learning Platform</p>
              </div>
            </div>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                1. Information We Collect
              </h2>
              <p>
                When you create an account on <strong>Zyvra</strong> (via Email OTP or Google Sign-In), we collect basic profile details: your name, email address, profile picture (if provided), and optional mobile number. We also record your learning progress, test attempts, bookmarks, and coin transactions.
              </p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                2. How We Use Your Information
              </h2>
              <p>
                Your data is strictly used to deliver personalized test preparation, evaluate mock tests, save your mistakes in the Mistake Notebook, track daily streaks, and communicate important exam updates or coupon discounts via WhatsApp/email.
              </p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                3. Data Security & Storage
              </h2>
              <p>
                All account credentials, tokens, and payment transactions are secured using industry-standard 256-bit SSL encryption via Supabase and Razorpay. We never sell, rent, or trade your personal data to third-party advertisers.
              </p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                4. Your Rights
              </h2>
              <p>
                You can review, modify, or update your personal details (such as full name and WhatsApp number) at any time from your Student Profile page. For account inquiries, contact support at <strong>zyvra.education@gmail.com</strong>.
              </p>
            </section>
          </article>
        ) : (
          <article className="prose prose-invert max-w-none space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white m-0">Terms of Service</h1>
                <p className="text-xs text-slate-400 m-0">Effective Date: November 2026 · Zyvra Learning Platform</p>
              </div>
            </div>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400" />
                1. Acceptance of Terms
              </h2>
              <p>
                By registering on or using <strong>Zyvra</strong> (accessible via www.zyvra.me), you agree to comply with these terms, our community guidelines, and applicable laws governing digital educational services.
              </p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400" />
                2. User Account & Device Limit
              </h2>
              <p>
                To safeguard paid course content and question banks, each student account is permitted to be actively logged into a maximum of two personal devices concurrently. Sharing accounts or attempting automated data scraping is strictly prohibited.
              </p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400" />
                3. Purchases & Content Validity
              </h2>
              <p>
                Paid folders, test series, or All-Access Full Passes grant access for the specific duration designated at checkout (such as 365 days for the Full Pass). Zyvra Coins redeemed at checkout apply instant discounts according to platform rules.
              </p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400" />
                4. Intellectual Property
              </h2>
              <p>
                All study notes, test questions, analytical tools, and explanations are the intellectual property of Zyvra. Content is licensed for individual, non-commercial educational use only.
              </p>
            </section>
          </article>
        )}
      </div>
    </div>
  );
}

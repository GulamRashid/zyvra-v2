import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Coins, Gift, ShoppingBag, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ShareAndEarnCard from '../../components/common/ShareAndEarnCard';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatCoins, formatTransactions } from '../../lib/formatters';

const LEDGER_PAGE_SIZE = 1000;

async function fetchLedgerAndAdjustments(supabase, userId) {
  const transactions = [];
  try {
    for (let offset = 0; ; offset += LEDGER_PAGE_SIZE) {
      const { data, error } = await supabase.from('coin_ledger').select('*')
        .eq('user_id', userId).order('created_at', { ascending: false })
        .range(offset, offset + LEDGER_PAGE_SIZE - 1);
      if (error) throw error;
      transactions.push(...(data || []));
      if (!data || data.length < LEDGER_PAGE_SIZE) break;
    }
  } catch (err) {
    console.warn('Failed to query coin_ledger, falling back to coin_transactions:', err);
  }

  if (transactions.length === 0) {
    try {
      const { data: txData, error: txError } = await supabase.from('coin_transactions').select('*')
        .eq('user_id', userId).order('created_at', { ascending: false })
        .limit(LEDGER_PAGE_SIZE);
      if (!txError && txData?.length) {
        transactions.push(...txData);
      }
    } catch (fallbackErr) {
      console.warn('Fallback to coin_transactions also failed:', fallbackErr);
    }
  }

  // Fetch referral credit timestamps & wallet updated_at for accurate adjustment entry metadata
  let adjustmentMeta = { date: null, reasonEn: 'Balance / Referral Adjustment', reasonHi: 'बैलेंस / रेफरल समायोजन' };
  try {
    const [refRes, walletRes] = await Promise.all([
      supabase.from('referrals').select('referrer_coins_awarded, created_at').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(1),
      supabase.from('coin_wallets').select('updated_at').eq('user_id', userId).maybeSingle()
    ]);
    const latestRef = refRes?.data?.[0];
    if (latestRef?.created_at) {
      adjustmentMeta = {
        date: latestRef.created_at,
        reasonEn: 'Referral / Balance Credit Adjustment',
        reasonHi: 'रेफरल / बैलेंस क्रेडिट समायोजन'
      };
    } else if (walletRes?.data?.updated_at) {
      adjustmentMeta.date = walletRes.data.updated_at;
    }
  } catch {
    // Keep non-fatal fallback date if unavailable
  }

  return { transactions, adjustmentMeta };
}

function transactionAmount(transaction) {
  const raw = Number(transaction.amount ?? transaction.coins ?? transaction.coin_amount ?? 0);
  const kind = String(
    transaction.transaction_type ||
    transaction.type ||
    transaction.tx_type ||
    transaction.source ||
    transaction.direction ||
    ''
  ).toLowerCase();
  return ['debit', 'spent', 'spend', 'deduction', 'purchase', 'redeem'].some((value) => kind.includes(value))
    ? -Math.abs(raw)
    : ['credit', 'earned', 'reward', 'refund', 'bonus', 'referral', 'adjustment'].some((value) => kind.includes(value))
      ? Math.abs(raw)
      : raw;
}

function transactionReason(transaction, isHindi) {
  if (transaction.__synthetic && isHindi && transaction.reasonHi) return transaction.reasonHi;
  if (transaction.__synthetic && !isHindi && transaction.reasonEn) return transaction.reasonEn;
  const raw = String(
    transaction.reason || transaction.description || transaction.reference_type || transaction.transaction_type || ''
  ).trim();
  if (!raw) return isHindi ? 'कॉइन गतिविधि' : 'Coin activity';
  const lower = raw.toLowerCase();
  if (lower === 'winner') return isHindi ? 'प्रतियोगिता / एडमिन इनाम' : 'Competition / Admin Reward';
  if (lower === 'admin_adjustment') return isHindi ? 'एडमिन बैलेंस समायोजन' : 'Admin Balance Adjustment';
  if (lower === 'welcome' || lower === 'signup_bonus' || lower.includes('welcome to zyvra bonus')) {
    return isHindi ? 'स्वागत बोनस' : 'Welcome Bonus';
  }
  if (lower === 'checkout_redemption') return isHindi ? 'खरीदारी पर कॉइन छूट' : 'Order Discount Redemption';
  return raw;
}

function transactionDate(transaction, isHindi) {
  const value = transaction.created_at || transaction.occurred_at || transaction.transaction_date;
  return value
    ? new Date(value).toLocaleString(isHindi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
}

export default function StudentWallet() {
  const navigate = useNavigate();
  const { user, coinBalance, walletLoaded, supabase } = useAuth();
  const { language } = useThemeLanguage();
  const isHindi = language === 'hi';

  const [transactions, setTransactions] = useState([]);
  const [adjustmentMeta, setAdjustmentMeta] = useState({
    date: null,
    reasonEn: 'Balance / Referral Adjustment',
    reasonHi: 'बैलेंस / रेफरल समायोजन'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) {
        setError((prev) => prev || (isHindi ? 'कॉइन विवरण लोड होने में समय लग रहा है। कृपया रीफ्रेश करें।' : 'Loading your coin ledger timed out. Please refresh.'));
        setLoading(false);
      }
    }, 8000);
    const loadLedger = async () => {
      if (!supabase || !user) throw new Error(isHindi ? 'वॉलेट देखने के लिए साइन इन करें।' : 'Sign in to view your Zyvra Coin wallet.');
      const { transactions: data, adjustmentMeta: meta } = await fetchLedgerAndAdjustments(supabase, user.id);
      window.clearTimeout(timeoutId);
      if (!active) return;
      setTransactions(data || []);
      if (meta) setAdjustmentMeta(meta);
      setLoading(false);
    };
    loadLedger().catch((loadError) => {
      window.clearTimeout(timeoutId);
      if (active) {
        setError(getFriendlyErrorMessage(loadError, isHindi ? 'कॉइन विवरण लोड नहीं हो सका।' : 'Unable to load your coin ledger.'));
        setLoading(false);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [supabase, user, isHindi]);

  // Reconcile wallet balance with recorded ledger entries so all credits/adjustments appear visibly in history
  const reconciledTransactions = useMemo(() => {
    const ledgerNet = transactions.reduce((sum, tx) => sum + transactionAmount(tx), 0);
    const walletVal = Number(coinBalance || 0);
    const diff = walletLoaded && !loading && !error ? walletVal - ledgerNet : 0;
    if (diff === 0) return transactions;

    const syntheticEntry = {
      id: 'wallet-balance-reconciliation',
      __synthetic: true,
      amount: diff,
      transaction_type: diff > 0 ? 'adjustment' : 'debit',
      reasonEn: adjustmentMeta.reasonEn,
      reasonHi: adjustmentMeta.reasonHi,
      created_at: adjustmentMeta.date || transactions[0]?.created_at || new Date().toISOString()
    };

    return [syntheticEntry, ...transactions].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [transactions, coinBalance, walletLoaded, loading, error, adjustmentMeta]);

  const summary = useMemo(() => reconciledTransactions.reduce((totals, transaction) => {
    const amount = transactionAmount(transaction);
    if (amount > 0) totals.earned += amount;
    if (amount < 0) totals.spent += Math.abs(amount);
    return totals;
  }, { earned: 0, spent: 0 }), [reconciledTransactions]);

  const rows = useMemo(() => {
    let runningBalance = Number(coinBalance) || 0;
    return reconciledTransactions.map((transaction) => {
      const amount = transactionAmount(transaction);
      const explicitBalance = transaction.__synthetic
        ? null
        : (transaction.balance_after ?? transaction.running_balance ?? transaction.balance);
      const balance = Number.isFinite(Number(explicitBalance)) ? Number(explicitBalance) : runningBalance;
      runningBalance = balance - amount;
      return { transaction, amount, balance };
    });
  }, [reconciledTransactions, coinBalance]);

  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-900 dark:text-slate-100">
      {/* Page Heading Banner */}
      <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50/90 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1.5">
          <button
            type="button"
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/profile', { replace: true });
              }
            }}
            className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white shrink-0 shadow-xs active:scale-95 transition-all"
            aria-label={isHindi ? 'वापस जाएँ' : 'Back'}
          >
            <ArrowLeft size={14} />
          </button>
          <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
            {isHindi ? 'आपके रिवार्ड्स और कॉइन्स' : 'Your Rewards & Currency'}
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
          {isHindi ? 'ज़ीव्रा कॉइन वॉलेट' : 'Zyvra Coin Wallet'}
        </h1>
        <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
          {isHindi
            ? 'अभ्यास से कमाए गए कॉइन्स देखें और कोर्स व टूल्स पर छूट पाएँ।'
            : 'Track the coins you earn through learning and spend on your next study path.'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Hero Card: Available Balance & Reconciled Totals */}
      <section className="wallet-hero relative overflow-hidden rounded-3xl border border-amber-500/30 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-xs shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
              {isHindi ? 'उपलब्ध बैलेंस' : 'Available Balance'}
            </div>
            <h2 className="text-2xl sm:text-4xl font-black !text-white tracking-tight">
              {!walletLoaded ? (
                <span className="inline-block h-8 w-24 rounded-lg bg-white/15 animate-pulse align-middle" aria-hidden="true" />
              ) : (
                <>
                  {Number(coinBalance || 0).toLocaleString()}{' '}
                  <span className="text-xs font-bold text-amber-300">{isHindi ? 'कॉइन्स' : 'coins'}</span>
                </>
              )}
            </h2>
            <p className="text-xs !text-slate-200 font-medium mt-0.5">
              {isHindi
                ? 'योग्य ज़ीव्रा खरीदारी पर रिडीम करें (10 कॉइन्स = ₹1 छूट)।'
                : 'Ready to redeem on eligible Zyvra purchases (10 Coins = ₹1).'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/60">
          <div className="p-2.5 rounded-xl bg-slate-900/70 shadow-xs border border-slate-700/70 text-left flex-1 sm:flex-initial">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">
              {isHindi ? 'कुल अर्जित व समायोजित' : 'Total Earned'}
            </span>
            <strong className="text-sm font-extrabold text-emerald-400 flex items-center gap-1">
              {loading || !walletLoaded ? (
                <span className="inline-block h-4 w-10 rounded bg-emerald-400/20 animate-pulse" aria-hidden="true" />
              ) : (
                <><ArrowDownLeft size={13} /> {summary.earned.toLocaleString()}</>
              )}
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/70 shadow-xs border border-slate-700/70 text-left flex-1 sm:flex-initial">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">
              {isHindi ? 'कुल खर्च' : 'Total Spent'}
            </span>
            <strong className="text-sm font-extrabold text-amber-300 flex items-center gap-1">
              {loading || !walletLoaded ? (
                <span className="inline-block h-4 w-10 rounded bg-amber-300/20 animate-pulse" aria-hidden="true" />
              ) : (
                <><ArrowUpRight size={13} /> {summary.spent.toLocaleString()}</>
              )}
            </strong>
          </div>
        </div>
      </section>

      <ShareAndEarnCard className="wallet-share-card" />

      {/* 2-Column Grid: How to Earn / Spend & Reconciled Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* How to Earn & Spend Info */}
        <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                {isHindi ? 'हर अभ्यास का लाभ लें' : 'Make Every Session Count'}
              </div>
              <h2 className="text-base font-black dark:text-white text-slate-900">
                {isHindi ? 'कॉइन्स कैसे कमाएँ व खर्च करें' : 'How to earn & spend'}
              </h2>
            </div>
            <Sparkles size={18} className="text-amber-500" />
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-700/60 border-slate-200/80 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Gift size={14} />
              </div>
              <div>
                <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                  {isHindi ? 'दोस्तों को आमंत्रित करें' : 'Refer study friends'}
                </strong>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isHindi
                    ? 'रेफरल लिंक साझा करें और हर सफल जॉइनिंग पर कॉइन्स पाएँ।'
                    : 'Share your invite code and earn wallet coins when friends join.'}
                </small>
              </div>
            </div>

            <div className="p-3 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-700/60 border-slate-200/80 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={14} />
              </div>
              <div>
                <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                  {isHindi ? 'दैनिक स्ट्रीक बनाए रखें' : 'Build your study streak'}
                </strong>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isHindi
                    ? 'नियमित अभ्यास से स्ट्रीक माइलस्टोन और बोनस अनलॉक करें।'
                    : 'Keep a steady study rhythm to unlock streak milestones.'}
                </small>
              </div>
            </div>

            <div className="p-3 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-700/60 border-slate-200/80 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                <ShoppingBag size={14} />
              </div>
              <div>
                <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                  {isHindi ? 'चेकआउट पर रिडीम करें' : 'Redeem coins at checkout'}
                </strong>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isHindi
                    ? 'योग्य कोर्स और टूल्स पर 10 कॉइन्स = ₹1 की तुरंत छूट पाएँ।'
                    : '10 coins = ₹1 discount on eligible purchases.'}
                </small>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Link
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
              to="/toolbox"
            >
              <ShoppingBag size={14} />
              <span>{isHindi ? 'प्रो टूल्स पर उपयोग करें' : 'Redeem on Pro Tools'}</span>
            </Link>
            <Link
              className="w-full py-2.5 px-3 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
              to="/explore"
            >
              <span>{isHindi ? 'कोर्स पर उपयोग करें' : 'Redeem on Courses'}</span>
            </Link>
          </div>
        </section>

        {/* Transaction History Ledger */}
        <section className="lg:col-span-2 p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                {isHindi ? 'आपकी कॉइन गतिविधि' : 'Your Coin Activity'}
              </div>
              <h2 className="text-base font-black dark:text-white text-slate-900">
                {isHindi ? 'लेन-देन का इतिहास' : 'Transaction history'}
              </h2>
            </div>
            <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
              {loading || !walletLoaded
                ? (isHindi ? 'लोड हो रहा है…' : 'Loading…')
                : formatTransactions(reconciledTransactions.length, language)}
            </span>
          </div>

          {loading || !walletLoaded ? (
            <LoadingSkeleton rows={4} />
          ) : !reconciledTransactions.length ? (
            <div className="p-8 text-center space-y-2 dark:text-slate-400 text-slate-500 text-xs">
              <Coins size={24} className="mx-auto text-amber-500 opacity-60" />
              <strong className="block text-sm dark:text-white text-slate-900">
                {isHindi ? 'आपका लेज़र तैयार है।' : 'Your ledger is ready.'}
              </strong>
              <span>{isHindi ? 'कॉइन रिवार्ड्स और खरीदारी यहाँ दिखाई देंगी।' : 'Coin rewards and purchases will show up here.'}</span>
            </div>
          ) : (
            <div className="divide-y dark:divide-slate-700/40 divide-slate-100 max-h-[420px] overflow-y-auto pr-1">
              {rows.map(({ transaction, amount, balance }, index) => (
                <article
                  className="py-3 flex items-center justify-between gap-3"
                  key={transaction.id || `${transaction.created_at}-${index}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        amount >= 0
                          ? 'bg-[#22c55e]/20 text-[#22c55e]'
                          : 'bg-amber-500/20 text-amber-500'
                      }`}
                    >
                      {amount >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                        {transactionReason(transaction, isHindi)}
                      </strong>
                      <small className="text-[10px] text-slate-400 dark:text-emerald-400/60 block">
                        {transactionDate(transaction, isHindi)}
                      </small>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <strong
                      className={`text-xs sm:text-sm font-black block ${
                        amount >= 0 ? 'text-[#22c55e]' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {amount >= 0 ? '+' : '−'}
                      {formatCoins(Math.abs(amount), language)}
                    </strong>
                    <small className="text-[10px] text-slate-400 dark:text-emerald-400/60 block">
                      {isHindi ? 'बैलेंस' : 'Balance'}{' '}{balance.toLocaleString()}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

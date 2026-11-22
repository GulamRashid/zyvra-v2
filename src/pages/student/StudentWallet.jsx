import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Coins, Gift, ShoppingBag, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ShareAndEarnCard from '../../components/common/ShareAndEarnCard';
import { useAuth } from '../../context/AuthContext';
import { getFriendlyErrorMessage } from '../../lib/errors';

const LEDGER_PAGE_SIZE = 1000;

async function fetchLedger(supabase, userId) {
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

  // If coin_ledger returned no rows, fall back to coin_transactions
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

  return transactions;
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
    : ['credit', 'earned', 'reward', 'refund', 'bonus', 'referral'].some((value) => kind.includes(value))
      ? Math.abs(raw)
      : raw;
}

function transactionReason(transaction) {
  return transaction.reason || transaction.description || transaction.reference_type || transaction.transaction_type || 'Coin activity';
}

function transactionDate(transaction) {
  const value = transaction.created_at || transaction.occurred_at || transaction.transaction_date;
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function StudentWallet() {
  const navigate = useNavigate();
  const { user, coinBalance, supabase } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadLedger = async () => {
      if (!supabase || !user) throw new Error('Sign in to view your Zyvra Coin wallet.');
      const data = await fetchLedger(supabase, user.id);
      if (!active) return;
      setTransactions(data || []);
      setLoading(false);
    };
    loadLedger().catch((loadError) => {
      if (active) {
        setError(getFriendlyErrorMessage(loadError, 'Unable to load your coin ledger.'));
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase, user]);

  const summary = useMemo(() => transactions.reduce((totals, transaction) => {
    const amount = transactionAmount(transaction);
    if (amount > 0) totals.earned += amount;
    if (amount < 0) totals.spent += Math.abs(amount);
    return totals;
  }, { earned: 0, spent: 0 }), [transactions]);

  const rows = useMemo(() => {
    let runningBalance = Number(coinBalance) || 0;
    return transactions.map((transaction) => {
      const amount = transactionAmount(transaction);
      const explicitBalance = transaction.balance_after ?? transaction.running_balance ?? transaction.balance;
      const balance = Number.isFinite(Number(explicitBalance)) ? Number(explicitBalance) : runningBalance;
      if (explicitBalance === undefined || explicitBalance === null) runningBalance -= amount;
      else runningBalance = balance - amount;
      return { transaction, amount, balance };
    });
  }, [transactions, coinBalance]);

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
              className="w-7 h-7 rounded-lg dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white shrink-0 shadow-xs active:scale-95 transition-all"
              aria-label="Back"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
              Your Rewards & Currency
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
            Zyvra Coin Wallet
          </h1>
          <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
            Track the coins you earn through learning and spend on your next study path.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {/* Hero Card: Available Balance & Totals - Bright Amber Dopamine Trigger */}
        <section className="wallet-hero relative overflow-hidden rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-amber-500/30 border-amber-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-500 shadow-xs shrink-0">
              <Coins size={24} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold dark:text-amber-400 text-amber-800 tracking-wider">
                Available Balance
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {Number(coinBalance || 0).toLocaleString()}{' '}
                <span className="text-xs font-bold text-amber-600 dark:text-amber-300">coins</span>
              </h2>
              <p className="wallet-hero-copy text-xs dark:text-slate-300 text-slate-600 font-medium mt-0.5">
                Ready to redeem on eligible Zyvra purchases (10 Coins = ₹1).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 dark:border-slate-700/60 border-slate-200">
            <div className="p-2.5 rounded-xl dark:bg-slate-800/80 bg-white shadow-xs border dark:border-slate-700/60 border-slate-200 text-left flex-1 sm:flex-initial">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block">Total Earned</span>
              <strong className="text-sm font-extrabold text-[#10B981] flex items-center gap-1">
                <ArrowDownLeft size={13} /> {summary.earned.toLocaleString()}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl dark:bg-slate-800/80 bg-white shadow-xs border dark:border-slate-700/60 border-slate-200 text-left flex-1 sm:flex-initial">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block">Total Spent</span>
              <strong className="text-sm font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <ArrowUpRight size={13} /> {summary.spent.toLocaleString()}
              </strong>
            </div>
          </div>
        </section>

        <ShareAndEarnCard className="wallet-share-card" />

        {/* 2-Column Grid: How to Earn / Spend & Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* How to Earn & Spend Info */}
          <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                  Make Every Session Count
                </div>
                <h2 className="text-base font-black dark:text-white text-slate-900">How to earn & spend</h2>
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
                    Score 70%+ in mock tests
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Earn test rewards when your attempt qualifies.
                  </small>
                </div>
              </div>

              <div className="p-3 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-700/60 border-slate-200/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div>
                  <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                    Build your study streak
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Keep a steady study rhythm to unlock streak rewards.
                  </small>
                </div>
              </div>

              <div className="p-3 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-700/60 border-slate-200/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                  <ShoppingBag size={14} />
                </div>
                <div>
                  <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                    Redeem coins at checkout
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    10 coins = ₹1 discount on eligible purchases.
                  </small>
                </div>
              </div>
            </div>

            <Link
              className="w-full py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
              to="/explore"
            >
              <span>Explore learning paths</span>
            </Link>
          </section>

          {/* Transaction History Ledger */}
          <section className="lg:col-span-2 p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                  Your Coin Activity
                </div>
                <h2 className="text-base font-black dark:text-white text-slate-900">Transaction history</h2>
              </div>
              <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
                {transactions.length} transactions
              </span>
            </div>

            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : !transactions.length ? (
              <div className="p-8 text-center space-y-2 dark:text-slate-400 text-slate-500 text-xs">
                <Coins size={24} className="mx-auto text-amber-500 opacity-60" />
                <strong className="block text-sm dark:text-white text-slate-900">Your ledger is ready.</strong>
                <span>Coin rewards and purchases will show up here.</span>
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
                          {transactionReason(transaction)}
                        </strong>
                        <small className="text-[10px] text-slate-400 dark:text-emerald-400/60 block">
                          {transactionDate(transaction)}
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
                        {Math.abs(amount).toLocaleString()} coins
                      </strong>
                      <small className="text-[10px] text-slate-400 dark:text-emerald-400/60 block">
                        Balance {balance.toLocaleString()}
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

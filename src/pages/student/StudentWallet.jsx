import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const LEDGER_PAGE_SIZE = 1000;

async function fetchLedger(supabase, userId) {
  const transactions = [];
  for (let offset = 0; ; offset += LEDGER_PAGE_SIZE) {
    const { data, error } = await supabase.from('coin_ledger').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false })
      .range(offset, offset + LEDGER_PAGE_SIZE - 1);
    if (error) throw error;
    transactions.push(...(data || []));
    if (!data || data.length < LEDGER_PAGE_SIZE) return transactions;
  }
}

function transactionAmount(transaction) {
  const raw = Number(transaction.amount ?? transaction.coins ?? transaction.coin_amount ?? 0);
  const kind = String(transaction.transaction_type || transaction.type || transaction.direction || '').toLowerCase();
  return ['debit', 'spent', 'spend', 'deduction', 'purchase', 'redeem'].some((value) => kind.includes(value))
    ? -Math.abs(raw)
    : ['credit', 'earned', 'reward', 'refund'].some((value) => kind.includes(value))
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
        setError(loadError.message || 'Unable to load your coin ledger.');
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
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading Banner */}
        <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#07261b] dark:to-[#04140e] bg-gradient-to-br from-emerald-100/90 via-teal-50 to-white border dark:border-emerald-500/25 border-emerald-200 p-4 sm:p-6 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
            Your Rewards
          </div>
          <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
            Zyvra Coin Wallet
          </h1>
          <p className="text-xs sm:text-sm dark:text-emerald-200/80 text-slate-600 font-medium mt-0.5">
            Track the coins you earn through learning and spend on your next study path.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {/* Hero Card: Available Balance & Totals */}
        <section className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-r dark:from-[#1b1708] dark:via-[#0c271b] dark:to-[#051a12] bg-gradient-to-r from-amber-100 via-emerald-50 to-white border dark:border-amber-500/35 border-amber-300/80 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-2xl shadow-glowGold shrink-0">
              🪙
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold dark:text-amber-400 text-amber-800 tracking-wider">
                Available Balance
              </div>
              <h2 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">
                {Number(coinBalance || 0).toLocaleString()}{' '}
                <span className="text-xs font-bold text-amber-600 dark:text-amber-300">coins</span>
              </h2>
              <p className="text-xs dark:text-emerald-300/80 text-slate-600 font-medium mt-0.5">
                Ready to redeem on eligible Zyvra purchases (10 Coins = ₹1).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 dark:border-emerald-800/30 border-slate-200">
            <div className="p-2.5 rounded-xl dark:bg-emerald-950/70 bg-white shadow-xs border dark:border-emerald-500/20 border-slate-200 text-left flex-1 sm:flex-initial">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-400/60 block">Total Earned</span>
              <strong className="text-sm font-extrabold text-[#22c55e] flex items-center gap-1">
                <ArrowDownLeft size={13} /> {summary.earned.toLocaleString()}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl dark:bg-emerald-950/70 bg-white shadow-xs border dark:border-emerald-500/20 border-slate-200 text-left flex-1 sm:flex-initial">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-emerald-400/60 block">Total Spent</span>
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
          <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                  Make Every Session Count
                </div>
                <h2 className="text-base font-black dark:text-white text-slate-900">How to earn & spend</h2>
              </div>
              <Sparkles size={18} className="text-amber-500" />
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-2xl dark:bg-emerald-950/50 bg-slate-50 border dark:border-emerald-500/15 border-slate-200/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift size={14} />
                </div>
                <div>
                  <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                    Score 70%+ in mock tests
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-emerald-300/80 block mt-0.5">
                    Earn test rewards when your attempt qualifies.
                  </small>
                </div>
              </div>

              <div className="p-3 rounded-2xl dark:bg-emerald-950/50 bg-slate-50 border dark:border-emerald-500/15 border-slate-200/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div>
                  <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                    Build your study streak
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-emerald-300/80 block mt-0.5">
                    Keep a steady study rhythm to unlock streak rewards.
                  </small>
                </div>
              </div>

              <div className="p-3 rounded-2xl dark:bg-emerald-950/50 bg-slate-50 border dark:border-emerald-500/15 border-slate-200/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                  <ShoppingBag size={14} />
                </div>
                <div>
                  <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                    Redeem coins at checkout
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-emerald-300/80 block mt-0.5">
                    10 coins = ₹1 discount on eligible purchases.
                  </small>
                </div>
              </div>
            </div>

            <Link
              className="w-full py-2.5 rounded-xl dark:bg-emerald-950/80 bg-slate-100 hover:bg-slate-200 dark:hover:bg-emerald-900 border dark:border-emerald-500/25 border-slate-300 text-xs font-bold dark:text-emerald-300 text-slate-800 flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
              to="/explore"
            >
              <span>Explore learning paths</span>
            </Link>
          </section>

          {/* Transaction History Ledger */}
          <section className="lg:col-span-2 p-4 sm:p-5 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                  Your Coin Activity
                </div>
                <h2 className="text-base font-black dark:text-white text-slate-900">Transaction history</h2>
              </div>
              <span className="text-xs font-bold dark:text-emerald-300 text-emerald-800">
                {transactions.length} transactions
              </span>
            </div>

            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : !transactions.length ? (
              <div className="p-8 text-center space-y-2 dark:text-emerald-300/80 text-slate-500 text-xs">
                <Coins size={24} className="mx-auto text-amber-500 opacity-60" />
                <strong className="block text-sm dark:text-white text-slate-900">Your ledger is ready.</strong>
                <span>Coin rewards and purchases will show up here.</span>
              </div>
            ) : (
              <div className="divide-y dark:divide-emerald-800/30 divide-slate-100 max-h-[420px] overflow-y-auto pr-1">
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
    </div>
  );
}

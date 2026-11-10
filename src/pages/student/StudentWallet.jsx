import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Gift, ShoppingBag, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

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

  return <div className="wallet-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR REWARDS</div><h1>Zyvra Coin wallet</h1><p>Track the coins you earn through learning and spend on your next study path.</p></div></div>
    {error && <div className="feedback error-feedback">{error}</div>}
    <section className="wallet-hero">
      <div className="wallet-hero-copy"><span className="wallet-hero-icon"><Coins size={24} /></span><div><div className="eyebrow">AVAILABLE BALANCE</div><h2>{Number(coinBalance).toLocaleString()} <span>coins</span></h2><p>Ready to redeem on eligible Zyvra purchases.</p></div></div>
      <div className="wallet-hero-stats"><div><span>Total earned</span><strong><ArrowDownLeft size={15} /> {summary.earned.toLocaleString()}</strong></div><div><span>Total spent</span><strong><ArrowUpRight size={15} /> {summary.spent.toLocaleString()}</strong></div></div>
      <div className="wallet-hero-glow" aria-hidden="true" />
    </section>
    <div className="wallet-content-grid">
      <section className="panel-card wallet-info-card"><div className="section-heading"><div><div className="eyebrow">MAKE EVERY SESSION COUNT</div><h2>How to earn & spend</h2></div><span className="setting-symbol"><Sparkles size={18} /></span></div><div className="wallet-tip"><span><Gift size={16} /></span><div><strong>Score 70%+ in mock tests</strong><small>Earn test rewards when your attempt qualifies.</small></div></div><div className="wallet-tip"><span><Sparkles size={16} /></span><div><strong>Build your daily learning streak</strong><small>Keep a steady study rhythm to unlock streak rewards.</small></div></div><div className="wallet-tip"><span><ShoppingBag size={16} /></span><div><strong>Redeem coins at checkout</strong><small>10 coins = ₹1 discount on eligible purchases.</small></div></div><Link className="button button-outline wallet-explore-link" to="/explore">Explore learning paths</Link></section>
      <section className="panel-card wallet-ledger-card"><div className="section-heading"><div><div className="eyebrow">YOUR COIN ACTIVITY</div><h2>Transaction history</h2></div><span className="chapter-item-count">{transactions.length} transactions</span></div>
        {loading ? <LoadingSkeleton rows={4} /> : !transactions.length ? <div className="empty-content"><Coins size={22} /><strong>Your ledger is ready.</strong><span>Coin rewards and purchases will show up here.</span></div> : <div className="wallet-ledger">{rows.map(({ transaction, amount, balance }, index) => <article className="wallet-ledger-row" key={transaction.id || `${transaction.created_at}-${index}`}><span className={`ledger-direction ${amount >= 0 ? 'credit' : 'debit'}`}>{amount >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="ledger-copy"><strong>{transactionReason(transaction)}</strong><small>{transactionDate(transaction)}</small></div><div className="ledger-amount"><strong className={amount >= 0 ? 'credit-text' : 'debit-text'}>{amount >= 0 ? '+' : '−'}{Math.abs(amount).toLocaleString()} coins</strong><small>Balance {balance.toLocaleString()}</small></div></article>)}</div>}
      </section>
    </div>
  </div>;
}

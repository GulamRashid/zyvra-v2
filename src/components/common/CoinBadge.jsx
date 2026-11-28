import { Coins } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { Link } from 'react-router-dom';

export default function CoinBadge({ balance = 0, loading = false }) {
  const { t } = useThemeLanguage();
  return (
    <Link
      className="coin-badge h-11 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-600 dark:text-amber-400 text-xs font-black hover:border-amber-400 transition-all shrink-0"
      to="/wallet"
      title={t('coins')}
      aria-label={loading ? 'Loading coin wallet' : `Open coin wallet: ${Number(balance).toLocaleString()} coins`}
    >
      <Coins size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
      {loading ? (
        <span className="inline-block h-3.5 w-7 rounded bg-amber-400/30 animate-pulse" aria-hidden="true" />
      ) : (
        <strong className="text-amber-700 dark:text-amber-300 font-extrabold tabular-nums">{Number(balance).toLocaleString()}</strong>
      )}
      <span className="hidden sm:inline text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-wider font-bold">coins</span>
    </Link>
  );
}

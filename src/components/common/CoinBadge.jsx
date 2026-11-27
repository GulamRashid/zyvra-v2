import { Coins } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { Link } from 'react-router-dom';

export default function CoinBadge({ balance = 0, loading = false }) {
  const { t } = useThemeLanguage();
  return (
    <Link
      className="coin-badge flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-400 text-xs font-black shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:border-amber-400 transition-all"
      to="/wallet"
      title={t('coins')}
      aria-label={loading ? 'Loading coin wallet' : `Open coin wallet: ${Number(balance).toLocaleString()} coins`}
    >
      <Coins size={14} className="text-amber-400" />
      {loading ? (
        <span className="inline-block h-3.5 w-7 rounded bg-amber-400/30 animate-pulse" aria-hidden="true" />
      ) : (
        <strong className="text-amber-300 font-extrabold">{Number(balance).toLocaleString()}</strong>
      )}
      <span className="text-[10px] text-amber-500 uppercase tracking-wider font-bold">coins</span>
    </Link>
  );
}

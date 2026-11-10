import { Coins } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { Link } from 'react-router-dom';

export default function CoinBadge({ balance = 0 }) {
  const { t } = useThemeLanguage();
  return <Link className="coin-badge" to="/wallet" title={t('coins')} aria-label={`Open coin wallet: ${Number(balance).toLocaleString()} coins`}><Coins size={16} /><strong>{Number(balance).toLocaleString()}</strong><span>coins</span></Link>;
}

import { LockKeyhole, Sparkles, X } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function ToolUnlockModal({ title, price, validityDays, comboPrice, comboValidityDays, onBuy, onBuyCombo, onClose }) {
  const { t, language } = useThemeLanguage();
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  return <div className="tool-unlock-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="tool-unlock-modal" role="dialog" aria-modal="true" aria-labelledby="tool-unlock-title">
      <button type="button" className="icon-button tool-unlock-close" aria-label={t('tbClose')} onClick={onClose}><X size={18} /></button>
      <span className="tool-unlock-icon"><LockKeyhole size={23} /></span>
      <div className="eyebrow">{t('tbPremium')}</div>
      <h2 id="tool-unlock-title">{t('tbUnlockTitle')}: {title}</h2>
      <p>{t('tbUnlockDescription')}</p>
      <button type="button" className="button button-gold" onClick={onBuy} disabled={!price}>
        {price ? `${t('tbBuyNow')} · ₹${Number(price).toLocaleString(locale)} / ${validityDays || 30} ${t('tbDays')}` : t('tbPriceUnavailable')}
      </button>
      {comboPrice > 0 && <button type="button" className="button button-outline" onClick={onBuyCombo}>
        <Sparkles size={15} /> {t('tbGetAllTools')} · ₹{Number(comboPrice).toLocaleString(locale)} / {comboValidityDays || 30} {t('tbDays')}
      </button>}
    </section>
  </div>;
}

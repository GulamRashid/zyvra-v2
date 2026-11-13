import { LockKeyhole, Sparkles, X } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function ToolUnlockModal({ title, price, validityDays, comboPrice, comboValidityDays, onBuy, onBuyCombo, onClose }) {
  const { t, language } = useThemeLanguage();
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#04140e] bg-white border dark:border-emerald-500/30 border-slate-300 text-center space-y-4 shadow-xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-unlock-title"
      >
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 dark:hover:text-white"
          aria-label={t('tbClose')}
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-500 text-xl mx-auto">
          <LockKeyhole size={22} />
        </div>

        <div>
          <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
            {t('tbPremium')}
          </div>
          <h2 id="tool-unlock-title" className="text-base font-black dark:text-white text-slate-900 mt-0.5">
            {t('tbUnlockTitle')}: {title}
          </h2>
          <p className="text-xs dark:text-emerald-300/80 text-slate-600 mt-1">
            {t('tbUnlockDescription')}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-black text-xs font-black shadow-glowGold flex items-center justify-center gap-1.5 min-h-[44px]"
            onClick={onBuy}
            disabled={!price}
          >
            <span>
              {price
                ? `${t('tbBuyNow')} · ₹${Number(price).toLocaleString(locale)} / ${validityDays || 30} ${t('tbDays')}`
                : t('tbPriceUnavailable')}
            </span>
          </button>

          {comboPrice > 0 && (
            <button
              type="button"
              className="w-full py-2.5 rounded-xl dark:bg-emerald-950/80 bg-slate-100 hover:bg-slate-200 dark:hover:bg-emerald-900 border dark:border-emerald-500/25 border-slate-300 dark:text-emerald-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
              onClick={onBuyCombo}
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>
                {t('tbGetAllTools')} · ₹${Number(comboPrice).toLocaleString(locale)} / {comboValidityDays || 30} {t('tbDays')}
              </span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

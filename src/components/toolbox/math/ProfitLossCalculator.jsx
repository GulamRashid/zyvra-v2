import { useMemo, useState } from 'react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

function money(value) {
  return Number.isFinite(value) ? `₹${value.toFixed(2)}` : '—';
}

export default function ProfitLossCalculator() {
  const { t } = useThemeLanguage();
  const [cost, setCost] = useState('1000');
  const [selling, setSelling] = useState('1200');
  const [marked, setMarked] = useState('1500');
  const [discount, setDiscount] = useState('10');
  const result = useMemo(() => {
    const cp = Number(cost);
    const sp = Number(selling);
    const mp = Number(marked);
    const rate = Number(discount);
    const valid = cost.trim() !== '' && selling.trim() !== '' && marked.trim() !== '' && discount.trim() !== ''
      && [cp, sp, mp, rate].every(Number.isFinite) && cp > 0 && sp >= 0 && mp >= 0 && rate >= 0 && rate <= 100;
    const difference = sp - cp;
    const discountValue = mp * rate / 100;
    return {
      valid,
      isProfit: difference >= 0,
      difference: Math.abs(difference),
      percentage: cp > 0 ? Math.abs(difference) / cp * 100 : 0,
      discountValue,
      finalPrice: mp - discountValue
    };
  }, [cost, discount, marked, selling]);
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbMathematics')}</div><h3>{t('tbProfitLoss')}</h3></div>
    <div className="unit-converter-controls">
      <label className="field-label">{t('tbCostPrice')}<input className="text-input" min="0" type="number" value={cost} onChange={(event) => setCost(event.target.value)} /></label>
      <label className="field-label">{t('tbSellingPrice')}<input className="text-input" min="0" type="number" value={selling} onChange={(event) => setSelling(event.target.value)} /></label>
      <label className="field-label">{t('tbMarkedPrice')}<input className="text-input" min="0" type="number" value={marked} onChange={(event) => setMarked(event.target.value)} /></label>
      <label className="field-label">{t('tbDiscountPercent')}<input className="text-input" min="0" max="100" type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
    </div>
    <div className="toolbox-formula-grid" aria-live="polite">
      <article className="toolbox-formula-card"><strong>{result.isProfit ? t('tbProfit') : t('tbLoss')}</strong><span>{result.valid ? money(result.difference) : '—'}</span><small>{result.valid ? `${result.percentage.toFixed(2)}%` : '—'}</small></article>
      <article className="toolbox-formula-card"><strong>{t('tbDiscountAmount')}</strong><span>{result.valid ? money(result.discountValue) : '—'}</span></article>
      <article className="toolbox-formula-card"><strong>{t('tbFinalPrice')}</strong><span>{result.valid ? money(result.finalPrice) : '—'}</span></article>
    </div>
  </section>;
}

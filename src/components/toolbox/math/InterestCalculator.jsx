import { useMemo, useState } from 'react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

function money(value) {
  return Number.isFinite(value) ? `₹${value.toFixed(2)}` : '—';
}

export default function InterestCalculator() {
  const { t } = useThemeLanguage();
  const [principal, setPrincipal] = useState('10000');
  const [rate, setRate] = useState('8');
  const [years, setYears] = useState('2');
  const [frequency, setFrequency] = useState('4');
  const result = useMemo(() => {
    const p = Number(principal);
    const r = Number(rate);
    const time = Number(years);
    const n = Number(frequency);
    if ([principal, rate, years, frequency].some((value) => value.trim() === '')
      || ![p, r, time, n].every(Number.isFinite) || p < 0 || r < 0 || time < 0 || n < 1) return null;
    const simple = p * r * time / 100;
    const compound = p * ((1 + r / (100 * n)) ** (n * time) - 1);
    return { simple, compound };
  }, [frequency, principal, rate, years]);
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbMathematics')}</div><h3>{t('tbInterest')}</h3></div>
    <div className="unit-converter-controls">
      <label className="field-label">{t('tbPrincipal')}<input className="text-input" min="0" type="number" value={principal} onChange={(event) => setPrincipal(event.target.value)} /></label>
      <label className="field-label">{t('tbRate')}<input className="text-input" min="0" type="number" step="any" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
      <label className="field-label">{t('tbTimeYears')}<input className="text-input" min="0" type="number" step="any" value={years} onChange={(event) => setYears(event.target.value)} /></label>
      <label className="field-label">{t('tbCompoundsPerYear')}
        <select className="text-input" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
          <option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="12">12</option>
        </select>
      </label>
    </div>
    <div className="toolbox-formula-grid" aria-live="polite">
      <article className="toolbox-formula-card"><strong>{t('tbSimpleInterest')}</strong><span>{result ? money(result.simple) : '—'}</span><small>{t('tbTotalAmount')}: {result ? money(Number(principal) + result.simple) : '—'}</small></article>
      <article className="toolbox-formula-card"><strong>{t('tbCompoundInterest')}</strong><span>{result ? money(result.compound) : '—'}</span><small>{t('tbTotalAmount')}: {result ? money(Number(principal) + result.compound) : '—'}</small></article>
    </div>
  </section>;
}

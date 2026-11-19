import { useMemo, useState } from 'react';
import { Percent, ArrowRightLeft, Sparkles, BookOpen } from 'lucide-react';
import MathRenderer from '../../common/MathRenderer';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

export function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

export function approximateFraction(decimal) {
  let best = { numerator: Math.round(decimal), denominator: 1 };
  let smallestError = Math.abs(decimal - best.numerator);
  for (let denominator = 1; denominator <= 1000; denominator += 1) {
    const numerator = Math.round(decimal * denominator);
    const error = Math.abs(decimal - numerator / denominator);
    if (error < smallestError) {
      smallestError = error;
      best = { numerator, denominator };
    }
    if (error <= 0.0001) break;
  }
  const divisor = gcd(best.numerator, best.denominator);
  return { numerator: best.numerator / divisor, denominator: best.denominator / divisor };
}

const GOLDEN_FRACTIONS = [
  { num: 1, den: 2, pct: '50%' },
  { num: 1, den: 3, pct: '33.33%' },
  { num: 1, den: 4, pct: '25%' },
  { num: 1, den: 5, pct: '20%' },
  { num: 1, den: 6, pct: '16.66%' },
  { num: 1, den: 7, pct: '14.28%' },
  { num: 1, den: 8, pct: '12.5%' },
  { num: 1, den: 9, pct: '11.11%' },
  { num: 1, den: 10, pct: '10%' },
  { num: 1, den: 11, pct: '9.09%' },
  { num: 1, den: 12, pct: '8.33%' },
  { num: 1, den: 14, pct: '7.14%' },
  { num: 1, den: 15, pct: '6.66%' },
  { num: 1, den: 16, pct: '6.25%' },
  { num: 1, den: 20, pct: '5%' },
  { num: 1, den: 25, pct: '4%' }
];

export default function FractionConverter() {
  const { t, language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeMode, setActiveMode] = useState('both'); // 'both' | 'chart'

  const [percentage, setPercentage] = useState('16.66');
  const [numerator, setNumerator] = useState('1');
  const [denominator, setDenominator] = useState('6');

  const converted = useMemo(() => {
    const value = Number(percentage);
    if (percentage.trim() === '' || !Number.isFinite(value)) return null;
    return approximateFraction(value / 100);
  }, [percentage]);

  const fractionPercent = useMemo(() => {
    const top = Number(numerator);
    const bottom = Number(denominator);
    if (numerator.trim() === '' || denominator.trim() === '' || !Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;
    return (top / bottom) * 100;
  }, [numerator, denominator]);

  const selectGoldenFraction = (item) => {
    setNumerator(String(item.num));
    setDenominator(String(item.den));
    setPercentage(item.pct.replace('%', ''));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Percent size={14} />
            {isHi ? 'गणित कैलकुलेटर' : 'Math Engine'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'भिन्न एवं प्रतिशत रूपांतरक (Fraction & % Converter)' : 'Fraction & Percentage Master'}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setActiveMode((m) => (m === 'chart' ? 'both' : 'chart'))}
          className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto hover:bg-amber-500/20 transition-all"
        >
          <BookOpen size={14} />
          {activeMode === 'chart'
            ? (isHi ? 'कैलकुलेटर देखें' : 'Show Calculators')
            : (isHi ? 'गोल्डन भिन्न टेबल (1/2 - 1/25)' : 'Golden Fraction Table')}
        </button>
      </div>

      {/* Quick Load Golden Fractions Strip */}
      <div className="rounded-2xl p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Sparkles size={13} />
            {isHi ? 'परीक्षा में बार-बार पूछे जाने वाले भिन्न (क्लिक करके लोड करें):' : 'High-Yield Exam Fractions (Click to load):'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GOLDEN_FRACTIONS.map((item) => {
            const isCurrent = numerator === String(item.num) && denominator === String(item.den);
            return (
              <button
                key={`${item.num}/${item.den}`}
                type="button"
                onClick={() => selectGoldenFraction(item)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  isCurrent
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-amber-400'
                }`}
              >
                <span>{item.num}/{item.den}</span>
                <span className={`text-[10px] ${isCurrent ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`}>
                  = {item.pct}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversion Dual Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box 1: Percentage to Fraction */}
        <section className="toolbox-section mini-tool p-4 rounded-2xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {t('tbPercentToFraction') || (isHi ? 'प्रतिशत से भिन्न' : 'Percent to Fraction')}
            </div>
            <h4 className="text-sm font-black text-neutral-900 dark:text-white">
              {t('tbConvertPercent') || (isHi ? 'प्रतिशत दर्ज करें' : 'Convert Percentage')}
            </h4>
          </div>

          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">
            {t('tbPercentageLabel') || (isHi ? 'प्रतिशत मान:' : 'Percentage value:')}
            <div className="flex items-center gap-2 mt-1">
              <input
                className="w-full text-sm font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                type="number"
                step="any"
                inputMode="decimal"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
              />
              <span className="text-sm font-bold text-neutral-500">%</span>
            </div>
          </label>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center" aria-live="polite">
            {converted ? (
              <MathRenderer formula={`${percentage}\\% \\approx \\frac{${converted.numerator}}{${converted.denominator}}`} />
            ) : (
              <span className="text-xs text-rose-500 font-bold">{t('tbFractionInvalid')}</span>
            )}
          </div>

          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {t('tbFractionApproxNote') || (isHi ? 'सटीक भिन्न मान न्यूनतम हर के साथ निकटतम निकाला जाता है।' : 'Calculates the simplified fraction representation.')}
          </p>
        </section>

        {/* Box 2: Fraction to Percentage */}
        <section className="toolbox-section mini-tool p-4 rounded-2xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {t('tbFractionToPercent') || (isHi ? 'भिन्न से प्रतिशत' : 'Fraction to Percent')}
            </div>
            <h4 className="text-sm font-black text-neutral-900 dark:text-white">
              {t('tbConvertFraction') || (isHi ? 'अंश और हर दर्ज करें' : 'Convert Fraction')}
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block mb-1">
                {t('tbNumerator') || (isHi ? 'अंश (Numerator)' : 'Numerator')}
              </label>
              <input
                className="w-full text-sm font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                type="number"
                step="any"
                inputMode="decimal"
                value={numerator}
                onChange={(event) => setNumerator(event.target.value)}
              />
            </div>

            <span className="text-lg font-black text-neutral-400 mt-5">/</span>

            <div className="flex-1">
              <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block mb-1">
                {t('tbDenominator') || (isHi ? 'हर (Denominator)' : 'Denominator')}
              </label>
              <input
                className="w-full text-sm font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                type="number"
                step="any"
                inputMode="decimal"
                value={denominator}
                onChange={(event) => setDenominator(event.target.value)}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center" aria-live="polite">
            {fractionPercent !== null ? (
              <MathRenderer formula={`\\frac{${numerator}}{${denominator}} = ${Number(fractionPercent.toFixed(4))}\\%`} />
            ) : (
              <span className="text-xs text-rose-500 font-bold">{t('tbFractionInvalidDenom')}</span>
            )}
          </div>

          {fractionPercent !== null && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {t('tbSimplifiedFraction') || (isHi ? 'प्रतिशत मान: (अंश ÷ हर) × 100' : 'Percentage: (Numerator ÷ Denominator) × 100')}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
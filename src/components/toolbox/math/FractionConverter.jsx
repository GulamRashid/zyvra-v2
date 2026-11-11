import { useMemo, useState } from 'react';
import MathRenderer from '../../common/MathRenderer';

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function approximateFraction(decimal) {
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

export default function FractionConverter() {
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

  return <div className="fraction-converter-stack">
    <section className="toolbox-section mini-tool">
      <div><div className="eyebrow">PERCENTAGE TO FRACTION</div><h3>Convert a percentage</h3></div>
      <label className="field-label">Percentage (%)
        <div className="fraction-input-wrap"><input className="text-input" type="number" step="any" inputMode="decimal" value={percentage} onChange={(event) => setPercentage(event.target.value)} /><span>%</span></div>
      </label>
      <div className="fraction-result" aria-live="polite">
        {converted
          ? <MathRenderer formula={`${percentage}\\% \\approx \\frac{${converted.numerator}}{${converted.denominator}}`} />
          : <span>Enter a valid percentage to convert it.</span>}
      </div>
      <p className="field-hint">The simplest familiar fraction is chosen when the decimal percentage is rounded (for example, 16.66% ≈ 1/6).</p>
    </section>
    <section className="toolbox-section mini-tool">
      <div><div className="eyebrow">FRACTION TO PERCENTAGE</div><h3>Convert a fraction</h3></div>
      <div className="fraction-parts">
        <label className="field-label">Numerator<input className="text-input" type="number" step="any" inputMode="decimal" value={numerator} onChange={(event) => setNumerator(event.target.value)} /></label>
        <span className="fraction-divider">÷</span>
        <label className="field-label">Denominator<input className="text-input" type="number" step="any" inputMode="decimal" value={denominator} onChange={(event) => setDenominator(event.target.value)} /></label>
      </div>
      <div className="fraction-result" aria-live="polite">
        {fractionPercent !== null
          ? <MathRenderer formula={`\\frac{${numerator}}{${denominator}} = ${Number(fractionPercent.toFixed(4))}\\%`} />
          : <span>Enter a valid fraction with a non-zero denominator.</span>}
      </div>
    </section>
  </div>;
}

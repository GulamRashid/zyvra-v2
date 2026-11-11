import { useMemo, useState } from 'react';
import MathRenderer from '../../common/MathRenderer';

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

export default function FractionConverter() {
  const [percentage, setPercentage] = useState('12.5');
  const fraction = useMemo(() => {
    const value = Number(percentage);
    if (percentage.trim() === '' || !Number.isFinite(value)) return null;
    const precision = Math.min((percentage.split('.')[1] || '').length, 6);
    const denominator = 10 ** precision * 100;
    const numerator = Math.round(value * (denominator / 100));
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }, [percentage]);

  return <section className="toolbox-section mini-tool fraction-converter">
    <label className="field-label">Percentage
      <div className="fraction-input-wrap"><input className="text-input" type="number" step="any" inputMode="decimal" value={percentage} onChange={(event) => setPercentage(event.target.value)} /><span>%</span></div>
    </label>
    <div className="fraction-result" aria-live="polite">
      {fraction
        ? <MathRenderer formula={`${fraction.numerator}\\; / \\;${fraction.denominator} = ${Number(percentage)}\\%`} />
        : <span>Enter a valid percentage to convert it.</span>}
    </div>
    <p className="field-hint">The fraction is reduced to its simplest form.</p>
  </section>;
}

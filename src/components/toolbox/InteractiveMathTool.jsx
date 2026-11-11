import { useMemo, useState } from 'react';
import { Calculator, Hash } from 'lucide-react';
import MathRenderer from '../common/MathRenderer';

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'Value is too large to calculate.';
  return Number(value.toPrecision(10)).toString();
}

export default function InteractiveMathTool() {
  const [input, setInput] = useState('12');
  const value = Number(input);
  const valid = input.trim() !== '' && Number.isFinite(value);
  const calculations = useMemo(() => {
    if (!valid) return null;
    return {
      square: formatNumber(value ** 2),
      cube: formatNumber(value ** 3),
      reciprocal: value === 0 ? null : formatNumber(1 / value),
      percentage: value === 0 ? null : formatNumber((1 / value) * 100),
      timesEleven: formatNumber(value * 11),
      timesFive: formatNumber(value * 5),
      timesTwentyFive: formatNumber(value * 25)
    };
  }, [valid, value]);

  return <section className="toolbox-section interactive-math-tool">
    <div className="section-heading">
      <div><div className="eyebrow">QUICK MATH</div><h2><Calculator size={17} /> Number shortcuts</h2></div>
    </div>
    <label className="interactive-math-input">
      <span><Hash size={16} /> Enter a number (N)</span>
      <input className="text-input" type="number" step="any" value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. 12" inputMode="decimal" />
    </label>
    <div className="interactive-math-grid" aria-live="polite">
      <article className="interactive-math-result"><strong>Square</strong><MathRenderer formula={valid ? `${input}^2 = ${calculations.square}` : 'N^2'} /></article>
      <article className="interactive-math-result"><strong>Cube</strong><MathRenderer formula={valid ? `${input}^3 = ${calculations.cube}` : 'N^3'} /></article>
      <article className="interactive-math-result">
        <strong>Fraction & percentage</strong>
        {valid && calculations.percentage !== null
          ? <MathRenderer formula={`\\frac{1}{${input}} = ${calculations.reciprocal} = ${calculations.percentage}\\%`} />
          : valid ? <span>N must be non-zero for 1/N.</span> : <MathRenderer formula="\\frac{1}{N} = decimal = percentage" />}
      </article>
      <article className="interactive-math-result"><strong>Multiply by 11</strong><MathRenderer formula={valid ? `${input} \\times 11 = ${calculations.timesEleven}` : 'N \\times 11'} /><small>For two digits, add the digits and place the sum between them (carry if needed).</small></article>
      <article className="interactive-math-result"><strong>Multiply by 5</strong><MathRenderer formula={valid ? `${input} \\times 5 = ${calculations.timesFive}` : 'N \\times 5'} /><small>Multiply by 10, then halve the result.</small></article>
      <article className="interactive-math-result"><strong>Multiply by 25</strong><MathRenderer formula={valid ? `${input} \\times 25 = ${calculations.timesTwentyFive}` : 'N \\times 25'} /><small>Multiply by 100, then divide by 4.</small></article>
    </div>
  </section>;
}

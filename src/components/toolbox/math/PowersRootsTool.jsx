import { useMemo, useState } from 'react';
import MathRenderer from '../../common/MathRenderer';

function format(value) {
  return Number.isFinite(value) ? Number(value.toPrecision(10)).toString() : '—';
}

export default function PowersRootsTool() {
  const [input, setInput] = useState('12');
  const value = Number(input);
  const results = useMemo(() => {
    if (input.trim() === '' || !Number.isFinite(value)) return null;
    return {
      square: format(value ** 2),
      cube: format(value ** 3),
      squareRoot: value < 0 ? 'Not a real number' : format(Math.sqrt(value)),
      cubeRoot: format(Math.cbrt(value))
    };
  }, [input, value]);

  return <section className="toolbox-section mini-tool powers-roots-tool">
    <label className="field-label">Enter a number
      <input className="text-input" type="number" step="any" inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} />
    </label>
    <div className="toolbox-formula-grid">
      <article className="toolbox-formula-card"><strong>Square</strong><MathRenderer formula={`${input || 'N'}^2 = ${results?.square || '—'}`} /></article>
      <article className="toolbox-formula-card"><strong>Cube</strong><MathRenderer formula={`${input || 'N'}^3 = ${results?.cube || '—'}`} /></article>
      <article className="toolbox-formula-card"><strong>Square root</strong><MathRenderer formula={`\\sqrt{${input || 'N'}} = ${results?.squareRoot || '—'}`} /></article>
      <article className="toolbox-formula-card"><strong>Cube root</strong><MathRenderer formula={`\\sqrt[3]{${input || 'N'}} = ${results?.cubeRoot || '—'}`} /></article>
    </div>
  </section>;
}

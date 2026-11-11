import { useMemo, useState } from 'react';
import MathRenderer from '../../common/MathRenderer';

function format(value) {
  return Number.isFinite(value) ? Number(value.toPrecision(8)).toString() : '—';
}

export default function SquaresCubes() {
  const [input, setInput] = useState('12');
  const value = Number(input);
  const results = useMemo(() => {
    if (input.trim() === '' || !Number.isFinite(value)) return null;
    return {
      square: format(value ** 2),
      cube: format(value ** 3),
      squareRoot: value < 0 ? null : format(Math.sqrt(value)),
      cubeRoot: format(Math.cbrt(value))
    };
  }, [input, value]);

  return <section className="toolbox-section mini-tool">
    <label className="field-label">Enter a number (N)
      <input className="text-input" type="number" step="any" inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} />
    </label>
    <div className="toolbox-formula-grid squares-cubes-results" aria-live="polite">
      <article className="toolbox-formula-card"><strong>Square</strong><MathRenderer formula={`${input || 'N'}^2 = ${results?.square || '—'}`} /></article>
      <article className="toolbox-formula-card"><strong>Cube</strong><MathRenderer formula={`${input || 'N'}^3 = ${results?.cube || '—'}`} /></article>
      <article className="toolbox-formula-card"><strong>Square root</strong>{results?.squareRoot !== null && results?.squareRoot !== undefined ? <MathRenderer formula={`\\sqrt{${input || 'N'}} = ${results.squareRoot}`} /> : <span>Real square root is undefined for negative values.</span>}</article>
      <article className="toolbox-formula-card"><strong>Cube root</strong><MathRenderer formula={`\\sqrt[3]{${input || 'N'}} = ${results?.cubeRoot || '—'}`} /></article>
    </div>
    <div className="square-reference-wrap">
      <h3>Squares & cubes: 1 to 30</h3>
      <div className="square-reference-scroll">
        <table className="square-reference-table">
          <thead><tr><th>n</th><th>n²</th><th>n³</th></tr></thead>
          <tbody>{Array.from({ length: 30 }, (_, index) => {
            const number = index + 1;
            return <tr key={number}><td>{number}</td><td>{number ** 2}</td><td>{number ** 3}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  </section>;
}

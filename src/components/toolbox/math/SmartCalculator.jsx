import { useState } from 'react';
import { Delete, Equal, Sparkles } from 'lucide-react';

const basicKeys = [
  ['AC', 'clear'], ['DEL', 'delete'], ['%', 'operator'], ['÷', 'operator'],
  ['7', 'number'], ['8', 'number'], ['9', 'number'], ['×', 'operator'],
  ['4', 'number'], ['5', 'number'], ['6', 'number'], ['−', 'operator'],
  ['1', 'number'], ['2', 'number'], ['3', 'number'], ['+', 'operator'],
  ['±', 'sign'], ['0', 'number'], ['.', 'decimal'], ['=', 'equals']
];

function calculate(left, operator, right) {
  if (operator === '+') return left + right;
  if (operator === '−') return left - right;
  if (operator === '×') return left * right;
  if (operator === '÷') return right === 0 ? NaN : left / right;
  if (operator === '%') return left % right;
  return right;
}

function tidy(value) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(10))) : 'Error';
}

export default function SmartCalculator() {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [replaceDisplay, setReplaceDisplay] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const press = (key, type) => {
    if (type === 'clear') {
      setDisplay('0');
      setStoredValue(null);
      setOperator(null);
      setReplaceDisplay(false);
    } else if (type === 'delete') {
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : '0');
    } else if (type === 'number') {
      setDisplay((current) => replaceDisplay || current === '0' || current === 'Error' ? key : current + key);
      setReplaceDisplay(false);
    } else if (type === 'decimal') {
      setDisplay((current) => replaceDisplay ? '0.' : current.includes('.') ? current : `${current}.`);
      setReplaceDisplay(false);
    } else if (type === 'sign') {
      setDisplay((current) => current.startsWith('-') ? current.slice(1) : `-${current}`);
    } else if (type === 'operator') {
      const current = Number(display);
      if (operator && storedValue !== null && !replaceDisplay) {
        const result = calculate(storedValue, operator, current);
        setDisplay(tidy(result));
        setStoredValue(result);
      } else {
        setStoredValue(current);
      }
      setOperator(key);
      setReplaceDisplay(true);
    } else if (type === 'equals' && operator && storedValue !== null) {
      setDisplay(tidy(calculate(storedValue, operator, Number(display))));
      setStoredValue(null);
      setOperator(null);
      setReplaceDisplay(true);
    } else if (type === 'constant') {
      setDisplay(tidy(Math.PI));
      setReplaceDisplay(true);
    } else if (type === 'unary') {
      const value = Number(display);
      const results = {
        sin: Math.sin(value * Math.PI / 180),
        cos: Math.cos(value * Math.PI / 180),
        tan: Math.tan(value * Math.PI / 180),
        log: value > 0 ? Math.log10(value) : NaN,
        sqrt: value >= 0 ? Math.sqrt(value) : NaN,
        square: value ** 2
      };
      setDisplay(tidy(results[key]));
      setReplaceDisplay(true);
    }
  };

  return <section className="toolbox-section mini-tool calculator-tool">
    <div className="calculator-display" aria-live="polite">{display}</div>
    <div className="calculator-keypad">
      {basicKeys.map(([label, type]) => <button
        type="button"
        key={label}
        className={`calculator-key ${type === 'operator' || type === 'equals' ? 'accent' : ''} ${type === 'clear' || type === 'delete' ? 'utility' : ''} ${type === 'operator' && operator === label ? 'selected' : ''}`}
        aria-label={label === 'DEL' ? 'Delete last digit' : label}
        aria-pressed={type === 'operator' ? operator === label : undefined}
        onClick={() => press(label, type)}
      >{label === 'DEL' ? <Delete size={18} /> : label === '=' ? <Equal size={18} /> : label}</button>)}
    </div>
    <button type="button" className={`calculator-advanced-toggle ${advanced ? 'active' : ''}`} onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}><Sparkles size={16} /> {advanced ? 'Hide advanced' : 'Advanced'}</button>
    {advanced && <div className="calculator-advanced-grid">
      {[['sin', 'unary'], ['cos', 'unary'], ['tan', 'unary'], ['log', 'unary'], ['√', 'unary', 'sqrt'], ['x²', 'unary', 'square'], ['π', 'constant']].map(([label, type, value]) => <button className="calculator-key advanced" type="button" key={label} onClick={() => press(value || label, type)}>{label}</button>)}
      <p className="field-hint">Trigonometric functions use degrees. Log is base 10.</p>
    </div>}
  </section>;
}

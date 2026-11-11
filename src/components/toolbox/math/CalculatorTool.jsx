import { useState } from 'react';
import { Delete, Equal } from 'lucide-react';

const keys = [
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

export default function CalculatorTool() {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [replaceDisplay, setReplaceDisplay] = useState(false);

  const press = (key, type) => {
    if (type === 'clear') {
      setDisplay('0');
      setStoredValue(null);
      setOperator(null);
      setReplaceDisplay(false);
    } else if (type === 'delete') {
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : '0');
    } else if (type === 'number') {
      setDisplay((current) => replaceDisplay || current === '0' ? key : current + key);
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
        setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(10))) : 'Error');
        setStoredValue(result);
      } else {
        setStoredValue(current);
      }
      setOperator(key);
      setReplaceDisplay(true);
    } else if (type === 'equals' && operator && storedValue !== null) {
      const result = calculate(storedValue, operator, Number(display));
      setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(10))) : 'Error');
      setStoredValue(null);
      setOperator(null);
      setReplaceDisplay(true);
    }
  };

  return <section className="toolbox-section mini-tool calculator-tool">
    <div className="calculator-display" aria-live="polite">{display}</div>
    <div className="calculator-keypad">
      {keys.map(([label, type]) => <button
        type="button"
        key={label}
        className={`calculator-key ${type === 'operator' || type === 'equals' ? 'accent' : ''} ${type === 'clear' || type === 'delete' ? 'utility' : ''}`}
        aria-label={label === 'DEL' ? 'Delete last digit' : label}
        onClick={() => press(label, type)}
      >
        {label === 'DEL' ? <Delete size={18} /> : label === '=' ? <Equal size={18} /> : label}
      </button>)}
    </div>
  </section>;
}

import { useState } from 'react';
import { Delete, Equal, Sparkles } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const basicKeys = [
  ['AC', 'clear'], ['DEL', 'delete'], ['%', 'percent'], ['÷', 'operator'],
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
  if (operator === '%') return (left * right) / 100;
  if (operator === 'nPr') return choose(left, right, true);
  if (operator === 'nCr') return choose(left, right, false);
  return right;
}

function tidy(value) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(10))) : 'Error';
}

function factorial(value) {
  if (!Number.isInteger(value) || value < 0 || value > 170) return NaN;
  let result = 1;
  for (let number = 2; number <= value; number += 1) result *= number;
  return result;
}

function choose(n, r, permutations) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n > 170) return NaN;
  return permutations ? factorial(n) / factorial(n - r) : factorial(n) / (factorial(r) * factorial(n - r));
}

export default function SmartCalculator() {
  const { t } = useThemeLanguage();
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [activeOperation, setActiveOperation] = useState(null);
  const [replaceDisplay, setReplaceDisplay] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [memory, setMemory] = useState(0);

  const press = (key, type) => {
    if (type === 'clear') {
      setDisplay('0');
      setStoredValue(null);
      setOperator(null);
      setActiveOperation(null);
      setReplaceDisplay(false);
    } else if (type === 'delete') {
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : '0');
    } else if (type === 'number') {
      if (replaceDisplay) setActiveOperation(null);
      setDisplay((current) => replaceDisplay || current === '0' || current === 'Error' ? key : current + key);
      setReplaceDisplay(false);
    } else if (type === 'decimal') {
      if (replaceDisplay) setActiveOperation(null);
      setDisplay((current) => replaceDisplay ? '0.' : current.includes('.') ? current : `${current}.`);
      setReplaceDisplay(false);
    } else if (type === 'sign') {
      setDisplay((current) => current.startsWith('-') ? current.slice(1) : `-${current}`);
    } else if (type === 'percent') {
      const current = Number(display);
      if (operator && storedValue !== null) {
        const percentVal = (storedValue * current) / 100;
        setDisplay(tidy(percentVal));
      } else {
        setDisplay(tidy(current / 100));
        setReplaceDisplay(true);
      }
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
      setActiveOperation(key);
      setReplaceDisplay(true);
    } else if (type === 'equals' && operator && storedValue !== null) {
      setDisplay(tidy(calculate(storedValue, operator, Number(display))));
      setStoredValue(null);
      setOperator(null);
      setActiveOperation(null);
      setReplaceDisplay(true);
    } else if (type === 'constant') {
      setDisplay(tidy(Math.PI));
      setReplaceDisplay(true);
    } else if (type === 'memory') {
      const current = Number(display);
      if (key === 'M+') setMemory((value) => value + current);
      if (key === 'M-') setMemory((value) => value - current);
      if (key === 'MR') {
        setDisplay(tidy(memory));
        setReplaceDisplay(true);
      }
    } else if (type === 'binary') {
      setStoredValue(Number(display));
      setOperator(key);
      setActiveOperation(key);
      setReplaceDisplay(true);
    } else if (type === 'unary') {
      const value = Number(display);
      const results = {
        sin: Math.sin(value * Math.PI / 180),
        cos: Math.cos(value * Math.PI / 180),
        tan: Math.tan(value * Math.PI / 180),
        log: value > 0 ? Math.log10(value) : NaN,
        sqrt: value >= 0 ? Math.sqrt(value) : NaN,
        square: value ** 2,
        factorial: factorial(value)
      };
      setDisplay(tidy(results[key]));
      setReplaceDisplay(true);
    }
  };

  const pendingExpression = operator !== null && storedValue !== null
    ? `${storedValue} ${operator}`
    : '';

  return <section className="toolbox-section mini-tool calculator-tool">
    <div className="calculator-display" aria-live="polite" aria-label={`${pendingExpression ? `${pendingExpression} ` : ''}${display}`}>
      <span className="calculator-secondary-display" aria-hidden="true">{pendingExpression}</span>
      <span className="calculator-primary-display">{display === 'Error' ? t('tbError') : display}</span>
    </div>
    <div className="calculator-keypad">
      {basicKeys.map(([label, type]) => <button
        type="button"
        key={label}
        className={`calculator-key ${type === 'operator' || type === 'equals' || type === 'percent' ? 'accent' : ''} ${type === 'clear' || type === 'delete' ? 'utility' : ''} ${type === 'operator' && activeOperation === label ? 'selected' : ''}`}
        aria-label={label === 'DEL' ? t('tbDeleteLastDigit') : label}
        aria-pressed={type === 'operator' ? activeOperation === label : undefined}
        onClick={() => press(label, type)}
      >{label === 'DEL' ? <Delete size={18} /> : label === '=' ? <Equal size={18} /> : label}</button>)}
    </div>
    <button type="button" className={`calculator-advanced-toggle ${advanced ? 'active' : ''}`} onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}><Sparkles size={16} /> {advanced ? t('tbHideAdvanced') : t('tbAdvanced')}</button>
    {advanced && <div className="calculator-advanced-grid">
      {[['sin', 'unary'], ['cos', 'unary'], ['tan', 'unary'], ['log', 'unary'], ['√', 'unary', 'sqrt'], ['x²', 'unary', 'square'], ['n!', 'unary', 'factorial'], ['π', 'constant'], ['nPr', 'binary'], ['nCr', 'binary'], ['M+', 'memory'], ['M−', 'memory', 'M-'], ['MR', 'memory']].map(([label, type, value]) => <button className={`calculator-key advanced ${type === 'binary' && activeOperation === label ? 'selected' : ''}`} type="button" key={label} onClick={() => press(value || label, type)}>{label}</button>)}
      <p className="field-hint">{t('tbTrigHint')}</p>
      <p className="field-hint">{t('tbMemory')}: {tidy(memory)} · {t('tbFactorial')}, {t('tbPermutations')}, {t('tbCombinations')}</p>
    </div>}
  </section>;
}

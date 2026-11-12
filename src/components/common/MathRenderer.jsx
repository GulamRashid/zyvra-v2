import katex from 'katex';
import 'katex/dist/katex.min.css';

const delimiters = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g;
const bareFormula = /\\(?:d?frac|sqrt)\{[^{}]+\}(?:\{[^{}]+\})?|[A-Za-z0-9]+(?:\^\{[^{}]+\}|_[{][^{}]+[}]|\^[A-Za-z0-9]+|_[A-Za-z0-9]+)/g;

function renderMath(formula, displayMode = false) {
  try {
    return katex.renderToString(formula, { displayMode, throwOnError: false });
  } catch {
    return null;
  }
}

function MathMarkup({ formula, display = false, fallback, className = '' }) {
  const html = renderMath(formula || '', display);
  if (html === null) return <span className="math-render-error">{fallback ?? formula}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderFormulaParts(text, keyPrefix = 'math') {
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(bareFormula)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push(<MathMarkup key={`${keyPrefix}-${index}`} formula={match[0]} fallback={match[0]} />);
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

export default function MathRenderer({ formula, content, display = false, children, className = '' }) {
  if (formula !== undefined) {
    return <MathMarkup formula={formula} display={display} className={`math-text ${className}`.trim()} />;
  }

  const rawText = children !== undefined ? children : (content !== undefined ? content : '');
  const text = typeof rawText === 'string' || typeof rawText === 'number' ? String(rawText) : '';
  const parts = text.split(delimiters);
  return <span className={`math-text ${className}`.trim()}>
    {parts.map((part, index) => {
      if (!part) return null;
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <MathMarkup className="math-block-inline" key={`display-${index}`} formula={part.slice(2, -2)} display fallback={part} />;
      }
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        return <MathMarkup className="math-block-inline" key={`display-${index}`} formula={part.slice(2, -2)} display fallback={part} />;
      }
      if ((part.startsWith('\\(') && part.endsWith('\\)')) || (part.startsWith('$') && part.endsWith('$'))) {
        const math = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
        return <MathMarkup key={`inline-${index}`} formula={math} fallback={part} />;
      }
      return <span key={`text-${index}`}>{renderFormulaParts(part, `bare-${index}`)}</span>;
    })}
  </span>;
}

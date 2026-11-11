import { BlockMath, InlineMath } from 'react-katex';

const delimiters = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g;
const bareFormula = /\\(?:d?frac|sqrt)\{[^{}]+\}(?:\{[^{}]+\})?|[A-Za-z0-9]+(?:\^\{[^{}]+\}|_[{][^{}]+[}]|\^[A-Za-z0-9]+|_[A-Za-z0-9]+)/g;

function renderFormulaParts(text, keyPrefix = 'math') {
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(bareFormula)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push(<InlineMath key={`${keyPrefix}-${index}`} math={match[0]} renderError={() => <span className="math-render-error">{match[0]}</span>} />);
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

export default function MathRenderer({ children, className = '' }) {
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  const parts = text.split(delimiters);
  return <span className={`math-text ${className}`.trim()}>
    {parts.map((part, index) => {
      if (!part) return null;
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <span className="math-block-inline" key={`display-${index}`}><BlockMath math={part.slice(2, -2)} renderError={() => <span className="math-render-error">{part}</span>} /></span>;
      }
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        return <span className="math-block-inline" key={`display-${index}`}><BlockMath math={part.slice(2, -2)} renderError={() => <span className="math-render-error">{part}</span>} /></span>;
      }
      if ((part.startsWith('\\(') && part.endsWith('\\)')) || (part.startsWith('$') && part.endsWith('$'))) {
        const math = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
        return <InlineMath key={`inline-${index}`} math={math} renderError={() => <span className="math-render-error">{part}</span>} />;
      }
      return <span key={`text-${index}`}>{renderFormulaParts(part, `bare-${index}`)}</span>;
    })}
  </span>;
}

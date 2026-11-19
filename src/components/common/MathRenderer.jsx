import { memo, useEffect, useState } from 'react';
import { getCachedKatex, loadKatex } from '../../lib/loadKatex';
import 'katex/dist/katex.min.css';

const delimiters = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g;
const bareFormula = /\\(?:d?frac|sqrt)\{[^{}]+\}(?:\{[^{}]+\})?|[A-Za-z0-9]+(?:\^\{[^{}]+\}|_[{][^{}]+[}]|\^[A-Za-z0-9]+|_[A-Za-z0-9]+)/g;

// High-speed in-memory LRU/Map cache for KaTeX rendered HTML strings
const katexRenderCache = new Map();
const MAX_CACHE_SIZE = 1000;

function renderKatexCached(katex, formula, display) {
  const cacheKey = `${display ? 'D' : 'I'}:${formula}`;
  if (katexRenderCache.has(cacheKey)) {
    return katexRenderCache.get(cacheKey);
  }
  try {
    const html = katex.renderToString(formula || '', { displayMode: display, throwOnError: false });
    if (katexRenderCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = katexRenderCache.keys().next().value;
      katexRenderCache.delete(oldestKey);
    }
    katexRenderCache.set(cacheKey, html);
    return html;
  } catch {
    return null;
  }
}

function MathMarkupComponent({ formula, display = false, fallback, className = '' }) {
  const [katex, setKatex] = useState(() => getCachedKatex());

  useEffect(() => {
    if (katex) return;
    let active = true;
    loadKatex()
      .then((loadedKatex) => {
        if (active) setKatex(() => loadedKatex);
      })
      .catch((error) => {
        console.error('[MathRenderer] Unable to load KaTeX:', error);
      });
    return () => { active = false; };
  }, [katex]);

  if (!katex) return <span className="math-render-pending">{fallback ?? formula}</span>;

  const html = renderKatexCached(katex, formula, display);
  if (html === null) return <span className="math-render-error">{fallback ?? formula}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

const MathMarkup = memo(MathMarkupComponent);

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

function MathRendererComponent({ formula, content, display = false, children, className = '' }) {
  if (formula !== undefined) {
    return <MathMarkup formula={formula} display={display} className={`math-text ${className}`.trim()} />;
  }

  const rawText = children !== undefined ? children : (content !== undefined ? content : '');
  const text = typeof rawText === 'string' || typeof rawText === 'number' ? String(rawText) : '';
  const parts = text.split(delimiters);
  return (
    <span className={`math-text ${className}`.trim()}>
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
    </span>
  );
}

const MathRenderer = memo(MathRendererComponent);
export default MathRenderer;

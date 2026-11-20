import React from 'react';
import MathRenderer from '../../common/MathRenderer';

// Parse inline formatting: **bold**, *italic*, `code`, and $math$
function renderInlineContent(text, lineIdx = 0) {
  if (!text) return null;

  // Pattern to catch math, bold, italic, and inline code
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, pIdx) => {
    if (!part) return null;

    // LaTeX Math ($...$ or $$...$$)
    if (part.startsWith('$') && part.endsWith('$')) {
      return <MathRenderer key={`m-${lineIdx}-${pIdx}`} content={part} />;
    }

    // Bold (**text**) -> Clean strong element without asterisks
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={`b-${lineIdx}-${pIdx}`} className="font-black text-slate-900 dark:text-white">
          {boldText}
        </strong>
      );
    }

    // Inline Code (`code`)
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={`c-${lineIdx}-${pIdx}`}
          className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-amber-600 dark:text-amber-400 font-mono text-[11px] border border-slate-300/40 dark:border-slate-700/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Italic (*text*) -> Clean em element without asterisks
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={`i-${lineIdx}-${pIdx}`} className="italic text-slate-700 dark:text-slate-300">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Regular text (renders bare fractions or exponents via MathRenderer)
    return <MathRenderer key={`t-${lineIdx}-${pIdx}`} content={part} />;
  });
}

export default function AiMessageRenderer({ content, className = '' }) {
  if (!content) return null;

  const raw = String(content || '');
  const lines = raw.split('\n');

  const elements = [];
  let currentList = null; // { type: 'bullet' | 'number', items: [] }

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'bullet') {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2 space-y-1.5 pl-0.5">
            {currentList.items.map((it, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                <span className="flex-1">{renderInlineContent(it, idx)}</span>
              </li>
            ))}
          </ul>
        );
      } else if (currentList.type === 'number') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2 space-y-1.5 pl-0.5">
            {currentList.items.map((it, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                <span className="font-black text-amber-500 min-w-[20px] shrink-0 text-xs mt-0.5">
                  {it.num}.
                </span>
                <span className="flex-1">{renderInlineContent(it.text, idx)}</span>
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line separates blocks
    if (!trimmed) {
      flushList();
      continue;
    }

    // Markdown Headers: #, ##, ###
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      elements.push(
        <div
          key={`h-${i}`}
          className={`font-black text-slate-900 dark:text-white tracking-tight ${
            level <= 2
              ? 'text-sm sm:text-base mt-3 mb-1.5 border-b border-amber-500/20 pb-1'
              : 'text-xs sm:text-sm mt-2.5 mb-1 text-amber-600 dark:text-amber-400'
          }`}
        >
          {renderInlineContent(text, i)}
        </div>
      );
      continue;
    }

    // Bullet items: * text, - text, • text
    const bulletMatch = trimmed.match(/^[*•-]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'bullet') {
        flushList();
        currentList = { type: 'bullet', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Numbered items: 1. text, 2) text
    const numberMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numberMatch) {
      if (!currentList || currentList.type !== 'number') {
        flushList();
        currentList = { type: 'number', items: [] };
      }
      currentList.items.push({ num: numberMatch[1], text: numberMatch[2] });
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed text-xs sm:text-sm my-1 text-slate-800 dark:text-slate-200">
        {renderInlineContent(trimmed, i)}
      </p>
    );
  }

  flushList();

  return <div className={`space-y-1 ${className}`.trim()}>{elements}</div>;
}

import React from 'react';
import MathRenderer from './MathRenderer';

// Matches List-I / List-II or Column-I / Column-II or स्तंभ-I / स्तंभ-II or सूची-I / सूची-II
const MATCHING_HEADER_REGEX = /(?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:I|1)\b[\s\S]*?(?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:II|2)\b/i;

// Statement line prefix like (1), (2), (i), (ii), 1., 2.
const STATEMENT_LINE_REGEX = /^(\s*(?:\([0-9ivxlcdmIVXLCDM]+\)|[0-9]{1,2}\.|\([A-Za-z]\))\s+)(.+)$/;

/**
 * Parses a matching column question into structured columns if pattern detected
 */
function parseMatchingTable(text) {
  if (!text || typeof text !== 'string') return null;
  if (!MATCHING_HEADER_REGEX.test(text)) return null;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/(?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:I|1)/i.test(lines[i])) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return null;

  const preamble = lines.slice(0, headerIndex).join('\n');
  const tableLines = lines.slice(headerIndex);

  let col1Title = 'List-I';
  let col2Title = 'List-II';

  // Detect header names
  const headerLine = tableLines[0];
  const col1Match = headerLine.match(/((?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:I|1))/i);
  const col2Match = headerLine.match(/((?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:II|2))/i);
  if (col1Match) col1Title = col1Match[1];
  if (col2Match) col2Title = col2Match[1];

  const col1Items = [];
  const col2Items = [];
  const postambleLines = [];

  let inPostamble = false;

  for (let i = 1; i < tableLines.length; i++) {
    const line = tableLines[i];

    // Detect code/postamble section like "कूट:", "Codes:", "उपर्युक्त में से..."
    if (/^(?:कूट|Codes?|कोड|Option|विकल्प|उत्तर|उपर्युक्त|Which of)/i.test(line)) {
      inPostamble = true;
    }

    if (inPostamble) {
      postambleLines.push(line);
      continue;
    }

    // Try splitting line into two items if on the same line: e.g. "(A) Item A   (1) Item 1"
    const splitMatch = line.match(/^(\([A-Za-z0-9]+\)[^\(\)]+?)\s+(\([A-Za-z0-9]+\).+)$/);
    if (splitMatch) {
      col1Items.push(splitMatch[1].trim());
      col2Items.push(splitMatch[2].trim());
      continue;
    }

    // Check if item belongs to Column 1 (letters A-D) or Column 2 (numbers 1-4)
    if (/^\([A-D]\)/i.test(line)) {
      col1Items.push(line);
    } else if (/^\([1-9ivx]+\)/i.test(line) || /^[1-9]\./.test(line)) {
      col2Items.push(line);
    } else if (line.includes('\t') || line.includes('   ')) {
      const parts = line.split(/\t+|\s{3,}/);
      if (parts.length >= 2) {
        col1Items.push(parts[0].trim());
        col2Items.push(parts[1].trim());
        continue;
      }
      col1Items.push(line);
    } else {
      postambleLines.push(line);
    }
  }

  return {
    preamble,
    col1Title,
    col2Title,
    col1Items,
    col2Items,
    postamble: postambleLines.join('\n')
  };
}

/**
 * QuestionFormatter:
 * - Formats statements with badges and indented blocks
 * - Detects and renders List-I / List-II matching tables
 * - Preserves line breaks and renders LaTeX formulas via MathRenderer
 */
export default function QuestionFormatter({ text, className = '' }) {
  if (!text) return null;
  const rawText = typeof text === 'string' ? text : String(text || '');

  // 1. Column-Matching check
  const matchingData = parseMatchingTable(rawText);
  if (matchingData && (matchingData.col1Items.length > 0 || matchingData.col2Items.length > 0)) {
    const maxRows = Math.max(matchingData.col1Items.length, matchingData.col2Items.length);
    const rows = Array.from({ length: maxRows }, (_, i) => ({
      left: matchingData.col1Items[i] || '',
      right: matchingData.col2Items[i] || ''
    }));

    return (
      <div className={`question-formatted-container ${className}`.trim()}>
        {matchingData.preamble && (
          <div className="question-preamble whitespace-pre-line mb-3">
            <MathRenderer>{matchingData.preamble}</MathRenderer>
          </div>
        )}

        <div className="matching-table-card my-3 p-3 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 overflow-hidden shadow-sm">
          <div className="grid grid-cols-2 gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-800 font-bold text-xs sm:text-sm text-neutral-800 dark:text-neutral-200">
            <div className="px-2 py-1 bg-neutral-200/60 dark:bg-neutral-800 rounded-md inline-block w-fit">
              <MathRenderer>{matchingData.col1Title}</MathRenderer>
            </div>
            <div className="px-2 py-1 bg-neutral-200/60 dark:bg-neutral-800 rounded-md inline-block w-fit">
              <MathRenderer>{matchingData.col2Title}</MathRenderer>
            </div>
          </div>
          <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-3 py-2 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                <div className="font-medium pr-1">
                  <MathRenderer>{row.left}</MathRenderer>
                </div>
                <div className="font-medium pl-1">
                  <MathRenderer>{row.right}</MathRenderer>
                </div>
              </div>
            ))}
          </div>
        </div>

        {matchingData.postamble && (
          <div className="question-postamble whitespace-pre-line mt-3">
            <MathRenderer>{matchingData.postamble}</MathRenderer>
          </div>
        )}
      </div>
    );
  }

  // 2. Statement-based or standard multi-line question formatting
  const lines = rawText.split('\n');

  return (
    <div className={`question-formatted-container whitespace-pre-line leading-relaxed ${className}`.trim()}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        const match = trimmed.match(STATEMENT_LINE_REGEX);
        if (match) {
          const badge = match[1].trim();
          const statementContent = match[2].trim();
          return (
            <div key={idx} className="statement-line-item flex items-start gap-2.5 my-1.5 pl-1.5 sm:pl-3">
              <span className="statement-badge inline-flex items-center justify-center font-bold text-xs sm:text-sm px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 flex-shrink-0 mt-0.5 shadow-xs">
                {badge}
              </span>
              <span className="statement-content text-neutral-800 dark:text-neutral-200 text-sm sm:text-base leading-relaxed">
                <MathRenderer>{statementContent}</MathRenderer>
              </span>
            </div>
          );
        }

        return (
          <div key={idx} className="question-line my-0.5">
            <MathRenderer>{line}</MathRenderer>
          </div>
        );
      })}
    </div>
  );
}

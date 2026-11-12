import React from 'react';
import MathRenderer from './MathRenderer';

// Matches List-I / List-II or Column-I / Column-II or स्तंभ-I / स्तंभ-II or सूची-I / सूची-II
const MATCHING_HEADER_REGEX = /(?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:I|1)\b[\s\S]*?(?:स्तंभ|सूची|List|Column)\s*[-–—]?\s*(?:II|2)\b/i;

// Regex for trailing prompt / postamble (English & Hindi)
const PROMPT_REGEX = /(?:[\.\।]\s+|\n+)(Select the correct|Which of the|Choose the|Correct code|Codes?:?|उपर्युक्त|सही कूट|सही कथन|कूट:?|नीचे दिए गए)[\s\S]*$/i;

/**
 * Parses multi-line matching column question with explicit headers (e.g. List-I ... List-II)
 */
function parseHeaderMatchingTable(text) {
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
    if (/^(?:कूट|Codes?|कोड|Option|विकल्प|उत्तर|उपर्युक्त|Which of|Select the)/i.test(line)) {
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
 * Parses inline matching question without newlines:
 * e.g. "Match the following: (1) ... (2) ... (3) ... (4) ... (A) ... (B) ... (C) ... (D) ..."
 */
function parseInlineMatching(text) {
  if (!text || typeof text !== 'string') return null;

  const tokenRegex = /(?:\(([1-9ivx]+|[A-Ea-e])\)|(?<=\s|^)([1-9ivx]+|[A-Ea-e])\.)(?=\s)/gi;
  let match;
  const tokens = [];
  while ((match = tokenRegex.exec(text)) !== null) {
    const rawVal = match[1] || match[2];
    const isNum = /^[0-9ivx]+$/i.test(rawVal);
    const isLetter = /^[A-Ea-e]$/i.test(rawVal);
    tokens.push({
      token: match[0].trim(),
      val: rawVal,
      isNum,
      isLetter,
      index: match.index,
      length: match[0].length
    });
  }

  const numTokens = tokens.filter((t) => t.isNum);
  const letterTokens = tokens.filter((t) => t.isLetter);

  // Must contain at least 2 numbers and 2 letters
  if (numTokens.length < 2 || letterTokens.length < 2) return null;

  // Determine split point between the two distinct groups
  const firstIsNum = tokens[0].isNum;
  let splitIndex = -1;

  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].isNum !== firstIsNum) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === -1) return null;

  const group1Tokens = tokens.slice(0, splitIndex);
  const group2Tokens = tokens.slice(splitIndex);

  if (group1Tokens.length < 2 || group2Tokens.length < 2) return null;

  const preamble = text.slice(0, tokens[0].index).trim();

  // Extract items for group 1
  const col1Items = [];
  for (let i = 0; i < group1Tokens.length; i++) {
    const start = group1Tokens[i].index;
    const end = (i < group1Tokens.length - 1) ? group1Tokens[i + 1].index : group2Tokens[0].index;
    let itemStr = text.slice(start, end).trim();
    if (i === group1Tokens.length - 1) {
      itemStr = itemStr.replace(/[\.\।\s]+$/, '');
    }
    col1Items.push(itemStr);
  }

  // Extract items for group 2 and postamble
  const col2Items = [];
  let postamble = '';
  for (let i = 0; i < group2Tokens.length; i++) {
    const start = group2Tokens[i].index;
    if (i < group2Tokens.length - 1) {
      const end = group2Tokens[i + 1].index;
      col2Items.push(text.slice(start, end).trim());
    } else {
      const rest = text.slice(start).trim();
      const pMatch = rest.match(PROMPT_REGEX);
      if (pMatch) {
        col2Items.push(rest.slice(0, pMatch.index).trim());
        postamble = pMatch[0].replace(/^[\.\।\s]+/, '').trim();
      } else {
        col2Items.push(rest);
      }
    }
  }

  const isHindi = /[\u0900-\u097F]/.test(text);
  const leftItems = firstIsNum ? col1Items : col2Items;
  const rightItems = firstIsNum ? col2Items : col1Items;

  return {
    preamble,
    col1Title: isHindi ? 'सूची-I' : 'List-I',
    col2Title: isHindi ? 'सूची-II' : 'List-II',
    col1Items: leftItems,
    col2Items: rightItems,
    postamble
  };
}

/**
 * Parses inline or multi-line statement questions:
 * e.g. "Consider the following statements: (1) ... (2) ... (3) ... Which of the above are correct?"
 */
function parseStatementQuestion(text) {
  if (!text || typeof text !== 'string') return null;

  const tokenRegex = /(?:\(([1-9ivxlcdm]+)\)|(?<=\s|^)([1-9ivxlcdm]+)\.)(?=\s+[^\s\d\)])/gi;
  let match;
  const tokens = [];
  while ((match = tokenRegex.exec(text)) !== null) {
    tokens.push({
      badge: match[0].trim(),
      val: match[1] || match[2],
      index: match.index,
      length: match[0].length
    });
  }

  if (tokens.length < 2) return null;

  const preamble = text.slice(0, tokens[0].index).trim();
  const statements = [];
  let postamble = '';

  for (let i = 0; i < tokens.length; i++) {
    const start = tokens[i].index + tokens[i].length;
    if (i < tokens.length - 1) {
      const end = tokens[i + 1].index;
      statements.push({
        badge: tokens[i].badge,
        text: text.slice(start, end).trim()
      });
    } else {
      const rest = text.slice(start).trim();
      const pMatch = rest.match(PROMPT_REGEX);
      if (pMatch) {
        statements.push({
          badge: tokens[i].badge,
          text: rest.slice(0, pMatch.index).trim()
        });
        postamble = pMatch[0].replace(/^[\.\।\s]+/, '').trim();
      } else {
        statements.push({
          badge: tokens[i].badge,
          text: rest
        });
      }
    }
  }

  return {
    preamble,
    statements,
    postamble
  };
}

/**
 * QuestionFormatter:
 * - Smart Parser & Table Renderer for Inline Matching Questions (2-column bordered table)
 * - Clean Vertical Indented List for Statement Questions with bold badges and gap: 8px
 * - Preserves line breaks and renders LaTeX formulas via MathRenderer
 */
export default function QuestionFormatter({ text, className = '' }) {
  if (!text) return null;
  const rawText = typeof text === 'string' ? text : String(text || '');

  // 1. Column-Matching check (Multi-line or Inline single-paragraph)
  const matchingData = parseHeaderMatchingTable(rawText) || parseInlineMatching(rawText);
  if (matchingData && (matchingData.col1Items.length > 0 || matchingData.col2Items.length > 0)) {
    const maxRows = Math.max(matchingData.col1Items.length, matchingData.col2Items.length);
    const rows = Array.from({ length: maxRows }, (_, i) => ({
      left: matchingData.col1Items[i] || '',
      right: matchingData.col2Items[i] || ''
    }));

    return (
      <div className={`question-formatted-container ${className}`.trim()}>
        {matchingData.preamble && (
          <div className="question-preamble font-semibold text-neutral-800 dark:text-neutral-200 mb-3 whitespace-pre-line leading-relaxed">
            <MathRenderer>{matchingData.preamble}</MathRenderer>
          </div>
        )}

        <div className="matching-table-card my-3.5 border border-neutral-300 dark:border-neutral-700/80 rounded-xl bg-neutral-50/70 dark:bg-neutral-900/60 overflow-hidden shadow-xs">
          <div className="grid grid-cols-2 bg-neutral-200/60 dark:bg-neutral-800/80 border-b border-neutral-300 dark:border-neutral-700/80 font-bold text-xs sm:text-sm text-neutral-800 dark:text-neutral-200">
            <div className="px-3 sm:px-4 py-2 border-r border-neutral-300 dark:border-neutral-700/80">
              <MathRenderer>{matchingData.col1Title}</MathRenderer>
            </div>
            <div className="px-3 sm:px-4 py-2">
              <MathRenderer>{matchingData.col2Title}</MathRenderer>
            </div>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 transition-colors">
                <div className="px-3 sm:px-4 py-2.5 font-medium border-r border-neutral-200 dark:border-neutral-800 leading-relaxed">
                  <MathRenderer>{row.left}</MathRenderer>
                </div>
                <div className="px-3 sm:px-4 py-2.5 font-medium leading-relaxed">
                  <MathRenderer>{row.right}</MathRenderer>
                </div>
              </div>
            ))}
          </div>
        </div>

        {matchingData.postamble && (
          <div className="question-postamble font-medium text-neutral-800 dark:text-neutral-200 mt-3 whitespace-pre-line leading-relaxed">
            <MathRenderer>{matchingData.postamble}</MathRenderer>
          </div>
        )}
      </div>
    );
  }

  // 2. Statement-based question parsing (Inline or Multi-line)
  const statementData = parseStatementQuestion(rawText);
  if (statementData && statementData.statements.length > 0) {
    return (
      <div className={`question-formatted-container ${className}`.trim()}>
        {statementData.preamble && (
          <div className="question-preamble font-semibold text-neutral-800 dark:text-neutral-200 mb-2.5 whitespace-pre-line leading-relaxed">
            <MathRenderer>{statementData.preamble}</MathRenderer>
          </div>
        )}

        <div className="statement-list flex flex-col gap-2 my-2.5 pl-1 sm:pl-2">
          {statementData.statements.map((stmt, idx) => (
            <div key={idx} className="statement-line-item flex items-start gap-2.5">
              <span className="statement-badge inline-flex items-center justify-center font-bold text-xs sm:text-sm px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 flex-shrink-0 mt-0.5 shadow-xs">
                {stmt.badge}
              </span>
              <span className="statement-content text-neutral-800 dark:text-neutral-200 text-sm sm:text-base leading-relaxed">
                <MathRenderer>{stmt.text}</MathRenderer>
              </span>
            </div>
          ))}
        </div>

        {statementData.postamble && (
          <div className="question-postamble font-medium text-neutral-800 dark:text-neutral-200 mt-2.5 whitespace-pre-line leading-relaxed">
            <MathRenderer>{statementData.postamble}</MathRenderer>
          </div>
        )}
      </div>
    );
  }

  // 3. Standard multi-line fallback question formatting
  const lines = rawText.split('\n');

  return (
    <div className={`question-formatted-container whitespace-pre-line leading-relaxed ${className}`.trim()}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        const match = trimmed.match(/^(\s*(?:\([0-9ivxlcdmIVXLCDM]+\)|[0-9]{1,2}\.|\([A-Za-z]\))\s+)(.+)$/);
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


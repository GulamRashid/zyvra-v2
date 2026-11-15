import React from 'react';
import MathRenderer from './MathRenderer';
import { parseMatchingQuestion, parseStatementQuestion } from '../../lib/question-parser';

export { parseMatchingQuestion, parseStatementQuestion };

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
  const matchingData = parseMatchingQuestion(rawText);
  if (matchingData && (matchingData.col1Items.length > 0 || matchingData.col2Items.length > 0)) {
    const maxRows = Math.max(matchingData.col1Items.length, matchingData.col2Items.length);
    const rows = Array.from({ length: maxRows }, (_, i) => ({
      left: matchingData.col1Items[i] || '',
      right: matchingData.col2Items[i] || ''
    }));

    return (
      <div className={`question-formatted-container text-slate-900 dark:text-slate-100 ${className}`.trim()}>
        {matchingData.preamble && (
          <div className="question-preamble font-bold text-slate-900 dark:text-slate-100 mb-3 whitespace-pre-line leading-relaxed">
            <MathRenderer>{matchingData.preamble}</MathRenderer>
          </div>
        )}

        <div className="matching-table-card my-3.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 overflow-hidden shadow-xs">
          <div className="grid grid-cols-2 bg-slate-200/70 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            <div className="px-3 sm:px-4 py-2 border-r border-slate-300 dark:border-slate-700">
              <MathRenderer>{matchingData.col1Title}</MathRenderer>
            </div>
            <div className="px-3 sm:px-4 py-2">
              <MathRenderer>{matchingData.col2Title}</MathRenderer>
            </div>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors">
                <div className="px-3 sm:px-4 py-2.5 font-medium border-r border-slate-200 dark:border-slate-800 leading-relaxed text-slate-900 dark:text-slate-100">
                  <MathRenderer>{row.left}</MathRenderer>
                </div>
                <div className="px-3 sm:px-4 py-2.5 font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                  <MathRenderer>{row.right}</MathRenderer>
                </div>
              </div>
            ))}
          </div>
        </div>

        {matchingData.postamble && (
          <div className="question-postamble font-semibold text-slate-900 dark:text-slate-100 mt-3 whitespace-pre-line leading-relaxed">
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
      <div className={`question-formatted-container text-slate-900 dark:text-slate-100 ${className}`.trim()}>
        {statementData.preamble && (
          <div className="question-preamble font-bold text-slate-900 dark:text-slate-100 mb-2.5 whitespace-pre-line leading-relaxed">
            <MathRenderer>{statementData.preamble}</MathRenderer>
          </div>
        )}

        <div className="statement-list flex flex-col gap-2 my-2.5 pl-1 sm:pl-2">
          {statementData.statements.map((stmt, idx) => (
            <div key={idx} className="statement-line-item flex items-start gap-2.5">
              <span className="statement-badge inline-flex items-center justify-center font-bold text-xs sm:text-sm px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-400/30 flex-shrink-0 mt-0.5 shadow-xs">
                {stmt.badge}
              </span>
              <span className="statement-content text-slate-900 dark:text-slate-100 text-sm sm:text-base font-medium leading-relaxed">
                <MathRenderer>{stmt.text}</MathRenderer>
              </span>
            </div>
          ))}
        </div>

        {statementData.postamble && (
          <div className="question-postamble font-semibold text-slate-900 dark:text-slate-100 mt-2.5 whitespace-pre-line leading-relaxed">
            <MathRenderer>{statementData.postamble}</MathRenderer>
          </div>
        )}
      </div>
    );
  }

  // 3. Standard multi-line fallback question formatting
  const lines = rawText.split('\n');

  return (
    <div className={`question-formatted-container text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed ${className}`.trim()}>
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
              <span className="statement-badge inline-flex items-center justify-center font-bold text-xs sm:text-sm px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-400/30 flex-shrink-0 mt-0.5 shadow-xs">
                {badge}
              </span>
              <span className="statement-content text-slate-900 dark:text-slate-100 text-sm sm:text-base font-medium leading-relaxed">
                <MathRenderer>{statementContent}</MathRenderer>
              </span>
            </div>
          );
        }

        return (
          <div key={idx} className="my-1 leading-relaxed text-slate-900 dark:text-slate-100">
            <MathRenderer>{line}</MathRenderer>
          </div>
        );
      })}
    </div>
  );
}


import React from 'react';

/**
 * Modern, responsive skeleton loader for Zyvra.
 * Supports multiple contextual variants:
 * - 'page' (default for full page loading / route suspense)
 * - 'dashboard' (stat metrics + panel cards)
 * - 'grid' / 'cards' (responsive cards grid)
 * - 'table' (data table rows)
 * - 'list' (refined list rows)
 */
export default function LoadingSkeleton({
  rows = 3,
  count,
  variant = 'list',
  className = '',
  message = 'सामग्री लोड हो रही है…'
}) {
  const rowCount = Math.max(1, Math.min(10, Number(count ?? rows) || 3));

  // 1. FULL PAGE SUSPENSE SKELETON
  if (variant === 'page') {
    return (
      <div className={`skeleton-page-container w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 ${className}`.trim()} role="status" aria-label={message}>
        <span className="sr-only">{message}</span>

        {/* Page Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="space-y-2">
            <div className="skeleton-bar skeleton-shimmer w-28 h-3 rounded-full" />
            <div className="skeleton-bar skeleton-shimmer w-52 sm:w-64 h-6 sm:h-7 rounded-xl" />
            <div className="skeleton-bar skeleton-shimmer w-40 sm:w-80 h-3.5 rounded-full" />
          </div>
          <div className="skeleton-bar skeleton-shimmer w-28 h-9 rounded-xl shrink-0" />
        </div>

        {/* Hero Banner Skeleton */}
        <div className="skeleton-card skeleton-shimmer w-full h-36 sm:h-44 rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
          <div className="space-y-2.5 max-w-md">
            <div className="skeleton-bar w-20 h-4 rounded-full bg-slate-700/60 dark:bg-slate-700/50" />
            <div className="skeleton-bar w-3/4 h-5 sm:h-6 rounded-xl bg-slate-700/60 dark:bg-slate-700/50" />
            <div className="skeleton-bar w-1/2 h-3.5 rounded-full bg-slate-700/50 dark:bg-slate-700/40" />
          </div>
          <div className="skeleton-bar w-32 h-8 rounded-xl bg-slate-700/60 dark:bg-slate-700/50" />
        </div>

        {/* 3 Metric / Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card skeleton-shimmer p-4 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700/60 dark:bg-slate-700/50 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="skeleton-bar w-16 h-3 rounded-full bg-slate-700/50 dark:bg-slate-700/40" />
                <div className="skeleton-bar w-24 h-4 rounded-lg bg-slate-700/60 dark:bg-slate-700/50" />
              </div>
            </div>
          ))}
        </div>

        {/* Content Section Skeleton */}
        <div className="space-y-3 pt-2">
          <div className="skeleton-bar skeleton-shimmer w-36 h-4 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-card skeleton-shimmer p-4 sm:p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-slate-700/60 dark:bg-slate-700/50" />
                  <div className="w-14 h-4 rounded-full bg-slate-700/50 dark:bg-slate-700/40" />
                </div>
                <div className="space-y-1.5">
                  <div className="skeleton-bar w-3/4 h-4 rounded-lg bg-slate-700/60 dark:bg-slate-700/50" />
                  <div className="skeleton-bar w-1/2 h-3 rounded-full bg-slate-700/50 dark:bg-slate-700/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. DASHBOARD SKELETON (Metrics Grid + Panels)
  if (variant === 'dashboard') {
    return (
      <div className={`skeleton-dashboard-container w-full min-w-0 space-y-4 sm:space-y-6 ${className}`.trim()} role="status" aria-label={message}>
        <span className="sr-only">{message}</span>

        {/* Top 4 Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card skeleton-shimmer p-3.5 sm:p-4 rounded-2xl space-y-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-700/60 dark:bg-slate-700/50" />
              <div className="space-y-1.5">
                <div className="skeleton-bar w-16 h-2.5 rounded-full bg-slate-700/50 dark:bg-slate-700/40" />
                <div className="skeleton-bar w-20 h-5 sm:h-6 rounded-lg bg-slate-700/70 dark:bg-slate-700/60" />
                <div className="skeleton-bar w-24 h-2.5 rounded-full bg-slate-700/40 dark:bg-slate-700/30" />
              </div>
            </div>
          ))}
        </div>

        {/* 2 Equal Panel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton-card skeleton-shimmer p-5 sm:p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
                <div className="space-y-1">
                  <div className="skeleton-bar w-20 h-2.5 rounded-full bg-slate-700/50" />
                  <div className="skeleton-bar w-36 h-4 rounded-lg bg-slate-700/60" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-slate-700/50" />
              </div>
              <div className="space-y-3">
                <div className="skeleton-bar w-full h-12 rounded-xl bg-slate-700/40" />
                <div className="skeleton-bar w-full h-12 rounded-xl bg-slate-700/40" />
                <div className="skeleton-bar w-full h-12 rounded-xl bg-slate-700/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. RESPONSIVE CARDS GRID SKELETON
  if (variant === 'grid' || variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0 ${className}`.trim()} role="status" aria-label={message}>
        <span className="sr-only">{message}</span>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="skeleton-card skeleton-shimmer p-4 sm:p-5 rounded-2xl space-y-3.5 flex flex-col justify-between min-h-[140px]">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-xl bg-slate-700/60 dark:bg-slate-700/50" />
                <div className="w-16 h-4 rounded-full bg-slate-700/50 dark:bg-slate-700/40" />
              </div>
              <div className="skeleton-bar w-4/5 h-4.5 rounded-lg bg-slate-700/60 dark:bg-slate-700/50" />
              <div className="skeleton-bar w-3/5 h-3 rounded-full bg-slate-700/40 dark:bg-slate-700/30" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
              <div className="skeleton-bar w-20 h-3 rounded-full bg-slate-700/40" />
              <div className="skeleton-bar w-16 h-6 rounded-lg bg-slate-700/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 4. TABLE SKELETON
  if (variant === 'table') {
    return (
      <div className={`skeleton-table-container w-full min-w-0 space-y-3 ${className}`.trim()} role="status" aria-label={message}>
        <span className="sr-only">{message}</span>
        {/* Table Toolbar */}
        <div className="skeleton-card skeleton-shimmer p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3">
          <div className="skeleton-bar w-44 sm:w-64 h-8 rounded-xl bg-slate-700/50" />
          <div className="skeleton-bar w-24 h-8 rounded-xl bg-slate-700/50 shrink-0" />
        </div>
        {/* Table Rows */}
        <div className="skeleton-card skeleton-shimmer rounded-2xl divide-y divide-slate-800/60 overflow-hidden">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-700/60 dark:bg-slate-700/50 shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="skeleton-bar w-3/5 h-3.5 rounded-lg bg-slate-700/60 dark:bg-slate-700/50" />
                  <div className="skeleton-bar w-2/5 h-2.5 rounded-full bg-slate-700/40 dark:bg-slate-700/30" />
                </div>
              </div>
              <div className="skeleton-bar w-16 sm:w-20 h-6 rounded-md bg-slate-700/50 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. REFINED LIST ROWS (DEFAULT - 100% RESPONSIVE)
  return (
    <div className={`skeleton-list w-full min-w-0 space-y-3 ${className}`.trim()} role="status" aria-label={message}>
      <span className="sr-only">{message}</span>
      {Array.from({ length: rowCount }, (_, index) => (
        <div className="skeleton-row skeleton-card skeleton-shimmer p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 sm:gap-4" key={index} aria-hidden="true">
          <div className="flex items-center gap-3 sm:gap-3.5 flex-1 min-w-0">
            <span className="skeleton-avatar w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-700/60 dark:bg-slate-700/50 shrink-0" />
            <div className="skeleton-lines space-y-1.5 flex-1 min-w-0">
              <span className="skeleton-line skeleton-line-title block h-3.5 sm:h-4 w-3/4 sm:w-1/2 rounded-lg bg-slate-700/60 dark:bg-slate-700/50" />
              <span className="skeleton-line block h-2.5 w-full sm:w-4/5 rounded-full bg-slate-700/40 dark:bg-slate-700/30" />
              <span className="skeleton-line skeleton-line-short block h-2.5 w-1/2 sm:w-1/3 rounded-full bg-slate-700/40 dark:bg-slate-700/30" />
            </div>
          </div>
          <span className="skeleton-action w-14 sm:w-16 h-7 sm:h-8 rounded-xl bg-slate-700/50 dark:bg-slate-700/40 shrink-0 hidden xs:block sm:block" />
        </div>
      ))}
    </div>
  );
}

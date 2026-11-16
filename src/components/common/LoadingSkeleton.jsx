export default function LoadingSkeleton({ rows = 3, count, className = '', message = 'Loading content' }) {
  const rowCount = Math.max(1, Math.min(8, Number(count ?? rows) || 3));

  return (
    <div className={`skeleton-list ${className}`.trim()} role="status" aria-label={message}>
      <span className="sr-only">{message}</span>
      {Array.from({ length: rowCount }, (_, index) => (
        <div className="skeleton-row" key={index} aria-hidden="true">
          <span className="skeleton-avatar" />
          <span className="skeleton-lines">
            <span className="skeleton-line skeleton-line-title" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line-short" />
          </span>
          <span className="skeleton-action" />
        </div>
      ))}
    </div>
  );
}

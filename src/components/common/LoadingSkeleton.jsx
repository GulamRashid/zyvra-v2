export default function LoadingSkeleton({ rows = 4 }) {
  return <div className="skeleton-list" aria-label="Loading">
    {Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index} />)}
  </div>;
}

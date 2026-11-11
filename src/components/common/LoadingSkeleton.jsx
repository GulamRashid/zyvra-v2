export default function LoadingSkeleton({ message = 'Loading your learning space...', className = '' }) {
  return (
    <div className={`zyvra-loader-container ${className}`} role="status" aria-label={message}>
      <div className="zyvra-loader-brand">
        <img
          src="/logo.png"
          alt="Zyvra"
          className="w-14 h-14 object-contain animate-pulse shadow-sm"
        />
        <div className="zyvra-loader-ring" />
      </div>
      <p className="zyvra-loader-text">{message}</p>
    </div>
  );
}

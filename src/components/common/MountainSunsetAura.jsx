export default function MountainSunsetAura({ className = '', height = 180, mobileHeight, showSun = true }) {
  return (
    <div
      className={`mountain-sunset-aura relative w-full overflow-hidden pointer-events-none select-none ${className}`}
      data-mobile-height={mobileHeight ? 'true' : undefined}
      style={{ height: `${height}px`, ...(mobileHeight ? { '--mobile-aura-height': `${mobileHeight}px` } : {}) }}
      aria-hidden="true"
    >
      {/* Background Deep Slate/Indigo Focus Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b dark:from-[#0F172A] dark:via-[#0B1120] dark:to-transparent from-slate-100/90 via-indigo-50/40 to-transparent transition-colors duration-300" />

      {/* Ambient Indigo/Cyan Focus Radial Glows */}
      <div className="absolute top-0 right-1/4 w-72 h-44 sm:w-96 sm:h-56 rounded-full bg-indigo-600/15 dark:bg-indigo-600/20 blur-3xl transform translate-x-12 -translate-y-8 pointer-events-none" />
      <div className="absolute top-4 left-1/5 w-60 h-36 rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Subtle Competitive Tech/Data Grid & Geometric Lines */}
      <svg
        viewBox="0 0 1000 240"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full opacity-60 dark:opacity-40 transition-opacity duration-300"
      >
        <defs>
          {/* High-Precision Tech Grid Pattern */}
          <pattern id="techGridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-slate-400/40 dark:text-indigo-400/25"
            />
            <circle cx="0" cy="0" r="1.5" className="fill-slate-400/60 dark:fill-indigo-400/40" />
          </pattern>

          {/* Indigo Geometric Line Gradients */}
          <linearGradient id="laserLine1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" stopOpacity="0" />
            <stop offset="50%" stopColor="#4F46E5" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="laserLine2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
            <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Tech Grid Background Fill */}
        <rect width="100%" height="100%" fill="url(#techGridPattern)" />

        {/* Abstract Dynamic Geometry / Telemetry Vector Lines */}
        <path
          d="M 0,90 Q 250,40 500,85 T 1000,45"
          fill="none"
          stroke="url(#laserLine1)"
          strokeWidth="1.75"
          className="opacity-75"
        />
        <path
          d="M 0,140 Q 320,110 640,165 T 1000,120"
          fill="none"
          stroke="url(#laserLine2)"
          strokeWidth="1.5"
          className="opacity-60"
        />

        {/* Telemetry Nodes & Focus Crosshairs */}
        <g className="text-indigo-500 dark:text-indigo-400">
          <circle cx="250" cy="65" r="3" className="fill-indigo-500 animate-pulse" />
          <circle cx="250" cy="65" r="7" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2,2" />

          <circle cx="500" cy="85" r="2.5" className="fill-emerald-400" />
          <circle cx="780" cy="65" r="3.5" className="fill-amber-400" />
          <circle cx="780" cy="65" r="9" fill="none" stroke="#F59E0B" strokeWidth="0.75" opacity="0.6" />

          {/* Subtle Data Vectors */}
          <line x1="250" y1="65" x2="310" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
          <line x1="780" y1="65" x2="850" y2="95" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
        </g>
      </svg>

      {/* Subtle Mist / Gradient Fade at bottom to seamlessly blend with page background */}
      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t dark:from-[#0B1120] dark:via-[#0B1120]/70 from-[#F8FAFC] via-[#F8FAFC]/70 to-transparent transition-colors duration-300" />
    </div>
  );
}

export { MountainSunsetAura as TechDataAura };


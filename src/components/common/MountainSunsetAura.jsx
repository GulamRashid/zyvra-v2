import React from 'react';

export default function MountainSunsetAura({ className = '', height = 180, showSun = true }) {
  return (
    <div
      className={`relative w-full overflow-hidden pointer-events-none select-none ${className}`}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {/* Background Sky Radial Glow */}
      <div className="absolute inset-0 bg-gradient-to-b dark:from-[#0a2e22] dark:via-[#062017] dark:to-transparent from-[#d1fae5]/80 via-[#a7f3d0]/30 to-transparent opacity-90 transition-colors duration-300" />
      
      {/* Ambient Sun Orb Glow */}
      {showSun && (
        <div className="absolute top-4 right-1/4 w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-b from-amber-200/50 via-amber-400/30 to-yellow-600/15 blur-2xl transform translate-x-8" />
      )}

      {/* Sun Circle */}
      {showSun && (
        <div
          className="absolute top-8 right-1/4 w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-b from-[#fff7ed] via-[#fef08a] to-[#f59e0b] shadow-[0_0_35px_rgba(245,158,11,0.5)] transform translate-x-6"
        />
      )}

      {/* Mountain & Pine Tree Silhouette SVG */}
      <svg
        viewBox="0 0 1000 240"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full h-[150px] opacity-95 transition-all duration-300"
      >
        <defs>
          <linearGradient id="backMtnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" className="text-emerald-700 dark:text-[#0b3827]" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.95" className="text-emerald-800 dark:text-[#061e15]" />
          </linearGradient>
          <linearGradient id="midMtnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" className="text-emerald-800 dark:text-[#072b1e]" />
            <stop offset="100%" stopColor="currentColor" className="text-emerald-900 dark:text-[#04160f]" />
          </linearGradient>
          <linearGradient id="foreMtnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" className="text-emerald-900 dark:text-[#052117]" />
            <stop offset="100%" stopColor="currentColor" className="text-emerald-950 dark:text-[#04140e]" />
          </linearGradient>
        </defs>

        {/* Distant Mountain Ridge */}
        <path
          d="M0,160 L120,110 L260,140 L420,80 L580,120 L720,70 L860,115 L1000,90 L1000,240 L0,240 Z"
          fill="url(#backMtnGrad)"
        />

        {/* Mid-distance Ridge */}
        <path
          d="M0,185 L180,145 L340,165 L510,125 L680,155 L840,120 L1000,160 L1000,240 L0,240 Z"
          fill="url(#midMtnGrad)"
        />

        {/* Pine Trees Silhouettes along the ridges */}
        <g className="text-emerald-950 dark:text-[#041a12] fill-current" opacity="0.9">
          {/* Cluster Left */}
          <polygon points="40,175 48,155 56,175" />
          <polygon points="52,178 60,150 68,178" />
          <polygon points="65,182 72,160 79,182" />
          <polygon points="90,170 97,148 104,170" />

          {/* Cluster Center-Left */}
          <polygon points="310,165 318,140 326,165" />
          <polygon points="322,168 330,135 338,168" />
          <polygon points="335,170 342,145 349,170" />

          {/* Cluster Right of Sun */}
          <polygon points="690,155 698,130 706,155" />
          <polygon points="702,158 710,125 718,158" />
          <polygon points="715,162 723,135 731,162" />
          <polygon points="728,165 735,142 742,165" />

          {/* Cluster Far Right */}
          <polygon points="880,150 888,128 896,150" />
          <polygon points="892,154 900,122 908,154" />
          <polygon points="905,158 912,135 919,158" />
          <polygon points="930,165 938,138 946,165" />
        </g>

        {/* Foreground Mountain Slope */}
        <path
          d="M0,210 Q250,175 500,195 T1000,190 L1000,240 L0,240 Z"
          fill="url(#foreMtnGrad)"
        />
      </svg>
      
      {/* Subtle Mist / Gradient Fade at bottom */}
      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t dark:from-[#04140e] dark:via-[#04140e]/60 from-[#f4faf7] via-[#f4faf7]/60 to-transparent transition-colors duration-300" />
    </div>
  );
}


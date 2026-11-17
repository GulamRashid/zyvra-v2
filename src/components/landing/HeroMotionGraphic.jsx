import { useState } from 'react';
import {
  Award,
  Brain,
  Cpu,
  Flame,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';

export default function HeroMotionGraphic({ isDark, isHindi }) {
  const [activeCard, setActiveCard] = useState(null);

  return (
    <div className="relative w-full max-w-[540px] aspect-square mx-auto flex items-center justify-center select-none">
      {/* Dynamic Ambient Glow Backdrops */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10"
        aria-hidden="true"
      >
        <div className="w-72 h-72 rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-emerald-500/25 blur-3xl animate-hero-pulse" />
        <div className="absolute w-56 h-56 rounded-full bg-gradient-to-br from-amber-500/20 via-pink-500/15 to-indigo-500/20 blur-2xl animate-hero-pulse [animation-delay:2s]" />
      </div>

      {/* SVG Orbital Canvas with Concentric Rotating Rings & Neural Data Lines */}
      <svg
        viewBox="0 0 500 500"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="orbitGradIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#10B981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.6" />
          </linearGradient>

          <linearGradient id="neuralBeamA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="neuralBeamB" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Outer Circular Grid Coordinates */}
        <circle
          cx="250"
          cy="250"
          r="220"
          fill="none"
          stroke={isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.16)'}
          strokeWidth="1"
          strokeDasharray="4 8"
        />

        {/* Orbit Ring 1 (Slow Clockwise Rotation) */}
        <g className="animate-hero-orbit origin-center">
          <circle
            cx="250"
            cy="250"
            r="185"
            fill="none"
            stroke="url(#orbitGradIndigo)"
            strokeWidth="1.5"
            strokeDasharray="12 12"
          />
          {/* Orbital Subject Nodes */}
          <circle cx="250" cy="65" r="4.5" fill="#6366F1" className="shadow-lg shadow-indigo-500" />
          <circle cx="435" cy="250" r="4" fill="#10B981" />
          <circle cx="250" cy="435" r="4.5" fill="#F59E0B" />
          <circle cx="65" cy="250" r="4" fill="#EC4899" />
        </g>

        {/* Orbit Ring 2 (Counter-Clockwise Rotation) */}
        <g className="animate-hero-orbit-reverse origin-center">
          <circle
            cx="250"
            cy="250"
            r="135"
            fill="none"
            stroke={isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.3)'}
            strokeWidth="1"
            strokeDasharray="6 14"
          />
          <circle cx="250" cy="115" r="3.5" fill="#38BDF8" />
          <circle cx="385" cy="250" r="3.5" fill="#8B5CF6" />
          <circle cx="250" cy="385" r="3.5" fill="#10B981" />
          <circle cx="115" cy="250" r="3.5" fill="#F59E0B" />
        </g>

        {/* Pulsing Radar Ring from Core */}
        <circle
          cx="250"
          cy="250"
          r="78"
          fill="none"
          stroke={isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.3)'}
          strokeWidth="1.5"
          className="animate-hero-radar origin-center"
        />

        {/* Neural Signal Connecting Lines (from Center to 4 Quadrants) */}
        {/* Line 1: Center to Top-Left */}
        <line
          x1="250"
          y1="250"
          x2="115"
          y2="115"
          stroke="url(#neuralBeamA)"
          strokeWidth="1.5"
          className="animate-hero-dash"
        />
        {/* Line 2: Center to Top-Right */}
        <line
          x1="250"
          y1="250"
          x2="385"
          y2="115"
          stroke="url(#neuralBeamB)"
          strokeWidth="1.5"
          className="animate-hero-dash"
        />
        {/* Line 3: Center to Bottom-Left */}
        <line
          x1="250"
          y1="250"
          x2="115"
          y2="385"
          stroke="url(#neuralBeamB)"
          strokeWidth="1.5"
          className="animate-hero-dash"
        />
        {/* Line 4: Center to Bottom-Right */}
        <line
          x1="250"
          y1="250"
          x2="385"
          y2="385"
          stroke="url(#neuralBeamA)"
          strokeWidth="1.5"
          className="animate-hero-dash"
        />
      </svg>

      {/* ======================================================== */}
      {/* CENTRAL 3D HOLOGRAPHIC CBT CORE ORB                       */}
      {/* ======================================================== */}
      <div className="relative z-10 w-44 h-44 sm:w-52 sm:h-52 rounded-full flex flex-col items-center justify-center p-4 text-center transition-transform hover:scale-105 duration-300">
        {/* Outer Glow Ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-sky-400 to-emerald-400 p-[2px] shadow-[0_0_40px_rgba(99,102,241,0.35)] animate-hero-pulse">
          <div
            className={`w-full h-full rounded-full ${
              isDark ? 'bg-[#0B1120]' : 'bg-white'
            }`}
          />
        </div>

        {/* Inner Glass Sphere */}
        <div
          className={`relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center p-3 sm:p-4 backdrop-blur-2xl border ${
            isDark
              ? 'bg-slate-900/90 border-indigo-500/40 text-white shadow-inner shadow-indigo-500/20'
              : 'bg-white/95 border-indigo-200/90 text-slate-900 shadow-xl shadow-indigo-100'
          }`}
        >
          {/* Beacon Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 text-[9px] sm:text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>0ms CBT ENGINE</span>
          </div>

          {/* Central Animated Hologram Icon */}
          <div className="relative my-0.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white">
              <Cpu size={26} className="animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-[10px] shadow-sm">
              ⚡
            </div>
          </div>

          {/* Core Name */}
          <h3 className={`text-sm sm:text-base font-black tracking-wider leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ZYVRA CBT 2.0
          </h3>

          <span className={`text-[9px] sm:text-[10px] font-bold tracking-tight ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
            {isHindi ? 'वास्तविक परीक्षा सिमुलेशन' : 'Live Precision Engine'}
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4 FLOATING SATELLITE TELEMETRY CARDS                     */}
      {/* ======================================================== */}

      {/* CARD 1: TOP-LEFT - Spaced Revision & Memory Vault */}
      <div
        onMouseEnter={() => setActiveCard('spaced')}
        onMouseLeave={() => setActiveCard(null)}
        className={`absolute top-2 left-1 sm:top-4 sm:left-2 z-20 w-44 sm:w-48 p-2.5 sm:p-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-hero-float-a ${
          activeCard === 'spaced' ? 'scale-105 shadow-glowGold' : 'shadow-lg'
        } ${
          isDark
            ? 'bg-slate-900/90 border-amber-500/30 text-white shadow-amber-950/20'
            : 'bg-white/95 border-amber-200 text-slate-900 shadow-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
          <div className="flex items-center gap-1.5 text-amber-500 font-black text-[10px]">
            <Brain size={13} />
            <span>{isHindi ? 'स्मार्ट दोहराव' : 'Spaced Recall'}</span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
            Day 1 → 7
          </span>
        </div>
        <div className="pt-1.5 flex items-center justify-between">
          <div>
            <div className="text-xs sm:text-sm font-black text-amber-500">
              98.4%
            </div>
            <div className={`text-[9px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isHindi ? 'याददाश्त रिटेंशन' : 'Retention Gain'}
            </div>
          </div>
          <Sparkles size={16} className="text-amber-400 fill-amber-400 animate-pulse" />
        </div>
      </div>

      {/* CARD 2: TOP-RIGHT - Speed & Accuracy Benchmark */}
      <div
        onMouseEnter={() => setActiveCard('speed')}
        onMouseLeave={() => setActiveCard(null)}
        className={`absolute top-2 right-1 sm:top-4 sm:right-2 z-20 w-44 sm:w-48 p-2.5 sm:p-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-hero-float-b ${
          activeCard === 'speed' ? 'scale-105 shadow-glowIndigo' : 'shadow-lg'
        } ${
          isDark
            ? 'bg-slate-900/90 border-indigo-500/30 text-white shadow-indigo-950/20'
            : 'bg-white/95 border-indigo-200 text-slate-900 shadow-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-indigo-500/20">
          <div className="flex items-center gap-1.5 text-indigo-500 font-black text-[10px]">
            <Zap size={13} className="fill-indigo-500" />
            <span>{isHindi ? 'सटीकता व गति' : 'Speed & Accuracy'}</span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            Topper Pace
          </span>
        </div>
        <div className="pt-1.5 flex items-center justify-between">
          <div>
            <div className="text-xs sm:text-sm font-black text-indigo-500">
              38s <span className="text-[10px] font-normal">/ Q</span>
            </div>
            <div className={`text-[9px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              99.2% Accuracy Rate
            </div>
          </div>
          <Flame size={16} className="text-orange-500 fill-orange-500 animate-pulse" />
        </div>
      </div>

      {/* CARD 3: BOTTOM-LEFT - BPSC Option E & Negative Engine */}
      <div
        onMouseEnter={() => setActiveCard('bpsc')}
        onMouseLeave={() => setActiveCard(null)}
        className={`absolute bottom-2 left-1 sm:bottom-4 sm:left-2 z-20 w-44 sm:w-48 p-2.5 sm:p-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-hero-float-b ${
          activeCard === 'bpsc' ? 'scale-105 shadow-glowGreen' : 'shadow-lg'
        } ${
          isDark
            ? 'bg-slate-900/90 border-emerald-500/30 text-white shadow-emerald-950/20'
            : 'bg-white/95 border-emerald-200 text-slate-900 shadow-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-emerald-500 font-black text-[10px]">
            <ShieldCheck size={13} />
            <span>{isHindi ? 'BPSC 5-विकल्प' : '5-Option Pattern'}</span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            -1/3rd Rule
          </span>
        </div>
        <div className="pt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[9px] font-black">
            <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">A</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">B</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">C</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">D</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white shadow-sm font-extrabold">E ✓</span>
          </div>
          <span className="text-[9px] font-black text-emerald-500">0ms Lock</span>
        </div>
      </div>

      {/* CARD 4: BOTTOM-RIGHT - Diagnostic Analytics & Topper Rank */}
      <div
        onMouseEnter={() => setActiveCard('rank')}
        onMouseLeave={() => setActiveCard(null)}
        className={`absolute bottom-2 right-1 sm:bottom-4 sm:right-2 z-20 w-44 sm:w-48 p-2.5 sm:p-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-hero-float-a ${
          activeCard === 'rank' ? 'scale-105 shadow-glowIndigo' : 'shadow-lg'
        } ${
          isDark
            ? 'bg-slate-900/90 border-purple-500/30 text-white shadow-purple-950/20'
            : 'bg-white/95 border-purple-200 text-slate-900 shadow-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/20">
          <div className="flex items-center gap-1.5 text-purple-500 font-black text-[10px]">
            <Award size={13} />
            <span>{isHindi ? 'अखिल भारतीय रैंक' : 'AI Rank Predictor'}</span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400">
            Top 0.2%
          </span>
        </div>
        <div className="pt-1.5 flex items-center justify-between">
          <div>
            <div className="text-xs sm:text-sm font-black text-purple-500 flex items-center gap-1">
              <span>AIR 14</span>
              <TrendingUp size={13} className="text-emerald-500" />
            </div>
            <div className={`text-[9px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              99.8th Percentile
            </div>
          </div>

          {/* Mini Equalizer Animated Diagnostic Bars */}
          <div className="flex items-end gap-1 h-6">
            <span className="w-1.5 h-3 rounded-full bg-indigo-500 animate-pulse" />
            <span className="w-1.5 h-5 rounded-full bg-purple-500 animate-pulse [animation-delay:0.3s]" />
            <span className="w-1.5 h-6 rounded-full bg-emerald-500 animate-pulse [animation-delay:0.6s]" />
          </div>
        </div>
      </div>
    </div>
  );
}

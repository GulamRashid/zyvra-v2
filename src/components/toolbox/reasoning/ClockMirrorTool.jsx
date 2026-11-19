import { useState } from 'react';
import { Clock, FlipHorizontal, Droplets, Compass, Sparkles, BookOpen } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

export function calculateMirrorTime(hours, minutes) {
  const normH = hours % 12;
  let mirH;
  let mirM;

  if (minutes === 0) {
    mirH = (12 - normH) % 12;
    if (mirH === 0) mirH = 12;
    mirM = 0;
  } else {
    mirH = 11 - normH;
    if (mirH <= 0) mirH += 12;
    mirM = 60 - minutes;
  }
  return { hours: mirH, minutes: mirM };
}

export function calculateWaterTime(hours, minutes) {
  const normH = hours % 12;
  let watH;
  let watM;

  if (minutes <= 30) {
    watH = (18 - (normH === 0 ? 12 : normH));
    watM = 30 - minutes;
  } else {
    watH = (17 - (normH === 0 ? 12 : normH));
    watM = 90 - minutes;
  }
  while (watH <= 0) watH += 12;
  while (watH > 12) watH -= 12;
  return { hours: watH, minutes: watM };
}

export function calculateClockAngle(hours, minutes) {
  const normH = hours % 12;
  const angle = Math.abs(30 * normH - 5.5 * minutes);
  const acute = Math.min(angle, 360 - angle);
  const reflex = 360 - acute;
  return { acute: Number(acute.toFixed(2)), reflex: Number(reflex.toFixed(2)) };
}

function SvgClock({ hours, minutes, label, subtitle, badgeColor = 'purple' }) {
  const normH = hours % 12;
  const hourAngle = (normH + minutes / 60) * 30;
  const minuteAngle = minutes * 6;

  // Center is (60, 60), radius is 48
  const cx = 60;
  const cy = 60;

  // Minute hand end point (length 34)
  const minRad = (minuteAngle - 90) * (Math.PI / 180);
  const mx2 = cx + 34 * Math.cos(minRad);
  const my2 = cy + 34 * Math.sin(minRad);

  // Hour hand end point (length 24)
  const hrRad = (hourAngle - 90) * (Math.PI / 180);
  const hx2 = cx + 24 * Math.cos(hrRad);
  const hy2 = cy + 24 * Math.sin(hrRad);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flex flex-col items-center p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-2xs">
      <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
        {label}
      </div>

      <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-xs">
        {/* Clock Outer Rim */}
        <circle cx={cx} cy={cy} r="54" className="fill-neutral-50 dark:fill-neutral-900 stroke-neutral-300 dark:stroke-neutral-700 stroke-2" />
        <circle cx={cx} cy={cy} r="51" className="fill-transparent stroke-neutral-200 dark:stroke-neutral-800 stroke-1" />

        {/* 12 Hour Ticks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30 * (Math.PI / 180);
          const x1 = cx + 46 * Math.cos(angle);
          const y1 = cy + 46 * Math.sin(angle);
          const x2 = cx + 51 * Math.cos(angle);
          const y2 = cy + 51 * Math.sin(angle);
          const isMain = i % 3 === 0;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={isMain ? 'stroke-neutral-700 dark:stroke-neutral-300 stroke-2' : 'stroke-neutral-400 dark:stroke-neutral-600 stroke-1'}
            />
          );
        })}

        {/* Main Hour Numbers */}
        <text x="60" y="24" textAnchor="middle" className="text-[9px] font-bold fill-neutral-600 dark:fill-neutral-400">12</text>
        <text x="100" y="63" textAnchor="middle" className="text-[9px] font-bold fill-neutral-600 dark:fill-neutral-400">3</text>
        <text x="60" y="103" textAnchor="middle" className="text-[9px] font-bold fill-neutral-600 dark:fill-neutral-400">6</text>
        <text x="20" y="63" textAnchor="middle" className="text-[9px] font-bold fill-neutral-600 dark:fill-neutral-400">9</text>

        {/* Hour Hand */}
        <line
          x1={cx}
          y1={cy}
          x2={hx2}
          y2={hy2}
          className="stroke-neutral-900 dark:stroke-white stroke-[3.5] stroke-linecap-round"
        />

        {/* Minute Hand */}
        <line
          x1={cx}
          y1={cy}
          x2={mx2}
          y2={my2}
          className="stroke-purple-600 dark:stroke-purple-400 stroke-2 stroke-linecap-round"
        />

        {/* Center Pivot */}
        <circle cx={cx} cy={cy} r="3" className="fill-neutral-900 dark:fill-white" />
        <circle cx={cx} cy={cy} r="1.5" className="fill-purple-500" />
      </svg>

      <div className="mt-2 text-center">
        <span className="text-base font-black font-mono text-neutral-900 dark:text-white">
          {pad(hours)}:{pad(minutes)}
        </span>
        {subtitle && (
          <span className="block text-[10px] text-neutral-400 font-bold">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ClockMirrorTool() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeTab, setActiveTab] = useState('mirror'); // 'mirror' | 'water' | 'angle' | 'rules'

  // Time state
  const [hours, setHours] = useState(8);
  const [minutes, setMinutes] = useState(20);

  const mirrorTime = calculateMirrorTime(hours, minutes);
  const waterTime = calculateWaterTime(hours, minutes);
  const angleInfo = calculateClockAngle(hours, minutes);

  const setPreset = (h, m) => {
    setHours(h);
    setMinutes(m);
  };

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <Clock size={14} />
            {isHi ? 'रीजनिंग क्लॉक इंजन' : 'Reasoning Clock Engine'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'घड़ी, दर्पण व जल प्रतिबिम्ब (Clock & Mirror)' : 'Clock, Mirror & Water Image Solver'}
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('mirror')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'mirror'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'दर्पण प्रतिबिम्ब' : 'Mirror Image'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('water')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'water'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'जल प्रतिबिम्ब' : 'Water Image'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('angle')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'angle'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'सुइयों का कोण' : 'Hands Angle'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'rules'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'गोल्डन रूल्स' : 'Exam Rules'}
          </button>
        </div>
      </div>

      {/* Time Controller Inputs & Exam Presets */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-0.5">
                {isHi ? 'घंटे (Hour 1-12)' : 'Hour (1-12)'}
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={hours}
                onChange={(e) => setHours(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))}
                className="w-20 text-center font-mono font-bold text-base p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <span className="text-xl font-black text-neutral-400 mt-4">:</span>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-0.5">
                {isHi ? 'मिनट (Min 0-59)' : 'Minute (0-59)'}
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                className="w-20 text-center font-mono font-bold text-base p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Quick Exam Presets */}
          <div>
            <span className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-1">
              {isHi ? 'परीक्षा प्रश्न समय (Exam Presets):' : 'Exam Presets:'}
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                [8, 20],
                [4, 40],
                [3, 15],
                [7, 30],
                [10, 10],
                [12, 0]
              ].map(([h, m]) => (
                <button
                  key={`${h}:${m}`}
                  type="button"
                  onClick={() => setPreset(h, m)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    hours === h && minutes === m
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-purple-400'
                  }`}
                >
                  {pad(h)}:{pad(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: MIRROR IMAGE ================= */}
      {activeTab === 'mirror' && (
        <div className="space-y-4">
          {/* Side-by-Side Visual Clocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <SvgClock
              hours={hours}
              minutes={minutes}
              label={isHi ? 'वास्तविक घड़ी (Real Clock)' : 'Real Clock'}
              subtitle={isHi ? 'दर्पण के सामने' : 'In front of mirror'}
            />

            <SvgClock
              hours={mirrorTime.hours}
              minutes={mirrorTime.minutes}
              label={isHi ? 'दर्पण प्रतिबिम्ब (Mirror Image)' : 'Mirror Image Clock'}
              subtitle={isHi ? 'दर्पण में दिखने वाला समय' : 'Reflected Time'}
              badgeColor="indigo"
            />
          </div>

          {/* Step-by-Step Formula Solution Card */}
          <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Sparkles size={14} />
                {isHi ? 'दर्पण समय का 1-सेकंड सूत्र (Mirror Formula)' : 'Mirror Image 1-Second Formula'}
              </span>
              <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/30">
                Subtract from 11:60
              </span>
            </div>

            <p className="text-xs text-neutral-300">
              {isHi
                ? `नियम: 11:60 में से वास्तविक समय (${pad(hours)}:${pad(minutes)}) घटाएँ:`
                : `Formula: Subtract the actual time (${pad(hours)}:${pad(minutes)}) from 11:60:`}
            </p>

            <div className="p-2.5 rounded-lg bg-neutral-800/80 font-mono text-xs text-neutral-200 space-y-1">
              <div>&nbsp;&nbsp;11 : 60</div>
              <div>- {pad(hours)} : {pad(minutes)}</div>
              <div className="border-t border-neutral-700 pt-1 font-bold text-purple-400">
                =&nbsp;{pad(mirrorTime.hours)} : {pad(mirrorTime.minutes)}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400">
                {isHi ? 'दर्पण में उत्तर:' : 'Mirror Reflection Time:'}
              </span>
              <span className="text-xl font-mono font-black text-purple-400">
                {pad(mirrorTime.hours)}:{pad(mirrorTime.minutes)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: WATER IMAGE ================= */}
      {activeTab === 'water' && (
        <div className="space-y-4">
          {/* Visual Clocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <SvgClock
              hours={hours}
              minutes={minutes}
              label={isHi ? 'वास्तविक घड़ी (Real Clock)' : 'Real Clock'}
              subtitle={isHi ? 'पानी की सतह के ऊपर' : 'Above Water'}
            />

            <SvgClock
              hours={waterTime.hours}
              minutes={waterTime.minutes}
              label={isHi ? 'जल प्रतिबिम्ब (Water Image)' : 'Water Image Clock'}
              subtitle={isHi ? 'पानी में दिखने वाला समय' : 'Water Reflection Time'}
              badgeColor="blue"
            />
          </div>

          {/* Water Formula Solution Card */}
          <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Droplets size={14} />
                {isHi ? 'जल प्रतिबिम्ब सूत्र (Water Image Formula)' : 'Water Image Formula'}
              </span>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/30">
                {minutes <= 30 ? 'Subtract from 18:30' : 'Subtract from 17:90'}
              </span>
            </div>

            <p className="text-xs text-neutral-300">
              {isHi
                ? minutes <= 30
                  ? `मिनट 30 या कम है, इसलिए 18:30 में से घटाएँ:`
                  : `मिनट 30 से अधिक है, इसलिए 17:90 में से घटाएँ:`
                : minutes <= 30
                  ? 'Since minutes ≤ 30, subtract from 18:30:'
                  : 'Since minutes > 30, subtract from 17:90:'}
            </p>

            <div className="p-2.5 rounded-lg bg-neutral-800/80 font-mono text-xs text-neutral-200 space-y-1">
              <div>&nbsp;&nbsp;{minutes <= 30 ? '18 : 30' : '17 : 90'}</div>
              <div>- {pad(hours)} : {pad(minutes)}</div>
              <div className="border-t border-neutral-700 pt-1 font-bold text-blue-400">
                =&nbsp;{pad(waterTime.hours)} : {pad(waterTime.minutes)}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400">
                {isHi ? 'जल प्रतिबिम्ब उत्तर:' : 'Water Reflection Time:'}
              </span>
              <span className="text-xl font-mono font-black text-blue-400">
                {pad(waterTime.hours)}:{pad(waterTime.minutes)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ANGLE BETWEEN HANDS ================= */}
      {activeTab === 'angle' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <SvgClock
              hours={hours}
              minutes={minutes}
              label={isHi ? 'घड़ी की सुइयां' : 'Hands Position'}
              subtitle={`${pad(hours)}:${pad(minutes)}`}
            />

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-purple-600 text-white shadow-md space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200 block">
                  {isHi ? 'सुइयों के बीच का कोण (Angle):' : 'Angle Between Hands:'}
                </span>
                <div className="text-3xl font-black font-mono">
                  {angleInfo.acute}°
                </div>
                <div className="text-xs text-purple-200">
                  {isHi ? 'वृहत् कोण (Reflex Angle): ' : 'Reflex Angle: '}
                  <span className="font-bold text-white">{angleInfo.reflex}°</span>
                </div>
              </div>

              {/* Formula details */}
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-xs space-y-1.5">
                <span className="font-bold text-neutral-900 dark:text-white block">
                  📐 {isHi ? 'कोण फॉर्मूला:' : 'Angle Formula:'}
                </span>
                <div className="font-mono bg-neutral-100 dark:bg-neutral-900 p-2 rounded-lg text-neutral-800 dark:text-neutral-200">
                  θ = |30H - (11/2)M|
                </div>
                <div className="text-neutral-600 dark:text-neutral-400">
                  = |30 × {hours % 12} - 5.5 × {minutes}| = {angleInfo.acute}°
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: EXAM RULES ================= */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <span className="text-xs font-black text-purple-600 dark:text-purple-400 block mb-1">
                0° (संपाती / Coincide)
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                {isHi
                  ? 'दोनों सुइयां 12 घंटे में 11 बार और 24 घंटे में 22 बार एक-दूसरे के ऊपर आती हैं (11 से 1 के बीच केवल 12 बजे)।'
                  : 'Hands coincide 11 times in 12 hours and 22 times in 24 hours.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                180° (विपरीत दिशा / Opposite)
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                {isHi
                  ? 'दोनों सुइयां 12 घंटे में 11 बार और 24 घंटे में 22 बार एक सीधी रेखा (विपरीत) में होती हैं (5 से 7 के बीच केवल 6 बजे)।'
                  : 'Hands are opposite 11 times in 12 hours and 22 times in 24 hours.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block mb-1">
                90° (समकोण / Right Angle)
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                {isHi
                  ? 'दोनों सुइयां 12 घंटे में 22 बार और 24 घंटे में 44 बार समकोण (90°) बनाती हैं।'
                  : 'Hands form 90° angle 22 times in 12 hours and 44 times in 24 hours.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
import { useState } from 'react';
import { Compass, Sun, Moon, ArrowRight, RotateCw, RotateCcw, MapPin, Calculator } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const DIRECTIONS = [
  { short: 'N', en: 'North', hi: 'उत्तर', angle: 0 },
  { short: 'NE', en: 'North-East', hi: 'उत्तर-पूर्व (ईशान)', angle: 45 },
  { short: 'E', en: 'East', hi: 'पूर्व', angle: 90 },
  { short: 'SE', en: 'South-East', hi: 'दक्षिण-पूर्व (आग्नेय)', angle: 135 },
  { short: 'S', en: 'South', hi: 'दक्षिण', angle: 180 },
  { short: 'SW', en: 'South-West', hi: 'दक्षिण-पश्चिम (नैऋत्य)', angle: 225 },
  { short: 'W', en: 'West', hi: 'पश्चिम', angle: 270 },
  { short: 'NW', en: 'North-West', hi: 'उत्तर-पश्चिम (वायव्य)', angle: 315 }
];

const TRIPLETS = [
  { a: 3, b: 4, c: 5 },
  { a: 5, b: 12, c: 13 },
  { a: 6, b: 8, c: 10 },
  { a: 8, b: 15, c: 17 },
  { a: 7, b: 24, c: 25 },
  { a: 9, b: 40, c: 41 }
];

export default function DirectionCompass() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeTab, setActiveTab] = useState('compass'); // 'compass' | 'shadow' | 'pythagoras'

  // Compass state
  const [currentAngle, setCurrentAngle] = useState(0);

  // Shadow rules state
  const [timeOfDay, setTimeOfDay] = useState('morning'); // 'morning' | 'evening'
  const [facingDir, setFacingDir] = useState('N'); // 'N' | 'S' | 'E' | 'W'

  // Pythagoras state
  const [leg1, setLeg1] = useState('3');
  const [dir1, setDir1] = useState('North');
  const [leg2, setLeg2] = useState('4');
  const [dir2, setDir2] = useState('East');

  // Find nearest direction name for angle
  const normalizedAngle = ((currentAngle % 360) + 360) % 360;
  const currentDirection = DIRECTIONS.reduce((prev, curr) => {
    const diffCurr = Math.abs(curr.angle - normalizedAngle);
    const diffPrev = Math.abs(prev.angle - normalizedAngle);
    return diffCurr < diffPrev ? curr : prev;
  });

  // Calculate Shadow result
  const calculateShadow = () => {
    if (timeOfDay === 'morning') {
      // Sun East -> Shadow West
      if (facingDir === 'N') return { resultEn: 'To their LEFT', resultHi: 'उनकी बायीं ओर (Left)', shadowDir: 'West' };
      if (facingDir === 'S') return { resultEn: 'To their RIGHT', resultHi: 'उनकी दायीं ओर (Right)', shadowDir: 'West' };
      if (facingDir === 'E') return { resultEn: 'BEHIND them', resultHi: 'उनके पीछे (Behind)', shadowDir: 'West' };
      if (facingDir === 'W') return { resultEn: 'IN FRONT of them', resultHi: 'उनके ठीक आगे (Front)', shadowDir: 'West' };
    } else {
      // Sun West -> Shadow East
      if (facingDir === 'N') return { resultEn: 'To their RIGHT', resultHi: 'उनकी दायीं ओर (Right)', shadowDir: 'East' };
      if (facingDir === 'S') return { resultEn: 'To their LEFT', resultHi: 'उनकी बायीं ओर (Left)', shadowDir: 'East' };
      if (facingDir === 'E') return { resultEn: 'IN FRONT of them', resultHi: 'उनके ठीक आगे (Front)', shadowDir: 'East' };
      if (facingDir === 'W') return { resultEn: 'BEHIND them', resultHi: 'उनके पीछे (Behind)', shadowDir: 'East' };
    }
    return { resultEn: 'Unknown', resultHi: 'अज्ञात', shadowDir: 'Unknown' };
  };

  const shadowInfo = calculateShadow();

  // Calculate Pythagoras
  const val1 = Number(leg1) || 0;
  const val2 = Number(leg2) || 0;
  const hypotenuse = Math.sqrt(val1 ** 2 + val2 ** 2);

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <Compass size={14} />
            {isHi ? 'दिशा और दूरी टूल' : 'Direction & Distance Engine'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'दिशा, कोण और छाया कैलकुलेटर' : 'Direction Compass & Shadow Solver'}
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('compass')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'compass'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'दिशा व कोण' : 'Compass & Turn'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shadow')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'shadow'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'छाया नियम (Shadow)' : 'Shadow Rules'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pythagoras')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'pythagoras'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'न्यूनतम दूरी (Distance)' : 'Shortest Path'}
          </button>
        </div>
      </div>

      {/* ================= TAB 1: COMPASS & TURNS ================= */}
      {activeTab === 'compass' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Visual Compass Dial */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
              <div className="relative w-56 h-56 rounded-full border-4 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                {/* 8 Direction Labels */}
                {DIRECTIONS.map((dir) => {
                  const rad = (dir.angle - 90) * (Math.PI / 180);
                  const radius = 92; // px from center
                  const x = Math.round(112 + radius * Math.cos(rad) - 16);
                  const y = Math.round(112 + radius * Math.sin(rad) - 14);
                  const isSelected = currentDirection.short === dir.short;

                  return (
                    <button
                      key={dir.short}
                      type="button"
                      onClick={() => setCurrentAngle(dir.angle)}
                      style={{ left: `${x}px`, top: `${y}px` }}
                      className={`absolute w-8 h-7 rounded-lg text-[11px] font-black flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md scale-110 z-10'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-purple-400'
                      }`}
                    >
                      {dir.short}
                    </button>
                  );
                })}

                {/* Rotating Needle */}
                <div
                  className="w-2 h-44 rounded-full relative transition-transform duration-300 ease-out pointer-events-none"
                  style={{ transform: `rotate(${currentAngle}deg)` }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[38px] border-b-rose-500 absolute top-0 left-1/2 -translate-x-1/2 drop-shadow-sm" />
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[38px] border-t-neutral-400 dark:border-t-neutral-500 absolute bottom-0 left-1/2 -translate-x-1/2" />
                  <div className="w-4 h-4 rounded-full bg-neutral-900 dark:bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-xs border-2 border-white dark:border-neutral-900" />
                </div>
              </div>

              {/* Status readout */}
              <div className="mt-4 text-center">
                <div className="text-xl font-black text-neutral-900 dark:text-white flex items-center justify-center gap-2">
                  <span>{currentDirection.short}</span>
                  <span className="text-purple-600 dark:text-purple-400">({isHi ? currentDirection.hi : currentDirection.en})</span>
                  <span className="text-sm font-mono text-neutral-400">[{normalizedAngle}°]</span>
                </div>
              </div>
            </div>

            {/* Quick Angle Rotator Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <RotateCw size={14} className="text-purple-500" />
                {isHi ? 'दायां (Right) / बायां (Left) मोड़ परीक्षा शॉर्टकट' : 'Quick Turn Shortcuts for Exam'}
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentAngle((a) => a + 90)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-purple-400 text-left transition-all"
                >
                  <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <RotateCw size={14} />
                    {isHi ? 'दायां मुड़ें (+90° CW)' : 'Turn Right (+90°)'}
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    {isHi ? 'घड़ी की दिशा (Clockwise)' : 'Clockwise turn'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentAngle((a) => a - 90)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-purple-400 text-left transition-all"
                >
                  <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <RotateCcw size={14} />
                    {isHi ? 'बायां मुड़ें (-90° ACW)' : 'Turn Left (-90°)'}
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    {isHi ? 'वामावर्त दिशा (Anti-Clockwise)' : 'Anti-clockwise turn'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentAngle((a) => a + 45)}
                  className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-purple-400 text-left transition-all"
                >
                  <div className="text-xs font-black text-neutral-900 dark:text-white">
                    +45° {isHi ? 'दायां कोण' : 'Right 45°'}
                  </div>
                  <span className="text-[10px] text-neutral-400">{isHi ? 'आधा मोड़' : 'Half turn'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentAngle((a) => a + 180)}
                  className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-purple-400 text-left transition-all"
                >
                  <div className="text-xs font-black text-neutral-900 dark:text-white">
                    180° {isHi ? 'पीछे मुड़ें' : 'About-Turn'}
                  </div>
                  <span className="text-[10px] text-neutral-400">{isHi ? 'विपरीत दिशा' : 'Opposite'}</span>
                </button>
              </div>

              {/* Angle Tip Box */}
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-neutral-700 dark:text-neutral-300">
                <span className="font-bold text-purple-700 dark:text-purple-300 block mb-0.5">
                  💡 {isHi ? 'परीक्षा मंत्र (Exam Rule):' : 'Golden Rule:'}
                </span>
                {isHi
                  ? 'प्रश्न में दायां (Right) का मतलब हमेशा +90° Clockwise होता है, और बायां (Left) का मतलब -90° Anti-Clockwise होता है।'
                  : 'Right turn always means +90° Clockwise; Left turn always means -90° Anti-Clockwise unless an angle is specified.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SHADOW RULES ================= */}
      {activeTab === 'shadow' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
              <Sun size={14} />
              {isHi ? 'छाया नियम सॉल्वर (Sun & Shadow Calculator)' : 'Sun & Shadow Exam Solver'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-4">
              {isHi
                ? 'सुबह (सूर्योदय) और शाम (सूर्यास्त) के समय छाया किस दिशा में पड़ेगी:'
                : 'Solve tricky morning/evening shadow questions in seconds:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '1. दिन का समय (Time of Day)' : '1. Time of Day'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTimeOfDay('morning')}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      timeOfDay === 'morning'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <Sun size={14} />
                    {isHi ? 'सुबह (सूर्योदय)' : 'Morning (Sunrise)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeOfDay('evening')}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      timeOfDay === 'evening'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <Moon size={14} />
                    {isHi ? 'शाम (सूर्यास्त)' : 'Evening (Sunset)'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '2. व्यक्ति का मुख (Facing Direction)' : '2. Person Facing Direction'}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'N', en: 'North', hi: 'उत्तर' },
                    { id: 'S', en: 'South', hi: 'दक्षिण' },
                    { id: 'E', en: 'East', hi: 'पूर्व' },
                    { id: 'W', en: 'West', hi: 'पश्चिम' }
                  ].map((dir) => (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setFacingDir(dir.id)}
                      className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                        facingDir === dir.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="font-black">{dir.id}</div>
                      <div className="text-[10px] opacity-80">{isHi ? dir.hi : dir.en}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Shadow Output */}
            <div className="p-4 rounded-xl bg-neutral-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  {isHi ? 'छाया की स्थिति (Shadow Falls):' : 'Shadow Falls:'}
                </div>
                <div className="text-xl font-black text-white mt-0.5">
                  {isHi ? shadowInfo.resultHi : shadowInfo.resultEn}
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {isHi ? 'छाया की वास्तविक भौगोलिक दिशा:' : 'Geographic Shadow Direction:'}{' '}
                  <span className="font-bold text-amber-300">{shadowInfo.shadowDir}</span>
                </div>
              </div>
              <div className="sm:border-l border-neutral-700 sm:pl-4 text-xs text-neutral-300">
                <span className="font-bold text-amber-400 block mb-0.5">{isHi ? 'सूर्य की स्थिति:' : 'Sun Position:'}</span>
                {timeOfDay === 'morning' ? (isHi ? 'पूर्व (East)' : 'East') : (isHi ? 'पश्चिम (West)' : 'West')}
              </div>
            </div>
          </div>

          {/* Quick Rules Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mb-1">
                🌅 {isHi ? 'सूर्योदय (Morning Rule)' : 'Sunrise Rule'}
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {isHi
                  ? 'सूर्य पूर्व में होता है ➔ सभी छाया पश्चिम (West) में गिरती हैं। यदि मुख उत्तर में है, तो छाया बायीं ओर (Left) गिरेगी।'
                  : 'Sun is in East ➔ all shadows fall on WEST. If facing North, shadow is on LEFT.'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <span className="text-xs font-black text-orange-600 dark:text-orange-400 block mb-1">
                🌇 {isHi ? 'सूर्यास्त (Evening Rule)' : 'Sunset Rule'}
              </span>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {isHi
                  ? 'सूर्य पश्चिम में होता है ➔ सभी छाया पूर्व (East) में गिरती हैं। यदि मुख उत्तर में है, तो छाया दायीं ओर (Right) गिरेगी।'
                  : 'Sun is in West ➔ all shadows fall on EAST. If facing North, shadow is on RIGHT.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: SHORTEST DISTANCE (PYTHAGORAS) ================= */}
      {activeTab === 'pythagoras' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20">
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
              <Calculator size={14} />
              {isHi ? 'पाइथागोरस न्यूनतम दूरी कैलकुलेटर' : 'Pythagorean Shortest Distance Solver'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-4">
              {isHi
                ? 'प्रारंभिक बिंदु और अंतिम बिंदु के बीच सीधी न्यूनतम दूरी (Displacement = √(a² + b²)):'
                : 'Calculate the straight-line displacement between starting and ending points:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '1. पहला विस्थापन (Leg 1)' : '1. First Leg'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={leg1}
                    onChange={(e) => setLeg1(e.target.value)}
                    className="w-24 text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    placeholder="e.g. 3"
                  />
                  <select
                    value={dir1}
                    onChange={(e) => setDir1(e.target.value)}
                    className="flex-1 text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  >
                    <option value="North">{isHi ? 'उत्तर (North)' : 'North'}</option>
                    <option value="South">{isHi ? 'दक्षिण (South)' : 'South'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '2. दूसरा विस्थापन (Leg 2)' : '2. Second Leg'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={leg2}
                    onChange={(e) => setLeg2(e.target.value)}
                    className="w-24 text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    placeholder="e.g. 4"
                  />
                  <select
                    value={dir2}
                    onChange={(e) => setDir2(e.target.value)}
                    className="flex-1 text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  >
                    <option value="East">{isHi ? 'पूर्व (East)' : 'East'}</option>
                    <option value="West">{isHi ? 'पश्चिम (West)' : 'West'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Output */}
            <div className="p-4 rounded-xl bg-indigo-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
                  {isHi ? 'सीधी न्यूनतम दूरी (Shortest Distance):' : 'Shortest Distance (Hypotenuse):'}
                </div>
                <div className="text-2xl font-black mt-0.5">
                  {Number.isInteger(hypotenuse) ? hypotenuse : hypotenuse.toFixed(2)} {isHi ? 'किमी / मीटर' : 'km / m'}
                </div>
                <div className="text-xs text-indigo-200 mt-1">
                  √({val1}² + {val2}²) = √({val1 ** 2} + {val2 ** 2}) = √{val1 ** 2 + val2 ** 2}
                </div>
              </div>

              <div className="sm:border-l border-indigo-400 sm:pl-4 text-xs">
                <span className="font-bold text-indigo-200 block mb-0.5">
                  {isHi ? 'आरंभिक बिंदु से दिशा:' : 'Direction from Start:'}
                </span>
                <span className="text-sm font-black text-white">
                  {dir1}-{dir2}
                </span>
              </div>
            </div>
          </div>

          {/* Triplet Quick Table */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
              <MapPin size={14} className="text-indigo-500" />
              {isHi ? 'याद रखने योग्य पाइथागोरस ट्रिपलेट (Exam Memorization Triples)' : 'Must-Know Pythagorean Triples for SSC/NTPC'}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRIPLETS.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setLeg1(String(t.a));
                    setLeg2(String(t.b));
                  }}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-center hover:border-indigo-400 transition-colors"
                >
                  <div className="text-xs font-mono font-black text-neutral-900 dark:text-white">
                    {t.a}² + {t.b}² = <span className="text-indigo-600 dark:text-indigo-400">{t.c}²</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    ({t.a}, {t.b}, {t.c})
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
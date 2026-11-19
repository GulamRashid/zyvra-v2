import { useState } from 'react';
import { Calendar, Sparkles, CheckCircle2, RotateCw, History, ArrowRight } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getCenturyCode(year) {
  const century = Math.floor(year / 100);
  const rem = century % 4;
  if (rem === 0) return 6; // 1600s, 2000s, 2400s
  if (rem === 1) return 4; // 1700s, 2100s
  if (rem === 2) return 2; // 1800s, 2200s
  return 0; // 1900s, 2300s
}

export function getMonthCode(month, isLeap) {
  // month: 1 for Jan, 12 for Dec
  // Normal Year: 0, 3, 3, 6, 1, 4, 6, 2, 5, 0, 3, 5 (033 614 625 035)
  const normalCodes = [0, 3, 3, 6, 1, 4, 6, 2, 5, 0, 3, 5];
  if (isLeap) {
    if (month === 1) return 6;
    if (month === 2) return 2;
  }
  return normalCodes[month - 1];
}

export function calculateDayOfWeek(year, month, day) {
  const leap = isLeapYear(year);
  const monthCode = getMonthCode(month, leap);
  const centuryCode = getCenturyCode(year);
  const yearLastTwo = year % 100;
  const leapYearsInTwo = Math.floor(yearLastTwo / 4);

  const totalSum = day + monthCode + centuryCode + yearLastTwo + leapYearsInTwo;
  const dayIndex = totalSum % 7;

  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesHi = ['रविवार (Sunday)', 'सोमवार (Monday)', 'मंगलवार (Tuesday)', 'बुधवार (Wednesday)', 'गुरुवार (Thursday)', 'शुक्रवार (Friday)', 'शनिवार (Saturday)'];

  return {
    dayIndex,
    nameEn: dayNamesEn[dayIndex],
    nameHi: dayNamesHi[dayIndex],
    isLeap: leap,
    breakdown: {
      date: day,
      monthCode,
      centuryCode,
      yearLastTwo,
      leapYearsInTwo,
      totalSum,
      remainder: dayIndex
    }
  };
}

export function getCalendarRepetition(year) {
  const rem = year % 4;
  if (isLeapYear(year)) {
    return { nextYear: year + 28, addYears: 28, rule: 'Leap Year (+28 years)' };
  }
  if (rem === 1) {
    return { nextYear: year + 6, addYears: 6, rule: 'Leap Year + 1 (+6 years)' };
  }
  // rem === 2 or rem === 3
  return { nextYear: year + 11, addYears: 11, rule: 'Leap Year + 2 or 3 (+11 years)' };
}

const EXAM_DATES = [
  { labelEn: 'India Independence', labelHi: 'भारत स्वतंत्रता दिवस', y: 1947, m: 8, d: 15 },
  { labelEn: 'Indian Republic Day', labelHi: 'प्रथम गणतंत्र दिवस', y: 1950, m: 1, d: 26 },
  { labelEn: 'Mahatma Gandhi Birthday', labelHi: 'गांधी जयंती', y: 1869, m: 10, d: 2 },
  { labelEn: 'Millennium Day', labelHi: 'मिलेनियम दिवस', y: 2000, m: 1, d: 1 },
  { labelEn: 'Leap Day 2024', labelHi: 'लीप दिवस 2024', y: 2024, m: 2, d: 29 }
];

const MONTH_NAMES = [
  { num: 1, en: 'January', hi: 'जनवरी' },
  { num: 2, en: 'February', hi: 'फरवरी' },
  { num: 3, en: 'March', hi: 'मार्च' },
  { num: 4, en: 'April', hi: 'अप्रैल' },
  { num: 5, en: 'May', hi: 'मई' },
  { num: 6, en: 'June', hi: 'जून' },
  { num: 7, en: 'July', hi: 'जुलाई' },
  { num: 8, en: 'August', hi: 'अगस्त' },
  { num: 9, en: 'September', hi: 'सितम्बर' },
  { num: 10, en: 'October', hi: 'अक्टूबर' },
  { num: 11, en: 'November', hi: 'नवम्बर' },
  { num: 12, en: 'December', hi: 'दिसम्बर' }
];

export default function CalendarDayTool() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeTab, setActiveTab] = useState('calc'); // 'calc' | 'repeat' | 'oddDays'

  // Input states
  const today = new Date();
  const [year, setYear] = useState(1947);
  const [month, setMonth] = useState(8);
  const [day, setDay] = useState(15);

  // Repetition state
  const [repYear, setRepYear] = useState(2024);

  const dayResult = calculateDayOfWeek(year, month, day);
  const repResult = getCalendarRepetition(repYear);

  const setDatePreset = (p) => {
    setYear(p.y);
    setMonth(p.m);
    setDay(p.d);
  };

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <Calendar size={14} />
            {isHi ? 'कैलेंडर एवं तारीख इंजन' : 'Calendar & Day Calculation Engine'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'दिन ज्ञात करना एवं कैलेंडर दोहराव' : 'Day Finder & Calendar Repetition Solver'}
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('calc')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'calc'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'दिन कैलकुलेटर' : 'Day Finder'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('repeat')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'repeat'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'कैलेंडर दोहराव (+28/+11/+6)' : 'Calendar Repeat'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('oddDays')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'oddDays'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'विषम दिन (Odd Days)' : 'Odd Days Rule'}
          </button>
        </div>
      </div>

      {/* ================= TAB 1: DAY CALCULATOR ================= */}
      {activeTab === 'calc' && (
        <div className="space-y-4">
          {/* Date Pickers */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              {isHi ? 'तारीख से दिन ज्ञात करें (Foolproof Date-to-Day Formula)' : 'Calculate Day from Any Date'}
            </h4>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-1">
                  {isHi ? 'दिन (1-31)' : 'Day (1-31)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={day}
                  onChange={(e) => setDay(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                  className="w-full text-center font-mono font-bold text-sm p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-1">
                  {isHi ? 'महीना (Month)' : 'Month'}
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  className="w-full text-center font-bold text-xs p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m.num} value={m.num}>
                      {isHi ? m.hi : m.en} ({m.num})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-1">
                  {isHi ? 'वर्ष (Year e.g. 1947)' : 'Year (e.g. 1947)'}
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-center font-mono font-bold text-sm p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Quick Historical Presets */}
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400 block mb-1">
                {isHi ? 'प्रसिद्ध परीक्षा तिथियां (Click to load):' : 'Famous Exam Dates (Click to load):'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EXAM_DATES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDatePreset(preset)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-indigo-500 transition-colors"
                  >
                    {isHi ? preset.labelHi : preset.labelEn} ({preset.d}/{preset.m}/{preset.y})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Big Result Card */}
          <div className="p-4 rounded-xl bg-indigo-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                {day} {MONTH_NAMES[month - 1].en} {year}
              </div>
              <div className="text-2xl font-black mt-0.5">
                {isHi ? dayResult.nameHi : dayResult.nameEn}
              </div>
              <div className="text-xs text-indigo-200 mt-1">
                {dayResult.isLeap ? (isHi ? '⚡ यह एक लीप वर्ष है' : '⚡ This is a Leap Year') : (isHi ? 'सामान्य वर्ष' : 'Ordinary Year')}
              </div>
            </div>

            <div className="sm:border-l border-indigo-400 sm:pl-4 text-xs font-mono">
              <span className="text-indigo-200 block text-[10px] uppercase font-bold">{isHi ? 'शेषफल (Remainder):' : 'Odd Day Index:'}</span>
              <span className="text-xl font-bold">{dayResult.breakdown.remainder}</span>
              <span className="text-indigo-200 text-[10px] block">(0=Sun, 1=Mon... 6=Sat)</span>
            </div>
          </div>

          {/* Step-by-Step Educational Breakdown */}
          <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2.5 shadow-md">
            <h5 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {isHi ? 'स्टेप-बाय-स्टेप गणना (Odd Days & Code Method)' : 'Step-by-Step Mathematical Calculation'}
            </h5>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-neutral-800">
                <span className="text-neutral-400 text-[10px] block">{isHi ? 'दिनांक (Date)' : 'Date'}</span>
                <span className="text-white font-bold">{dayResult.breakdown.date}</span>
              </div>
              <div className="p-2 rounded-lg bg-neutral-800">
                <span className="text-neutral-400 text-[10px] block">{isHi ? 'माह कोड (Month)' : 'Month Code'}</span>
                <span className="text-indigo-400 font-bold">{dayResult.breakdown.monthCode}</span>
              </div>
              <div className="p-2 rounded-lg bg-neutral-800">
                <span className="text-neutral-400 text-[10px] block">{isHi ? 'शताब्दी कोड (Cent.)' : 'Century Code'}</span>
                <span className="text-indigo-400 font-bold">{dayResult.breakdown.centuryCode}</span>
              </div>
              <div className="p-2 rounded-lg bg-neutral-800">
                <span className="text-neutral-400 text-[10px] block">{isHi ? 'वर्ष के 2 अंक' : 'Last 2 Digits'}</span>
                <span className="text-white font-bold">{dayResult.breakdown.yearLastTwo}</span>
              </div>
              <div className="p-2 rounded-lg bg-neutral-800">
                <span className="text-neutral-400 text-[10px] block">{isHi ? 'भागफल (Y ÷ 4)' : 'Leap in Y'}</span>
                <span className="text-emerald-400 font-bold">{dayResult.breakdown.leapYearsInTwo}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-800/80 font-mono text-xs space-y-1">
              <div>
                कुल योग = {dayResult.breakdown.date} + {dayResult.breakdown.monthCode} + {dayResult.breakdown.centuryCode} + {dayResult.breakdown.yearLastTwo} + {dayResult.breakdown.leapYearsInTwo} = <strong>{dayResult.breakdown.totalSum}</strong>
              </div>
              <div className="text-indigo-300">
                7 से भाग देने पर शेषफल = {dayResult.breakdown.totalSum} % 7 = <strong className="text-amber-400">{dayResult.breakdown.remainder}</strong> ➔ {isHi ? dayResult.nameHi : dayResult.nameEn}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CALENDAR REPETITION ================= */}
      {activeTab === 'repeat' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <RotateCw size={14} />
              {isHi ? 'समान कैलेंडर वर्ष खोजक (Calendar Repetition Rule)' : 'Calendar Repeat Year Finder'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? 'प्रतियोगी परीक्षाओं में अक्सर पूछा जाता है: "2024 का कैलेंडर दोबारा किस वर्ष काम आएगा?"'
                : 'Frequently asked exam question: "Which year will have the exact same calendar as year X?"'}
            </p>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isHi ? 'वर्ष दर्ज करें:' : 'Enter Year:'}
                <input
                  type="number"
                  value={repYear}
                  onChange={(e) => setRepYear(parseInt(e.target.value, 10) || 2024)}
                  className="mt-1 w-32 text-base font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </label>

              <div className="flex flex-wrap gap-1.5 pt-4">
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setRepYear(y)}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-purple-500"
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Repetition Output */}
            <div className="p-4 rounded-xl bg-purple-600 text-white shadow-md flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200 block">
                  {repYear} {isHi ? 'का कैलेंडर दोबारा प्रयोग होगा:' : 'will repeat in:'}
                </span>
                <span className="text-3xl font-black font-mono mt-0.5 block">
                  {repResult.nextYear}
                </span>
                <span className="text-xs text-purple-200 mt-1 block">
                  {isHi ? `लागू नियम: ${repResult.rule}` : `Applied Rule: ${repResult.rule}`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-xl font-mono">
                  +{repResult.addYears} Years
                </span>
              </div>
            </div>
          </div>

          {/* Quick Rules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <strong className="text-purple-600 dark:text-purple-400 block mb-1">
                लीप वर्ष (Leap Year) ➔ +28 वर्ष
              </strong>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                उदा. 2024 + 28 = 2052
              </p>
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <strong className="text-indigo-600 dark:text-indigo-400 block mb-1">
                लीप वर्ष + 1 ➔ +6 वर्ष
              </strong>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                उदा. 2025 + 6 = 2031
              </p>
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <strong className="text-emerald-600 dark:text-emerald-400 block mb-1">
                लीप वर्ष + 2 या + 3 ➔ +11 वर्ष
              </strong>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                उदा. 2026 + 11 = 2037
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ODD DAYS REFERENCE ================= */}
      {activeTab === 'oddDays' && (
        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 space-y-2">
            <h5 className="font-black text-neutral-900 dark:text-white uppercase tracking-wider text-xs">
              {isHi ? 'शताब्दियों में विषम दिन (Odd Days in Centuries)' : 'Odd Days in Centuries'}
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <span className="text-neutral-400 block text-[10px]">100 Years</span>
                <strong className="text-base text-indigo-600 dark:text-indigo-400">5 Odd Days</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <span className="text-neutral-400 block text-[10px]">200 Years</span>
                <strong className="text-base text-indigo-600 dark:text-indigo-400">3 Odd Days</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <span className="text-neutral-400 block text-[10px]">300 Years</span>
                <strong className="text-base text-indigo-600 dark:text-indigo-400">1 Odd Day</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                <span className="text-neutral-400 block text-[10px]">400 Years</span>
                <strong className="text-base text-emerald-600 dark:text-emerald-400">0 Odd Days</strong>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-neutral-700 dark:text-neutral-300">
            <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-0.5">
              💡 {isHi ? 'गोल्डन रूल:' : 'Golden Rule:'}
            </span>
            {isHi
              ? 'सामान्य वर्ष में 365 दिन = 52 सप्ताह + 1 विषम दिन होता है। इसलिए जिस दिन सामान्य वर्ष शुरू होता है, उसी दिन समाप्त होता है। लीप वर्ष में 2 विषम दिन होते हैं।'
              : 'Ordinary year has 1 odd day (starts and ends on the same day). Leap year has 2 odd days.'}
          </div>
        </div>
      )}
    </section>
  );
}
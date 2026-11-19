import { useState } from 'react';
import { Zap, Sparkles, CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

export default function SpeedMathTricks() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeTab, setActiveTab] = useState('times11'); // 'times11' | 'fast5' | 'digitalSum' | 'base100'

  // Tab 1: Times 11 State
  const [num11, setNum11] = useState('43');
  const n11 = parseInt(num11, 10);
  const isValid11 = !Number.isNaN(n11) && n11 > 0 && n11 < 10000;

  // Breakdown for 2-digit number * 11
  const get11Breakdown = () => {
    if (!isValid11) return null;
    if (n11 >= 10 && n11 <= 99) {
      const d1 = Math.floor(n11 / 10);
      const d2 = n11 % 10;
      const sum = d1 + d2;
      return {
        type: '2digit',
        d1,
        d2,
        sum,
        carry: sum >= 10 ? 1 : 0,
        result: n11 * 11
      };
    }
    return {
      type: 'multidigit',
      result: n11 * 11
    };
  };
  const b11 = get11Breakdown();

  // Tab 2: Multiply by 5, 25, 125
  const [numPower, setNumPower] = useState('64');
  const [multiplier, setMultiplier] = useState(25);
  const np = parseFloat(numPower) || 0;
  const getPowerSteps = () => {
    if (multiplier === 5) {
      return {
        divisor: 2,
        factor: 10,
        half: np / 2,
        result: np * 5,
        formula: '(N ÷ 2) × 10'
      };
    }
    if (multiplier === 25) {
      return {
        divisor: 4,
        factor: 100,
        half: np / 4,
        result: np * 25,
        formula: '(N ÷ 4) × 100'
      };
    }
    return {
      divisor: 8,
      factor: 1000,
      half: np / 8,
      result: np * 125,
      formula: '(N ÷ 8) × 1000'
    };
  };
  const pSteps = getPowerSteps();

  // Tab 3: Digital Sum (Digit Root / बीजांक)
  const [dsInput, setDsInput] = useState('3485');
  const calculateDigitalSum = (str) => {
    const digitsOnly = str.replace(/\D/g, '');
    if (!digitsOnly) return { sum: 0, steps: [] };
    const steps = [];
    let current = digitsOnly.split('').map(Number);
    steps.push({ text: current.join(' + '), total: current.reduce((a, b) => a + b, 0) });
    let total = steps[0].total;
    while (total > 9) {
      const nextDigits = String(total).split('').map(Number);
      total = nextDigits.reduce((a, b) => a + b, 0);
      steps.push({ text: nextDigits.join(' + '), total });
    }
    return { sum: total, steps };
  };
  const dsResult = calculateDigitalSum(dsInput);

  // Tab 4: Base 100 Multiplication
  const [baseA, setBaseA] = useState('97');
  const [baseB, setBaseB] = useState('94');
  const bA = parseInt(baseA, 10) || 100;
  const bB = parseInt(baseB, 10) || 100;
  const diffA = bA - 100;
  const diffB = bB - 100;
  const leftPart = bA + diffB; // or bB + diffA
  const rightPart = diffA * diffB;
  const baseResult = bA * bB;

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Zap size={14} />
            {isHi ? 'स्पीड मैथ व वैदिक गणना' : 'Speed Math & Mental Tricks'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'वैदिक मैथ एवं स्पीड कैलकुलेशन ट्रिक्स' : 'Vedic Math & Rapid Calculation Shortcuts'}
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('times11')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'times11'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? '× 11 ट्रिक' : '× 11 Trick'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fast5')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'fast5'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? '× 5, 25, 125' : '× 5, 25, 125'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('digitalSum')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'digitalSum'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'डिजिटल सम (बीजांक)' : 'Digital Sum'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('base100')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'base100'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'बेस 100 गुणा' : 'Base 100'}
          </button>
        </div>
      </div>

      {/* ================= TAB 1: TIMES 11 TRICK ================= */}
      {activeTab === 'times11' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              {isHi ? '11 से 2 सेकंड में गुणा करने का वैदिक नियम' : 'Multiply Any Number by 11 in 2 Seconds'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? 'नियम: दोनों अंकों को फैलाएं, और उनके बीच में दोनों का जोड़ रख दें!'
                : 'Rule: Separate the digits and place their sum in the middle! (Carry over if sum ≥ 10).'}
            </p>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isHi ? 'संख्या दर्ज करें:' : 'Enter number:'}
                <input
                  type="number"
                  value={num11}
                  onChange={(e) => setNum11(e.target.value)}
                  className="mt-1 w-32 text-base font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 43"
                />
              </label>

              {/* Sample badges */}
              <div className="flex flex-wrap gap-1.5 pt-4">
                {[23, 35, 45, 62, 78, 87, 94].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNum11(String(s))}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-amber-500"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Step Visualizer */}
            {b11 && b11.type === '2digit' && (
              <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2">
                <div className="text-xs text-amber-400 font-bold">
                  {isHi ? `चरण 1: पहले और अंतिम अंक को फैलाएं ➔ ${b11.d1} _ ${b11.d2}` : `Step 1: Spread digits ➔ ${b11.d1} _ ${b11.d2}`}
                </div>
                <div className="text-xs text-amber-300 font-bold">
                  {isHi
                    ? `चरण 2: बीच में (${b11.d1} + ${b11.d2} = ${b11.sum}) रखें`
                    : `Step 2: Place sum in middle ➔ ${b11.d1} + ${b11.d2} = ${b11.sum}`}
                  {b11.carry === 1 && (
                    <span className="text-rose-400 ml-1">
                      ({isHi ? '1 हासिल अगले अंक में जुड़ेगा' : 'Carry 1 over to left digit'})
                    </span>
                  )}
                </div>
                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400">{num11} × 11 =</span>
                  <span className="text-2xl font-mono font-black text-amber-400">{b11.result}</span>
                </div>
              </div>
            )}

            {b11 && b11.type === 'multidigit' && (
              <div className="p-4 rounded-xl bg-neutral-900 text-white flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300">{num11} × 11 =</span>
                <span className="text-2xl font-mono font-black text-amber-400">{b11.result}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: MULTIPLY BY 5, 25, 125 ================= */}
      {activeTab === 'fast5' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Zap size={14} />
              {isHi ? '5, 25, 125 से फास्ट भाग-गुणा ट्रिक' : 'Divide & Multiply Shortcut for 5, 25, 125'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? 'गुणा करने के बजाय सरल संख्या से भाग देकर शून्य जोड़ें:'
                : 'Instead of complex multiplication, divide by 2, 4, or 8 and add zeros:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  {isHi ? 'संख्या (N):' : 'Number (N):'}
                </label>
                <input
                  type="number"
                  value={numPower}
                  onChange={(e) => setNumPower(e.target.value)}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  {isHi ? 'गुणक चुनें:' : 'Choose Multiplier:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[5, 25, 125].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMultiplier(m)}
                      className={`p-2 rounded-xl text-xs font-black transition-all ${
                        multiplier === m
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-emerald-400'
                      }`}
                    >
                      × {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Steps Output Box */}
            <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2">
              <div className="text-xs text-emerald-400 font-bold">
                {isHi ? 'वैदिक फॉर्मूला: ' : 'Vedic Formula: '}
                <span className="font-mono text-white">{pSteps.formula}</span>
              </div>
              <div className="text-xs text-neutral-300">
                {np} ÷ {pSteps.divisor} = <span className="font-mono font-bold text-emerald-300">{pSteps.half}</span>
                {' ➔ '}
                {pSteps.half} × {pSteps.factor}
              </div>
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400">{np} × {multiplier} =</span>
                <span className="text-2xl font-mono font-black text-emerald-400">{pSteps.result}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: DIGITAL SUM (DIGIT ROOT) ================= */}
      {activeTab === 'digitalSum' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {isHi ? 'डिजिटल सम (बीजांक विधि) - विकल्पों को छांटने का रामबाण' : 'Digital Sum (Digit Root) - Option Elimination Secret'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? 'SSC व बैंकिंग में सरलीकरण (Simplification) के कठिन सवालों में 4 में से 3 विकल्प बिना हल किए 5 सेकंड में गलत साबित करें:'
                : 'Instantly eliminate wrong options in simplification questions without full calculations:'}
            </p>

            <div>
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                {isHi ? 'संख्या या उत्तर दर्ज करें:' : 'Enter any big number:'}
              </label>
              <input
                type="text"
                value={dsInput}
                onChange={(e) => setDsInput(e.target.value)}
                className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500"
                placeholder="e.g. 3485"
              />
            </div>

            {/* Digital Sum Steps */}
            <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2">
              <div className="text-xs text-indigo-400 font-bold mb-1">
                {isHi ? 'अंकों का योग (Digit Addition Steps):' : 'Digit Addition Steps:'}
              </div>
              {dsResult.steps.map((st, idx) => (
                <div key={idx} className="text-xs font-mono text-neutral-300 flex items-center gap-2">
                  <ArrowRight size={12} className="text-neutral-500" />
                  <span>{st.text} = </span>
                  <span className="font-bold text-white">{st.total}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400">
                  {isHi ? 'अंतिम डिजिटल सम (बीजांक):' : 'Final Digital Root:'}
                </span>
                <span className="text-2xl font-mono font-black text-indigo-400">
                  {dsResult.sum} {dsResult.sum === 9 && '(or 0)'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-neutral-700 dark:text-neutral-300">
              <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-0.5">
                💡 {isHi ? 'परीक्षा नियम (Exam Rule):' : 'Exam Golden Rule:'}
              </span>
              {isHi
                ? 'प्रश्न के सभी पदों का डिजिटल सम निकालें। जिस विकल्प का डिजिटल सम समान होगा, वही सही उत्तर है। 9 को 0 मानकर छोड़ सकते हैं।'
                : 'Calculate the digital sum of LHS. The only option with the exact same digital sum is your correct answer. 9 can be treated as 0.'}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: BASE 100 MULTIPLICATION ================= */}
      {activeTab === 'base100' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border border-purple-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Zap size={14} />
              {isHi ? '100 के निकटतम संख्याओं का वैदिक गुणा' : 'Base 100 Multiplication Trick'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? '100 के नजदीक वाली संख्याओं (उदा. 98 × 96 या 104 × 106) को 3 सेकंड में गुणा करें:'
                : 'Multiply numbers near 100 (e.g. 97 × 94 or 104 × 106) mentally in 3 seconds:'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  {isHi ? 'पहली संख्या:' : 'Number 1:'}
                </label>
                <input
                  type="number"
                  value={baseA}
                  onChange={(e) => setBaseA(e.target.value)}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  {isHi ? 'दूसरी संख्या:' : 'Number 2:'}
                </label>
                <input
                  type="number"
                  value={baseB}
                  onChange={(e) => setBaseB(e.target.value)}
                  className="w-full text-base font-mono font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Step Breakdown */}
            <div className="p-4 rounded-xl bg-neutral-900 text-white space-y-2">
              <div className="text-xs text-purple-400 font-bold">
                {isHi ? '100 से विचलन (Deviations from 100):' : 'Deviations from 100:'}
              </div>
              <div className="text-xs font-mono text-neutral-300">
                {bA} ➔ {diffA >= 0 ? `+${diffA}` : diffA} | {bB} ➔ {diffB >= 0 ? `+${diffB}` : diffB}
              </div>
              <div className="text-xs text-purple-300 font-bold pt-1">
                {isHi ? `बायां भाग: ${bA} + (${diffB}) = ${leftPart}` : `Left Part: ${bA} + (${diffB}) = ${leftPart}`}
              </div>
              <div className="text-xs text-purple-300 font-bold">
                {isHi
                  ? `दायां भाग: (${diffA}) × (${diffB}) = ${String(rightPart).padStart(2, '0')}`
                  : `Right Part: (${diffA}) × (${diffB}) = ${String(rightPart).padStart(2, '0')}`}
              </div>
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400">{bA} × {bB} =</span>
                <span className="text-2xl font-mono font-black text-purple-400">{baseResult}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
import { useMemo, useState } from 'react';
import { Superscript, Sparkles, BookOpen, Calculator, Zap } from 'lucide-react';
import MathRenderer from '../../common/MathRenderer';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

function format(value) {
  return Number.isFinite(value) ? Number(value.toPrecision(8)).toString() : '—';
}

export default function SquaresCubes() {
  const { t, language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeTab, setActiveTab] = useState('calc'); // 'calc' | 'table' | 'vedic'

  const [input, setInput] = useState('12');
  const value = Number(input);

  // Vedic ending in 5 test number
  const [vedic5Num, setVedic5Num] = useState(35);

  const results = useMemo(() => {
    if (input.trim() === '' || !Number.isFinite(value)) return null;
    return {
      square: format(value ** 2),
      cube: format(value ** 3),
      squareRoot: value < 0 ? null : format(Math.sqrt(value)),
      cubeRoot: format(Math.cbrt(value))
    };
  }, [input, value]);

  // Vedic calculation for ending in 5
  const vedicPrefix = Math.floor(vedic5Num / 10);
  const vedicPrefixMult = vedicPrefix * (vedicPrefix + 1);
  const vedicResult = vedic5Num ** 2;

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Superscript size={14} />
            {isHi ? 'गणित कैलकुलेटर' : 'Math Powers Engine'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'वर्ग, घन एवं वैदिक शॉर्टकट' : 'Squares, Cubes & Vedic Tricks'}
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('calc')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'calc'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'कैलकुलेटर' : 'Calculator'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'table'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? '1-30 तालिका' : '1-30 Table'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vedic')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'vedic'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'वैदिक ट्रिक्स' : 'Vedic Tricks'}
          </button>
        </div>
      </div>

      {/* ================= TAB 1: INSTANT CALCULATOR ================= */}
      {activeTab === 'calc' && (
        <div className="space-y-4">
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
            {t('tbEnterN') || (isHi ? 'संख्या (N) दर्ज करें:' : 'Enter number (N):')}
            <input
              className="mt-1 w-full text-base font-mono font-bold p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
              type="number"
              step="any"
              inputMode="decimal"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. 12"
            />
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" aria-live="polite">
            <article className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/90 text-center">
              <strong className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">
                {t('tbSquare') || (isHi ? 'वर्ग (Square)' : 'Square')}
              </strong>
              <MathRenderer formula={`${input || 'N'}^2 = ${results?.square || '—'}`} />
            </article>

            <article className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/90 text-center">
              <strong className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">
                {t('tbCube') || (isHi ? 'घन (Cube)' : 'Cube')}
              </strong>
              <MathRenderer formula={`${input || 'N'}^3 = ${results?.cube || '—'}`} />
            </article>

            <article className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/90 text-center">
              <strong className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">
                {t('tbSquareRoot') || (isHi ? 'वर्गमूल (√N)' : 'Square Root')}
              </strong>
              {results?.squareRoot !== null && results?.squareRoot !== undefined ? (
                <MathRenderer formula={`\\sqrt{${input || 'N'}} = ${results.squareRoot}`} />
              ) : (
                <span className="text-xs text-rose-500">{t('tbNegativeSqrt')}</span>
              )}
            </article>

            <article className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/90 text-center">
              <strong className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">
                {t('tbCubeRoot') || (isHi ? 'घनमूल (∛N)' : 'Cube Root')}
              </strong>
              <MathRenderer formula={`\\sqrt[3]{${input || 'N'}} = ${results?.cubeRoot || '—'}`} />
            </article>
          </div>
        </div>
      )}

      {/* ================= TAB 2: REFERENCE TABLE 1-30 ================= */}
      {activeTab === 'table' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {isHi ? '1 से 30 तक वर्ग और घन (प्रतियोगी परीक्षाओं के लिए याद रखें):' : 'Squares and Cubes from 1 to 30:'}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-100 dark:bg-neutral-800/80 sticky top-0 text-neutral-700 dark:text-neutral-300 font-black">
                <tr>
                  <th className="p-2.5 text-center">n</th>
                  <th className="p-2.5 text-center">n² (वर्ग)</th>
                  <th className="p-2.5 text-center">n³ (घन)</th>
                  <th className="p-2.5 text-center">क्विक लोड</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                {Array.from({ length: 30 }, (_, index) => {
                  const num = index + 1;
                  return (
                    <tr key={num} className="hover:bg-amber-500/5 transition-colors">
                      <td className="p-2.5 text-center font-bold font-mono text-neutral-900 dark:text-white">{num}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">{num ** 2}</td>
                      <td className="p-2.5 text-center font-mono text-neutral-600 dark:text-neutral-400">{num ** 3}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setInput(String(num));
                            setActiveTab('calc');
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-amber-500 hover:text-white transition-colors"
                        >
                          Check
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: VEDIC SHORTCUTS ================= */}
      {activeTab === 'vedic' && (
        <div className="space-y-4">
          {/* Trick 1: Ending in 5 */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Zap size={14} />
              {isHi ? 'ट्रिक 1: 5 पर समाप्त होने वाली संख्याओं का वर्ग (Ending in 5)' : 'Trick 1: Squares of Numbers Ending in 5'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? 'नियम: दहाई अंक n को (n + 1) से गुणा करें और अंत में 25 जोड़ दें।'
                : 'Rule: Multiply the tens digit n by (n + 1) and append 25 at the end.'}
            </p>

            {/* Selector buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setVedic5Num(n)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    vedic5Num === n
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-amber-400'
                  }`}
                >
                  {n}²
                </button>
              ))}
            </div>

            {/* Live Vedic Step Breakdown Box */}
            <div className="p-3.5 rounded-xl bg-neutral-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-[11px] font-bold text-amber-400">
                  {isHi ? `चरण 1: ${vedicPrefix} × (${vedicPrefix} + 1) = ${vedicPrefixMult}` : `Step 1: ${vedicPrefix} × (${vedicPrefix} + 1) = ${vedicPrefixMult}`}
                </div>
                <div className="text-[11px] font-bold text-amber-300 mt-0.5">
                  {isHi ? 'चरण 2: अंत में 25 जोड़ें ➔ ' : 'Step 2: Append 25 ➔ '}
                  <span className="font-mono text-white text-xs">{vedicPrefixMult}25</span>
                </div>
              </div>
              <div className="text-right sm:border-l border-neutral-700 sm:pl-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">{vedic5Num}² Result</span>
                <span className="text-xl font-mono font-black text-amber-400">{vedicResult}</span>
              </div>
            </div>
          </div>

          {/* Trick 2: Base 50 trick */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              {isHi ? 'ट्रिक 2: 50 के आसपास की संख्याओं का वर्ग (Base 50 Trick)' : 'Trick 2: Squares Near 50 (Base 50)'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {isHi
                ? '50 से जितनी संख्या ज्यादा या कम है (x), उसे 25 में जोड़ें/घटाएं और आगे x² लिखें:'
                : 'Difference from 50 (x): add or subtract x to 25, followed by x²:'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block">54² (50 + 4):</span>
                <span>(25 + 4) | 4² = <strong>2916</strong></span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-rose-600 dark:text-rose-400 block">46² (50 - 4):</span>
                <span>(25 - 4) | 4² = <strong>2116</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
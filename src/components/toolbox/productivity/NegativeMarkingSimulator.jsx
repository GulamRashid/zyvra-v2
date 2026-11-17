import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Percent,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const PRESETS = [
  { id: 'bpsc', name: 'BPSC Prelims', marks: 1, penalty: 0.333, defaultCutoff: 91, total: 150 },
  { id: 'ssc', name: 'SSC CGL Tier-1', marks: 2, penalty: 0.50, defaultCutoff: 138, total: 100 },
  { id: 'railway', name: 'Railway RRB', marks: 1, penalty: 0.333, defaultCutoff: 72, total: 100 },
  { id: 'upsc', name: 'UPSC CSE Prelims', marks: 2, penalty: 0.666, defaultCutoff: 88, total: 100 },
  { id: 'custom', name: 'Custom Scheme', marks: 1, penalty: 0.25, defaultCutoff: 70, total: 100 }
];

export default function NegativeMarkingSimulator() {
  const { language } = useThemeLanguage();
  const isHindi = language === 'hi';

  const [selectedPresetId, setSelectedPresetId] = useState('bpsc');
  const [marksPerQ, setMarksPerQ] = useState(1);
  const [penaltyPerQ, setPenaltyPerQ] = useState(0.333);
  const [targetCutoff, setTargetCutoff] = useState(91);

  // Question counts
  const [sureCount, setSureCount] = useState(65);
  const [fiftyFiftyCount, setFiftyFiftyCount] = useState(25);
  const [oneEliminatedCount, setOneEliminatedCount] = useState(15);
  const [blindGuessCount, setBlindGuessCount] = useState(5);

  const applyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setMarksPerQ(preset.marks);
    setPenaltyPerQ(preset.penalty);
    setTargetCutoff(preset.defaultCutoff);
  };

  const totalAttempted = sureCount + fiftyFiftyCount + oneEliminatedCount + blindGuessCount;

  const results = useMemo(() => {
    const sureScore = sureCount * marksPerQ;

    // 50-50 EV: P(correct) = 0.5, P(wrong) = 0.5
    const evFifty = fiftyFiftyCount * (0.5 * marksPerQ - 0.5 * penaltyPerQ);

    // 1 eliminated EV: P(correct) = 0.333, P(wrong) = 0.667
    const evOne = oneEliminatedCount * (0.333 * marksPerQ - 0.667 * penaltyPerQ);

    // Blind guess EV: P(correct) = 0.25, P(wrong) = 0.75
    const evBlind = blindGuessCount * (0.25 * marksPerQ - 0.75 * penaltyPerQ);

    const expectedScore = Math.max(0, sureScore + evFifty + evOne + evBlind);

    // Standard deviation approximation for variance bounds
    const variance =
      fiftyFiftyCount * (0.25 * Math.pow(marksPerQ + penaltyPerQ, 2)) +
      oneEliminatedCount * (0.222 * Math.pow(marksPerQ + penaltyPerQ, 2)) +
      blindGuessCount * (0.1875 * Math.pow(marksPerQ + penaltyPerQ, 2));

    const stdDev = Math.sqrt(variance);

    const bestCase = Math.max(0, expectedScore + 1.28 * stdDev); // ~80th percentile
    const worstCase = Math.max(0, expectedScore - 1.28 * stdDev); // ~20th percentile

    const marginToCutoff = expectedScore - targetCutoff;

    return {
      sureScore,
      evFifty,
      evOne,
      evBlind,
      expectedScore: Number(expectedScore.toFixed(2)),
      bestCase: Number(bestCase.toFixed(2)),
      worstCase: Number(worstCase.toFixed(2)),
      marginToCutoff: Number(marginToCutoff.toFixed(2)),
      isAboveCutoff: expectedScore >= targetCutoff
    };
  }, [sureCount, fiftyFiftyCount, oneEliminatedCount, blindGuessCount, marksPerQ, penaltyPerQ, targetCutoff]);

  const resetValues = () => {
    setSureCount(65);
    setFiftyFiftyCount(25);
    setOneEliminatedCount(15);
    setBlindGuessCount(0);
  };

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="section-heading flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow">
            {isHindi ? 'परीक्षा रणनीति और संभावना विश्लेषक' : 'EXAM STRATEGY & RISK SIMULATOR'}
          </div>
          <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900 flex items-center gap-2">
            <Target size={20} className="text-amber-500" />
            <span>{isHindi ? 'नेगेटिव मार्किंग व तुक्का रिस्क कैलकुलेटर' : 'Negative Marking & Cutoff Risk Simulator'}</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {isHindi
              ? 'गणितीय संभाव्यता (Expected Value) से जानें कि किन सवालों में रिस्क लेना फायदेमंद है'
              : 'Calculate expected score, cutoff safety margin and elimination odds'}
          </p>
        </div>
        <button
          type="button"
          onClick={resetValues}
          className="p-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 border dark:border-slate-700 border-slate-200"
        >
          <RotateCcw size={13} />
          <span>{isHindi ? 'रीसेट' : 'Reset'}</span>
        </button>
      </div>

      {/* Exam Presets */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold dark:text-slate-300 text-slate-700">
          {isHindi ? 'परीक्षा का चयन करें (Exam Pattern):' : 'Select Exam Pattern:'}
        </label>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[44px] flex items-center justify-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-glowIndigo font-black'
                    : 'dark:bg-slate-800 bg-slate-100 dark:text-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Cutoff & Scheme Configuration Bar */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-2xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200 text-center">
        <div>
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 block uppercase truncate">Marks/Right</span>
          <span className="text-xs sm:text-sm font-black text-emerald-500">+{marksPerQ}</span>
        </div>
        <div>
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 block uppercase truncate">Penalty/Wrong</span>
          <span className="text-xs sm:text-sm font-black text-rose-500">-{penaltyPerQ.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 block uppercase truncate">Target Cutoff</span>
          <input
            type="number"
            value={targetCutoff}
            onChange={(e) => setTargetCutoff(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 h-8 sm:h-9 mx-auto text-center font-black text-base sm:text-sm rounded-lg border dark:border-slate-700 border-slate-300 bg-white dark:bg-slate-900 outline-none text-amber-500"
          />
        </div>
      </div>

      {/* Question Attempt Categories Inputs */}
      <div className="space-y-3 pt-1">
        <h4 className="text-xs font-black dark:text-white text-slate-900 uppercase tracking-wider">
          {isHindi ? 'आपके प्रश्नों का विभाजन (Questions Breakdown):' : 'Attempt Breakdown by Confidence:'}
        </h4>

        {/* 1. 100% Sure Questions */}
        <div className="p-3.5 rounded-2xl border dark:border-emerald-500/30 border-emerald-200 dark:bg-emerald-950/20 bg-emerald-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={15} />
              <span>{isHindi ? '100% पक्के सवाल (Sure Questions)' : '100% Confident (Sure Answers)'}</span>
            </span>
            <strong className="text-sm font-black">{sureCount} Qs</strong>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            value={sureCount}
            onChange={(e) => setSureCount(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Accuracy: ~100%</span>
            <span>Yield: +{(sureCount * marksPerQ).toFixed(1)} marks</span>
          </div>
        </div>

        {/* 2. 50-50 Elimination (2 Options Eliminated) */}
        <div className="p-3.5 rounded-2xl border dark:border-indigo-500/30 border-indigo-200 dark:bg-indigo-950/20 bg-indigo-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Zap size={15} />
              <span>{isHindi ? '50-50 एलिमिनेशन (2 विकल्प हटा दिए)' : '50-50 Elimination (2 Options Eliminated)'}</span>
            </span>
            <strong className="text-sm font-black">{fiftyFiftyCount} Qs</strong>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            value={fiftyFiftyCount}
            onChange={(e) => setFiftyFiftyCount(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Probability: 50%</span>
            <span className={results.evFifty >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500'}>
              Expected Gain: {results.evFifty >= 0 ? `+${results.evFifty.toFixed(2)}` : results.evFifty.toFixed(2)} marks
            </span>
          </div>
        </div>

        {/* 3. 1 Option Eliminated (3 Options Remaining) */}
        <div className="p-3.5 rounded-2xl border dark:border-amber-500/30 border-amber-200 dark:bg-amber-950/20 bg-amber-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <HelpCircle size={15} />
              <span>{isHindi ? '1 विकल्प एलिमिनेट (3 में से अनुमान)' : '1 Option Eliminated (3 Choices Left)'}</span>
            </span>
            <strong className="text-sm font-black">{oneEliminatedCount} Qs</strong>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            value={oneEliminatedCount}
            onChange={(e) => setOneEliminatedCount(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Probability: 33.3%</span>
            <span className={results.evOne >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500'}>
              Expected Gain: {results.evOne >= 0 ? `+${results.evOne.toFixed(2)}` : results.evOne.toFixed(2)} marks
            </span>
          </div>
        </div>

        {/* 4. Pure Wild Guess / Blind Luck */}
        <div className="p-3.5 rounded-2xl border dark:border-rose-500/30 border-rose-200 dark:bg-rose-950/20 bg-rose-50/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={15} />
              <span>{isHindi ? 'अंधा तुक्का (कोई विकल्प नहीं हटा)' : 'Blind Guess (Wild / 4 Choices)'}</span>
            </span>
            <strong className="text-sm font-black">{blindGuessCount} Qs</strong>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            value={blindGuessCount}
            onChange={(e) => setBlindGuessCount(Number(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Probability: 25%</span>
            <span className={results.evBlind >= 0 ? 'text-slate-500 font-bold' : 'text-rose-500 font-black'}>
              Expected Net: {results.evBlind.toFixed(2)} marks (High Risk!)
            </span>
          </div>
        </div>
      </div>

      {/* RESULTS DISPLAY COCKPIT */}
      <div className="p-4 sm:p-5 rounded-3xl dark:bg-gradient-to-br dark:from-slate-900 dark:via-[#1E293B] dark:to-slate-900 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 border dark:border-indigo-500/30 border-indigo-200 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b dark:border-slate-700/60 border-slate-200 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block">
              {isHindi ? 'सिम्युलेटेड स्कोर परिणाम' : 'SIMULATED SCORE OUTCOME'}
            </span>
            <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900">
              {isHindi ? 'अनुमानित नेट स्कोर (Expected Score)' : 'Expected Net Score'}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {results.expectedScore}
            </div>
            <span className="text-[10px] font-bold text-slate-500">
              Attempted: {totalAttempted} Qs
            </span>
          </div>
        </div>

        {/* Score Range & Cut-off Comparison */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl dark:bg-slate-800/80 bg-white border dark:border-slate-700/40 border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 block flex items-center justify-center gap-1">
              <TrendingDown size={11} className="text-rose-500" />
              <span>Worst Case</span>
            </span>
            <strong className="text-sm font-black text-rose-500">{results.worstCase}</strong>
          </div>
          <div className="p-2.5 rounded-xl dark:bg-slate-800/80 bg-white border dark:border-slate-700/40 border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 block flex items-center justify-center gap-1">
              <Percent size={11} className="text-indigo-500" />
              <span>Target Cutoff</span>
            </span>
            <strong className="text-sm font-black dark:text-white text-slate-900">{targetCutoff}</strong>
          </div>
          <div className="p-2.5 rounded-xl dark:bg-slate-800/80 bg-white border dark:border-slate-700/40 border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 block flex items-center justify-center gap-1">
              <TrendingUp size={11} className="text-emerald-500" />
              <span>Best Case</span>
            </span>
            <strong className="text-sm font-black text-emerald-500">{results.bestCase}</strong>
          </div>
        </div>

        {/* Cut-off Safety Status Badge */}
        <div
          className={`p-3 rounded-2xl flex items-center gap-3 border ${
            results.isAboveCutoff
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {results.isAboveCutoff ? (
            <ShieldCheck size={22} className="text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle size={22} className="text-rose-500 shrink-0" />
          )}
          <div className="min-w-0 text-xs">
            <strong className="block font-black text-sm">
              {results.isAboveCutoff
                ? isHindi
                  ? `कट-ऑफ सुरक्षित है (+${results.marginToCutoff} अंक ऊपर)`
                  : `Safe Zone (+${results.marginToCutoff} above Cutoff)`
                : isHindi
                ? `कट-ऑफ से ${Math.abs(results.marginToCutoff)} अंक पीछे`
                : `Below Cutoff by ${Math.abs(results.marginToCutoff)} marks`}
            </strong>
            <span className="text-[11px] opacity-90 block leading-tight">
              {results.isAboveCutoff
                ? isHindi
                  ? 'आपकी वर्तमान रणनीति कट-ऑफ पार करने के लिए गणितीय रूप से पर्याप्त है।'
                  : 'Your strategy achieves positive mathematical expectation above the cutoff.'
                : isHindi
                ? 'कट-ऑफ पार करने के लिए 50-50 एलिमिनेशन वाले अधिक सवालों को अटेम्प्ट करना आवश्यक है।'
                : 'You need to attempt more 50-50 elimination questions to safely clear cutoff.'}
            </span>
          </div>
        </div>

        {/* Topper Mathematical Insights */}
        <div className="p-3.5 rounded-2xl dark:bg-slate-900/60 bg-white border dark:border-slate-700/50 border-slate-200 space-y-2 text-xs leading-relaxed">
          <div className="flex items-center gap-1.5 font-black text-amber-500">
            <Sparkles size={14} />
            <span>{isHindi ? 'टॉपर्स का गणितीय नियम (Topper Insight):' : 'Mathematical Rule of Competitive Exams:'}</span>
          </div>
          <p className="dark:text-slate-300 text-slate-700 font-medium">
            {isHindi ? (
              <>
                <strong>50-50 एलिमिनेशन वाले प्रश्न कभी न छोड़ें!</strong> 1/3 नेगेटिव मार्किंग में भी 50-50 गेस का Expected Score प्रति सवाल <strong>+0.33 अंक</strong> बढ़ाता है। 20 सवालों में यह औसतन <strong>+6 से +7 अतिरिक्त अंक</strong> देता है, जो कट-ऑफ पार कराने में निर्णायक होता है।
              </>
            ) : (
              <>
                <strong>Never skip 50-50 eliminated questions!</strong> Even with 1/3 negative marking, 50-50 elimination yields a positive expected value of <strong>+0.33 marks per question</strong> (+6 to +7 marks over 20 questions).
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

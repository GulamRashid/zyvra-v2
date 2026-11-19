import { useState } from 'react';
import { Check, Dices, HelpCircle, RotateCw, Sparkles } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const PRESET_ONE_COMMON = [
  {
    title: 'SSC CGL Standard Example (Common: 3)',
    title_hi: 'SSC CGL मानक उदाहरण (कॉमन: 3)',
    dice1: { top: 3, front: 1, right: 2 },
    dice2: { top: 3, front: 4, right: 5 },
    common: 3,
    opposites: [
      { a: 1, b: 4, reason: '1st clockwise step from 3' },
      { a: 2, b: 5, reason: '2nd clockwise step from 3' },
      { a: 3, b: 6, reason: 'Remaining opposite faces' }
    ]
  },
  {
    title: 'Railway NTPC Example (Common: 2)',
    title_hi: 'रेलवे NTPC उदाहरण (कॉमन: 2)',
    dice1: { top: 2, front: 6, right: 4 },
    dice2: { top: 2, front: 3, right: 1 },
    common: 2,
    opposites: [
      { a: 6, b: 3, reason: '1st clockwise step from 2' },
      { a: 4, b: 1, reason: '2nd clockwise step from 2' },
      { a: 2, b: 5, reason: 'Remaining opposite faces' }
    ]
  }
];

export default function DiceRules() {
  const { language } = useThemeLanguage();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab] = useState('one-common'); // 'one-common' | 'open-dice' | 'standard-dice'
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);

  // Open Dice Active Box
  const [selectedOpenBox, setSelectedOpenBox] = useState('A');

  // Standard dice validator state
  const [testFaces, setTestFaces] = useState([1, 2, 3]);

  const preset = PRESET_ONE_COMMON[selectedPresetIdx];

  // Open dice net model (Classic Cross/T-Shape Net)
  // Boxes:
  //      [ 1 ]
  // [ 5 ][ 2 ][ 6 ]
  //      [ 3 ]
  //      [ 4 ]
  // Opposites: 1 ↔ 3 (1-skip in column), 2 ↔ 4 (1-skip in column), 5 ↔ 6 (wings)
  const OPEN_DICE_BOXES = [
    { id: 1, label: '1', pairId: 3, name: 'Top Box' },
    { id: 2, label: '2', pairId: 4, name: 'Center Box' },
    { id: 3, label: '3', pairId: 1, name: 'Middle-Lower Box' },
    { id: 4, label: '4', pairId: 2, name: 'Bottom Box' },
    { id: 5, label: '5', pairId: 6, name: 'Left Wing' },
    { id: 6, label: '6', pairId: 5, name: 'Right Wing' }
  ];

  // Standard dice check logic
  // If any 2 adjacent faces sum to 7 => Ordinary dice!
  const hasSumSeven = (testFaces[0] + testFaces[1] === 7) ||
                      (testFaces[0] + testFaces[2] === 7) ||
                      (testFaces[1] + testFaces[2] === 7);

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="section-heading flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow">
            {isHindi ? 'रीजनिंग: पासा (DICE) शॉर्टकट' : 'REASONING: DICE RULES MASTER'}
          </div>
          <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900 flex items-center gap-2">
            <Dices size={18} className="text-amber-500" />
            <span>{isHindi ? 'पासा एवं विपरीत फलक सॉल्वर' : 'Interactive Dice & Opposite Face Solver'}</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {isHindi
              ? 'क्लॉकवाइज रोटेशन रूल, खुला पासा (Open Dice) और मानक बनाम साधारण पासा'
              : 'Clockwise rotation rule, open dice 1-skip rule & standard dice validator'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200">
        {[
          { id: 'one-common', label: isHindi ? '1 कॉमन सतह नियम' : '1 Common Face Rule' },
          { id: 'open-dice', label: isHindi ? 'खुला पासा (Open Net)' : 'Open Dice Net' },
          { id: 'standard-dice', label: isHindi ? 'मानक पासा जाँच' : 'Standard vs Ordinary' }
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center min-h-[42px] ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'dark:text-slate-300 text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ONE COMMON FACE RULE */}
      {activeTab === 'one-common' && (
        <div className="space-y-4">
          {/* Preset Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {PRESET_ONE_COMMON.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPresetIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedPresetIdx === idx
                    ? 'bg-indigo-600 text-white shadow-glowIndigo font-black'
                    : 'dark:bg-slate-800 bg-slate-100 dark:text-slate-300 text-slate-700'
                }`}
              >
                {isHindi ? p.title_hi : p.title}
              </button>
            ))}
          </div>

          {/* Visual 2-Dice Comparison */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs">
            {/* Dice Position 1 */}
            <div className="text-center space-y-2">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                {isHindi ? 'स्थिति 1 (Dice 1)' : 'Position 1'}
              </span>
              <div className="w-24 h-24 mx-auto relative rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/40 p-2 flex flex-col justify-between shadow-sm">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span className="text-[10px]">Top</span>
                  <strong className="text-base font-black text-amber-500 px-1 rounded bg-amber-500/15">
                    {preset.dice1.top}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    <span className="text-[9px] block text-slate-400">Front</span>
                    <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {preset.dice1.front}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] block text-slate-400">Right</span>
                    <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {preset.dice1.right}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Dice Position 2 */}
            <div className="text-center space-y-2">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                {isHindi ? 'स्थिति 2 (Dice 2)' : 'Position 2'}
              </span>
              <div className="w-24 h-24 mx-auto relative rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/40 p-2 flex flex-col justify-between shadow-sm">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span className="text-[10px]">Top</span>
                  <strong className="text-base font-black text-amber-500 px-1 rounded bg-amber-500/15">
                    {preset.dice2.top}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    <span className="text-[9px] block text-slate-400">Front</span>
                    <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {preset.dice2.front}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] block text-slate-400">Right</span>
                    <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {preset.dice2.right}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clockwise Step Rule Card */}
          <div className="p-3.5 rounded-2xl border dark:border-amber-500/30 border-amber-200 dark:bg-amber-950/20 bg-amber-50/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400">
              <RotateCw size={15} />
              <span>
                {isHindi
                  ? `नियम: कॉमन सतह (${preset.common}) से घड़ी की दिशा (Clockwise) में घूमें`
                  : `Rule: Rotate clockwise from common face (${preset.common})`}
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono font-bold dark:text-slate-200 text-slate-800">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 border-amber-100 flex items-center justify-between">
                <span>Dice 1 Rotation:</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {preset.dice1.top} ➔ {preset.dice1.front} ➔ {preset.dice1.right}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 border-amber-100 flex items-center justify-between">
                <span>Dice 2 Rotation:</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {preset.dice2.top} ➔ {preset.dice2.front} ➔ {preset.dice2.right}
                </span>
              </div>
            </div>
          </div>

          {/* Computed Opposite Results */}
          <div className="space-y-2">
            <span className="text-xs font-black dark:text-white text-slate-900 block">
              {isHindi ? '🎯 परिणाम: आमने-सामने के फलक (Opposite Faces):' : '🎯 Results: Opposite Face Pairs:'}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {preset.opposites.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl dark:bg-slate-900 bg-white border-2 border-emerald-500/40 text-center shadow-xs space-y-1"
                >
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {pair.a} <span className="text-slate-400 text-sm">↔</span> {pair.b}
                  </div>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {isHindi
                      ? idx === 2 ? 'शेष फलक' : `घड़ी की दिशा का ${idx + 1}वां चरण`
                      : pair.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPEN DICE NET (1-SKIP RULE) */}
      {activeTab === 'open-dice' && (
        <div className="space-y-4">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
            {isHindi
              ? '💡 1-Skip Rule: सीधे स्तंभ या पंक्ति में एक बॉक्स छोड़कर आने वाला बॉक्स हमेशा विपरीत (Opposite) होता है। दोनों बाहर निकले पंख (Wings 5 व 6) आपस में विपरीत होते हैं।'
              : '💡 1-Skip Rule: In straight lines, alternate boxes (skipping 1) are always opposite! The two outer wings (5 & 6) are also opposite to each other.'}
          </div>

          {/* Open Net Graphic */}
          <div className="p-4 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs flex flex-col items-center">
            {/* Box 1 */}
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-sm mb-1">
              1
            </div>

            {/* Row of Wings + Box 2 */}
            <div className="flex items-center gap-1 my-1">
              {/* Left Wing 5 */}
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center shadow-sm">
                5
              </div>
              {/* Center Box 2 */}
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                2
              </div>
              {/* Right Wing 6 */}
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center shadow-sm">
                6
              </div>
            </div>

            {/* Box 3 */}
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-sm my-1">
              3
            </div>

            {/* Box 4 */}
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white font-black text-base flex items-center justify-center shadow-sm mt-1">
              4
            </div>
          </div>

          {/* Opposite Pairs Breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center">
              <span className="text-[10px] uppercase font-bold text-indigo-500 block">1-Skip Column</span>
              <strong className="text-base font-black text-indigo-600 dark:text-indigo-400">1 ↔ 3</strong>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center">
              <span className="text-[10px] uppercase font-bold text-purple-500 block">1-Skip Column</span>
              <strong className="text-base font-black text-purple-600 dark:text-purple-400">2 ↔ 4</strong>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-500 block">Side Wings</span>
              <strong className="text-base font-black text-amber-600 dark:text-amber-400">5 ↔ 6</strong>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STANDARD VS ORDINARY DICE VALIDATOR */}
      {activeTab === 'standard-dice' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs space-y-2">
            <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900">
              {isHindi ? 'पासे के प्रकार पहचानें:' : 'Distinguish Dice Types:'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 space-y-1">
                <strong className="text-emerald-500 font-bold block">
                  {isHindi ? '1. मानक पासा (Standard Dice)' : '1. Standard Dice'}
                </strong>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  {isHindi
                    ? 'विपरीत सतहों का योग 7 होता है (1↔6, 2↔5, 3↔4)। किसी भी दो पड़ोसी सतहों का योग 7 कभी नहीं होगा!'
                    : 'Opposite faces always sum to 7 (1↔6, 2↔5, 3↔4). Adjacent faces NEVER sum to 7.'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 space-y-1">
                <strong className="text-rose-500 font-bold block">
                  {isHindi ? '2. साधारण पासा (Ordinary Dice)' : '2. Ordinary Dice'}
                </strong>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  {isHindi
                    ? 'यदि किन्हीं भी 2 दिखाई देने वाली पड़ोसी सतहों का योग 7 हो जाए, तो वह साधारण पासा है।'
                    : 'If ANY two visible adjacent faces sum to 7, it is guaranteed to be an Ordinary Dice.'}
                </p>
              </div>
            </div>
          </div>

          {/* Test 3 Adjacent Faces */}
          <div className="space-y-2">
            <span className="text-xs font-bold dark:text-slate-300 text-slate-700 block">
              {isHindi ? 'दिखाई देने वाले 3 फलक चुनें (Test 3 Faces):' : 'Select 3 visible faces:'}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((pos) => (
                <div key={pos} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">
                    {isHindi ? `फलक ${pos + 1}` : `Face ${pos + 1}`}
                  </label>
                  <select
                    value={testFaces[pos]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTestFaces((prev) => {
                        const copy = [...prev];
                        copy[pos] = val;
                        return copy;
                      });
                    }}
                    className="w-full py-2 px-3 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white font-black text-sm text-center outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Verdict */}
            <div className={`p-3.5 rounded-2xl border text-center space-y-1 ${
              hasSumSeven
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              <strong className="block text-sm font-black">
                {hasSumSeven
                  ? (isHindi ? '⚠️ यह साधारण पासा (Ordinary Dice) है!' : '⚠️ This is an Ordinary Dice!')
                  : (isHindi ? '✅ यह मानक पासा (Standard Dice) हो सकता है!' : '✅ This can be a Standard Dice!')}
              </strong>
              <small className="block text-[11px] opacity-80">
                {hasSumSeven
                  ? (isHindi
                      ? 'क्योंकि 2 पड़ोसी सतहों का योग 7 हो रहा है (इसलिए वे विपरीत नहीं हो सकतीं)।'
                      : 'Because adjacent faces sum to 7, meaning they cannot be on opposite sides.')
                  : (isHindi
                      ? 'किसी भी 2 पड़ोसी सतहों का योग 7 नहीं है। इसलिए विपरीत सतहों का योग 7 संभव है।'
                      : 'No adjacent faces sum to 7, satisfying standard dice criteria.')}
              </small>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

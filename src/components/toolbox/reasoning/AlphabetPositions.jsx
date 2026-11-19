import { useMemo, useState } from 'react';
import { Binary, Check, Copy, Hash, Sparkles, Wand2 } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const EJOTY = [
  { letter: 'E', pos: 5 },
  { letter: 'J', pos: 10 },
  { letter: 'O', pos: 15 },
  { letter: 'T', pos: 20 },
  { letter: 'Y', pos: 25 }
];

const CFILORUX = [
  { letter: 'C', pos: 3 },
  { letter: 'F', pos: 6 },
  { letter: 'I', pos: 9 },
  { letter: 'L', pos: 12 },
  { letter: 'O', pos: 15 },
  { letter: 'R', pos: 18 },
  { letter: 'U', pos: 21 },
  { letter: 'X', pos: 24 }
];

// Classic Indian competitive exam mnemonics for opposite letters (Sum = 27)
const OPPOSITE_PAIRS = [
  { a: 'A', b: 'Z', mnemonic: 'Azad', hindi: 'आज़ाद (A-Z)' },
  { a: 'B', b: 'Y', mnemonic: 'Boy', hindi: 'बॉय (B-Y)' },
  { a: 'C', b: 'X', mnemonic: 'Crux / Crax', hindi: 'क्रैक्स (C-X)' },
  { a: 'D', b: 'W', mnemonic: 'Dew', hindi: 'माउंटेन ड्यू (D-W)' },
  { a: 'E', b: 'V', mnemonic: 'EVen / Love', hindi: 'इवन / लव (E-V)' },
  { a: 'F', b: 'U', mnemonic: 'FUn / For U', hindi: 'फन (F-U)' },
  { a: 'G', b: 'T', mnemonic: 'GT Road', hindi: 'जीटी रोड (G-T)' },
  { a: 'H', b: 'S', mnemonic: 'High School', hindi: 'हाई स्कूल (H-S)' },
  { a: 'I', b: 'R', mnemonic: 'Indian Railway', hindi: 'इंडियन रेलवे (I-R)' },
  { a: 'J', b: 'Q', mnemonic: 'Jungle Queen', hindi: 'जंगल क्वीन / रानी (J-Q)' },
  { a: 'K', b: 'P', mnemonic: 'Kanpur / Kurta Pajama', hindi: 'कानपुर (K-P)' },
  { a: 'L', b: 'O', mnemonic: 'LOve', hindi: 'लव (L-O)' },
  { a: 'M', b: 'N', mnemonic: 'MaN', hindi: 'मैन (M-N)' }
];

export default function AlphabetPositions() {
  const { language } = useThemeLanguage();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab] = useState('mnemonics'); // 'mnemonics' | 'grid' | 'decoder'
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [decoderWord, setDecoderWord] = useState('ZYVRA');
  const [copied, setCopied] = useState(false);

  // Selected letter stats
  const letterIndex = ALPHABET.indexOf(selectedLetter);
  const forwardPos = letterIndex + 1;
  const reversePos = 26 - letterIndex;
  const oppositeLetter = ALPHABET[25 - letterIndex];
  const pairMnemonic = OPPOSITE_PAIRS.find(
    (p) => p.a === selectedLetter || p.b === selectedLetter
  );

  // Decoder word calculation
  const cleanWord = decoderWord.toUpperCase().replace(/[^A-Z]/g, '');
  const decodedStats = useMemo(() => {
    if (!cleanWord) return null;
    const chars = cleanWord.split('');
    let forwardSum = 0;
    let reverseSum = 0;

    const breakdown = chars.map((char) => {
      const idx = ALPHABET.indexOf(char);
      const fPos = idx + 1;
      const rPos = 26 - idx;
      const opp = ALPHABET[25 - idx];
      forwardSum += fPos;
      reverseSum += rPos;
      return { char, fPos, rPos, opp };
    });

    const oppositeWord = breakdown.map((b) => b.opp).join('');
    const shiftPlusOne = breakdown.map((b) => ALPHABET[(ALPHABET.indexOf(b.char) + 1) % 26]).join('');
    const shiftMinusOne = breakdown.map((b) => ALPHABET[(ALPHABET.indexOf(b.char) - 1 + 26) % 26]).join('');

    return {
      chars: breakdown,
      forwardSum,
      reverseSum,
      oppositeWord,
      shiftPlusOne,
      shiftMinusOne
    };
  }, [cleanWord]);

  const copyText = (txt) => {
    navigator.clipboard?.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="section-heading flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow">
            {isHindi ? 'रीजनिंग: कोडिंग-डिकोडिंग मास्टर' : 'REASONING: CODING & DECODING'}
          </div>
          <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900 flex items-center gap-2">
            <Binary size={18} className="text-indigo-500" />
            <span>{isHindi ? 'अक्षर स्थान एवं याद रखने की ट्रिक्स' : 'Alphabet Positions & Memory Tricks'}</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {isHindi
              ? 'EJOTY, विपरीत अक्षरों के mnemonic शब्द (Azad, Boy...) और लाइव वर्ड डिकोडर'
              : 'EJOTY formula, opposite letter mnemonics (A-Z to M-N) & word decoder'}
          </p>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200">
        {[
          { id: 'mnemonics', label: isHindi ? 'स्मरण ट्रिक्स (EJOTY)' : 'Memory Tricks (EJOTY)', icon: Sparkles },
          { id: 'grid', label: isHindi ? 'A-Z तालिका (Positions)' : 'A-Z Grid (1 to 26)', icon: Hash },
          { id: 'decoder', label: isHindi ? 'वर्ड डिकोडर (Word Solver)' : 'Word Decoder', icon: Wand2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-glowIndigo font-black'
                  : 'dark:text-slate-300 text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: MNEMONICS & SHORTCUTS */}
      {activeTab === 'mnemonics' && (
        <div className="space-y-4">
          {/* EJOTY & CFILORUX Banners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* EJOTY */}
            <div className="p-3.5 rounded-2xl border dark:border-indigo-500/30 border-indigo-200 dark:bg-indigo-950/20 bg-indigo-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 dark:text-indigo-400">
                  {isHindi ? '5 का पहाड़ा (Table of 5)' : '5x Multiples Rule'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                  E-J-O-T-Y
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {EJOTY.map((item) => (
                  <button
                    key={item.letter}
                    type="button"
                    onClick={() => {
                      setSelectedLetter(item.letter);
                      setActiveTab('grid');
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 border-indigo-200 shadow-xs hover:border-indigo-500 transition-colors"
                  >
                    <strong className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                      {item.letter}
                    </strong>
                    <span className="text-xs font-bold text-slate-500">{item.pos}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                {isHindi
                  ? '💡 EJOTY से किसी भी अक्षर का स्थान 1 सेकंड में निकालें (उदा: H = J - 2 = 10 - 2 = 8)'
                  : '💡 Use EJOTY to deduce any letter position quickly (e.g., H is J-2 = 10-2 = 8)'}
              </p>
            </div>

            {/* CFILORUX */}
            <div className="p-3.5 rounded-2xl border dark:border-amber-500/30 border-amber-200 dark:bg-amber-950/20 bg-amber-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                  {isHindi ? '3 का पहाड़ा (Table of 3)' : '3x Multiples Rule'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300">
                  C-F-I-L-O-R-U-X
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {CFILORUX.map((item) => (
                  <button
                    key={item.letter}
                    type="button"
                    onClick={() => {
                      setSelectedLetter(item.letter);
                      setActiveTab('grid');
                    }}
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 border-amber-200 shadow-xs hover:border-amber-500 transition-colors"
                  >
                    <strong className="block text-sm font-black text-amber-600 dark:text-amber-400">
                      {item.letter}
                    </strong>
                    <span className="text-[11px] font-bold text-slate-500">{item.pos}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                {isHindi
                  ? '💡 3 की टेबल याद रखने से कठिन रीजनिंग कोडिंग बहुत आसान हो जाती है'
                  : '💡 The 3x table gives accurate anchor points for all surrounding letters'}
              </p>
            </div>
          </div>

          {/* Opposite Letters Mnemonics Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5">
                <span>🔄</span>
                <span>{isHindi ? 'विपरीत अक्षरों के याद रखने वाले शब्द (Sum = 27)' : 'Opposite Pairs & Memory Tricks (Sum = 27)'}</span>
              </h4>
              <span className="text-[10px] font-bold text-indigo-500">13 Pairs</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OPPOSITE_PAIRS.map((pair) => (
                <div
                  key={pair.a}
                  className="p-2.5 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 border border-indigo-500/20">
                      {pair.a}↔{pair.b}
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-xs font-bold dark:text-white text-slate-900 truncate">
                        {pair.mnemonic}
                      </strong>
                      <small className="block text-[10px] text-slate-400 truncate">
                        {isHindi ? pair.hindi : `${ALPHABET.indexOf(pair.a) + 1} + ${ALPHABET.indexOf(pair.b) + 1} = 27`}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: A-Z INTERACTIVE GRID */}
      {activeTab === 'grid' && (
        <div className="space-y-3">
          {/* Active Letter Inspector Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-glowIndigo">
                {selectedLetter}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400">
                  {isHindi ? 'चयनित अक्षर' : 'Selected Letter'}
                </span>
                <div className="text-xs sm:text-sm font-bold dark:text-white text-slate-900">
                  {isHindi ? 'आगे से स्थान:' : 'Forward Pos:'} <strong className="text-emerald-500 font-black">{forwardPos}</strong> | {isHindi ? 'पीछे से:' : 'Reverse:'} <strong className="text-amber-500 font-black">{reversePos}</strong>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isHindi ? 'विपरीत अक्षर:' : 'Opposite:'} <strong className="text-indigo-600 dark:text-indigo-400">{oppositeLetter}</strong> {pairMnemonic ? `(${pairMnemonic.mnemonic})` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Letter Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
            {ALPHABET.map((char, index) => {
              const pos = index + 1;
              const isSelected = selectedLetter === char;
              const isEjoty = [5, 10, 15, 20, 25].includes(pos);

              return (
                <button
                  key={char}
                  type="button"
                  onClick={() => setSelectedLetter(char)}
                  className={`p-2 rounded-xl text-center border transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-glowIndigo scale-105 z-10'
                      : isEjoty
                      ? 'dark:bg-amber-950/30 bg-amber-50/80 border-amber-300 dark:border-amber-600/40 text-amber-700 dark:text-amber-300 hover:border-amber-500'
                      : 'dark:bg-slate-900 bg-white dark:border-slate-800 border-slate-200 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                  }`}
                >
                  <strong className="text-sm font-black">{char}</strong>
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {pos}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            {isHindi
              ? '💡 अक्षरों के आगे और पीछे के स्थान का योग हमेशा 27 होता है (Forward + Reverse = 27)'
              : '💡 Note: The sum of forward and reverse positions of any letter is always 27 (e.g. A: 1 + 26 = 27)'}
          </p>
        </div>
      )}

      {/* VIEW 3: LIVE WORD DECODER */}
      {activeTab === 'decoder' && (
        <div className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
              {isHindi ? 'कोई भी शब्द टाइप करें (Coding Test):' : 'Enter any word to decode:'}
            </span>
            <input
              type="text"
              value={decoderWord}
              maxLength={25}
              onChange={(e) => setDecoderWord(e.target.value)}
              placeholder="e.g. SSC, REASONING, ZYVRA..."
              className="w-full px-3.5 py-2.5 rounded-xl border dark:border-slate-700 border-slate-300 dark:bg-slate-900 bg-white font-mono uppercase text-base tracking-widest outline-none focus:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-black"
            />
          </label>

          {decodedStats ? (
            <div className="space-y-3">
              {/* Letters Breakdown Row */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {decodedStats.chars.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-200 text-center min-w-[50px] shadow-xs"
                  >
                    <strong className="block text-base font-black text-indigo-600 dark:text-indigo-400">
                      {item.char}
                    </strong>
                    <div className="text-[10px] font-bold text-emerald-500">+{item.fPos}</div>
                    <div className="text-[9px] text-slate-400">rev: {item.rPos}</div>
                    <div className="text-[9px] font-extrabold text-amber-500 mt-0.5">opp: {item.opp}</div>
                  </div>
                ))}
              </div>

              {/* Aggregated Exam Coding Results */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isHindi ? 'अंकों का कुल योग' : 'Forward Sum'}
                  </span>
                  <strong className="text-base font-black text-emerald-500">{decodedStats.forwardSum}</strong>
                </div>
                <div className="p-3 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isHindi ? 'उल्टे अंकों का योग' : 'Reverse Sum'}
                  </span>
                  <strong className="text-base font-black text-amber-500">{decodedStats.reverseSum}</strong>
                </div>
                <div className="p-3 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isHindi ? 'विपरीत कोड (Opposite)' : 'Opposite Word'}
                  </span>
                  <strong className="text-base font-black text-indigo-500">{decodedStats.oppositeWord}</strong>
                </div>
                <div className="p-3 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isHindi ? '+1 शिफ्ट कोड' : '+1 Shift'}
                  </span>
                  <strong className="text-base font-black text-purple-500">{decodedStats.shiftPlusOne}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyText(`Word: ${cleanWord} | Forward Sum: ${decodedStats.forwardSum} | Opposite: ${decodedStats.oppositeWord}`)}
                className="w-full py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? (isHindi ? 'कॉपी हो गया!' : 'Copied!') : (isHindi ? 'डिकोडर परिणाम कॉपी करें' : 'Copy Decode Results')}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500">
              {isHindi ? 'कृपया कोई शब्द टाइप करें।' : 'Please type a word above.'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

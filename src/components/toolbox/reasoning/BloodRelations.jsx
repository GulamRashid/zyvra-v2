import { useState } from 'react';
import { Brain, Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const KINSHIP_MATRIX = [
  {
    generation: '+2',
    nameEn: 'Grandparents Generation (+2)',
    nameHi: 'दादा-दादी / नाना-नानी पीढ़ी (+2)',
    relations: [
      { en: "Father's Father", hi: 'दादा (Paternal Grandfather)' },
      { en: "Father's Mother", hi: 'दादी (Paternal Grandmother)' },
      { en: "Mother's Father", hi: 'नाना (Maternal Grandfather)' },
      { en: "Mother's Mother", hi: 'नानी (Maternal Grandmother)' }
    ]
  },
  {
    generation: '+1',
    nameEn: 'Parents & Uncles/Aunts (+1)',
    nameHi: 'माता-पिता, चाचा, मामा, बुआ, मौसी (+1)',
    relations: [
      { en: 'Father / Mother', hi: 'पिता / माता' },
      { en: "Father's Brother", hi: 'चाचा / ताऊ (Paternal Uncle)' },
      { en: "Father's Sister", hi: 'बुआ (Paternal Aunt)' },
      { en: "Mother's Brother", hi: 'मामा (Maternal Uncle)' },
      { en: "Mother's Sister", hi: 'मौसी (Maternal Aunt)' },
      { en: "Father's Brother's Wife", hi: 'चाची / ताई' },
      { en: "Mother's Brother's Wife", hi: 'मामी' },
      { en: "Spouse's Father / Mother", hi: 'ससुर (Father-in-law) / सास (Mother-in-law)' }
    ]
  },
  {
    generation: '0',
    nameEn: 'Same Generation / Peers (0)',
    nameHi: 'समान पीढ़ी - भाई-बहन, कज़िन, जीवनसाथी (0)',
    relations: [
      { en: 'Husband / Wife', hi: 'पति / पत्नी (Spouse)' },
      { en: 'Own Brother / Sister', hi: 'सगा भाई / सगी बहन (Sibling)' },
      { en: 'Cousin (Uncle/Aunt child)', hi: 'चचेरा/ममेरा/फुफेरा/मौसेरा भाई-बहन' },
      { en: "Wife's/Husband's Brother", hi: 'साला / देवर / जेठ / जीजा (Brother-in-law)' },
      { en: "Wife's/Husband's Sister", hi: 'साली / ननद / भाभी (Sister-in-law)' }
    ]
  },
  {
    generation: '-1',
    nameEn: 'Children & Nieces/Nephews (-1)',
    nameHi: 'बच्चे, भतीजे/भांजे (-1)',
    relations: [
      { en: 'Son / Daughter', hi: 'बेटा / बेटी' },
      { en: "Brother's Son / Daughter", hi: 'भतीजा (Nephew) / भतीजी (Niece)' },
      { en: "Sister's Son / Daughter", hi: 'भांजा (Nephew) / भांजी (Niece)' },
      { en: "Son's Wife", hi: 'बहू / पुत्रवधू (Daughter-in-law)' },
      { en: "Daughter's Husband", hi: 'दामाद (Son-in-law)' }
    ]
  },
  {
    generation: '-2',
    nameEn: 'Grandchildren (-2)',
    nameHi: 'पोता-पोती / नाती-नातिन (-2)',
    relations: [
      { en: "Son's Children", hi: 'पोता (Grandson) / पोती (Granddaughter)' },
      { en: "Daughter's Children", hi: 'नाती (Grandson) / नातिन (Granddaughter)' }
    ]
  }
];

const CHAIN_PRESETS = [
  {
    id: 'p1',
    phraseEn: "My father's only son",
    phraseHi: 'मेरे पिता का इकलौता पुत्र',
    gender: 'If speaker is Male',
    resultEn: 'Myself (Self)',
    resultHi: 'स्वयं (मैं खुद)',
    gen: '0'
  },
  {
    id: 'p2',
    phraseEn: "My father's only daughter",
    phraseHi: 'मेरे पिता की इकलौती पुत्री',
    gender: 'If speaker is Female',
    resultEn: 'Myself (Self)',
    resultHi: 'स्वयं (मैं खुद)',
    gen: '0'
  },
  {
    id: 'p3',
    phraseEn: "My mother's brother's only sister",
    phraseHi: 'मेरी माँ के भाई की इकलौती बहन',
    gender: 'Universal',
    resultEn: 'Mother',
    resultHi: 'माता (Mother)',
    gen: '+1'
  },
  {
    id: 'p4',
    phraseEn: "My father's brother's son",
    phraseHi: 'मेरे पिता के भाई का बेटा',
    gender: 'Universal',
    resultEn: 'Cousin (Paternal)',
    resultHi: 'चचेरा भाई (Cousin)',
    gen: '0'
  },
  {
    id: 'p5',
    phraseEn: "My wife's father's only son",
    phraseHi: 'मेरी पत्नी के पिता का इकलौता बेटा',
    gender: 'Universal',
    resultEn: 'Brother-in-law (Sala)',
    resultHi: 'साला (Brother-in-law)',
    gen: '0'
  },
  {
    id: 'p6',
    phraseEn: "My grandfather's only son's daughter",
    phraseHi: 'मेरे दादा के इकलौते बेटे की बेटी',
    gender: 'Universal',
    resultEn: 'Sister (or Self if Female)',
    resultHi: 'सगी बहन (या स्वयं)',
    gen: '0'
  }
];

export default function BloodRelations() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';
  const [activeTab, setActiveTab] = useState('chains'); // 'chains' | 'matrix' | 'symbols'

  // Interactive 2-step relation builder
  const [startPerson, setStartPerson] = useState('father');
  const [step1, setStep1] = useState('brother');
  const [step2, setStep2] = useState('son');

  // Compute chain result
  const solveChain = () => {
    const key = `${startPerson}-${step1}-${step2}`;
    const solutions = {
      'father-brother-son': { en: 'Cousin (Father\'s nephew)', hi: 'चचेरा भाई (Cousin)', gen: '0' },
      'father-brother-daughter': { en: 'Cousin (Father\'s niece)', hi: 'चचेरी बहन (Cousin)', gen: '0' },
      'father-sister-son': { en: 'Cousin (Bua\'s son)', hi: 'फुफेरा भाई (Cousin)', gen: '0' },
      'father-sister-daughter': { en: 'Cousin (Bua\'s daughter)', hi: 'फुफेरी बहन (Cousin)', gen: '0' },
      'father-father-son': { en: 'Father or Uncle (Chacha/Tau)', hi: 'पिता या चाचा/ताऊ', gen: '+1' },
      'mother-brother-son': { en: 'Cousin (Mama\'s son)', hi: 'ममेरा भाई (Cousin)', gen: '0' },
      'mother-brother-daughter': { en: 'Cousin (Mama\'s daughter)', hi: 'ममेरी बहन (Cousin)', gen: '0' },
      'mother-sister-son': { en: 'Cousin (Mausi\'s son)', hi: 'मौसेरा भाई (Cousin)', gen: '0' },
      'mother-father-daughter': { en: 'Mother or Mausi', hi: 'माता या मौसी', gen: '+1' },
      'brother-wife-brother': { en: 'Brother-in-law of brother', hi: 'भाभी का भाई', gen: '0' },
      'sister-husband-sister': { en: 'Sister-in-law of sister', hi: 'जीजा की बहन', gen: '0' }
    };

    return solutions[key] || {
      en: `${startPerson}'s ${step1}'s ${step2}`,
      hi: `रिश्ता: ${startPerson} ➔ ${step1} ➔ ${step2}`,
      gen: 'Varies'
    };
  };

  const chainResult = solveChain();

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <Brain size={14} />
            {isHi ? 'रीजनिंग टूलकिट' : 'Reasoning Toolkit'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'रक्त संबंध मास्टर (Blood Relations Solver)' : 'Blood Relations Master & Solver'}
          </h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('chains')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'chains'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'चेन सॉल्वर' : 'Chain Solver'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'matrix'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'पीढ़ी चार्ट (Matrix)' : 'Gen Matrix'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('symbols')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'symbols'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'प्रतीक नियम' : 'Symbols'}
          </button>
        </div>
      </div>

      {/* ================= TAB 1: INTERACTIVE CHAIN SOLVER ================= */}
      {activeTab === 'chains' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20">
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} />
              {isHi ? 'लाइव 3-स्टेप रिलेशन बिल्डर' : 'Live 3-Step Relation Chain Builder'}
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-4">
              {isHi
                ? 'एग्जाम में पूछे जाने वाले उलझाऊ रिश्तों को टुकड़ों में तोड़कर तुरंत समझें:'
                : 'Break down complex exam phrasing ("A is the father of B\'s brother\'s daughter"): '}
            </p>

            {/* Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '1. शुरुआती व्यक्ति (Start)' : '1. Start Person'}
                </label>
                <select
                  value={startPerson}
                  onChange={(e) => setStartPerson(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="father">{isHi ? 'मेरे पिता (My Father)' : 'My Father'}</option>
                  <option value="mother">{isHi ? 'मेरी माँ (My Mother)' : 'My Mother'}</option>
                  <option value="brother">{isHi ? 'मेरा भाई (My Brother)' : 'My Brother'}</option>
                  <option value="sister">{isHi ? 'मेरी बहन (My Sister)' : 'My Sister'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '2. उनका/उनकी (Relation 1)' : '2. Their Relation'}
                </label>
                <select
                  value={step1}
                  onChange={(e) => setStep1(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="brother">{isHi ? 'का भाई (Brother)' : 'Brother'}</option>
                  <option value="sister">{isHi ? 'की बहन (Sister)' : 'Sister'}</option>
                  <option value="father">{isHi ? 'के पिता (Father)' : 'Father'}</option>
                  <option value="wife">{isHi ? 'की पत्नी (Wife)' : 'Wife'}</option>
                  <option value="husband">{isHi ? 'के पति (Husband)' : 'Husband'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 block">
                  {isHi ? '3. का/की (Relation 2)' : '3. Target Child/Relative'}
                </label>
                <select
                  value={step2}
                  onChange={(e) => setStep2(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="son">{isHi ? 'का बेटा (Son)' : 'Son'}</option>
                  <option value="daughter">{isHi ? 'की बेटी (Daughter)' : 'Daughter'}</option>
                  <option value="brother">{isHi ? 'का भाई (Brother)' : 'Brother'}</option>
                  <option value="sister">{isHi ? 'की बहन (Sister)' : 'Sister'}</option>
                </select>
              </div>
            </div>

            {/* Live Result Box */}
            <div className="p-4 rounded-xl bg-purple-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-purple-200">
                  {isHi ? 'अंतिम रिश्ता (Final Relationship)' : 'Final Relationship'}
                </div>
                <div className="text-lg font-black mt-0.5">
                  {isHi ? chainResult.hi : chainResult.en}
                </div>
                <div className="text-xs text-purple-200 mt-1 flex items-center gap-1.5">
                  <span>{isHi ? 'पीढ़ी अंतर:' : 'Generation Gap:'}</span>
                  <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded-md">
                    {chainResult.gen === '0' ? (isHi ? 'समान पीढ़ी (Gen 0)' : 'Same Gen (0)') : chainResult.gen}
                  </span>
                </div>
              </div>
              <div className="text-right sm:text-left border-t sm:border-t-0 sm:border-l border-white/20 pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200 block">
                  {isHi ? 'चेन पाथ:' : 'Chain Path:'}
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  You ➔ {startPerson} ➔ {step1} ➔ {step2}
                </span>
              </div>
            </div>
          </div>

          {/* High Yield SSC Exam Chain Presets */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
              <BookOpen size={14} className="text-purple-500" />
              {isHi ? 'SSC / Railways में बार-बार पूछे जाने वाले गोल्डन फॉर्मूले' : 'Frequently Asked Golden Exam Chains'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHAIN_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 shadow-2xs hover:border-purple-400 transition-colors"
                >
                  <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {isHi ? preset.phraseHi : preset.phraseEn}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1">
                      <ArrowRight size={13} className="text-neutral-400" />
                      {isHi ? preset.resultHi : preset.resultEn}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
                      Gen {preset.gen}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: GENERATION MATRIX ================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            {isHi
              ? 'पीढ़ी (Generation) के आधार पर रिश्तों का वर्गीकरण। परीक्षा में सवाल हल करते समय हमेशा पीढ़ी का स्तर (+2 से -2) देखें:'
              : 'Classification of kinship by generation levels (+2 to -2). Use these levels to eliminate options fast in competitive exams:'}
          </p>

          <div className="space-y-2.5">
            {KINSHIP_MATRIX.map((gen) => (
              <div
                key={gen.generation}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/70"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <span className="font-mono bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded text-[11px] font-bold">
                      {gen.generation}
                    </span>
                    {isHi ? gen.nameHi : gen.nameEn}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {gen.relations.map((rel, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 text-[11px]"
                    >
                      <div className="font-bold text-neutral-800 dark:text-neutral-200">
                        {isHi ? rel.hi : rel.en}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {isHi ? rel.en : rel.hi}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: STANDARD EXAM SYMBOLS ================= */}
      {activeTab === 'symbols' && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            {isHi
              ? 'एग्जाम में रफ शीट पर फैमिली ट्री बनाते समय इन मानक प्रतीकों का उपयोग करें ताकि 10 सेकंड में उत्तर निकल सके:'
              : 'Standard exam diagramming symbols to draw foolproof family trees on scratch paper in seconds:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-black text-base flex items-center justify-center shrink-0">
                [ + ]
              </div>
              <div>
                <strong className="text-xs text-neutral-900 dark:text-white block">
                  {isHi ? 'पुरुष (Male) = वर्ग या [+ ]' : 'Male = Square or [ + ]'}
                </strong>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isHi ? 'पुरुष सदस्य को हमेशा वर्ग या प्लस चिन्ह से दर्शाएं।' : 'Always denote male members with a square box or + sign.'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-black text-base flex items-center justify-center shrink-0">
                ( - )
              </div>
              <div>
                <strong className="text-xs text-neutral-900 dark:text-white block">
                  {isHi ? 'महिला (Female) = वृत्त या [ - ]' : 'Female = Circle or [ - ]'}
                </strong>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isHi ? 'महिला सदस्य को हमेशा गोले या माइनस चिन्ह से दर्शाएं।' : 'Always denote female members with a circle or - sign.'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-black text-base flex items-center justify-center shrink-0">
                ═
              </div>
              <div>
                <strong className="text-xs text-neutral-900 dark:text-white block">
                  {isHi ? 'विवाहित जोड़ा (Married Couple) = डबल लाइन (═)' : 'Married Couple = Double Line (═)'}
                </strong>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isHi ? 'पति और पत्नी के बीच दोहरी रेखा खींची जाती है (उदा. [A] ═ (B))।' : 'Connect husband and wife with double line.'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-black text-base flex items-center justify-center shrink-0">
                ──
              </div>
              <div>
                <strong className="text-xs text-neutral-900 dark:text-white block">
                  {isHi ? 'भाई-बहन (Siblings) = एकल क्षैतिज रेखा (──)' : 'Siblings = Single Horizontal Line (──)'}
                </strong>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isHi ? 'सगे भाई और बहनों के बीच एक सीधी रेखा खींची जाती है।' : 'Connect brothers and sisters with a single horizontal line.'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 flex items-start gap-3 sm:col-span-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black text-base flex items-center justify-center shrink-0">
                │
              </div>
              <div>
                <strong className="text-xs text-neutral-900 dark:text-white block">
                  {isHi ? 'पीढ़ी अंतर (Generation Gap) = ऊर्ध्वाधर रेखा (│)' : 'Generation Gap = Vertical Line (│)'}
                </strong>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isHi ? 'माता-पिता हमेशा ऊपर और बच्चे नीचे रहते हैं (उदा. [पिता] ➔ नीचे लाइन ➔ [बेटा])।' : 'Parents stay on the top line, vertical bar leads to children below.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
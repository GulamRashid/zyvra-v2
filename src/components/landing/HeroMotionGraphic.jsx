import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

const INITIAL_SECONDS = 14 * 60 + 32;

function formatTimer(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const SAMPLE_QUESTION = {
  chapterEn: 'NCERT Class 6 · History · Ch. 4',
  chapterHi: 'एनसीईआरटी कक्षा 6 · इतिहास · अध्याय 4',
  stemEn: 'Consider the following statements regarding the Great Bath at Mohenjodaro:',
  stemHi: 'मोहनजोदड़ो के महान स्नानागार (Great Bath) के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए:',
  statementsEn: [
    '1. It was lined with baked bricks and sealed with natural tar to make it watertight.',
    '2. Water was likely drawn from a nearby well and drained out after use.'
  ],
  statementsHi: [
    '1. इसे पकी ईंटों से बनाया गया था और पानी के रिसाव को रोकने के लिए प्राकृतिक चारकोल/तारकोल की परत चढ़ाई गई थी।',
    '2. इसमें पानी संभवतः पास के एक कुएँ से भरा जाता था और उपयोग के बाद खाली कर दिया जाता था।'
  ],
  promptEn: 'Which of the statements given above is/are correct?',
  promptHi: 'उपर्युक्त में से कौन-सा/से कथन सही है/हैं?',
  options: [
    { id: 'A', en: '1 only', hi: 'केवल 1' },
    { id: 'B', en: '2 only', hi: 'केवल 2' },
    { id: 'C', en: 'Both 1 and 2', hi: '1 और 2 दोनों' },
    { id: 'D', en: 'Neither 1 nor 2', hi: 'न तो 1, न ही 2' }
  ],
  correctId: 'C',
  explanationEn: 'Both statements are correct. The Great Bath in Mohenjodaro used bricks set in plaster and sealed with natural tar, with a well supply and drainage outlet.',
  explanationHi: 'दोनों कथन सही हैं। मोहनजोदड़ो के महान स्नानागार में ईंटों व प्लास्टर के साथ प्राकृतिक तारकोल का उपयोग हुआ था तथा जल निकासी की व्यवस्था थी।'
};

export default function HeroMotionGraphic({ isDark, isHindi }) {
  const [selected, setSelected] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : INITIAL_SECONDS));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-2xl shadow-black/40'
    : 'bg-white border-slate-200 text-slate-900 shadow-xl shadow-slate-900/5';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const subSurface = isDark ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200';

  const hasSelected = selected !== null;
  const isCorrect = selected === SAMPLE_QUESTION.correctId;

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl border overflow-hidden transition-colors ${cardSurface}`}
      aria-label={isHindi ? 'लाइव CBT प्रश्न पूर्वावलोकन' : 'Interactive CBT Quiz UI Preview'}
    >
      {/* Top Quiz Header Bar */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/70'}`}>
        <span className={`text-[11px] sm:text-xs font-semibold truncate ${mutedText}`}>
          {isHindi ? SAMPLE_QUESTION.chapterHi : SAMPLE_QUESTION.chapterEn}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums border ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}>
            <Clock size={12} className="text-indigo-500" />
            {formatTimer(secondsLeft)}
          </span>
          <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
            {isHindi ? 'हिं / EN' : 'EN / हिं'}
          </span>
        </div>
      </div>

      {/* Uniform Question Number Strip */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((num) => {
            const stateClass = num === 1
              ? (isDark ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
              : num === 2
                ? (isDark ? 'bg-indigo-600/20 border-indigo-400 text-indigo-200 ring-2 ring-indigo-500/40' : 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-600/20')
                : (isDark ? 'bg-slate-800/80 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500');
            return (
              <span
                key={num}
                className={`w-8 h-8 rounded-full border text-xs font-bold inline-flex items-center justify-center ${stateClass}`}
              >
                {num}
              </span>
            );
          })}
        </div>
        <span className={`text-[11px] font-medium ${mutedText}`}>
          {isHindi ? 'अभ्यास मोड' : 'Practice Mode'}
        </span>
      </div>

      {/* Question Stem & Statements */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="space-y-2">
          <p className={`text-xs sm:text-sm font-semibold leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isHindi ? SAMPLE_QUESTION.stemHi : SAMPLE_QUESTION.stemEn}
          </p>
          <div className={`p-3 rounded-xl border space-y-1.5 text-xs leading-relaxed ${subSurface} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {(isHindi ? SAMPLE_QUESTION.statementsHi : SAMPLE_QUESTION.statementsEn).map((stmt, idx) => (
              <p key={idx} className="m-0">{stmt}</p>
            ))}
          </div>
          <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {isHindi ? SAMPLE_QUESTION.promptHi : SAMPLE_QUESTION.promptEn}
          </p>
        </div>

        {/* Interactive Options A–D */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SAMPLE_QUESTION.options.map((opt) => {
            const active = selected === opt.id;
            const correctChoice = active && opt.id === SAMPLE_QUESTION.correctId;
            const optionStyle = active
              ? correctChoice
                ? (isDark ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' : 'border-emerald-500 bg-emerald-50 text-emerald-900')
                : (isDark ? 'border-amber-500/60 bg-amber-500/10 text-amber-200' : 'border-amber-500 bg-amber-50 text-amber-900')
              : (isDark ? 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50');
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs font-medium flex items-center gap-2.5 transition-colors ${optionStyle}`}
              >
                <span className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 ${
                  active
                    ? correctChoice
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                    : (isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700')
                }`}>
                  {opt.id}
                </span>
                <span className="truncate">{isHindi ? opt.hi : opt.en}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation Box — revealed only after an option is clicked (Practice Mode behavior) */}
        {hasSelected ? (
          <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
            isCorrect
              ? (isDark ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50/80 border-emerald-200 text-emerald-900')
              : (isDark ? 'bg-amber-950/30 border-amber-500/30 text-amber-200' : 'bg-amber-50/80 border-amber-200 text-amber-900')
          }`}>
            {isCorrect ? (
              <CheckCircle2 size={16} className={isDark ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-emerald-600 shrink-0 mt-0.5'} />
            ) : (
              <Sparkles size={16} className={isDark ? 'text-amber-400 shrink-0 mt-0.5' : 'text-amber-600 shrink-0 mt-0.5'} />
            )}
            <div>
              <span className="font-bold">
                {isCorrect
                  ? (isHindi ? 'सही उत्तर (C): ' : 'Correct (C): ')
                  : (isHindi ? 'सही उत्तर विकल्प C है: ' : 'Correct answer is Option C: ')}
              </span>
              <span>{isHindi ? SAMPLE_QUESTION.explanationHi : SAMPLE_QUESTION.explanationEn}</span>
            </div>
          </div>
        ) : (
          <p className={`text-[11px] m-0 ${mutedText}`}>
            {isHindi ? 'तुरंत जांच व व्याख्या देखने के लिए किसी विकल्प पर क्लिक करें।' : 'Select an option to check your answer and view explanation.'}
          </p>
        )}
      </div>
    </div>
  );
}

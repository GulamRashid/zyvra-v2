import { useState, useEffect } from 'react';
import {
  Calendar,
  Coins,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Globe2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MathRenderer from './MathRenderer';

export default function DailyChallengeModal({
  isOpen,
  onClose,
  initialChallenge,
  onChallengeCompleted
}) {
  const { user } = useAuth();
  const [challengeData, setChallengeData] = useState(initialChallenge || null);
  const [loading, setLoading] = useState(!initialChallenge);
  const [selectedOption, setSelectedOption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [language, setLanguage] = useState('en'); // 'en' | 'hi'
  const [error, setError] = useState('');

  // Fetch or sync challenge data
  useEffect(() => {
    if (!isOpen || !supabase) return;

    if (initialChallenge) {
      setChallengeData(initialChallenge);
      if (initialChallenge.attempted && initialChallenge.attempt) {
        setSelectedOption(initialChallenge.attempt.selected_option || '');
        setSubmissionResult({
          is_correct: initialChallenge.attempt.is_correct,
          correct_option: initialChallenge.question?.correct_answer,
          explanation: initialChallenge.question?.explanation,
          distractor_notes: initialChallenge.question?.distractor_notes,
          coins_awarded: initialChallenge.attempt.coins_awarded
        });
      }
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadToday() {
      setLoading(true);
      setError('');
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_today_daily_challenge');
        if (rpcErr) throw rpcErr;

        if (isMounted) {
          setChallengeData(data);
          if (data?.attempted && data?.attempt) {
            setSelectedOption(data.attempt.selected_option || '');
            setSubmissionResult({
              is_correct: data.attempt.is_correct,
              correct_option: data.question?.correct_answer,
              explanation: data.question?.explanation,
              distractor_notes: data.question?.distractor_notes,
              coins_awarded: data.attempt.coins_awarded
            });
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Could not load today challenge.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadToday();
    return () => { isMounted = false; };
  }, [isOpen, initialChallenge]);

  if (!isOpen) return null;

  const question = challengeData?.question;
  const hasHindi = Boolean(question?.question_text_hi && question.question_text_hi.trim());
  const isAttempted = Boolean(challengeData?.attempted || submissionResult);

  const handleSubmit = async () => {
    if (!selectedOption || !challengeData?.challenge_id || submitting || !user) return;

    setSubmitting(true);
    setError('');
    try {
      const { data, error: submitErr } = await supabase.rpc('submit_daily_challenge', {
        p_challenge_id: challengeData.challenge_id,
        p_selected_option: selectedOption
      });

      if (submitErr) throw submitErr;
      if (!data?.success && data?.error && !data?.already_attempted) {
        throw new Error(data.error);
      }

      setSubmissionResult(data);
      setChallengeData((prev) => ({
        ...prev,
        attempted: true,
        attempt: {
          selected_option: selectedOption,
          is_correct: data.is_correct,
          coins_awarded: data.coins_awarded
        },
        question: {
          ...prev?.question,
          correct_answer: data.correct_option,
          explanation: data.explanation,
          distractor_notes: data.distractor_notes
        }
      }));

      if (onChallengeCompleted) {
        onChallengeCompleted(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700/80 border-slate-300 dark:text-white text-slate-900 shadow-2xl my-6 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b dark:border-slate-800 border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-500">
                <Calendar size={12} />
                <span>Question of the Day · {challengeData?.target_date || 'Today'}</span>
              </div>
              <h3 className="text-sm sm:text-base font-black dark:text-white text-slate-900 leading-tight">
                Daily Brain Challenge
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reward Coins Pill */}
            <div className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black text-xs flex items-center gap-1">
              <Coins size={13} />
              <span>+{challengeData?.reward_coins || 10}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl dark:hover:bg-slate-800 hover:bg-slate-100 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="animate-spin w-6 h-6 mx-auto text-indigo-400" />
              <p>Fetching today's challenge...</p>
            </div>
          ) : !challengeData?.has_challenge || !question ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="font-bold text-slate-300">No challenge scheduled for today yet.</p>
              <p>Check back tomorrow morning to earn bonus Zyvra Coins!</p>
            </div>
          ) : (
            <>
              {/* Question Meta & Bilingual Toggle */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {question.subject || 'Daily Prep'}
                </span>

                {hasHindi && (
                  <button
                    type="button"
                    onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                    className="px-2.5 py-1 rounded-lg dark:bg-slate-800 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Globe2 size={12} />
                    <span>{language === 'en' ? 'हिंदी में पढ़ें' : 'Read in English'}</span>
                  </button>
                )}
              </div>

              {/* Question Text */}
              <div className="text-sm font-semibold dark:text-slate-100 text-slate-800 leading-relaxed dark:bg-[#1E293B]/70 bg-slate-50 p-4 rounded-2xl border dark:border-slate-700/60 border-slate-200">
                <MathRenderer
                  text={
                    language === 'hi' && question.question_text_hi
                      ? question.question_text_hi
                      : question.question_text
                  }
                />
              </div>

              {/* Options List */}
              <div className="space-y-2">
                {(question.options || []).map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = selectedOption === letter;

                  // Solution highlight states
                  let optionStateClasses = 'dark:bg-[#1E293B]/60 bg-white dark:border-slate-700/60 border-slate-300 dark:hover:border-indigo-400 hover:border-indigo-500 text-slate-300';

                  if (isAttempted && submissionResult) {
                    const correctLetter = submissionResult.correct_option;
                    if (letter === correctLetter) {
                      optionStateClasses = 'dark:bg-emerald-500/20 bg-emerald-50 border-emerald-500 text-emerald-400 font-bold';
                    } else if (isSelected && !submissionResult.is_correct) {
                      optionStateClasses = 'dark:bg-rose-500/20 bg-rose-50 border-rose-500 text-rose-400 font-bold';
                    } else {
                      optionStateClasses = 'dark:bg-[#1E293B]/30 bg-slate-50 dark:border-slate-800 border-slate-200 text-slate-500 opacity-60';
                    }
                  } else if (isSelected) {
                    optionStateClasses = 'dark:bg-indigo-600/25 bg-indigo-50 border-indigo-500 text-indigo-400 font-bold shadow-sm';
                  }

                  const optEn = typeof opt === 'string' ? opt : (opt?.en || opt?.text || '');
                  const optHi = typeof opt === 'object' && opt?.hi ? opt.hi : '';
                  const optText = (language === 'hi' && optHi) ? optHi : optEn;

                  return (
                    <div
                      key={letter}
                      onClick={() => !isAttempted && setSelectedOption(letter)}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                        !isAttempted ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
                      } ${optionStateClasses}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isSelected || (isAttempted && letter === submissionResult?.correct_option)
                            ? 'bg-indigo-600 text-white'
                            : 'dark:bg-slate-800 bg-slate-200 text-slate-400'
                        }`}
                      >
                        {letter}
                      </div>
                      <div className="text-xs font-medium dark:text-slate-200 text-slate-800 flex-1">
                        <MathRenderer text={optText} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Error feedback */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                  {error}
                </div>
              )}

              {/* Solution Feedback Box when Attempted */}
              {isAttempted && submissionResult && (
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    submissionResult.is_correct
                      ? 'dark:bg-emerald-500/10 bg-emerald-50 border-emerald-500/40 text-emerald-400'
                      : 'dark:bg-rose-500/10 bg-rose-50 border-rose-500/40 text-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-sm">
                    {submissionResult.is_correct ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                        <span>Brilliant! You solved today's challenge (+{submissionResult.coins_awarded} Coins) 🎉</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="text-rose-400 shrink-0" />
                        <span>Nice try! The correct answer was Option {submissionResult.correct_option}.</span>
                      </>
                    )}
                  </div>

                  {submissionResult.explanation && (
                    <div className="text-xs text-slate-300 dark:text-slate-200 pt-2 border-t dark:border-slate-700/60 border-slate-200 space-y-1">
                      <div className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">
                        Detailed Explanation:
                      </div>
                      <div className="leading-relaxed">
                        <MathRenderer text={submissionResult.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t dark:border-slate-800 border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 text-xs font-bold dark:text-slate-300 text-slate-700"
          >
            {isAttempted ? 'Close' : 'Cancel'}
          </button>

          {!isAttempted && challengeData?.has_challenge && (
            <button
              type="button"
              disabled={!selectedOption || submitting}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Answer</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

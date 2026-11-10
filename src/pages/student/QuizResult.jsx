import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Clock3, Coins, Languages, LoaderCircle, Sparkles, Target, Trophy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getOptionEntries, normalizeRpcObject, unwrapRpcPayload } from '../../lib/tests';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { translateText } from '../../lib/translator';

const valueOf = (result, ...keys) => {
  for (const key of keys) if (result[key] !== undefined && result[key] !== null) return result[key];
  return 0;
};

function getStoredHindi(value) {
  return value && typeof value === 'object' ? value.hi || value.text_hi || '' : '';
}

function getLocalizedEnglish(value) {
  if (typeof value === 'string') return value;
  return value?.en || value?.text || '';
}

function SolutionCard({ item, index, language, translations, translating }) {
  const question = item.question || item;
  const options = getOptionEntries(question.options);
  const explanation = item.explanation || question.explanation;
  const questionText = question.question_text_en
    || getLocalizedEnglish(question.question_text)
    || question.text
    || '';
  const questionHindi = question.question_text_hi || getStoredHindi(question.question_text) || question.text_hi || '';
  const explanationText = getLocalizedEnglish(explanation);
  const explanationHindi = question.explanation_hi || getStoredHindi(explanation) || getStoredHindi(question.explanation);
  const displayedQuestion = language === 'hi' ? questionHindi || translations.question || questionText : questionText;
  const displayedExplanation = language === 'hi' ? explanationHindi || translations.explanation || explanationText : explanationText;
  const selected = item.student_selected ?? item.selected_option ?? item.response?.selected_option ?? item.selected_answers ?? item.response?.selected_answers ?? null;
  const correct = item.correct_answer ?? item.answer_key ?? item.correct_option ?? null;
  const correctKey = Array.isArray(correct) ? correct[0] : correct;
  const chosenKey = Array.isArray(selected) ? selected[0] : selected;
  const hasSelection = Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
  const isCorrect = item.is_correct ?? item.response?.is_correct ?? (hasSelection && String(chosenKey).toUpperCase() === String(correctKey).toUpperCase());
  return <article className="solution-card">
    <div className="solution-question-heading">
      <span className={`solution-result-icon ${isCorrect ? 'correct' : hasSelection ? 'incorrect' : 'skipped'}`}>{isCorrect ? <CheckCircle2 size={16} /> : hasSelection ? <CircleX size={16} /> : <span>—</span>}</span>
      <div><span className="eyebrow">QUESTION {String(index + 1).padStart(2, '0')}</span>
        <h3 lang={language} aria-busy={translating}>{displayedQuestion || 'Question text unavailable.'}{language === 'hi' && !questionHindi && !translations.question && translating && <LoaderCircle className="translation-inline-spinner" size={14} aria-label="Translating" />}</h3>
      </div>
    </div>
    <div className="solution-options">{options.map(([key, option]) => {
    const text = getLocalizedEnglish(option);
    const hindiText = getStoredHindi(option) || translations[`option:${key}`];
    const displayedOption = language === 'hi' ? hindiText || text : text;
    const selectedOption = String(chosenKey || '').toUpperCase() === key;
    const correctOption = String(correctKey || '').toUpperCase() === key;
    return <div key={key} className={`solution-option ${correctOption ? 'correct-answer' : ''} ${selectedOption && !correctOption ? 'wrong-answer' : ''}`}><b>{key}</b><span lang={language}>{displayedOption}{language === 'hi' && !getStoredHindi(option) && !translations[`option:${key}`] && translating && <LoaderCircle className="translation-inline-spinner" size={12} aria-label="Translating" />}</span>{selectedOption && <em>Your answer</em>}{correctOption && <em>Correct answer</em>}</div>;
  })}</div>
    <div className="solution-answer-row"><span>Your answer: <strong>{Array.isArray(selected) && selected.length ? selected.join(', ') : chosenKey || 'Not answered'}</strong></span><span>Correct answer: <strong>{Array.isArray(correct) ? correct.join(', ') : correctKey || 'Unavailable'}</strong></span>{question.subject && <span className="subject-pill">{question.subject}</span>}</div>
    {explanation && <div className="solution-explanation"><strong>Explanation</strong><p lang={language}>{displayedExplanation}{language === 'hi' && !explanationHindi && !translations.explanation && translating && <LoaderCircle className="translation-inline-spinner" size={12} aria-label="Translating" />}</p></div>}
  </article>;
}

export default function QuizResult() {
  const { attemptId } = useParams();
  const { supabase, refreshAccount } = useAuth();
  const [result, setResult] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [currentSolutionIndex, setCurrentSolutionIndex] = useState(0);
  const [language, setLanguage] = useState('en');
  const [translatedData, setTranslatedData] = useState({});
  const [translatingSolutionId, setTranslatingSolutionId] = useState('');
  const inFlightTranslations = useRef(new Map());
  const currentSolution = solutions[currentSolutionIndex] || null;

  useEffect(() => {
    if (activeTab !== 'solutions' || language !== 'hi' || !currentSolution) return undefined;

    const question = currentSolution.question || currentSolution;
    const solutionId = String(currentSolution.question_id || currentSolution.id || question.id || currentSolutionIndex);
    const entries = [];
    const questionEnglish = question.question_text_en
      || getLocalizedEnglish(question.question_text)
      || question.text
      || '';
    const questionHindi = question.question_text_hi || getStoredHindi(question.question_text) || question.text_hi || '';
    if (!questionHindi && questionEnglish && !translatedData[solutionId]?.question) {
      entries.push(['question', questionEnglish]);
    }

    for (const [key, option] of getOptionEntries(question.options)) {
      const optionEnglish = getLocalizedEnglish(option);
      if (!getStoredHindi(option) && optionEnglish && !translatedData[solutionId]?.[`option:${key}`]) {
        entries.push([`option:${key}`, optionEnglish]);
      }
    }

    const explanation = currentSolution.explanation || question.explanation;
    const explanationEnglish = getLocalizedEnglish(explanation);
    const explanationHindi = question.explanation_hi || getStoredHindi(explanation) || getStoredHindi(question.explanation);
    if (!explanationHindi && explanationEnglish && !translatedData[solutionId]?.explanation) {
      entries.push(['explanation', explanationEnglish]);
    }
    if (!entries.length) {
      setTranslatingSolutionId((current) => current === solutionId ? '' : current);
      return undefined;
    }

    setTranslatingSolutionId(solutionId);
    const translations = entries.map(([field, text]) => {
      const cacheKey = `${solutionId}:${field}`;
      let request = inFlightTranslations.current.get(cacheKey);
      if (!request) {
        request = translateText(text);
        inFlightTranslations.current.set(cacheKey, request);
        request.finally(() => inFlightTranslations.current.delete(cacheKey));
      }
      return request.then((value) => [field, value]);
    });

    Promise.all(translations).then((values) => {
      setTranslatedData((current) => ({
        ...current,
        [solutionId]: { ...current[solutionId], ...Object.fromEntries(values) }
      }));
    }).finally(() => {
      setTranslatingSolutionId((current) => current === solutionId ? '' : current);
    });
    return undefined;
  }, [activeTab, language, currentSolution, currentSolutionIndex, translatedData]);

  useEffect(() => {
    let active = true;
    const loadResult = async () => {
      if (!supabase) throw new Error('Supabase is not configured. Test results are only available from the secure result service.');
      const { data, error: rpcError } = await supabase.rpc('get_test_attempt_result', { p_attempt_id: attemptId });
      if (rpcError) throw rpcError;
      const payload = unwrapRpcPayload(data);
      const root = normalizeRpcObject(data);
      const resultData = Array.isArray(payload) ? root : { ...root, ...payload };
      if (!resultData || !Object.keys(resultData).length) throw new Error('No result was returned for this test attempt.');
      const answerRows = resultData.solutions || resultData.questions || resultData.answers || (Array.isArray(payload) ? payload : []);
      if (!active) return;
      setResult(resultData);
      setSolutions(Array.isArray(answerRows) ? answerRows : []);
      refreshAccount().catch((accountError) => console.error('Unable to refresh coin wallet after test submission:', accountError));
      setLoading(false);
    };
    loadResult().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load your result.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase, attemptId, refreshAccount]);

  if (loading) return <main className="quiz-loading"><LoadingSkeleton rows={5} /></main>;
  if (error) return <main className="quiz-error-page"><div className="quiz-error-card"><div className="locked-icon"><BookOpen size={22} /></div><h1>Result unavailable</h1><p>{error}</p><Link to="/tests" className="button button-outline"><ArrowLeft size={15} /> Back to tests</Link></div></main>;
  const scorecard = result.scorecard || result.summary || result;
  const score = Number(valueOf(scorecard, 'score', 'total_score', 'final_score'));
  const rawPercentage = Number(valueOf(scorecard, 'percentage', 'score_percentage'));
  const percentage = rawPercentage > 0 && rawPercentage <= 1 ? rawPercentage * 100 : rawPercentage;
  const rawAccuracy = Number(valueOf(scorecard, 'accuracy_percentage', 'accuracy'));
  const accuracy = rawAccuracy > 0 && rawAccuracy <= 1 ? rawAccuracy * 100 : rawAccuracy;
  const totalMarks = Number(valueOf(scorecard, 'total_marks', 'maximum_marks'));
  const positive = Number(valueOf(scorecard, 'positive_score', 'positive_marks'));
  const negative = Math.abs(Number(valueOf(scorecard, 'negative_deductions', 'negative_score', 'negative_marks')));
  const blankPenalty = Math.abs(Number(valueOf(scorecard, 'blank_penalty_deductions', 'blank_penalty', 'option_e_penalty')));
  const coinsEarned = Number(valueOf(result, 'coins_earned', 'reward_coins') || valueOf(scorecard, 'coins_earned', 'reward_coins'));
  const firstAttempt = result.is_first_attempt ?? result.first_attempt ?? scorecard.is_first_attempt ?? false;
  const qualified = result.qualified_for_coin_reward ?? result.coin_reward_qualified ?? scorecard.qualified_for_coin_reward ?? coinsEarned > 0;

  return <main className="quiz-result-page"><header className="result-header"><Link to="/tests" className="quiz-brand"><span className="brand-mark">Z</span><span>ZYVRA<span>YOUR LEARNING JOURNEY</span></span></Link><Link className="result-home-link" to="/">Exit to dashboard <ArrowRight size={15} /></Link></header><div className="result-content">
    <section className="result-celebration"><div className="celebration-spark spark-left"><Sparkles size={23} /></div><div className="result-trophy"><Trophy size={28} /></div><div className="eyebrow">TEST COMPLETE</div><h1>{percentage >= 80 ? 'Wonderful work!' : 'Every attempt moves you forward.'}</h1><p>{result.test_title || result.title || 'Your test results are ready.'}</p><div className="result-primary-stats"><div><strong>{score.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><span>TOTAL SCORE{totalMarks ? ` / ${totalMarks}` : ''}</span></div><div><strong>{percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong><span>PERCENTAGE</span></div><div><strong>{accuracy.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong><span>ACCURACY</span></div></div>{coinsEarned > 0 && <div className="reward-earned"><span className="reward-coin-icon"><Coins size={19} /></span><div><strong>+{coinsEarned} Zyvra Coins earned</strong><span>{firstAttempt ? 'First attempt reward' : 'Reward credited to your wallet'}</span></div><BadgeCheck size={18} /></div>}{coinsEarned <= 0 && result.coin_reward_enabled && <div className="reward-not-earned"><Coins size={16} />{firstAttempt && !qualified ? 'Keep practising to meet the reward score.' : 'Coin rewards are available for qualifying first attempts.'}</div>}<div className="celebration-spark spark-right"><Sparkles size={19} /></div></section>
    <div className="result-tabs" role="tablist"><button role="tab" aria-selected={activeTab === 'summary'} className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}><Target size={15} /> Score breakdown</button><button role="tab" aria-selected={activeTab === 'solutions'} className={activeTab === 'solutions' ? 'active' : ''} onClick={() => setActiveTab('solutions')}><BookOpen size={15} /> Solutions & explanations <span>{solutions.length}</span></button></div>
    {activeTab === 'summary' && <><section className="result-breakdown-grid"><article className="breakdown-card"><span className="breakdown-icon"><Trophy size={17} /></span><span>Total marks</span><strong>{score.toLocaleString(undefined, { maximumFractionDigits: 2 })}{totalMarks ? <small> / {totalMarks}</small> : null}</strong><div className="breakdown-track"><span style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} /></div></article><article className="breakdown-card positive"><span className="breakdown-icon"><CheckCircle2 size={17} /></span><span>Positive score</span><strong>+{positive.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>Correct answers</small></article><article className="breakdown-card negative"><span className="breakdown-icon"><CircleX size={17} /></span><span>Negative deductions</span><strong>−{negative.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>Incorrect answers</small></article><article className="breakdown-card blank"><span className="breakdown-icon"><Clock3 size={17} /></span><span>Blank penalty deductions</span><strong>−{blankPenalty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>Mandatory Option E rule</small></article></section><div className="result-next-step"><div><span className="eyebrow">KEEP YOUR MOMENTUM</span><h2>Review your answers and strengthen what you’ve learned.</h2></div><button className="button button-gold" onClick={() => setActiveTab('solutions')}>Review solutions <ArrowRight size={15} /></button></div></>}
    {activeTab === 'solutions' && <section className="solutions-panel">
      <div className="solutions-heading">
        <div><div className="eyebrow">LEARN FROM EVERY ANSWER</div><h2>Solutions & explanations</h2><p>Review one question at a time and strengthen your understanding.</p></div>
        <Link to="/explore" className="inline-link">Explore topics <ArrowRight size={14} /></Link>
      </div>
      <div className="review-toolbar">
        <div className="review-palette" role="group" aria-label="Choose a question to review">
          {solutions.map((item, index) => {
            const selected = item.student_selected ?? item.selected_option ?? item.response?.selected_option ?? item.selected_answers ?? item.response?.selected_answers ?? null;
            const hasSelection = Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
            const correct = item.is_correct ?? item.response?.is_correct;
            const state = correct === true ? 'correct' : hasSelection ? 'incorrect' : 'skipped';
            return <button
              type="button"
              key={item.question_id || item.id || index}
              className={`review-palette-number ${state} ${currentSolutionIndex === index ? 'current' : ''}`}
              aria-label={`Review question ${index + 1}, ${state}`}
              aria-current={currentSolutionIndex === index ? 'step' : undefined}
              onClick={() => setCurrentSolutionIndex(index)}
            >{index + 1}</button>;
          })}
        </div>
        <div className="native-language-toggle" role="group" aria-label="Review language">
          <Languages size={14} aria-hidden="true" />
          <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          <button type="button" className={language === 'hi' ? 'active' : ''} aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>HI</button>
        </div>
      </div>
      {!solutions.length
        ? <div className="empty-content"><BookOpen size={23} /><strong>Solutions are not available yet.</strong><span>They may be released after review.</span></div>
        : <SolutionCard
          item={currentSolution}
          index={currentSolutionIndex}
          language={language}
          translations={translatedData[String(currentSolution.question_id || currentSolution.id || currentSolution.question?.id || currentSolutionIndex)] || {}}
          translating={translatingSolutionId === String(currentSolution.question_id || currentSolution.id || currentSolution.question?.id || currentSolutionIndex)}
        />}
      {solutions.length > 0 && <div className="review-navigation">
        <button type="button" className="button button-outline" onClick={() => setCurrentSolutionIndex((index) => Math.max(0, index - 1))} disabled={currentSolutionIndex === 0}><ChevronLeft size={16} /> Previous</button>
        <span>Question {currentSolutionIndex + 1} of {solutions.length}</span>
        <button type="button" className="button button-gold" onClick={() => setCurrentSolutionIndex((index) => Math.min(solutions.length - 1, index + 1))} disabled={currentSolutionIndex === solutions.length - 1}>Next <ChevronRight size={16} /></button>
      </div>}
    </section>}
    <div className="result-footer"><Link to="/tests"><ArrowLeft size={14} /> Back to tests</Link><span>Results and rewards are calculated securely by Zyvra.</span></div>
  </div>
  </main>;
}

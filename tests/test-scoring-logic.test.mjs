import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCorrectAnswer,
  sanitizeLiveQuestion,
  getOptionEntries,
  getQuestionText,
  extractLocalizedExplanation,
  extractLocalizedDistractorNote,
  getAnsweredQuestionCount,
  hasDevanagari,
  hasLatin,
  formatScore,
  calculateTestScore,
  resolveSolutionStatus
} from '../src/lib/tests.js';

test('getAnsweredQuestionCount uses response data and never treats score/total as answered questions', () => {
  assert.equal(getAnsweredQuestionCount({ score: 18, total_questions: 20 }), 0);
  assert.equal(getAnsweredQuestionCount({ state_json: { answers: { q1: 'A', q2: '' }, responses: { q3: { selected_option: 'C' } } } }), 2);
  assert.equal(getAnsweredQuestionCount({ answered_count: 4, total_questions: 20 }), 4);
});

test('normalizeCorrectAnswer: correctly resolves various answer formats', () => {
  // Direct letter
  assert.equal(normalizeCorrectAnswer('A'), 'A');
  assert.equal(normalizeCorrectAnswer('b'), 'B');
  assert.equal(normalizeCorrectAnswer(' E '), 'E');

  // JSON formatted or brackets
  assert.equal(normalizeCorrectAnswer('["A"]'), 'A');
  assert.equal(normalizeCorrectAnswer('["C"]'), 'C');
  assert.equal(normalizeCorrectAnswer('"B"'), 'B');

  // Numeric index (1-based)
  assert.equal(normalizeCorrectAnswer('1'), 'A');
  assert.equal(normalizeCorrectAnswer('2'), 'B');
  assert.equal(normalizeCorrectAnswer('5'), 'E');

  // 0-based index
  assert.equal(normalizeCorrectAnswer('0'), 'A');

  // Prefix formats
  assert.equal(normalizeCorrectAnswer('Option A'), 'A');
  assert.equal(normalizeCorrectAnswer('Option (B)'), 'B');
  assert.equal(normalizeCorrectAnswer('(C)'), 'C');
  assert.equal(normalizeCorrectAnswer('Option D - Some Text'), 'D');

  // Object shape
  assert.equal(normalizeCorrectAnswer({ answer: 'B' }), 'B');
  assert.equal(normalizeCorrectAnswer({ option: 'C' }), 'C');

  // Null / undefined handling
  assert.equal(normalizeCorrectAnswer(null), '');
  assert.equal(normalizeCorrectAnswer(undefined), '');
});

test('normalizeCorrectAnswer: text matching against options list', () => {
  const options = ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'];
  assert.equal(normalizeCorrectAnswer('New Delhi', options), 'A');
  assert.equal(normalizeCorrectAnswer('Mumbai', options), 'B');
  assert.equal(normalizeCorrectAnswer('kolkata', options), 'C');
  assert.equal(normalizeCorrectAnswer('Chennai', options), 'D');
});

test('sanitizeLiveQuestion: properly normalizes options and correct answers', () => {
  const rawQuestion = {
    id: 'q-101',
    question_en: 'What is the capital of India?',
    options: ['New Delhi', 'Mumbai', 'Chennai', 'Kolkata'],
    correct_answer: 'New Delhi',
    explanation: 'New Delhi is the official capital.'
  };

  const sanitized = sanitizeLiveQuestion(rawQuestion);
  assert.equal(sanitized.id, 'q-101');
  assert.equal(sanitized.correct_answer, 'A', 'Should normalize text answer to option key A');
  assert.equal(sanitized.options.length, 4);
  assert.equal(sanitized.options[0].en, 'New Delhi');
});

test('sanitizeLiveQuestion: bilingual question text routing (Hindi in English slot)', () => {
  const misplacedQuestion = {
    id: 'q-102',
    question_text: 'भारत की राजधानी क्या है?', // Hindi in default slot
    question_hi: '',
    options: ['नई दिल्ली', 'मुंबई', 'कोलकाता', 'चेन्नई'],
    correct_answer: 'A'
  };

  const sanitized = sanitizeLiveQuestion(misplacedQuestion);
  assert.equal(sanitized.question_text.hi, 'भारत की राजधानी क्या है?', 'Should route Devanagari text to Hindi slot');
});

test('extractLocalizedExplanation: language-specific extraction and prefix cleanup', () => {
  const bilingualExplanation = `English: Photosynthesis is the process used by plants to convert light energy.
Hindi: प्रकाश संश्लेषण वह प्रक्रिया है जिसके द्वारा पौधे प्रकाश ऊर्जा को परिवर्तित करते हैं।`;

  const enResult = extractLocalizedExplanation(bilingualExplanation, 'en');
  assert.ok(!enResult.includes('Hindi:'), 'English explanation must not contain Hindi section');
  assert.ok(enResult.includes('Photosynthesis'), 'Should contain English content');

  const hiResult = extractLocalizedExplanation(bilingualExplanation, 'hi');
  assert.ok(!hiResult.includes('English:'), 'Hindi explanation must not contain English section');
  assert.ok(hiResult.includes('प्रकाश संश्लेषण'), 'Should contain Hindi content');
});

test('extractLocalizedDistractorNote: extracts note by language', () => {
  const slashNote = 'गलत उत्तर / Incorrect answer because of historical reasons';
  const hiNote = extractLocalizedDistractorNote(slashNote, 'hi');
  const enNote = extractLocalizedDistractorNote(slashNote, 'en');

  assert.equal(hiNote, 'गलत उत्तर');
  assert.equal(enNote, 'Incorrect answer because of historical reasons');
});

test('formatScore: formats numbers cleanly with zero decimal drift and handles negatives and edge cases', () => {
  assert.equal(formatScore(10), '10');
  assert.equal(formatScore(9.25), '9.25');
  assert.equal(formatScore(8.333333333333334), '8.33');
  assert.equal(formatScore(0.6699999999999999), '0.67');
  assert.equal(formatScore(-0.6666666666666666), '-0.67');
  assert.equal(formatScore(-2.5), '-2.5');
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(-0), '0');
  assert.equal(formatScore(null), '0');
  assert.equal(formatScore(undefined), '0');
  assert.equal(formatScore(NaN), '0');
});

test('calculateTestScore: standard 4-option test with 0.25 negative marking', () => {
  const questions = [
    { id: 'q1', correct_answer: 'A' },
    { id: 'q2', correct_answer: 'B' },
    { id: 'q3', correct_answer: 'C' },
    { id: 'q4', correct_answer: 'D' }
  ];

  // Case 1: All correct
  const allCorrect = calculateTestScore({
    questions,
    responses: { q1: { selected_option: 'A' }, q2: { selected_option: 'B' }, q3: { selected_option: 'C' }, q4: { selected_option: 'D' } },
    positiveMarks: 1,
    negativeMarks: 0.25
  });
  assert.equal(allCorrect.correctCount, 4);
  assert.equal(allCorrect.incorrectCount, 0);
  assert.equal(allCorrect.unattemptedCount, 0);
  assert.equal(allCorrect.score, 4);
  assert.equal(allCorrect.maxScore, 4);
  assert.equal(allCorrect.percentage, 100);
  assert.equal(allCorrect.formattedScore, '4');

  // Case 2: 3 correct, 1 wrong (Score: 3 - 0.25 = 2.75)
  const threeCorrect = calculateTestScore({
    questions,
    responses: { q1: { selected_option: 'A' }, q2: { selected_option: 'B' }, q3: { selected_option: 'C' }, q4: { selected_option: 'A' } },
    positiveMarks: 1,
    negativeMarks: 0.25
  });
  assert.equal(threeCorrect.correctCount, 3);
  assert.equal(threeCorrect.incorrectCount, 1);
  assert.equal(threeCorrect.score, 2.75);
  assert.equal(threeCorrect.percentage, 69); // 2.75 / 4 = 68.75% -> 69%
  assert.equal(threeCorrect.formattedScore, '2.75');

  // Case 3: All skipped
  const allSkipped = calculateTestScore({
    questions,
    responses: {},
    positiveMarks: 1,
    negativeMarks: 0.25
  });
  assert.equal(allSkipped.correctCount, 0);
  assert.equal(allSkipped.incorrectCount, 0);
  assert.equal(allSkipped.unattemptedCount, 4);
  assert.equal(allSkipped.score, 0);
  assert.equal(allSkipped.percentage, 0);
  assert.equal(allSkipped.formattedScore, '0');

  // Case 4: All wrong with negative total score
  const allWrong = calculateTestScore({
    questions,
    responses: { q1: { selected_option: 'B' }, q2: { selected_option: 'C' }, q3: { selected_option: 'A' }, q4: { selected_option: 'B' } },
    positiveMarks: 1,
    negativeMarks: 0.25
  });
  assert.equal(allWrong.correctCount, 0);
  assert.equal(allWrong.incorrectCount, 4);
  assert.equal(allWrong.score, -1);
  assert.equal(allWrong.percentage, 0); // clamped to 0% for negative total score
  assert.equal(allWrong.formattedScore, '-1');
});

test('calculateTestScore: State PCS / BPSC 1/3 negative marking with exact floating point rounding', () => {
  const questions = Array.from({ length: 9 }, (_, i) => ({ id: `q${i + 1}`, correct_answer: 'A' }));
  // 6 correct, 3 wrong: grossPositive = 6, grossNegative = 3 * (1/3) = 1.00 -> Net Score = 5.00
  const result = calculateTestScore({
    questions,
    responses: {
      q1: { selected_option: 'A' },
      q2: { selected_option: 'A' },
      q3: { selected_option: 'A' },
      q4: { selected_option: 'A' },
      q5: { selected_option: 'A' },
      q6: { selected_option: 'A' },
      q7: { selected_option: 'B' },
      q8: { selected_option: 'C' },
      q9: { selected_option: 'D' }
    },
    positiveMarks: 1,
    negativeMarks: 1 / 3
  });

  assert.equal(result.correctCount, 6);
  assert.equal(result.incorrectCount, 3);
  assert.equal(result.score, 5);
  assert.equal(result.formattedScore, '5');
});

test('calculateTestScore: BPSC Mandatory Option E Rule with blank penalty', () => {
  const questions = [
    { id: 'q1', correct_answer: 'A', options: ['A', 'B', 'C', 'D', 'E'] },
    { id: 'q2', correct_answer: 'B', options: ['A', 'B', 'C', 'D', 'E'] },
    { id: 'q3', correct_answer: 'E', options: ['A', 'B', 'C', 'D', 'E'] }, // Correct answer is Option E
    { id: 'q4', correct_answer: 'C', options: ['A', 'B', 'C', 'D', 'E'] },
    { id: 'q5', correct_answer: 'D', options: ['A', 'B', 'C', 'D', 'E'] }
  ];

  // Student answers:
  // q1: A (Correct +1)
  // q2: B (Correct +1)
  // q3: E (Correct +1)
  // q4: E (Selected E when correct was C -> Wrong -0.25)
  // q5: Left completely blank -> incurs mandatory blank Option E penalty of -0.25
  const result = calculateTestScore({
    questions,
    responses: {
      q1: { selected_option: 'A' },
      q2: { selected_option: 'B' },
      q3: { selected_option: 'E' },
      q4: { selected_option: 'E' }
      // q5 not answered
    },
    positiveMarks: 1,
    negativeMarks: 0.25,
    mandatoryOptionEPenalty: 0.25
  });

  assert.equal(result.correctCount, 3);
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.unattemptedCount, 1);
  assert.equal(result.optionEPenaltyCount, 1);
  // Net score: (3 * 1) - (1 * 0.25) - (1 * 0.25) = 2.50
  assert.equal(result.score, 2.5);
  assert.equal(result.formattedScore, '2.5');
});

test('resolveSolutionStatus: accurately classifies correct, incorrect, unattempted and handles fallbacks', () => {
  // Correct match
  const correctItem = {
    student_selected: 'B',
    correct_answer: 'B'
  };
  const status1 = resolveSolutionStatus(correctItem);
  assert.equal(status1.isCorrect, true);
  assert.equal(status1.isIncorrect, false);
  assert.equal(status1.isUnattempted, false);
  assert.equal(status1.chosenKey, 'B');
  assert.equal(status1.correctKey, 'B');

  // Incorrect match
  const incorrectItem = {
    selected_option: 'C',
    correct_option: 'A'
  };
  const status2 = resolveSolutionStatus(incorrectItem);
  assert.equal(status2.isCorrect, false);
  assert.equal(status2.isIncorrect, true);
  assert.equal(status2.isUnattempted, false);
  assert.equal(status2.chosenKey, 'C');
  assert.equal(status2.correctKey, 'A');

  // Unattempted
  const unattemptedItem = {
    selected_option: null,
    correct_answer: 'D'
  };
  const status3 = resolveSolutionStatus(unattemptedItem);
  assert.equal(status3.isCorrect, false);
  assert.equal(status3.isIncorrect, false);
  assert.equal(status3.isUnattempted, true);
  assert.equal(status3.hasSelection, false);

  // Nested question object fallback
  const nestedItem = {
    student_selected: 'A',
    question: {
      correct_answer: 'A',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
    }
  };
  const status4 = resolveSolutionStatus(nestedItem);
  assert.equal(status4.isCorrect, true);
  assert.equal(status4.correctKey, 'A');

  // Malformed or null object safe handling
  const nullStatus = resolveSolutionStatus(null);
  assert.equal(nullStatus.isCorrect, false);
  assert.equal(nullStatus.isUnattempted, true);
  assert.equal(nullStatus.hasSelection, false);
});


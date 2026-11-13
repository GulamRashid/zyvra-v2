import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCorrectAnswer,
  sanitizeLiveQuestion,
  getOptionEntries,
  getQuestionText,
  extractLocalizedExplanation,
  extractLocalizedDistractorNote,
  hasDevanagari,
  hasLatin
} from '../src/lib/tests.js';

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


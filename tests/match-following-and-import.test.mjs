import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMatchingQuestion, parseStatementQuestion } from '../src/lib/question-parser.js';
import { parseImportCsv, validateImportQuestion } from '../src/lib/tests.js';

test('Matching Parser: Inline with pipe', () => {
  const text = 'Match Column I with Column II: Column I: (1) Harappa (2) Mohenjodaro (3) Lothal (4) Kalibangan | Column II: (A) Ravi (B) Indus (C) Bhogava (D) Ghaggar. Choose the correct matching:';
  const res = parseMatchingQuestion(text);
  assert.ok(res, 'Should parse inline with pipe');
  assert.equal(res.preamble, 'Match Column I with Column II');
  assert.equal(res.col1Title, 'Column I');
  assert.equal(res.col2Title, 'Column II');
  assert.deepEqual(res.col1Items, ['(1) Harappa', '(2) Mohenjodaro', '(3) Lothal', '(4) Kalibangan']);
  assert.deepEqual(res.col2Items, ['(A) Ravi', '(B) Indus', '(C) Bhogava', '(D) Ghaggar']);
  assert.equal(res.postamble, 'Choose the correct matching');
});

test('Matching Parser: Hindi multiline with सूची-I and सूची-II', () => {
  const text = `सूची-I को सूची-II से सुमेलित कीजिए:
सूची-I:
(1) हड़प्पा
(2) मोहनजोदड़ो
(3) लोथल
(4) कालीबंगा
सूची-II:
(A) रावी
(B) सिंधु
(C) भोगवा
(D) घग्गर
नीचे दिए गए कूट का प्रयोग कर सही उत्तर चुनिए:`;
  const res = parseMatchingQuestion(text);
  assert.ok(res, 'Should parse Hindi multiline');
  assert.equal(res.preamble, 'सूची-I को सूची-II से सुमेलित कीजिए');
  assert.equal(res.col1Title, 'सूची-I');
  assert.equal(res.col2Title, 'सूची-II');
  assert.deepEqual(res.col1Items, ['(1) हड़प्पा', '(2) मोहनजोदड़ो', '(3) लोथल', '(4) कालीबंगा']);
  assert.deepEqual(res.col2Items, ['(A) रावी', '(B) सिंधु', '(C) भोगवा', '(D) घग्गर']);
  assert.equal(res.postamble, 'नीचे दिए गए कूट का प्रयोग कर सही उत्तर चुनिए');
});

test('Matching Parser: Hindi स्तंभ I / स्तंभ II inline with pipe', () => {
  const text = 'स्तंभ I को स्तंभ II से सुमेलित कीजिए: स्तंभ I: (1) अनुच्छेद 14 (2) अनुच्छेद 19 | स्तंभ II: (A) समता (B) स्वतंत्रता सही मिलान चुनिए:';
  const res = parseMatchingQuestion(text);
  assert.ok(res, 'Should parse स्तंभ inline');
  assert.equal(res.col1Title, 'स्तंभ I');
  assert.equal(res.col2Title, 'स्तंभ II');
  assert.deepEqual(res.col1Items, ['(1) अनुच्छेद 14', '(2) अनुच्छेद 19']);
  assert.deepEqual(res.col2Items, ['(A) समता', '(B) स्वतंत्रता']);
  assert.equal(res.postamble, 'सही मिलान चुनिए');
});

test('Matching Parser: Items (B), (C), (D) in Column II strictly stay on the right', () => {
  const text = `Match the following:
Column I:
(1) Article 14
(2) Article 19
Column II:
(A) Equality
(B) Freedom
(C) Life
(D) Remedies
Choose the correct matching:`;
  const res = parseMatchingQuestion(text);
  assert.ok(res, 'Should parse multiline');
  assert.equal(res.preamble, 'Match the following');
  assert.deepEqual(res.col1Items, ['(1) Article 14', '(2) Article 19']);
  assert.deepEqual(res.col2Items, ['(A) Equality', '(B) Freedom', '(C) Life', '(D) Remedies']);
  assert.equal(res.postamble, 'Choose the correct matching');
});

test('Statement Parser: Pipe-separated statements in English and Hindi', () => {
  const text = 'Consider the following statements: | (1) Harappa is on Ravi. | (2) Lothal has a dockyard. | Which of the above statements is/are correct?';
  const res = parseStatementQuestion(text);
  assert.ok(res, 'Should parse statement question');
  assert.equal(res.preamble, 'Consider the following statements');
  assert.equal(res.statements.length, 2);
  assert.equal(res.statements[0].badge, '(1)');
  assert.equal(res.statements[0].text, 'Harappa is on Ravi.');
  assert.equal(res.statements[1].badge, '(2)');
  assert.equal(res.statements[1].text, 'Lothal has a dockyard.');
  assert.equal(res.postamble, 'Which of the above statements is/are correct?');
});

test('Bulk Import CSV: Supports question_type column and auto-detection', () => {
  const csv = `question_type,question_en,question_hi,option_a,option_b,option_c,option_d,correct_answer,subject,chapter_id
mcq,"What is 2+2?","2+2 क्या है?","1","2","3","4","D","Math","ch-uuid-1"
,"Consider statements: | (1) Statement A | (2) Statement B | Which is correct?","कथन: | (1) कथन A | (2) कथन B","A","B","C","D","A","GS","ch-uuid-1"
,"Match Column I with Column II: Column I: (1) X | Column II: (A) Y | Codes:","मिलान: सूची-I: (1) X | सूची-II: (A) Y","1-A","1-B","1-C","1-D","A","GS","ch-uuid-1"`;

  const parsed = parseImportCsv(csv);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].question_type, 'mcq');
  assert.equal(parsed[1].question_type, 'statement', 'Should auto-detect statement question');
  assert.equal(parsed[2].question_type, 'matching', 'Should auto-detect matching question');

  const seen = new Set();
  const seenTexts = new Set();
  const val0 = validateImportQuestion(parsed[0], 0, seen, seenTexts);
  assert.ok(val0.valid, `Row 0 should be valid: ${val0.errors.join(', ')}`);
});

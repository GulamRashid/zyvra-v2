import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMatchingQuestion, parseStatementQuestion } from '../src/lib/question-parser.js';
import { parseImportCsv, validateImportQuestion } from '../src/lib/tests.js';
import { CSV_TEMPLATE, JSON_TEMPLATE, SAMPLE_QUESTIONS } from '../src/lib/question-templates.js';

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
  const text = 'Consider the following statements: | 1. Harappa was excavated along the banks of River Ravi. | 2. Lothal served as a prominent port town. | Which of the statements given above is/are correct?';
  const res = parseStatementQuestion(text);
  assert.ok(res, 'Should parse statement question');
  assert.equal(res.preamble, 'Consider the following statements');
  assert.equal(res.statements.length, 2);
  assert.equal(res.statements[0].badge, '1.');
  assert.equal(res.statements[0].text, 'Harappa was excavated along the banks of River Ravi.');
  assert.equal(res.statements[1].badge, '2.');
  assert.equal(res.statements[1].text, 'Lothal served as a prominent port town.');
  assert.equal(res.postamble, 'Which of the statements given above is/are correct?');
});

test('Statement Parser: Assertion & Reason in English & Hindi', () => {
  const textEn = 'Assertion (A): The President of India is elected indirectly by an electoral college. | Reason (R): India has opted for a parliamentary system. | Choose the correct code:';
  const resEn = parseStatementQuestion(textEn);
  assert.ok(resEn, 'Should parse Assertion & Reason English');
  assert.equal(resEn.statements.length, 2);
  assert.equal(resEn.statements[0].badge, 'Assertion (A):');
  assert.equal(resEn.statements[0].text, 'The President of India is elected indirectly by an electoral college.');
  assert.equal(resEn.statements[1].badge, 'Reason (R):');
  assert.equal(resEn.statements[1].text, 'India has opted for a parliamentary system.');
  assert.equal(resEn.postamble, 'Choose the correct code');

  const textHi = 'अभिकथन (A): भारत के राष्ट्रपति का चुनाव एक निर्वाचक मंडल द्वारा अप्रत्यक्ष रूप से होता है। | कारण (R): भारत ने संसदीय प्रणाली को अपनाया है। | सही कूट चुनिए:';
  const resHi = parseStatementQuestion(textHi);
  assert.ok(resHi, 'Should parse Assertion & Reason Hindi');
  assert.equal(resHi.statements.length, 2);
  assert.equal(resHi.statements[0].badge, 'अभिकथन (A):');
  assert.equal(resHi.statements[0].text, 'भारत के राष्ट्रपति का चुनाव एक निर्वाचक मंडल द्वारा अप्रत्यक्ष रूप से होता है।');
  assert.equal(resHi.statements[1].badge, 'कारण (R):');
  assert.equal(resHi.statements[1].text, 'भारत ने संसदीय प्रणाली को अपनाया है।');
  assert.equal(resHi.postamble, 'सही कूट चुनिए');
});

test('Matching Parser: Pipe delimiters before Column headers (| Column I: ... | Column II: ...)', () => {
  const textEn = 'Match Column I with Column II: | Column I: (1) Harappa (2) Mohenjodaro (3) Lothal (4) Kalibangan | Column II: (A) Ravi (B) Indus (C) Bhogava (D) Ghaggar | Choose the correct matching:';
  const resEn = parseMatchingQuestion(textEn);
  assert.ok(resEn, 'Should parse Item 5 matching English');
  assert.equal(resEn.preamble, 'Match Column I with Column II');
  assert.equal(resEn.col1Title, 'Column I');
  assert.equal(resEn.col2Title, 'Column II');
  assert.deepEqual(resEn.col1Items, ['(1) Harappa', '(2) Mohenjodaro', '(3) Lothal', '(4) Kalibangan']);
  assert.deepEqual(resEn.col2Items, ['(A) Ravi', '(B) Indus', '(C) Bhogava', '(D) Ghaggar']);
  assert.equal(resEn.postamble, 'Choose the correct matching');

  const textHi = 'स्तंभ I को स्तंभ II से सुमेलित कीजिए: | स्तंभ I: (1) हड़प्पा (2) मोहनजोदड़ो (3) लोथल (4) कालीबंगा | स्तंभ II: (A) रावी (B) सिंधु (C) भोगवा (D) घग्गर | सही मिलान चुनिए:';
  const resHi = parseMatchingQuestion(textHi);
  assert.ok(resHi, 'Should parse Item 5 matching Hindi');
  assert.equal(resHi.preamble, 'स्तंभ I को स्तंभ II से सुमेलित कीजिए');
  assert.equal(resHi.col1Title, 'स्तंभ I');
  assert.equal(resHi.col2Title, 'स्तंभ II');
  assert.deepEqual(resHi.col1Items, ['(1) हड़प्पा', '(2) मोहनजोदड़ो', '(3) लोथल', '(4) कालीबंगा']);
  assert.deepEqual(resHi.col2Items, ['(A) रावी', '(B) सिंधु', '(C) भोगवा', '(D) घग्गर']);
  assert.equal(resHi.postamble, 'सही मिलान चुनिए');
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

test('Bulk Import Templates: CSV_TEMPLATE contains all 5 question formats and validates with 0 errors', () => {
  const parsed = parseImportCsv(CSV_TEMPLATE);
  assert.equal(parsed.length, 5, 'CSV Template must contain exactly 5 rows');

  // Item 1: Standard 4-Option MCQ
  assert.equal(parsed[0].question_type, 'mcq');
  assert.equal(parsed[0].options.length, 4, 'Item 1 must have 4 options');
  assert.equal(parsed[0].correct_answer, 'B');
  assert.ok(parsed[0].explanation_en && parsed[0].explanation_hi, 'Item 1 bilingual explanation');

  // Item 2: 5-Option BPSC Style MCQ
  assert.equal(parsed[1].question_type, 'mcq');
  assert.equal(parsed[1].options.length, 5, 'Item 2 must have 5 options');
  assert.equal(parsed[1].options[4].en, 'None of the above / More than one of the above');
  assert.equal(parsed[1].correct_answer, 'C');

  // Item 3: Multi-Statement
  assert.equal(parsed[2].question_type, 'statement');
  assert.equal(parsed[2].options.length, 4);
  assert.equal(parsed[2].correct_answer, 'C');

  // Item 4: Assertion & Reason
  assert.equal(parsed[3].question_type, 'statement');
  assert.equal(parsed[3].options.length, 4);
  assert.equal(parsed[3].correct_answer, 'A');

  // Item 5: Match the Following
  assert.equal(parsed[4].question_type, 'matching');
  assert.equal(parsed[4].options.length, 4);
  assert.equal(parsed[4].correct_answer, 'A');

  // All 5 rows must pass validation with 0 errors
  const seen = new Set();
  const seenTexts = new Set();
  parsed.forEach((row, i) => {
    const val = validateImportQuestion(row, i, seen, seenTexts);
    assert.ok(val.valid, `CSV Row ${i + 1} validation failed: ${val.errors.join(', ')}`);
  });
});

test('Bulk Import Templates: JSON_TEMPLATE contains all 5 question formats and validates with 0 errors', () => {
  const parsed = JSON.parse(JSON_TEMPLATE);
  assert.equal(parsed.length, 5, 'JSON Template must contain exactly 5 rows');
  assert.deepEqual(parsed, SAMPLE_QUESTIONS);

  // Validate all 5 rows with 0 errors
  const seen = new Set();
  const seenTexts = new Set();
  parsed.forEach((row, i) => {
    const val = validateImportQuestion(row, i, seen, seenTexts);
    assert.ok(val.valid, `JSON Row ${i + 1} validation failed: ${val.errors.join(', ')}`);
  });
});

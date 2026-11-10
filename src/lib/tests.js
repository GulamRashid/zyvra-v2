export const TEST_PATTERNS = [
  { value: 'standard-4', label: 'Standard 4-Option', optionCount: 4 },
  { value: 'bpsc-classic-5', label: 'BPSC Classic 5-Option', optionCount: 5 },
  { value: 'bpsc-mandatory-e', label: 'BPSC Mandatory Option E Rule', optionCount: 5 }
];

export function normalizeRpcObject(data) {
  if (Array.isArray(data)) return data[0] || {};
  return data || {};
}

export function getOptionEntries(options) {
  if (Array.isArray(options)) return options.map((option, index) => [String.fromCharCode(65 + index), option]);
  if (options && typeof options === 'object') {
    return Object.entries(options)
      .filter(([key]) => /^[A-E]$/i.test(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key.toUpperCase(), value]);
  }
  return [];
}

export function getQuestionText(value, language = 'en') {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value[language] || value.en || value.hi || '';
  return '';
}

export function sanitizeLiveQuestion(question) {
  const source = question || {};
  const safeQuestion = {};
  for (const key of ['id', 'question_id', 'question_text', 'question_text_en', 'question_text_hi', 'question_en', 'question_hi', 'text', 'text_hi', 'subject', 'topic', 'tags', 'passage', 'image_url', 'language']) {
    if (source[key] !== undefined && source[key] !== null) safeQuestion[key] = source[key];
  }
  const sanitizeBilingual = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(['en', 'hi', 'text', 'text_hi', 'image_url'].filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
  };
  safeQuestion.id = safeQuestion.id || safeQuestion.question_id;
  if (!safeQuestion.question_text) {
    safeQuestion.question_text = {
      en: source.question_text_en || source.question_en || '',
      hi: source.question_text_hi || source.question_hi || ''
    };
  } else {
    safeQuestion.question_text = sanitizeBilingual(safeQuestion.question_text);
  }
  let rawOptions = source.options;
  if (!rawOptions && ['A', 'B', 'C', 'D', 'E'].some((key) => source[`option_${key.toLowerCase()}`] !== undefined)) {
    rawOptions = ['A', 'B', 'C', 'D', 'E']
      .filter((key) => source[`option_${key.toLowerCase()}`] !== undefined)
      .map((key) => ({ en: source[`option_${key.toLowerCase()}`], hi: source[`option_${key.toLowerCase()}_hi`] || '' }));
  }
  if (Array.isArray(rawOptions)) safeQuestion.options = rawOptions.map(sanitizeBilingual);
  else if (rawOptions && typeof rawOptions === 'object') {
    safeQuestion.options = Object.fromEntries(Object.entries(rawOptions)
      .filter(([key]) => /^[A-E]$/i.test(key))
      .map(([key, value]) => [key.toUpperCase(), sanitizeBilingual(value)]));
  } else {
    safeQuestion.options = [];
  }
  return safeQuestion;
}

export function validateImportQuestion(question, index, seenIds = new Set()) {
  const errors = [];
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    return { valid: false, errors: [`Row ${index + 1}: must be a question object.`] };
  }
  if (typeof question.question_text !== 'string' || !question.question_text.trim()) errors.push('question_text is required.');
  if (!Array.isArray(question.options) || ![4, 5].includes(question.options.length)) errors.push('options must contain exactly 4 or 5 values.');
  else if (question.options.some((option) => {
    if (typeof option === 'string') return !option.trim();
    return typeof option !== 'object' || !option || !(option.en || option.text || option.hi || option.text_hi);
  })) errors.push('each option must contain non-empty text.');
  const answer = question.correct_answer;
  if (typeof question.subject !== 'string' || !question.subject.trim()) errors.push('subject is required.');
  const allowedAnswers = Array.isArray(question.options) ? question.options.map((_, optionIndex) => String.fromCharCode(65 + optionIndex)) : [];
  const normalizedAnswer = Array.isArray(answer) ? answer : [answer];
  if (!normalizedAnswer.length || normalizedAnswer.some((value) => !allowedAnswers.includes(String(value).toUpperCase()))) errors.push('correct_answer must be an option letter present in options.');
  if (question.difficulty && !['easy', 'medium', 'hard'].includes(String(question.difficulty).toLowerCase())) errors.push('difficulty must be easy, medium or hard.');
  if (question.id && seenIds.has(String(question.id))) errors.push('duplicate question id in import.');
  if (question.id) seenIds.add(String(question.id));
  return { valid: errors.length === 0, errors: errors.map((message) => `Row ${index + 1}: ${message}`) };
}

export function unwrapRpcPayload(data) {
  const value = normalizeRpcObject(data);
  if (Array.isArray(data)) return data;
  for (const key of ['questions', 'result', 'attempt', 'data']) {
    if (Array.isArray(value[key])) return value[key];
    if (value[key] && typeof value[key] === 'object') return value[key];
  }
  return value;
}

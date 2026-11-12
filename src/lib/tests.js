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

export function hasDevanagari(text) {
  return typeof text === 'string' && /[\u0900-\u097F]/.test(text);
}

export function hasLatin(text) {
  return typeof text === 'string' && /[a-zA-Z]/.test(text);
}

export function getQuestionText(value, language = 'en') {
  if (!value) return '';

  if (typeof value === 'string') {
    if (language === 'en') {
      if (hasDevanagari(value) && !hasLatin(value)) {
        return '';
      }
      return value;
    }
    return value;
  }

  if (typeof value === 'object') {
    if (language === 'en') {
      const candidates = [
        value.en,
        value.question_en,
        value.text_en,
        value.question_text_en,
        value.text,
        value.question_text
      ];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          if (hasLatin(candidate) || !hasDevanagari(candidate)) {
            return candidate;
          }
        }
      }
      if (typeof value.en === 'string' && value.en.trim() && !hasDevanagari(value.en)) {
        return value.en;
      }
      return '';
    }

    if (language === 'hi') {
      const candidates = [
        value.hi,
        value.question_hi,
        value.text_hi,
        value.question_text_hi,
        value.text,
        value.question_text
      ];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          if (hasDevanagari(candidate)) {
            return candidate;
          }
        }
      }
      if (typeof value.hi === 'string' && value.hi.trim()) {
        return value.hi;
      }
      return '';
    }

    return value[language] || value.en || '';
  }

  return '';
}

export function sanitizeLiveQuestion(question) {
  const source = question || {};
  const safeQuestion = {};
  for (const key of ['id', 'question_id', 'question_text', 'question_text_en', 'question_text_hi', 'question_en', 'question_hi', 'text', 'text_hi', 'subject', 'topic', 'tags', 'passage', 'image_url', 'language', 'explanation', 'explanation_en', 'explanation_hi', 'correct_answer', 'distractor_notes']) {
    if (source[key] !== undefined && source[key] !== null) safeQuestion[key] = source[key];
  }
  safeQuestion.id = safeQuestion.id || safeQuestion.question_id;

  // Resolve English candidate
  const rawQEn = source.question_en
    || source.question_text_en
    || source.text_en
    || (typeof source.question_text === 'object' ? source.question_text?.en : null)
    || (typeof source.text === 'object' ? source.text?.en : null)
    || (typeof source.question_text === 'string' ? source.question_text : '')
    || (typeof source.text === 'string' ? source.text : '');

  // Resolve Hindi candidate
  const rawQHi = source.question_hi
    || source.question_text_hi
    || source.text_hi
    || (typeof source.question_text === 'object' ? source.question_text?.hi : null)
    || (typeof source.text === 'object' ? source.text?.hi : null)
    || '';

  let resolvedEn = typeof rawQEn === 'string' ? rawQEn : '';
  let resolvedHi = typeof rawQHi === 'string' ? rawQHi : '';

  // If resolvedEn contains pure Devanagari and no Latin, but resolvedHi is empty,
  // it was mistakenly put in the English slot: route to Hindi!
  if (hasDevanagari(resolvedEn) && !hasLatin(resolvedEn)) {
    if (!resolvedHi) resolvedHi = resolvedEn;
    const altEn = source.question_en || source.question_text_en || source.text_en;
    resolvedEn = (typeof altEn === 'string' && hasLatin(altEn)) ? altEn : '';
  }

  // If resolvedHi contains Latin and no Devanagari while resolvedEn is empty, swap
  if (hasLatin(resolvedHi) && !hasDevanagari(resolvedHi) && !resolvedEn) {
    resolvedEn = resolvedHi;
    resolvedHi = '';
  }

  safeQuestion.question_text = {
    en: resolvedEn,
    hi: resolvedHi
  };
  safeQuestion.question_en = resolvedEn;
  safeQuestion.question_text_en = resolvedEn;
  safeQuestion.question_hi = resolvedHi;
  safeQuestion.question_text_hi = resolvedHi;

  // Options sanitization
  let rawOptions = source.options;
  if (!rawOptions && ['A', 'B', 'C', 'D', 'E'].some((key) => source[`option_${key.toLowerCase()}`] !== undefined || source[`option_${key.toLowerCase()}_en`] !== undefined)) {
    rawOptions = ['A', 'B', 'C', 'D', 'E']
      .filter((key) => source[`option_${key.toLowerCase()}`] !== undefined || source[`option_${key.toLowerCase()}_en`] !== undefined)
      .map((key) => ({
        en: source[`option_${key.toLowerCase()}_en`] || source[`option_${key.toLowerCase()}`] || '',
        hi: source[`option_${key.toLowerCase()}_hi`] || ''
      }));
  }

  const sanitizeOption = (option) => {
    if (!option) return { en: '', hi: '' };
    if (typeof option === 'string') {
      if (hasDevanagari(option) && !hasLatin(option)) {
        return { en: '', hi: option };
      }
      return { en: option, hi: '' };
    }
    let optEn = String(option.en || option.text || '').trim();
    let optHi = String(option.hi || option.text_hi || '').trim();

    if (hasDevanagari(optEn) && !hasLatin(optEn)) {
      if (!optHi) optHi = optEn;
      optEn = hasLatin(option.en) ? option.en : '';
    }
    if (hasLatin(optHi) && !hasDevanagari(optHi) && !optEn) {
      optEn = optHi;
      optHi = '';
    }

    return { en: optEn, hi: optHi };
  };

  if (Array.isArray(rawOptions)) {
    safeQuestion.options = rawOptions.map(sanitizeOption);
  } else if (rawOptions && typeof rawOptions === 'object') {
    safeQuestion.options = Object.fromEntries(
      Object.entries(rawOptions)
        .filter(([key]) => /^[A-E]$/i.test(key))
        .map(([key, value]) => [key.toUpperCase(), sanitizeOption(value)])
    );
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
  const qText = question.question_text || question.question_en || question.question_text_en || question.question;
  if (!qText || (typeof qText === 'string' && !qText.trim()) || (typeof qText === 'object' && !qText.en && !qText.hi)) {
    errors.push('question_text (or question_en) is required.');
  }
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

function cleanLanguagePrefix(text, lang) {
  if (!text || typeof text !== 'string') return '';
  let str = text.trim();
  if (lang === 'hi') {
    str = str.replace(/^(?:Hindi|HI|हिंदी|हिन्दी)\s*[:：\-–—]\s*/i, '');
  } else {
    str = str.replace(/^(?:English|EN|अंग्रेजी|अंग्रेज़ी)\s*[:：\-–—]\s*/i, '');
  }
  return str.trim();
}

/**
 * Extracts and filters explanations by language:
 * - When language === 'hi', extracts ONLY Hindi explanation (stripping 'Hindi:' prefix)
 * - When language === 'en', extracts ONLY English explanation (stripping 'English:' prefix)
 */
export function extractLocalizedExplanation(rawExplanation, language = 'en', question = null) {
  // 1. Direct language-specific fields on question
  if (language === 'hi') {
    if (question?.explanation_hi && typeof question.explanation_hi === 'string' && question.explanation_hi.trim()) {
      return cleanLanguagePrefix(question.explanation_hi, 'hi');
    }
  } else {
    if (question?.explanation_en && typeof question.explanation_en === 'string' && question.explanation_en.trim()) {
      return cleanLanguagePrefix(question.explanation_en, 'en');
    }
  }

  // 2. Object format: { en: '...', hi: '...' }
  if (rawExplanation && typeof rawExplanation === 'object') {
    if (language === 'hi' && (rawExplanation.hi || rawExplanation.text_hi)) {
      return cleanLanguagePrefix(rawExplanation.hi || rawExplanation.text_hi, 'hi');
    }
    if (language === 'en' && (rawExplanation.en || rawExplanation.text_en || rawExplanation.text)) {
      return cleanLanguagePrefix(rawExplanation.en || rawExplanation.text_en || rawExplanation.text, 'en');
    }
  }

  const text = typeof rawExplanation === 'string' ? rawExplanation.trim() : '';
  if (!text) return '';

  // 3. Combined string format: "English: ... \n Hindi: ..."
  const enRegex = /(?:^|\n)\s*(?:English|EN|अंग्रेजी|अंग्रेज़ी)\s*[:：\-–—]\s*([\s\S]*?)(?=(?:\n\s*(?:Hindi|HI|हिंदी|हिन्दी)\s*[:：\-–—]|$))/i;
  const hiRegex = /(?:^|\n)\s*(?:Hindi|HI|हिंदी|हिन्दी)\s*[:：\-–—]\s*([\s\S]*?)(?=(?:\n\s*(?:English|EN|अंग्रेजी|अंग्रेज़ी)\s*[:：\-–—]|$))/i;

  const enMatch = text.match(enRegex);
  const hiMatch = text.match(hiRegex);

  if (language === 'hi') {
    if (hiMatch && hiMatch[1].trim()) {
      return cleanLanguagePrefix(hiMatch[1], 'hi');
    }
    // If no explicit header, but text contains Devanagari, return cleaned text
    if (hasDevanagari(text) && !enMatch) {
      return cleanLanguagePrefix(text, 'hi');
    }
    // If there is an English header, strip the English section out
    if (enMatch) {
      const stripped = text.replace(enRegex, '').trim();
      return cleanLanguagePrefix(stripped, 'hi');
    }
    return cleanLanguagePrefix(text, 'hi');
  } else {
    // English
    if (enMatch && enMatch[1].trim()) {
      return cleanLanguagePrefix(enMatch[1], 'en');
    }
    // If there's an explicit Hindi section in the text, strip it out completely
    if (hiMatch) {
      const withoutHindi = text.replace(hiRegex, '').trim();
      return cleanLanguagePrefix(withoutHindi, 'en');
    }
    return cleanLanguagePrefix(text, 'en');
  }
}

/**
 * Extracts distractor notes for a specific language
 */
export function extractLocalizedDistractorNote(note, language = 'en') {
  if (!note) return '';
  if (typeof note === 'object') {
    return language === 'hi'
      ? cleanLanguagePrefix(note.hi || note.text_hi || note.en || '', 'hi')
      : cleanLanguagePrefix(note.en || note.text || note.hi || '', 'en');
  }
  const str = String(note).trim();

  // Pattern: "Hindi text / English text" or "English text / Hindi text"
  if (str.includes(' / ') || str.includes(' | ')) {
    const parts = str.split(/\s*[/|]\s*/);
    if (parts.length >= 2) {
      const part0Dev = hasDevanagari(parts[0]);
      const part1Dev = hasDevanagari(parts[1]);
      if (part0Dev && !part1Dev) {
        return cleanLanguagePrefix(language === 'hi' ? parts[0] : parts[1], language);
      }
      if (!part0Dev && part1Dev) {
        return cleanLanguagePrefix(language === 'hi' ? parts[1] : parts[0], language);
      }
    }
  }

  // Header patterns: "English: ... \n Hindi: ..."
  const enMatch = str.match(/(?:^|\n)\s*(?:English|EN)\s*[:：\-–—]\s*([\s\S]*?)(?=(?:\n\s*(?:Hindi|HI)\s*[:：\-–—]|$))/i);
  const hiMatch = str.match(/(?:^|\n)\s*(?:Hindi|HI)\s*[:：\-–—]\s*([\s\S]*?)(?=(?:\n\s*(?:English|EN)\s*[:：\-–—]|$))/i);
  if (language === 'hi' && hiMatch) return cleanLanguagePrefix(hiMatch[1], 'hi');
  if (language === 'en' && enMatch) return cleanLanguagePrefix(enMatch[1], 'en');
  if (language === 'en' && hiMatch) return cleanLanguagePrefix(str.replace(hiMatch[0], ''), 'en');

  return cleanLanguagePrefix(str, language);
}


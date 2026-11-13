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
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (_) {}
  }
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

export function normalizeCorrectAnswer(raw, options = []) {
  if (raw === undefined || raw === null) return '';
  let str = '';
  if (Array.isArray(raw)) {
    str = String(raw[0] ?? '').trim();
  } else if (typeof raw === 'object') {
    str = String(raw.answer || raw.option || raw.value || raw.key || raw.id || raw.correct || '').trim();
  } else {
    str = String(raw).trim();
  }

  // Strip JSON formatting or outer quotes/brackets: e.g. '["A"]' -> 'A', '"A"' -> 'A'
  str = str.replace(/^\[\s*["']?|["']?\s*\]$/g, '').replace(/^["']|["']$/g, '').trim();

  // 1. Direct option letter match: A, B, C, D, E (or a, b, c, d, e)
  if (/^[A-E]$/i.test(str)) {
    return str.toUpperCase();
  }

  // 2. 1-based numeric: '1' -> 'A', '2' -> 'B', etc.
  if (/^[1-5]$/.test(str)) {
    return String.fromCharCode(65 + Number(str) - 1);
  }

  // 3. 0-based index: '0' -> 'A'
  if (str === '0') {
    return 'A';
  }

  // 4. Option key prefix like "Option A" or "Option (A)" or "(A)"
  const prefixMatch = str.match(/^(?:Option\s*)?\(?([A-E])\)?(?:\s*[:.\-]|$)/i);
  if (prefixMatch) {
    return prefixMatch[1].toUpperCase();
  }

  // 5. Match full text against options array or entries
  if (options && (Array.isArray(options) || typeof options === 'object')) {
    const entries = getOptionEntries(options);
    for (const [key, opt] of entries) {
      if (typeof opt === 'string' && opt.trim().toLowerCase() === str.toLowerCase()) {
        return key;
      }
      if (opt && typeof opt === 'object') {
        const en = String(opt.en || opt.text || opt.label || '').trim().toLowerCase();
        const hi = String(opt.hi || opt.text_hi || opt.label || '').trim().toLowerCase();
        if (en && en === str.toLowerCase()) return key;
        if (hi && hi === str.toLowerCase()) return key;
      }
    }
  }

  return str.toUpperCase();
}

export function sanitizeLiveQuestion(question) {
  const source = question || {};
  const safeQuestion = { ...source };
  for (const key of ['id', 'question_id', 'question_text', 'question_text_en', 'question_text_hi', 'question_en', 'question_hi', 'text', 'text_hi', 'subject', 'topic', 'tags', 'passage', 'image_url', 'language', 'explanation', 'explanation_en', 'explanation_hi', 'correct_answer', 'correct_option', 'answer', 'distractor_notes']) {
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
  if (typeof rawOptions === 'string') {
    try {
      rawOptions = JSON.parse(rawOptions);
    } catch (_) {}
  }

  // Handle { en: [...], hi: [...] } parallel arrays
  if (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions) && (Array.isArray(rawOptions.en) || Array.isArray(rawOptions.hi))) {
    const enArr = Array.isArray(rawOptions.en) ? rawOptions.en : [];
    const hiArr = Array.isArray(rawOptions.hi) ? rawOptions.hi : [];
    const maxLen = Math.max(enArr.length, hiArr.length);
    rawOptions = Array.from({ length: maxLen }, (_, i) => ({
      en: enArr[i] || '',
      hi: hiArr[i] || ''
    }));
  }

  // Fallback to option_a ... option_e if rawOptions is null or empty
  const hasValidRawOptions = rawOptions != null && (
    Array.isArray(rawOptions) ? rawOptions.length > 0 : (typeof rawOptions === 'object' && Object.keys(rawOptions).length > 0)
  );
  if (!hasValidRawOptions && ['A', 'B', 'C', 'D', 'E'].some((key) => {
    const k = key.toLowerCase();
    return source[`option_${k}`] !== undefined || source[`option_${k}_en`] !== undefined || source[`option_${k}_hi`] !== undefined;
  })) {
    rawOptions = ['A', 'B', 'C', 'D', 'E']
      .filter((key) => {
        const k = key.toLowerCase();
        return source[`option_${k}`] !== undefined || source[`option_${k}_en`] !== undefined || source[`option_${k}_hi`] !== undefined;
      })
      .map((key) => {
        const k = key.toLowerCase();
        return {
          id: key,
          en: source[`option_${k}_en`] || source[`option_${k}`] || '',
          hi: source[`option_${k}_hi`] || source[`option_${k}`] || ''
        };
      });
  }

  const sanitizeOption = (option) => {
    if (!option) return { en: '', hi: '' };
    if (typeof option === 'string') {
      if (hasDevanagari(option) && !hasLatin(option)) {
        return { en: '', hi: option };
      }
      return { en: option, hi: '' };
    }
    let optEn = String(option.en || option.text || option.label || option.value || '').trim();
    let optHi = String(option.hi || option.text_hi || '').trim();

    if (hasDevanagari(optEn) && !hasLatin(optEn)) {
      if (!optHi) optHi = optEn;
      optEn = hasLatin(option.en) ? option.en : '';
    }
    if (hasLatin(optHi) && !hasDevanagari(optHi) && !optEn) {
      optEn = optHi;
      optHi = '';
    }

    return typeof option === 'object' ? { ...option, en: optEn, hi: optHi } : { en: optEn, hi: optHi };
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

  // Authoritative correct answer resolution and normalization
  const rawCorrect =
    source.correct_answer ??
    source.correct_option ??
    source.answer ??
    source.right_option ??
    source.ans ??
    source.correctOption ??
    source.correctAnswer ??
    source.correct;

  const normalizedAnswer = normalizeCorrectAnswer(rawCorrect, safeQuestion.options);
  if (normalizedAnswer) {
    safeQuestion.correct_answer = normalizedAnswer;
    safeQuestion.correct_option = normalizedAnswer;
    safeQuestion.answer = normalizedAnswer;
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

/**
 * Parses explanation, distractor notes, and references from markdown/JSON
 */
export function parseStructuredExplanation(rawExplanation, distractorNotes = null, rawReference = null, language = 'en', question = null) {
  const localizedExp = extractLocalizedExplanation(rawExplanation, language, question) || '';

  // 1. Check for Reference / Source in text or question
  let reference = rawReference || question?.reference || question?.source || '';
  let cleanedExplanation = localizedExp;

  const refRegex = /(?:^|\n)\s*(?:Reference|Source|स्रोत|सन्दर्भ)\s*[:：\-–—]\s*([^\n]+)/i;
  const refMatch = cleanedExplanation.match(refRegex);
  if (refMatch) {
    if (!reference) reference = refMatch[1].trim();
    cleanedExplanation = cleanedExplanation.replace(refRegex, '').trim();
  }

  // 2. Check for Distractor notes in distractorNotes parameter
  const parsedDistractors = {};
  if (distractorNotes && typeof distractorNotes === 'object') {
    Object.entries(distractorNotes).forEach(([key, note]) => {
      const parsed = extractLocalizedDistractorNote(note, language);
      if (parsed) parsedDistractors[key.toUpperCase()] = parsed;
    });
  }

  // 3. If no distractor notes from object, parse from markdown sections inside explanation text
  const whyWrongRegex = /(?:^|\n)\s*(?:###?\s*)?(?:Why other options are wrong|Option Analysis|अन्य विकल्प क्यों गलत हैं\??|विकल्प विश्लेषण)\s*[:：\-–—]?\s*([\s\S]*)/i;
  const whyWrongMatch = cleanedExplanation.match(whyWrongRegex);

  if (whyWrongMatch) {
    const whyWrongSection = whyWrongMatch[1];
    cleanedExplanation = cleanedExplanation.slice(0, whyWrongMatch.index).trim();

    // Parse individual options from this section e.g. "• A: ...", "A. ...", "- Option A: ..."
    const optionLineRegex = /(?:^|\n)\s*[-*•]?\s*(?:Option\s*)?([A-E])\s*[:.\-–—)]\s*([^\n]+)/gi;
    let match;
    while ((match = optionLineRegex.exec(whyWrongSection)) !== null) {
      const optKey = match[1].toUpperCase();
      const optReason = match[2].trim();
      if (!parsedDistractors[optKey]) {
        parsedDistractors[optKey] = optReason;
      }
    }
  }

  // Fallback reference if none provided: generate contextual reference from question subject & topic
  if (!reference && question?.subject) {
    reference = `${question.subject} – Chapter: ${question.topic || question.chapter || 'Fundamentals'}, NCERT / Core Reference`;
  }

  return {
    mainExplanation: cleanedExplanation || localizedExp,
    distractorNotes: parsedDistractors,
    reference: reference
  };
}



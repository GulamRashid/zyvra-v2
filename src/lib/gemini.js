/**
 * ZYVRA AI Guru - Intelligent Academic Mentor Engine
 * 
 * Powered by Google Gemini API with fallback cascade,
 * configurable daily quotas, ZYVRA coins integration,
 * KaTeX formatting, and strict competitive exam guidelines.
 */

import { toLocalDateString } from './streak.js';

export const AI_USAGE_STORAGE_PREFIX = 'zyvra_ai_usage_';
export const AI_CONFIG_STORAGE_KEY = 'zyvra_ai_tutor_config_cache';

const FALLBACK_B64_KEY = 'QVEuQWI4Uk42SUdXV0ZQMUhUS0ltT21UMzNRUGU2Um82eGM2bnV6ci1UVHlPVUVRTnk2RUE=';

const decodeBase64 = (str) => {
  try {
    if (typeof atob === 'function') return atob(str);
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf8');
  } catch {
    return '';
  }
  return '';
};

const getEnvApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }
  return decodeBase64(FALLBACK_B64_KEY);
};

export const DEFAULT_AI_CONFIG = {
  enabled: true,
  apiKey: getEnvApiKey(),
  model: 'gemini-3.5-flash-lite',
  fallbackModels: ['gemini-3.5-flash', 'gemini-flash-lite-latest'],
  freeQuestionsPerDay: 3,
  coinsPerQuestion: 2,
  passUserDailyLimit: 50,
  systemPrompt: `You are Zyvra AI Guru (ज़ाइव्रा एआई गुरु), an elite, patient, warm, and inspiring academic mentor for Indian competitive exams (UPSC CSE, State PSC like BPSC, UPPSC, MPPSC, SSC CGL/CHSL, Railway RRB NTPC/Group D, Banking IBPS/SBI, Defence NDA/CDS, Police SI, and Teaching CTET exams).

CORE MISSION & ETHICS:
1. Identity: You are strictly "Zyvra AI Guru" of Zyvra Platform. Never mention Google, Gemini, Meta, OpenAI or third-party engines.
2. Tone & Feeling (भाव): Scholarly, encouraging, warm, humble, and pedagogically clear. Treat the student like a dedicated aspirant with heartfelt encouragement. Never sound robotic.
3. Language Adaptation:
   - If the student asks in Hindi, answer in clear, refined Hindi (Devanagari script) with standard exam terminology.
   - If the student asks in English, answer in clear English.
   - If the student asks in Hinglish, respond in natural bilingual Hinglish that is easy to comprehend.
4. Clean Typography & Zero Symbol Clutter:
   - Do NOT use unnecessary raw asterisks, double asterisks, or messy markdown hashes.
   - For lists, use clean bullets or numbered points (1., 2., 3.).
   - Write cleanly in well-spaced paragraphs without cluttered walls of text.
   - Ensure your explanations sound melodious, natural, and expressive when read aloud.
5. Structure:
   - Direct conceptual answer in 1-2 introductory sentences.
   - Key exam facts / pointers in clear, crisp bullets.
   - "Exam Shortcut / Smarter Method" where applicable for Math/Reasoning.
   - "Common Pitfall / Where Students Make Mistakes" so the student avoids traps.
   - Standard LaTeX math notation for all equations and numbers (enclosed in $...$ for inline or $$...$$ for display formulas).
6. Strict Non-Exam Query Refusal:
   - If a student asks questions about movies, gaming, entertainment, celebrity gossip, software hacking, or personal non-study topics, politely refuse:
     "मैं Zyvra AI Guru हूँ—आपकी प्रतियोगी परीक्षा की तैयारी के लिए समर्पित। कृपया अपनी परीक्षा, विषय (GS, Math, Reasoning, English, Current Affairs) से जुड़ा प्रश्न पूछें!"`
};

/**
 * Fetch AI configuration from Supabase platform_settings or fallback to cache / defaults
 */
export async function getAiConfig(supabase = null) {
  let cached = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (raw) cached = JSON.parse(raw);
    } catch {
      // Ignore localStorage parse error
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'ai_tutor_config')
        .maybeSingle();

      if (!error && data?.setting_value && typeof data.setting_value === 'object') {
        const dbConfig = data.setting_value;
        const merged = {
          ...DEFAULT_AI_CONFIG,
          ...dbConfig,
          apiKey: (dbConfig.apiKey && String(dbConfig.apiKey).trim()) ? String(dbConfig.apiKey).trim() : getEnvApiKey()
        };
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(merged));
          } catch { /* ignore */ }
        }
        return merged;
      }
    } catch (err) {
      console.warn('Unable to load AI config from database:', err);
    }
  }

  if (cached) {
    if (!cached.apiKey || !cached.apiKey.trim()) {
      cached.apiKey = getEnvApiKey();
    }
    return cached;
  }

  return DEFAULT_AI_CONFIG;
}

/**
 * Save updated AI configuration to Supabase platform_settings (Admin use)
 */
export async function saveAiConfig(supabase, newConfig) {
  const merged = { ...DEFAULT_AI_CONFIG, ...newConfig };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(merged));
    } catch { /* ignore */ }
  }

  if (supabase) {
    const { error } = await supabase
      .from('platform_settings')
      .upsert({
        setting_key: 'ai_tutor_config',
        setting_value: merged,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (error) throw error;
  }

  return merged;
}

/**
 * Get daily AI query usage for a student
 */
export function getDailyAiUsage(userId = 'guest') {
  if (typeof window === 'undefined') return { used: 0, date: toLocalDateString() };
  const todayKey = toLocalDateString();
  const storageKey = `${AI_USAGE_STORAGE_PREFIX}${userId || 'guest'}_${todayKey}`;
  try {
    const count = Number(window.localStorage.getItem(storageKey)) || 0;
    return { used: count, date: todayKey };
  } catch {
    return { used: 0, date: todayKey };
  }
}

/**
 * Increment daily AI query usage
 */
export function incrementDailyAiUsage(userId = 'guest') {
  if (typeof window === 'undefined') return 1;
  const todayKey = toLocalDateString();
  const storageKey = `${AI_USAGE_STORAGE_PREFIX}${userId || 'guest'}_${todayKey}`;
  try {
    const current = Number(window.localStorage.getItem(storageKey)) || 0;
    const next = current + 1;
    window.localStorage.setItem(storageKey, String(next));
    return next;
  } catch {
    return 1;
  }
}

/**
 * Check if the student is permitted to ask an AI question (Free quota or coins)
 */
export function checkAiPermission(userId = 'guest', userCoins = 0, config = DEFAULT_AI_CONFIG, hasToolAccess = false) {
  if (!config.enabled) {
    return {
      allowed: false,
      isFree: false,
      freeLeft: 0,
      coinsNeeded: 0,
      reason: 'ai_disabled',
      messageHi: 'Zyvra AI Guru अभी अस्थायी रूप से मेंटेनेंस में है। कृपया थोड़ी देर बाद प्रयास करें।',
      messageEn: 'Zyvra AI Guru is temporarily undergoing maintenance. Please try again soon.'
    };
  }

  const { used } = getDailyAiUsage(userId);
  const freeLimit = config.freeQuestionsPerDay !== undefined && config.freeQuestionsPerDay !== null ? Number(config.freeQuestionsPerDay) : 3;
  const coinsRequired = config.coinsPerQuestion !== undefined && config.coinsPerQuestion !== null ? Number(config.coinsPerQuestion) : 2;
  const passDailyLimit = config.passUserDailyLimit !== undefined && config.passUserDailyLimit !== null ? Number(config.passUserDailyLimit) : 50;

  // Paid / Pass holder check
  if (hasToolAccess) {
    if (used < passDailyLimit) {
      return {
        allowed: true,
        isFree: true,
        freeLeft: passDailyLimit - used,
        coinsNeeded: 0,
        isPassUser: true
      };
    }
    return {
      allowed: false,
      isFree: false,
      freeLeft: 0,
      coinsNeeded: coinsRequired,
      reason: 'daily_pass_limit_reached',
      messageHi: `आज की दैनिक सीमा (${passDailyLimit} सवाल) पूरी हो चुकी है। कृपया कल दोबारा पूछें।`,
      messageEn: `Daily limit of ${passDailyLimit} queries reached. Please resume tomorrow.`
    };
  }

  // Free quota available
  if (used < freeLimit) {
    return {
      allowed: true,
      isFree: true,
      freeLeft: freeLimit - used,
      coinsNeeded: 0,
      isPassUser: false
    };
  }

  // Free quota used up, check coins
  if (userCoins >= coinsRequired) {
    return {
      allowed: true,
      isFree: false,
      freeLeft: 0,
      coinsNeeded: coinsRequired,
      isPassUser: false
    };
  }

  return {
    allowed: false,
    isFree: false,
    freeLeft: 0,
    coinsNeeded: coinsRequired,
    reason: 'insufficient_coins',
    messageHi: `आज के मुफ़्त सवाल पूरे हो चुके हैं। अगला सवाल पूछने के लिए ${coinsRequired} ZYVRA Coins चाहिए। (आपका बैलेंस: ${userCoins} सिक्के)`,
    messageEn: `Daily free questions exhausted. Asking another requires ${coinsRequired} ZYVRA Coins. (Your balance: ${userCoins} coins)`
  };
}

/**
 * Call Google Gemini API to generate explanation or answer doubt
 */
export async function queryZyvraAiGuru({
  prompt,
  context = '',
  conversationHistory = [],
  config = DEFAULT_AI_CONFIG
}) {
  if (!prompt || !prompt.trim()) {
    throw new Error('Please enter a question or problem statement.');
  }

  const apiKey = config.apiKey || DEFAULT_AI_CONFIG.apiKey;
  if (!apiKey) {
    throw new Error('AI engine API key is missing. Please contact admin.');
  }

  const systemInstructionText = config.systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;
  const modelsToTry = [
    config.model || 'gemini-3.5-flash-lite',
    ...(config.fallbackModels || ['gemini-3.5-flash', 'gemini-flash-lite-latest'])
  ];

  // Build clean contents payload
  const contents = [];

  // Add conversation history (up to last 6 messages to keep latency low & free quota safe)
  const recentHistory = (conversationHistory || []).slice(-6);
  recentHistory.forEach((msg) => {
    if (msg.role === 'user' || msg.role === 'model') {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      });
    }
  });

  // Current prompt with optional exam/question context
  let finalUserPrompt = prompt.trim();
  if (context && context.trim()) {
    finalUserPrompt = `[Context / Reference Question]:\n${context.trim()}\n\n[Student Doubt / Query]:\n${prompt.trim()}`;
  }

  contents.push({
    role: 'user',
    parts: [{ text: finalUserPrompt }]
  });

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData?.error?.message || `HTTP ${response.status} from model ${model}`;
        // If 503 (high demand) or 404, try next model in cascade
        if (response.status === 503 || response.status === 404) {
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const answerText = candidate?.content?.parts?.[0]?.text;

      if (!answerText) {
        throw new Error('AI returned an empty response. Please try rephrasing your question.');
      }

      return {
        text: answerText,
        modelUsed: model,
        finishReason: candidate.finishReason || 'STOP'
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not connect to Zyvra AI. Please try again.');
}

/**
 * Safely parse JSON array returned by Gemini
 */
export function extractJsonArray(rawText) {
  let cleaned = String(rawText || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Senior Chief Examiner PCS Question Generator
 * 
 * Generates authentic, high-caliber, multi-statement examination questions
 * modeled after State PSC (BPSC, UPPSC, MPPSC) and UPSC Civil Services papers.
 */
export async function generatePcsExamQuestions({
  subject = 'General Studies',
  topic = 'General Overview',
  subtopic = '',
  examTarget = 'bpsc', // 'bpsc' | 'uppsc' | 'mppsc' | 'general_pcs' | 'upsc'
  questionMix = 'balanced', // 'balanced' | 'statements' | 'assertion_reason' | 'match_columns' | 'standard'
  difficulty = 'pcs_prelims', // 'moderate' | 'pcs_prelims' | 'pcs_advanced'
  count = 5,
  chapterId = null,
  config = DEFAULT_AI_CONFIG
}) {
  const apiKey = config.apiKey || DEFAULT_AI_CONFIG.apiKey;
  if (!apiKey) {
    throw new Error('AI engine API key is missing. Please configure Gemini API key.');
  }

  const isBpsc = examTarget.toLowerCase().includes('bpsc');
  const targetExamLabel = {
    bpsc: 'BPSC (Bihar Public Service Commission - 5 options with Option E)',
    uppsc: 'UPPSC (Uttar Pradesh Public Service Commission - 4 options, Assertion-Reason & Match List)',
    mppsc: 'MPPSC (Madhya Pradesh Public Service Commission - 4 options)',
    upsc: 'UPSC Civil Services Prelims (High Analytical Depth, Statement Evaluation)',
    general_pcs: 'State PCS Examination (High Quality Analytical MCQ)'
  }[examTarget] || 'State PCS Examination';

  const systemInstruction = `You are a Senior Question Paper Setter & Chief Examiner for Indian State Public Service Commissions (BPSC, UPPSC, MPPSC, RAS, JPSC) and UPSC Civil Services with 20+ years of paper moderation experience.

CORE PHILOSOPHY & EXAMINER RULES:
1. NO TRIVIAL QUESTIONS: Never generate superficial one-liners. Emulate authentic State PSC preliminary exam papers.
2. AUTHORITY & SOURCE GROUNDING: Ground questions in NCERT (Class 6-12), M. Laxmikanth (Polity), Bipin Chandra & Spectrum Rajiv Ahir (Modern History), GC Leong & Majid Husain (Geography), Ramesh Singh & Economic Survey (Economy), and authentic state gazettes.
3. BILINGUAL EXCELLENCE:
   - Provide "question_text" in clear, formal English.
   - Provide "question_text_hi" in authentic, standard Devanagari Hindi using official commission terminology (e.g., 'अनुच्छेद', 'संवैधानिक संशोधन', 'अधिनियम', 'प्रायद्वीपीय', 'अपवाह तंत्र').
   - Provide options in both English and Hindi.
4. EXAM PATTERN & OPTIONS SPECIFICATION:
   ${isBpsc ? `- BPSC SPECIAL RULE: Each question MUST have exactly 5 options (A, B, C, D, E).
   Option E MUST be strictly:
   {"en": "None of the above / More than one of the above", "hi": "उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक"}
   - Option E can be the correct answer if appropriate.` : `- Provide exactly 4 options (A, B, C, D) with distinct plausible choices.`}
5. QUESTION FORMAT MIX:
   ${questionMix === 'statements' ? '- Use Multi-statement format: "Consider the following statements... 1, 2, 3... Which of the statements given above is/are correct? (A) 1 only (B) 2 only (C) 1 and 2 (D) Neither 1 nor 2"' :
   questionMix === 'assertion_reason' ? '- Use Assertion-Reason format: "Assertion (A): ... Reason (R): ... Codes: (A) Both A and R are true and R is the correct explanation of A..."' :
   questionMix === 'match_columns' ? '- Use Match the Following: "Match List-I with List-II and select the correct answer using the codes given below..."' :
   '- Create a rich mix of Multi-Statement evaluation ("कथनों पर विचार कीजिए"), Assertion-Reason, and analytical single questions.'}
6. DISTRACTOR (TRAP) ENGINEERING:
   - The incorrect options must be realistic traps that test student vigilance against common misconceptions, near-miss years, swapped terms, or partial truths.
   - For each incorrect option, include a brief note in "distractor_notes" explaining why an aspirant might mistakenly choose it and why it is wrong.
7. COMPREHENSIVE EXPLANATION:
   - Provide a thorough, authoritative explanation in "explanation" (English) and "explanation_hi" (Hindi) explaining why the correct answer is right, citing the specific Article, Act, or historical fact.
   - Use KaTeX math ($...$) for any formula or equation.

OUTPUT FORMAT:
You MUST respond ONLY with a valid JSON array of question objects. Do not include markdown code blocks or surrounding text.
Example JSON schema per question:
{
  "question_text": "English question",
  "question_text_hi": "हिंदी प्रश्न",
  "question_type": "mcq",
  "options": [
    { "en": "Option A in English", "hi": "विकल्प A हिंदी में" },
    { "en": "Option B in English", "hi": "विकल्प B हिंदी में" },
    { "en": "Option C in English", "hi": "विकल्प C हिंदी में" },
    { "en": "Option D in English", "hi": "विकल्प D हिंदी में" }
    ${isBpsc ? ',{ "en": "None of the above / More than one of the above", "hi": "उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक" }' : ''}
  ],
  "correct_answer": "A",
  "explanation": "Detailed conceptual explanation in English...",
  "explanation_hi": "विस्तृत व्याख्या हिंदी में...",
  "distractor_notes": {
    "B": "Why B is a trap",
    "C": "Why C is incorrect"
  },
  "subject": "${subject}",
  "difficulty": "${difficulty === 'pcs_advanced' ? 'hard' : difficulty === 'moderate' ? 'medium' : 'hard'}",
  "tags": ["${examTarget.toUpperCase()}", "${subject}", "${topic}"]
}`;

  const prompt = `Generate exactly ${count} authentic ${targetExamLabel} examination questions on the following curriculum:
- Subject: ${subject}
- Main Topic: ${topic}
${subtopic ? `- Specific Sub-topic: ${subtopic}` : ''}
- Target Standard: ${difficulty}
- Pattern Focus: ${questionMix}

Ensure all ${count} questions are deep, rigorous, authentically phrased, and formatted as a strict JSON array conforming to the specified schema.`;

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    config.model || 'gemini-3.5-flash-lite',
    ...(config.fallbackModels || ['gemini-3.5-flash', 'gemini-flash-lite-latest'])
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.35,
          maxOutputTokens: 8192
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData?.error?.message || `HTTP ${response.status} from model ${model}`;
        if (response.status === 503 || response.status === 404) {
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('AI returned an empty question batch.');
      }

      const questions = extractJsonArray(rawText);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('AI failed to format questions as a valid JSON array.');
      }

      // Attach chapter_id if provided
      return questions.map((q) => ({
        ...q,
        chapter_id: chapterId || null,
        status: 'published',
        usage_scope: 'both'
      }));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not generate questions with PCS Examiner engine.');
}


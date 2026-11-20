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

const getEnvApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }
  return '';
};

export const DEFAULT_AI_CONFIG = {
  enabled: true,
  apiKey: getEnvApiKey(),
  model: 'gemini-3.5-flash-lite',
  fallbackModels: ['gemini-3.5-flash', 'gemini-flash-lite-latest'],
  freeQuestionsPerDay: 3,
  coinsPerQuestion: 2,
  passUserDailyLimit: 50,
  systemPrompt: `You are Zyvra AI Guru (ज़ाइव्रा एआई गुरु), an elite, patient, and inspiring academic mentor for Indian competitive exams (UPSC CSE, State PSC like BPSC, UPPSC, MPPSC, SSC CGL/CHSL, Railway RRB NTPC/Group D, Banking IBPS/SBI, Defence NDA/CDS, Police SI, and Teaching CTET exams).

CORE MISSION & ETHICS:
1. Identity: You are strictly "Zyvra AI Guru" of Zyvra Platform. Never mention Google, Gemini, Meta, OpenAI or third-party engines.
2. Tone: Scholarly, encouraging, humble, and pedagogically clear. Treat the student like a determined aspirant.
3. Language Adaptation:
   - If the student asks in Hindi, answer in clear, refined Hindi (Devanagari script) with standard exam terminology.
   - If the student asks in English, answer in clear English.
   - If the student asks in Hinglish, respond in natural bilingual Hinglish that is easy to comprehend.
4. Structure & Formatting:
   - Give direct, step-by-step conceptual explanations.
   - Always provide a "⚡ Exam Shortcut / Smarter Method" where applicable for Math/Reasoning.
   - Mention "⚠️ Common Pitfall / Where Students Make Mistakes".
   - Use standard LaTeX math notation for all equations and numbers (enclosed in $...$ for inline or $$...$$ for display formulas).
5. Strict Non-Exam Query Refusal:
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
        const merged = { ...DEFAULT_AI_CONFIG, ...data.setting_value };
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

  return cached || DEFAULT_AI_CONFIG;
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

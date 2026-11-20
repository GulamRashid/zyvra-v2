/**
/**
 * ZYVRA Speech Audio Voice Engine
 * 
 * Refined, expressive text-to-speech with natural cadence,
 * emoji/symbol scrubbing, mathematical transliteration,
 * and smart OS voice selection (Google Hindi, Microsoft Hemant, etc.)
 */

/**
 * Clean and prepare text for natural, melodious speech
 * - Strips emojis and pictographs so screen readers don't read them aloud
 * - Replaces LaTeX math symbols with natural spoken words (उदा. बटा, अंडर रूट, प्रतिशत)
 * - Removes markdown asterisks, hashes, brackets, and code delimiters
 */
export function prepareSpeechText(rawText) {
  if (!rawText) return '';

  let s = String(rawText);

  // 1. Remove markdown links [title](url) -> title
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 2. Math transliterations to natural Hindi / English spoken terms
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 बटा $2');
  s = s.replace(/\\sqrt\{([^}]+)\}/g, 'अंडर रूट $1');
  s = s.replace(/\\times|\\cdot/g, ' गुणा ');
  s = s.replace(/\\approx/g, ' लगभग ');
  s = s.replace(/\\le|\\leq/g, ' से कम या बराबर ');
  s = s.replace(/\\ge|\\geq/g, ' से अधिक या बराबर ');
  s = s.replace(/\\neq/g, ' बराबर नहीं ');
  s = s.replace(/\\pm/g, ' प्लस माइनस ');
  s = s.replace(/\\degree|°/g, ' डिग्री ');
  s = s.replace(/\\pi/g, ' पाई ');
  s = s.replace(/\\theta/g, ' थीटा ');
  s = s.replace(/\\Delta/g, ' डेल्टा ');
  s = s.replace(/km\/h/g, ' किलोमीटर प्रति घंटा ');
  s = s.replace(/m\/s/g, ' मीटर प्रति सेकंड ');
  s = s.replace(/cm|सेमी/g, ' सेंटीमीटर ');
  s = s.replace(/%/g, ' प्रतिशत ');
  s = s.replace(/=/g, ' बराबर ');
  s = s.replace(/\+/g, ' प्लस ');
  s = s.replace(/\^2/g, ' स्क्वायर ');
  s = s.replace(/\^3/g, ' क्यूब ');

  // 3. Remove all Unicode emojis and pictographs (⚡, 🏔️, 📖, ⚠️, 📌, etc.)
  try {
    s = s.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\ufe0f]/gu, '');
  } catch {
    // Fallback regex if unicode property escapes are restricted
    s = s.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '');
  }

  // 4. Remove special decorative symbols, bullets, hashes, asterisks
  s = s.replace(/[✦★⚡⚠️📌🚀🏔️📖💡•–—_`~|]/g, ' ');
  s = s.replace(/^#+\s+/gm, '');
  s = s.replace(/\*+/g, '');
  s = s.replace(/\$+/g, '');
  s = s.replace(/[{}[\]\\]/g, ' ');

  // 5. Clean up redundant spaces and empty lines
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Split text into natural conversational sentence chunks
 * for expressive pauses and avoiding browser synthesis timeouts
 */
export function splitIntoSentences(text) {
  if (!text) return [];
  // Split on Hindi Purna Viram (।), full stop, question mark, exclamation, or newline
  const matches = text.match(/[^।?!.\n]+[।?!.\n]?/g);
  if (!matches) return [text];
  return matches.map((m) => m.trim()).filter(Boolean);
}

/**
 * Choose the most expressive, natural-sounding voice from the browser's voice list
 */
export function pickBestVoice(voices, lang = 'hi-IN') {
  if (!voices || voices.length === 0) return null;

  const isHindi = lang.toLowerCase().startsWith('hi');

  if (isHindi) {
    // 1. Premium natural Hindi voices (Google Hindi, Microsoft Hemant/Kalpana, Swara)
    const naturalHindi = voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      const isHi = vLang.includes('hi') || vLang.includes('hindi');
      return isHi && (vName.includes('google') || vName.includes('natural') || vName.includes('hemant') || vName.includes('kalpana') || vName.includes('lekha') || vName.includes('swara') || vName.includes('online'));
    });
    if (naturalHindi) return naturalHindi;

    // 2. Any Hindi voice
    const anyHindi = voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase();
      return vLang.includes('hi') || vLang.includes('hindi');
    });
    if (anyHindi) return anyHindi;

    // 3. Indian English voice (sounds natural for Hinglish)
    const indianEn = voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      return vLang.includes('en-in') || vLang.includes('en_in') || vName.includes('india') || vName.includes('ravi') || vName.includes('heera');
    });
    if (indianEn) return indianEn;
  } else {
    // English requested: prefer Indian English for familiar accent
    const indianEn = voices.find((v) => {
      const vLang = (v.lang || '').toLowerCase();
      return vLang.includes('en-in') || vLang.includes('en_in') || (v.name || '').toLowerCase().includes('india');
    });
    if (indianEn) return indianEn;

    const naturalEn = voices.find((v) => {
      const vName = (v.name || '').toLowerCase();
      return vName.includes('google') || vName.includes('natural');
    });
    if (naturalEn) return naturalEn;
  }

  // Fallback to default system voice
  return voices.find((v) => v.default) || voices[0];
}

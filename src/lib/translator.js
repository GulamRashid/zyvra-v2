export async function translateText(text, targetLang = 'hi') {
  if (!text) return '';
  // Safe client-side fallback: avoids unofficial Google scraping endpoints that cause HTTP 429
  // and leak examination questions over third-party networks.
  // Questions and options are stored bilingual in Supabase (question_en, question_hi, etc.)
  return text;
}

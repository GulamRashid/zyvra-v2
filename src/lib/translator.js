export async function translateText(text, targetLang = 'hi') {
  if (!text) return '';
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error(`Translation request failed with HTTP ${res.status}.`);
    const data = await res.json();
    return data[0].map((x) => x[0]).join('');
  } catch (e) {
    console.error('Translation failed:', e);
    return text;
  }
}

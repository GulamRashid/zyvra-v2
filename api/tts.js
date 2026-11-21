/**
 * ZYVRA Neural TTS Serverless Handler
 *
 * Converts educational Hindi / English explanations into natural,
 * crystal-clear MP3 speech using Google's Neural TTS Engine.
 * Supports sentence chunking, mathematical symbol transliteration,
 * and immutable CDN caching.
 */

import { prepareSpeechText, splitIntoSentences } from '../src/lib/speechVoice.js';

/**
 * Split text into chunks safe for Google TTS (<180 chars per chunk)
 */
function chunkForTTS(text, maxChars = 175) {
  const sentences = splitIntoSentences(text);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= maxChars) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      // If a single sentence is longer than maxChars, break by commas or spaces
      if (sentence.length > maxChars) {
        const words = sentence.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxChars) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
        else current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, maxChars)];
}

export default async function handler(req, res) {
  const isWebStandard = typeof res === 'undefined' || typeof res?.status !== 'function';

  // Support GET and POST
  let text = '';
  let lang = 'hi';

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    text = url.searchParams.get('text') || '';
    lang = url.searchParams.get('lang') || 'hi';
  } else if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    text = body?.text || '';
    lang = body?.lang || 'hi';
  } else {
    if (isWebStandard) {
      return new Response('Method Not Allowed', { status: 405 });
    }
    res.status(405).send('Method Not Allowed');
    return;
  }

  const cleaned = prepareSpeechText(text);
  if (!cleaned) {
    if (isWebStandard) {
      return new Response('Missing text parameter', { status: 400 });
    }
    res.status(400).send('Missing text parameter');
    return;
  }

  // Normalize language: 'hi' or 'en'
  const isHindi = lang.toLowerCase().startsWith('hi');
  const targetLang = isHindi ? 'hi' : 'en-IN';

  try {
    const chunks = chunkForTTS(cleaned, 175);
    const audioBuffers = [];

    for (const chunk of chunks) {
      const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${targetLang}&client=tw-ob`;
      const gRes = await fetch(gUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });

      if (!gRes.ok) {
        throw new Error(`Google TTS returned ${gRes.status}`);
      }

      const arrayBuf = await gRes.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuf));
    }

    const combinedMp3 = Buffer.concat(audioBuffers);

    if (isWebStandard) {
      return new Response(combinedMp3, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(combinedMp3.byteLength),
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable'
        }
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', combinedMp3.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    res.status(200).send(combinedMp3);
  } catch (err) {
    console.error('TTS generation failed:', err);
    if (isWebStandard) {
      return new Response(JSON.stringify({ error: err.message || 'TTS generation failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
}

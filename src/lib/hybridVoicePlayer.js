/**
 * ZYVRA Hybrid Realistic Voice Audio Player
 * 
 * Provides ultra-realistic human speech for Quiz Walkman and AI Guru:
 * 1. Primary: Cloud Neural TTS (Crystal-clear, natural human intonation)
 * 2. Smart In-Memory & Blob Caching (Instant replay, zero redundant data)
 * 3. Background Preloader (0ms delay between consecutive question audios)
 * 4. Fallback: Browser Web Speech Synthesis with pickBestVoice (offline/slow network protection)
 */

import { prepareSpeechText, pickBestVoice, splitIntoSentences } from './speechVoice.js';

// Global cache for audio blob object URLs
const audioBlobCache = new Map();

// Active playback handle
let currentAudio = null;
let currentUtteranceStop = null;
let currentPlayingId = null;

/**
 * Generate a lightweight cache key from text and language
 */
function getCacheKey(text, lang) {
  const normText = String(text || '').trim().slice(0, 300);
  return `${lang || 'hi'}_${normText.length}_${normText.slice(0, 40)}`;
}

/**
 * Fetch studio-grade Neural Speech Audio
 * 1. Checks /api/tts endpoint (running Gemini Neural TTS)
 * 2. Falls back to direct client-side Gemini Neural TTS with VITE_GEMINI_API_KEY
 */
async function fetchNeuralSpeechBlob(cleaned, lang) {
  const isHindi = String(lang).toLowerCase().startsWith('hi');
  const targetLang = isHindi ? 'hi' : 'en-IN';

  // 1. First attempt: call /api/tts endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`/api/tts?lang=${targetLang}&text=${encodeURIComponent(cleaned)}`, {
      method: 'GET',
      headers: { Accept: 'audio/wav, audio/mpeg, */*' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && !contentType.includes('text/html')) {
      const blob = await res.blob();
      if (blob.size > 200) {
        return URL.createObjectURL(blob);
      }
    }
  } catch (err) {
    console.warn('API TTS fetch note:', err.message);
  }

  // 2. Direct client-side Gemini Neural TTS call if API route didn't return audio
  const apiKey = (import.meta.env?.VITE_GEMINI_API_KEY || '').trim();
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`;
      const voiceName = isHindi ? 'Sulafat' : 'Kore';
      const style = isHindi
        ? 'confident, articulate Indian teacher speaking clear Hindi at standard 1x conversational speed with crisp pronunciation and fluent tempo'
        : 'confident, articulate educator speaking clear English at standard 1x conversational speed with crisp pronunciation and fluent tempo';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.8-flash-lite-tts',
          input: [{
            type: 'user_input',
            content: [{
              type: 'text',
              text: cleaned,
              annotations: [{
                type: 'speech_metadata',
                style
              }]
            }]
          }],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [{ voice: voiceName }]
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        for (const step of (data.steps || [])) {
          for (const item of (step.content || [])) {
            if (item.type === 'audio' && item.data) {
              const byteCharacters = atob(item.data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: item.mime_type || 'audio/wav' });
              return URL.createObjectURL(blob);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Client Gemini TTS note:', err.message);
    }
  }

  return null;
}

/**
 * Preload audio into memory cache silently in the background
 */
export async function preloadAudio(rawText, lang = 'hi') {
  if (typeof window === 'undefined') return;
  const cleaned = prepareSpeechText(rawText);
  if (!cleaned) return;

  const key = getCacheKey(cleaned, lang);
  if (audioBlobCache.has(key)) return;

  try {
    const objectUrl = await fetchNeuralSpeechBlob(cleaned, lang);
    if (objectUrl) {
      audioBlobCache.set(key, objectUrl);
    }
  } catch (_) {
    // Non-fatal, silent background preload catch
  }
}

/**
 * Stop any ongoing speech playback (both HTML5 audio and browser synthesis)
 */
export function stopSpeech() {
  currentPlayingId = null;

  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch {
      // Ignored
    }
    currentAudio = null;
  }

  if (currentUtteranceStop) {
    try {
      currentUtteranceStop();
    } catch {
      // Ignored
    }
    currentUtteranceStop = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignored
    }
  }
}

/**
 * Fallback to browser SpeechSynthesis with best voice and sentence chunking
 */
function playFallbackBrowserTTS(cleanedText, lang, { onStart, onEnd, onError, playbackId, voices = [] }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const sentences = splitIntoSentences(cleanedText);
    const chosenVoice = pickBestVoice(voices.length > 0 ? voices : window.speechSynthesis.getVoices(), lang);

    let currentIdx = 0;
    let isCancelled = false;

    currentUtteranceStop = () => {
      isCancelled = true;
      window.speechSynthesis.cancel();
    };

    if (onStart) onStart();

    const speakNext = () => {
      if (isCancelled || currentPlayingId !== playbackId || currentIdx >= sentences.length) {
        currentUtteranceStop = null;
        if (onEnd) onEnd();
        return;
      }

      const sentence = sentences[currentIdx++];
      if (!sentence) {
        speakNext();
        return;
      }

      const UtteranceClass = window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
      const utterance = new UtteranceClass(sentence);
      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.lang = chosenVoice?.lang || (lang.startsWith('hi') ? 'hi-IN' : 'en-US');
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        setTimeout(speakNext, 80);
      };

      utterance.onerror = (e) => {
        console.warn('Browser TTS utterance note:', e);
        if (currentIdx >= sentences.length) {
          if (onEnd) onEnd();
        } else {
          speakNext();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  } catch (err) {
    console.error('Fallback TTS failed:', err);
    if (onError) onError(err);
    else if (onEnd) onEnd();
  }
}

/**
 * Play text using Ultra-Realistic Neural AI Voice with Fallback to Browser HD Voice
 * 
 * @param {string} rawText Text to speak
 * @param {Object} options
 * @param {string} options.lang 'hi' or 'en'
 * @param {Function} options.onStart Callback when audio starts
 * @param {Function} options.onEnd Callback when audio finishes
 * @param {Function} options.onError Callback on failure
 * @param {Array} options.voices Optional OS voice list for fallback
 */
export async function playRealisticSpeech(rawText, options = {}) {
  const {
    lang = 'hi',
    onStart = () => {},
    onEnd = () => {},
    onError = () => {},
    voices = []
  } = options;

  stopSpeech();

  const cleaned = prepareSpeechText(rawText);
  if (!cleaned) {
    onEnd();
    return;
  }

  const playbackId = `playback_${Date.now()}_${Math.random()}`;
  currentPlayingId = playbackId;

  const key = getCacheKey(cleaned, lang);
  let audioSrc = audioBlobCache.get(key) || null;

  // 1. Try to fetch from Neural TTS if not in cache
  if (!audioSrc) {
    audioSrc = await fetchNeuralSpeechBlob(cleaned, lang);
    if (audioSrc) {
      audioBlobCache.set(key, audioSrc);
    }
  }

  // Check if cancelled while fetching
  if (currentPlayingId !== playbackId) return;

  // 2. If Neural Audio is ready, play via HTML5 Audio element
  if (audioSrc) {
    try {
      const audio = new Audio(audioSrc);
      audio.playbackRate = 1.08;
      currentAudio = audio;

      audio.onplay = () => {
        if (currentPlayingId === playbackId) {
          onStart();
        }
      };

      audio.onended = () => {
        if (currentPlayingId === playbackId) {
          currentAudio = null;
          onEnd();
        }
      };

      audio.onerror = () => {
        console.warn('HTML5 Audio playback error, falling back to browser TTS');
        if (currentPlayingId === playbackId) {
          currentAudio = null;
          playFallbackBrowserTTS(cleaned, lang, { onStart, onEnd, onError, playbackId, voices });
        }
      };

      await audio.play();
      return;
    } catch (playErr) {
      console.warn('Audio.play() error (autoplay restriction or decode), falling back:', playErr);
    }
  }

  // 3. Fallback: Browser Web Speech API
  playFallbackBrowserTTS(cleaned, lang, { onStart, onEnd, onError, playbackId, voices });
}

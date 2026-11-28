/**
 * ZYVRA Hybrid Realistic Voice Audio Player
 * 
 * Provides ultra-realistic human speech for Quiz Walkman and AI Guru:
 * 1. Primary: Cloud Neural TTS (Crystal-clear, natural human intonation)
 * 2. Smart In-Memory & Blob Caching (Instant replay, zero redundant data)
 * 3. Background Preloader (0ms delay between consecutive question audios)
 * 4. Fallback: Browser Web Speech Synthesis with pickBestVoice (offline/slow network protection)
 */

import { pcm16ToWav, prepareSpeechText, pickBestVoice, splitIntoSentences } from './speechVoice.js';

// Global cache for audio { objectUrl, arrayBuffer }
const audioBlobCache = new Map();

// Active playback handle
let currentAudio = null;
let currentBufferSource = null;
let currentUtteranceStop = null;
let currentPlayingId = null;

// Shared Web Audio API context — unlocked synchronously during user gesture
let sharedAudioCtx = null;

function getUnlockedAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Generate a lightweight cache key from text and language
 */
function getCacheKey(text, lang) {
  const normText = String(text || '').trim().slice(0, 300);
  return `${lang || 'hi'}_${normText.length}_${normText.slice(0, 40)}`;
}

/**
 * Direct client-side Gemini Neural TTS
 * Primary: gemini-2.5-flash-preview-tts (AI Studio speech model, ~4s latency)
 * Fallback: gemini-3.8-flash-tts (Interactions API)
 */
async function fetchClientGeminiSpeech() {
  // Client-side direct Gemini key usage removed; TTS is served via /api/tts.
  return null;
}

/**
 * Fetch studio-grade Neural Speech Audio
 * 1. Direct client-side Gemini 3.8 Flash TTS if VITE_GEMINI_API_KEY is available
 *    (avoids serverless 10s timeouts and Netlify HTML rewrites)
 * 2. Falls back to /api/tts serverless endpoint
 */
async function fetchNeuralSpeechBlob(cleaned, lang) {
  const isHindi = String(lang).toLowerCase().startsWith('hi');
  const targetLang = isHindi ? 'hi' : 'en-IN';

  // 1. Direct Gemini Neural TTS when client key is configured
  const clientAudio = await fetchClientGeminiSpeech(cleaned, isHindi);
  if (clientAudio) return clientAudio;

  // 2. Fallback: call /api/tts endpoint
  try {
    const controller = new globalThis.AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(`/api/tts?lang=${targetLang}&text=${encodeURIComponent(cleaned)}`, {
      method: 'GET',
      headers: { Accept: 'audio/wav, audio/mpeg, */*' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && !contentType.includes('text/html')) {
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > 200) {
        const blob = new Blob([arrayBuffer], { type: contentType || 'audio/wav' });
        return {
          objectUrl: URL.createObjectURL(blob),
          arrayBuffer
        };
      }
    }
  } catch (err) {
    console.warn('API TTS fetch note:', err.message);
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
    const entry = await fetchNeuralSpeechBlob(cleaned, lang);
    if (entry) {
      audioBlobCache.set(key, entry);
    }
  } catch (_) {
    // Non-fatal, silent background preload catch
  }
}

/**
 * Stop any ongoing speech playback (Web Audio, HTML5 audio, and browser synthesis)
 */
export function stopSpeech() {
  currentPlayingId = null;

  if (currentBufferSource) {
    try {
      currentBufferSource.onended = null;
      currentBufferSource.stop(0);
      currentBufferSource.disconnect();
    } catch {
      // Ignored
    }
    currentBufferSource = null;
  }

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

  // Synchronously unlock Web Audio API during the user's tap/click gesture
  // so mobile Safari/Chrome won't block playback after the async TTS fetch (7-12s).
  const audioCtx = getUnlockedAudioContext();

  stopSpeech();

  const cleaned = prepareSpeechText(rawText);
  if (!cleaned) {
    onEnd();
    return;
  }

  const playbackId = `playback_${Date.now()}_${Math.random()}`;
  currentPlayingId = playbackId;

  const key = getCacheKey(cleaned, lang);
  let audioEntry = audioBlobCache.get(key) || null;

  // 1. Try to fetch from Neural TTS if not in cache
  if (!audioEntry) {
    audioEntry = await fetchNeuralSpeechBlob(cleaned, lang);
    if (audioEntry) {
      audioBlobCache.set(key, audioEntry);
    }
  }

  // Check if cancelled while fetching
  if (currentPlayingId !== playbackId) return;

  // 2A. Primary playback: Web Audio API (bypasses mobile 5s user-gesture expiry)
  if (audioEntry && audioEntry.arrayBuffer && audioCtx) {
    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      // Pass a cloned buffer because decodeAudioData detaches the ArrayBuffer
      const decoded = await audioCtx.decodeAudioData(audioEntry.arrayBuffer.slice(0));
      if (currentPlayingId !== playbackId) return;

      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.playbackRate.value = 1.06;
      source.connect(audioCtx.destination);
      currentBufferSource = source;

      source.onended = () => {
        if (currentPlayingId === playbackId) {
          currentBufferSource = null;
          onEnd();
        }
      };

      onStart();
      source.start(0);
      return;
    } catch (webAudioErr) {
      console.warn('Web Audio playback note, trying HTML5 Audio:', webAudioErr.message);
      currentBufferSource = null;
    }
  }

  // 2B. Secondary playback: HTML5 Audio element
  const audioSrc = audioEntry?.objectUrl || (typeof audioEntry === 'string' ? audioEntry : null);
  if (audioSrc) {
    try {
      const audio = new globalThis.Audio(audioSrc);
      audio.playbackRate = 1.06;
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

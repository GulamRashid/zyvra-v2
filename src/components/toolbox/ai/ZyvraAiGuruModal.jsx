import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Coins,
  Copy,
  CornerDownLeft,
  Flame,
  Globe,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import AiMessageRenderer from './AiMessageRenderer';
import { useAuth } from '../../../context/AuthContext';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import {
  DEFAULT_AI_CONFIG,
  checkAiPermission,
  getAiConfig,
  getDailyAiUsage,
  incrementDailyAiUsage,
  queryZyvraAiGuru,
  streamZyvraAiGuru
} from '../../../lib/gemini';
import {
  pickBestVoice,
  prepareSpeechText,
  splitIntoSentences
} from '../../../lib/speechVoice';
import { playRealisticSpeech, stopSpeech } from '../../../lib/hybridVoicePlayer';
import useModalBack from '../../../hooks/useModalBack';

export default function ZyvraAiGuruModal({
  isOpen,
  onClose,
  initialPrompt = '',
  initialContext = '',
  examTitle = ''
}) {
  useModalBack(isOpen, onClose, 'ai-guru');
  const { user, profile, coinBalance, supabase, refreshAccount } = useAuth();
  const { language } = useThemeLanguage();
  const [config, setConfig] = useState(DEFAULT_AI_CONFIG);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [quotaState, setQuotaState] = useState({ allowed: true, isFree: true, freeLeft: 3, coinsNeeded: 0 });
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  // Available OS Voices for Speech Synthesis
  const [voices, setVoices] = useState([]);
  const speakingQueueRef = useRef({ active: false, stopFn: null });

  // Speech Recognition (Voice Input) state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  // Default to Hindi ('hi-IN') for Indian competitive exam aspirants
  const [voiceLang, setVoiceLang] = useState('hi-IN');
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);

  const isHi = language === 'hi';

  // Load voices dynamically on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) setVoices(v);
      } catch {
        // ignore
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Load config on mount
  useEffect(() => {
    let active = true;
    getAiConfig(supabase).then((cfg) => {
      if (active && cfg) setConfig(cfg);
    });
    return () => { active = false; };
  }, [supabase]);

  // Update quota state
  const refreshQuota = useCallback(() => {
    const q = checkAiPermission(user?.id || 'guest', coinBalance || 0, config, false);
    setQuotaState(q);
  }, [user?.id, coinBalance, config]);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // Initialize Speech Recognition with accurate interim/final accumulation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = voiceLang;

        recognition.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interimTranscript += result[0].transcript;
            }
          }

          const currentSessionSpeech = (finalTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
          const base = baseTextRef.current.trim();
          setInputText(base ? `${base} ${currentSessionSpeech}` : currentSessionSpeech);
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition warning:', e.error);
          if (e.error !== 'no-speech') {
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [voiceLang]);

  // Toggle voice recognition safely
  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch { /* ignore */ }
      setIsListening(false);
    } else {
      try {
        baseTextRef.current = inputText;
        recognitionRef.current.lang = voiceLang;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
        setIsListening(false);
      }
    }
  };

  // Pre-fill initial prompt if provided (e.g. from QuizResult)
  useEffect(() => {
    if (isOpen && initialPrompt) {
      setInputText(initialPrompt);
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [isOpen, initialPrompt]);

  // Auto-scroll on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Cleanup speech on unmount or ESC key
  const handleClose = () => {
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      setIsListening(false);
    }
    stopSpeaking();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Send message
  const handleSend = async (overridePrompt = null) => {
    const textToSend = (overridePrompt || inputText).trim();
    if (!textToSend || loading) return;

    // Stop listening if speaking
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      setIsListening(false);
    }
    stopSpeaking();

    setErrorMsg('');

    // Check permission
    const quota = checkAiPermission(user?.id || 'guest', coinBalance || 0, config, false);
    if (!quota.allowed) {
      setErrorMsg(isHi ? quota.messageHi : quota.messageEn);
      return;
    }

    const userMessage = { role: 'user', text: textToSend, timestamp: Date.now() };
    const streamingAiMessage = { role: 'model', text: '', isStreaming: true, timestamp: Date.now() };
    const nextMessages = [...messages, userMessage, streamingAiMessage];
    setMessages(nextMessages);
    setInputText('');
    baseTextRef.current = '';
    setLoading(true);

    try {
      const response = await streamZyvraAiGuru({
        prompt: textToSend,
        context: initialContext,
        conversationHistory: nextMessages.slice(0, -2),
        onChunk: (accumulated) => {
          setLoading(false);
          setMessages((prev) => {
            if (!prev.length) return prev;
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx].role === 'model') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: accumulated,
                isStreaming: true
              };
            }
            return updated;
          });
        },
        config
      });

      // Increment daily usage
      incrementDailyAiUsage(user?.id || 'guest');

      // Deduct coins if not free
      if (!quota.isFree && quota.coinsNeeded > 0 && supabase && user?.id) {
        try {
          await supabase.from('coin_transactions').insert({
            user_id: user.id,
            amount: -quota.coinsNeeded,
            transaction_type: 'debit',
            description: 'Zyvra AI Guru doubt query',
            source: 'ai_tutor'
          });
          if (refreshAccount) refreshAccount();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new window.CustomEvent('zyvra:coins-updated'));
          }
        } catch (coinErr) {
          console.warn('Could not record coin deduction:', coinErr);
        }
      }

      // Finalize the streamed message
      setMessages((prev) => {
        if (!prev.length) return prev;
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx].role === 'model') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            text: response.text,
            model: response.modelUsed,
            isStreaming: false
          };
        }
        return updated;
      });

      refreshQuota();
    } catch (err) {
      console.error('AI Guru Query Failed:', err);
      // Remove empty streaming bubble if error occurs before any chunk
      setMessages((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last.role === 'model' && !last.text) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setErrorMsg(err.message || 'Unable to connect to Zyvra AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Copy answer to clipboard
  const handleCopy = (text, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Stop currently playing speech
  const stopSpeaking = () => {
    stopSpeech();
    setSpeakingIndex(null);
  };

  // Ultra-realistic neural speech reader with fallback to browser HD voice
  const handleSpeak = (text, idx) => {
    if (speakingIndex === idx) {
      stopSpeaking();
      return;
    }

    stopSpeaking();
    setSpeakingIndex(idx);

    playRealisticSpeech(text, {
      lang: voiceLang.startsWith('hi') ? 'hi' : 'en',
      voices,
      onStart: () => setSpeakingIndex(idx),
      onEnd: () => setSpeakingIndex(null),
      onError: () => setSpeakingIndex(null)
    });
  };

  // Stop audio whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
      setSpeakingIndex(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickPrompts = [
    {
      labelHi: 'शॉर्टकट ट्रिक बताएं',
      labelEn: 'Shortcut Trick',
      prompt: 'Is question ya concept ko sabse tez solve karne ki shortcut trick bataiye.'
    },
    {
      labelHi: 'स्टेप-बाय-स्टेप कॉन्सेप्ट',
      labelEn: 'Step-by-Step Concept',
      prompt: 'Kripya iska foundational concept saral bhasha me step-by-step samjhaiye.'
    },
    {
      labelHi: 'सामान्य गलतियाँ (Pitfalls)',
      labelEn: 'Common Mistakes',
      prompt: 'Aspirants is tarah ke sawalo me aksar kya galti karte hain?'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-guru-title"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl h-[92vh] max-h-[820px] flex flex-col rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden transition-all text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Topbar */}
        <header className="px-5 py-4 border-b dark:border-slate-800/80 border-slate-100 flex items-center justify-between shrink-0 bg-white/50 dark:bg-[#0B1120]/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ai-guru-title" className="text-sm font-black dark:text-white text-slate-900 tracking-tight">
                  Zyvra AI Guru
                </h2>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Ready" />
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {examTitle ? `${examTitle} • Doubt Desk` : (isHi ? 'प्रतियोगी परीक्षा मेंटर' : 'Exam Preparation Mentor')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dynamic Quota Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200 text-slate-600 dark:text-slate-300">
              {quotaState.isFree ? (
                <>
                  <Flame size={12} className="text-orange-500" />
                  <span>{quotaState.freeLeft} {isHi ? 'मुफ़्त सवाल शेष' : 'free left'}</span>
                </>
              ) : (
                <>
                  <Coins size={12} className="text-amber-500" />
                  <span>{quotaState.coinsNeeded} {isHi ? 'सिक्के / सवाल' : 'coins / Q'}</span>
                </>
              )}
            </div>

            {/* Language Switcher for Voice & Text */}
            <button
              type="button"
              onClick={() => {
                setVoiceLang((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'));
                stopSpeaking();
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-black dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border dark:border-slate-700 border-slate-200 transition-colors flex items-center gap-1.5"
              title={voiceLang === 'hi-IN' ? 'Switch to English' : 'हिंदी पर स्विच करें'}
            >
              <Globe size={13} className="text-indigo-400" />
              <span>{voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Message Stream with Generous Whitespace */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-5 py-6 space-y-6 custom-scrollbar"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-black dark:text-white text-slate-900 tracking-tight">
                {isHi ? 'नमस्ते! मैं Zyvra AI Guru हूँ' : 'Namaste! I am Zyvra AI Guru'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                {isHi
                  ? 'अपनी परीक्षा का कोई भी कठिन सवाल, गणितीय ट्रिक, रीजनिंग या सामान्य ज्ञान का डाउट पूछें।'
                  : 'Ask any exam doubt, formula shortcut, reasoning trick, or conceptual question.'}
              </p>

              {/* Airy Minimalist Suggestion Pills */}
              <div className="mt-6 flex flex-col gap-2 w-full">
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(qp.prompt)}
                    className="w-full p-2.5 rounded-2xl text-left text-xs font-bold dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800/80 border-slate-200 hover:border-amber-500/50 dark:hover:border-amber-500/40 text-slate-700 dark:text-slate-300 transition-all flex items-center justify-between group active:scale-[0.99]"
                  >
                    <span>{isHi ? qp.labelHi : qp.labelEn}</span>
                    <CornerDownLeft size={13} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-xs sm:text-sm font-medium dark:bg-indigo-600/20 bg-indigo-50 border dark:border-indigo-500/30 border-indigo-200 text-slate-800 dark:text-indigo-100 shadow-xs">
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[95%] sm:max-w-[90%] space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                    <Sparkles size={11} />
                    <span>Zyvra AI Guru</span>
                  </div>

                  {/* Refined rich typography message body */}
                  <div className="rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm leading-relaxed dark:bg-slate-900/70 bg-slate-50 border dark:border-slate-800 border-slate-200 text-slate-800 dark:text-slate-200 shadow-xs">
                    {msg.text ? (
                      <AiMessageRenderer content={msg.text} />
                    ) : (
                      <span className="text-slate-400 italic text-xs">उत्तर तैयार किया जा रहा है…</span>
                    )}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-amber-400 animate-pulse ml-1 align-middle rounded-xs" />
                    )}
                  </div>

                  {/* Micro Actions: Copy & Expressive Listen (shown when streaming finishes) */}
                  {!msg.isStreaming && msg.text && (
                    <div className="flex items-center gap-2 pt-1 pl-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.text, idx)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Copy explanation"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check size={12} className="text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpeak(msg.text, idx)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold transition-all px-2.5 py-1 rounded-lg ${
                          speakingIndex === idx
                            ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                            : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={speakingIndex === idx ? 'आवाज़ रोकें (Stop audio)' : 'स्पष्ट आवाज़ में सुनें (Listen aloud)'}
                      >
                        {speakingIndex === idx ? (
                          <>
                            <VolumeX size={13} className="text-white" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={13} />
                            <span>Listen (सुनें)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && !messages.some((m) => m.isStreaming) && (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px] font-medium italic">
                {isHi ? 'Zyvra AI उत्तर तैयार कर रहा है…' : 'Thinking…'}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Minimalist Input Footer */}
        <footer className="p-3 sm:p-4 border-t dark:border-slate-800/80 border-slate-100 bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-md shrink-0">
          {/* Active Listening Indicator */}
          {isListening && (
            <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>
                  {voiceLang === 'hi-IN' ? 'सुन रहा हूँ… बोलिए (हिंदी)' : 'Listening… Speak now (English)'}
                </span>
              </span>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:underline"
              >
                Stop
              </button>
            </div>
          )}

          {/* Quick Mic Language Toggle Badge */}
          {speechSupported && (
            <div className="flex items-center justify-between mb-1.5 px-1">
              <button
                type="button"
                onClick={() => {
                  const nextLang = voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
                  setVoiceLang(nextLang);
                  if (recognitionRef.current) {
                    recognitionRef.current.lang = nextLang;
                  }
                  stopSpeaking();
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-amber-500 dark:text-slate-400 transition-colors"
                title="वॉयस टाइपिंग भाषा बदलें"
              >
                <Mic size={12} className="text-amber-500" />
                <span>
                  वॉयस इनपुट भाषा:{' '}
                  <strong className="text-amber-600 dark:text-amber-400 underline underline-offset-2">
                    {voiceLang === 'hi-IN' ? 'हिंदी (Hindi)' : 'English'}
                  </strong>
                </span>
              </button>

              <span className="text-[10px] text-slate-400">
                (बदलने के लिए टैप करें)
              </span>
            </div>
          )}

          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-900/80 border dark:border-slate-800 border-slate-200 rounded-2xl p-2 transition-all focus-within:border-amber-500/50 dark:focus-within:border-amber-500/50">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                voiceLang === 'hi-IN'
                  ? 'अपना सवाल हिंदी में लिखें या माइक दबाकर बोलें…'
                  : 'Type your question in English or tap mic to speak…'
              }
              className="flex-1 bg-transparent border-0 outline-hidden resize-none text-xs sm:text-sm dark:text-slate-100 text-slate-800 placeholder-slate-400 leading-relaxed px-1"
            />

            <div className="flex items-center gap-1.5 shrink-0 pb-1">
              {/* Voice Input Mic Button */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-xl transition-all ${
                    isListening
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105 animate-pulse'
                      : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                  }`}
                  aria-label={isListening ? 'Stop listening' : 'Speak doubt'}
                  title={isListening ? 'माइक बंद करें (Stop)' : `माइक से बोलें (${voiceLang === 'hi-IN' ? 'हिंदी' : 'English'})`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputText.trim() || loading}
                className="p-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed hover:from-orange-600 hover:to-amber-600 transition-all active:scale-95"
                aria-label="Send query"
              >
                <Send size={15} />
              </button>
            </div>
          </div>

          <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-400 font-medium">
              ✦ Zyvra AI Guru is trained for competitive exams • Formatted with KaTeX formulas
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

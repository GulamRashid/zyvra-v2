import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const legacyKeys = {
  'sticky-notes': 'zyvra-toolbox-sticky-notes',
  'daily-targets': 'zyvra-toolbox-daily-targets',
  'exam-countdown': 'zyvra-toolbox-exam-countdown',
  pomodoro: 'zyvra-toolbox-pomodoro'
};

function readLocal(storageKey, fallback, allowLegacy = false) {
  try {
    const toolboxKey = storageKey.split(':').at(-1);
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== null) return { value: normalizeValue(toolboxKey, JSON.parse(raw), fallback), exists: true, legacy: false };
    // The old keys were shared by every account on this browser. Never import
    // them into a signed-in student's private data space.
    const legacyKey = allowLegacy ? legacyKeys[toolboxKey] : null;
    const legacy = legacyKey ? window.localStorage.getItem(legacyKey) : null;
    return { value: legacy === null ? fallback : normalizeValue(toolboxKey, JSON.parse(legacy), fallback), exists: legacy !== null, legacy: legacy !== null, legacyKey };
  } catch { return { value: fallback, exists: false }; }
}

function normalizeValue(key, value, fallback) {
  if (key === 'sticky-notes') return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string').slice(0, 100).map((item) => ({ id: item.id.slice(0, 80), title: String(item.title || '').slice(0, 160), content: String(item.content || '').slice(0, 2000), date: String(item.date || '').slice(0, 40) })) : fallback;
  if (key === 'daily-targets') return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string').slice(0, 100).map((item) => ({ id: item.id.slice(0, 80), text: String(item.text || '').slice(0, 200), defaultKey: typeof item.defaultKey === 'string' ? item.defaultKey.slice(0, 50) : undefined, done: item.done === true })) : fallback;
  if (key === 'flashcards') return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string').slice(0, 100).map((item) => ({ id: item.id.slice(0, 80), front: String(item.front || '').slice(0, 500), back: String(item.back || '').slice(0, 1000) })) : fallback;
  if (key === 'mistakes') return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string').slice(0, 100).map((item) => ({ id: item.id.slice(0, 80), topic: String(item.topic || '').slice(0, 60), mistake: String(item.mistake || '').slice(0, 500), correctAnswer: String(item.correctAnswer || '').slice(0, 500), nextReview: /^\d{4}-\d{2}-\d{2}$/.test(String(item.nextReview || '')) ? item.nextReview : '', reviewCount: Math.min(1000, Math.max(0, Math.floor(Number(item.reviewCount) || 0))), createdAt: String(item.createdAt || '').slice(0, 40) })) : fallback;
  if (key === 'exam-countdown') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    return { title: String(value.title || '').slice(0, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(String(value.date || '')) ? value.date : '' };
  }
  if (key !== 'pomodoro' || !value || typeof value !== 'object' || !['focus', 'break'].includes(value.mode)) return fallback;
  const focusMinutes = Math.min(180, Math.max(1, Math.floor(Number(value.focusMinutes) || 25)));
  const breakMinutes = Math.min(60, Math.max(1, Math.floor(Number(value.breakMinutes) || 5)));
  let remaining = Math.min((value.mode === 'focus' ? focusMinutes : breakMinutes) * 60, Math.max(0, Math.floor(Number(value.remaining) || 0)));
  let mode = value.mode;
  let completed = Math.max(0, Math.floor(Number(value.completed) || 0));
  let elapsed = value.running ? Math.min(86_400, Math.max(0, Math.floor((Date.now() - Number(value.updatedAt || Date.now())) / 1000))) : 0;
  while (elapsed >= Math.max(1, remaining)) {
    elapsed -= Math.max(1, remaining);
    if (mode === 'focus') completed += 1;
    mode = mode === 'focus' ? 'break' : 'focus';
    remaining = (mode === 'focus' ? focusMinutes : breakMinutes) * 60;
  }
  return { mode, remaining: Math.max(0, remaining - elapsed), running: value.running === true, completed, focusMinutes, breakMinutes };
}

/** Account-scoped cloud sync with a local, offline-friendly copy. */
export default function useStudentToolboxData(key, fallback) {
  const { user } = useAuth();
  const storageKey = `zyvra-toolbox:${user?.id || 'guest'}:${key}`;
  const [value, setValue] = useState(() => readLocal(storageKey, fallback, !user?.id).value);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState('local');
  const [valueOwner, setValueOwner] = useState(storageKey);
  const [retryNonce, setRetryNonce] = useState(0);
  const baseline = useRef(JSON.stringify(readLocal(storageKey, fallback, !user?.id).value));
  const generation = useRef(0);
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    const retryWhenOnline = () => setRetryNonce((current) => current + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, []);

  useEffect(() => {
    const requestId = ++generation.current;
    const local = readLocal(storageKey, fallbackRef.current, !user?.id);
    setValueOwner(storageKey);
    setReady(false);
    setValue(local.value);
    if (local.legacy) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(local.value));
        window.localStorage.removeItem(local.legacyKey);
      } catch { /* Keep the old local copy if the browser cannot migrate it. */ }
    }
    setSyncState(user?.id ? 'syncing' : 'local');

    if (!user?.id || !supabase) {
      baseline.current = JSON.stringify(local.value);
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    supabase.from('student_toolbox_data').select('data').eq('user_id', user.id).maybeSingle()
      .then(async ({ data, error }) => {
        if (error) throw error;
        if (cancelled || generation.current !== requestId) return;
        const cloudHasValue = data?.data && Object.prototype.hasOwnProperty.call(data.data, key);
        const nextValue = cloudHasValue ? normalizeValue(key, data.data[key], fallbackRef.current) : local.value;
        baseline.current = JSON.stringify(nextValue);
        setValue(nextValue);
        setSyncState('synced');
        setReady(true);
        if (!cloudHasValue && local.exists) {
          const { error: saveError } = await supabase.rpc('save_student_toolbox_data', { p_key: key, p_value: local.value });
          if (saveError) throw saveError;
        }
      })
      .catch((error) => {
        console.warn(`Toolbox ${key} cloud sync unavailable:`, error);
        if (cancelled || generation.current !== requestId) return;
        // Trigger one guarded save attempt so an offline edit is uploaded
        // automatically when connectivity returns.
        baseline.current = '__cloud_sync_unavailable__';
        setSyncState('offline');
        setReady(true);
      });
    return () => { cancelled = true; };
  }, [key, storageKey, user?.id]);

  useEffect(() => {
    if (valueOwner !== storageKey) return;
    try {
      const localValue = key === 'pomodoro' ? { ...value, updatedAt: Date.now() } : value;
      window.localStorage.setItem(storageKey, JSON.stringify(localValue));
    } catch { setSyncState((current) => current === 'synced' ? 'offline' : current); }
  }, [key, storageKey, value, valueOwner]);

  useEffect(() => {
    if (valueOwner !== storageKey || !ready || !user?.id || !supabase || (key === 'pomodoro' && value?.running) || baseline.current === JSON.stringify(value)) return undefined;
    const snapshot = JSON.stringify(value);
    setSyncState('syncing');
    const timer = window.setTimeout(async () => {
      try {
        const { error } = await supabase.rpc('save_student_toolbox_data', { p_key: key, p_value: value });
        if (error) throw error;
        baseline.current = snapshot;
        setSyncState('synced');
      } catch (error) {
        console.warn(`Toolbox ${key} save failed:`, error);
        setSyncState('offline');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [key, ready, retryNonce, storageKey, user?.id, value, valueOwner]);

  return [value, setValue, syncState];
}

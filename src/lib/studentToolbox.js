import { supabase } from './supabase';

export const FREE_MISTAKES_LIMIT = 5;
export const FREE_FLASHCARDS_LIMIT = 10;
export const PRO_MISTAKES_LIMIT = 200;
export const PRO_FLASHCARDS_LIMIT = 200;

function localDate(value = new Date()) {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 10);
}

export function nextReviewDate(reviewCount) {
  const intervals = [1, 3, 7, 14, 30];
  const date = new Date();
  date.setDate(date.getDate() + intervals[Math.min(reviewCount, intervals.length - 1)]);
  return localDate(date);
}

export function getMistakesStorageKey(userId) {
  return `zyvra-toolbox:${userId || 'guest'}:mistakes`;
}

export function getFlashcardsStorageKey(userId) {
  return `zyvra-toolbox:${userId || 'guest'}:flashcards`;
}

export function readMistakesLocal(userId) {
  try {
    const raw = window.localStorage.getItem(getMistakesStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isQuestionInMistakeNotebook(userId, questionId) {
  if (!questionId) return false;
  const list = readMistakesLocal(userId);
  return list.some((item) => String(item.questionId || item.id) === String(questionId));
}

/**
 * Save a question / mistake directly into the student's Mistake Notebook
 * Returns { success: boolean, count: number, limitReached: boolean, error?: string }
 */
export async function saveMistakeToNotebook({
  userId,
  topic = 'General Revision',
  mistake = '',
  correctAnswer = '',
  questionId = null,
  testTitle = '',
  entryType = 'mistake',
  isCorrect = false,
  isPremium = false
}) {
  const key = getMistakesStorageKey(userId);
  const current = readMistakesLocal(userId);

  // Check if already saved
  const existingIdx = current.findIndex((item) => String(item.questionId || item.id) === String(questionId));
  if (existingIdx >= 0) {
    return { success: true, count: current.length, alreadySaved: true };
  }

  // Check freemium limit
  const maxLimit = isPremium ? PRO_MISTAKES_LIMIT : FREE_MISTAKES_LIMIT;
  if (current.length >= maxLimit) {
    return {
      success: false,
      count: current.length,
      limitReached: true,
      error: `Limit reached (${current.length}/${maxLimit}). Upgrade to Pro to save unlimited mistakes!`
    };
  }

  const today = localDate();
  const newEntry = {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    questionId: questionId ? String(questionId) : null,
    testTitle: String(testTitle || '').slice(0, 100),
    topic: String(topic || 'General Revision').slice(0, 80),
    mistake: String(mistake || '').slice(0, 500),
    correctAnswer: String(correctAnswer || '').slice(0, 600),
    entryType: entryType === 'review' || isCorrect ? 'review' : 'mistake',
    isCorrect: Boolean(isCorrect),
    nextReview: today,
    reviewCount: 0,
    createdAt: new Date().toISOString()
  };

  const updated = [newEntry, ...current];

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(updated));
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('zyvra:mistakes-updated', { detail: { mistakes: updated } }));
      }
    }
  } catch (err) {
    console.warn('Local storage write failed for mistake notebook:', err);
  }

  // Cloud sync if authenticated
  if (userId && supabase) {
    try {
      const { data: row } = await supabase
        .from('student_toolbox_data')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      const existingData = row?.data && typeof row.data === 'object' ? row.data : {};
      await supabase
        .from('student_toolbox_data')
        .upsert(
          {
            user_id: userId,
            data: { ...existingData, mistakes: updated },
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );
    } catch (syncErr) {
      console.warn('Cloud sync error saving mistake:', syncErr);
    }
  }

  return { success: true, count: updated.length, limitReached: false };
}

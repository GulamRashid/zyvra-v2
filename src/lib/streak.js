/**
 * ZYVRA Daily Study Streak Engine
 * 
 * Transparent, dopamine-driven, non-shaming streak tracking.
 * Calculates daily active streaks, preserves pending streaks for the current day,
 * tracks 7-day rolling activity, awards milestone badges, and syncs
 * seamlessly across LocalStorage and Supabase.
 */

export const STREAK_STORAGE_PREFIX = 'zyvra_study_activity_dates_';

export const STREAK_MILESTONES = [
  { days: 3, labelEn: '3-Day Spark', labelHi: '3 दिन की शुरुआत', icon: '🥉', badge: 'Bronze', bonusCoins: 5 },
  { days: 7, labelEn: '7-Day Habit', labelHi: '7 दिन की आदत', icon: '🥈', badge: 'Silver', bonusCoins: 15 },
  { days: 14, labelEn: '14-Day Momentum', labelHi: '14 दिन की रफ्तार', icon: '🔥', badge: 'Flame', bonusCoins: 30 },
  { days: 30, labelEn: '30-Day Master', labelHi: '30 दिन का संकल्प', icon: '🥇', badge: 'Gold', bonusCoins: 75 },
  { days: 60, labelEn: '60-Day Unstoppable', labelHi: '60 दिन का रिकॉर्ड', icon: '⚡', badge: 'Thunder', bonusCoins: 150 },
  { days: 100, labelEn: '100-Day Legend', labelHi: '100 दिन का लीजेंड', icon: '👑', badge: 'Crown', bonusCoins: 300 }
];

/**
 * Format any Date or ISO timestamp into a local 'YYYY-MM-DD' key
 */
export function toLocalDateString(dateInput = new Date()) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Pure calculation function for daily streaks
 */
export function calculateStreakData(dates = [], referenceDate = new Date()) {
  const validDates = new Set();
  (Array.isArray(dates) ? dates : []).forEach((d) => {
    if (!d) return;
    const key = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toLocalDateString(d);
    if (key) validDates.add(key);
  });

  const refKey = toLocalDateString(referenceDate);
  const refDate = new Date(referenceDate);

  // Yesterday reference
  const yDate = new Date(refDate);
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayKey = toLocalDateString(yDate);

  const isActiveToday = validDates.has(refKey);
  const wasActiveYesterday = validDates.has(yesterdayKey);

  let currentStreak = 0;
  const cursor = new Date(refDate);

  if (isActiveToday) {
    // Count consecutive days backwards from today
    while (validDates.has(toLocalDateString(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  } else if (wasActiveYesterday) {
    // Streak is preserved from yesterday! Not broken until today passes with no study.
    cursor.setDate(cursor.getDate() - 1);
    while (validDates.has(toLocalDateString(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  } else {
    currentStreak = 0;
  }

  // Calculate historical longest streak
  const sortedDates = Array.from(validDates).sort();
  let longestStreak = 0;
  let running = 0;
  let prevDate = null;

  for (const dStr of sortedDates) {
    if (!prevDate) {
      running = 1;
    } else {
      const prev = new Date(`${prevDate}T00:00:00`);
      const curr = new Date(`${dStr}T00:00:00`);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        running += 1;
      } else if (diffDays > 1) {
        running = 1;
      }
    }
    prevDate = dStr;
    if (running > longestStreak) longestStreak = running;
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  // 7-day rolling window (ending on reference date)
  const last7Days = [];
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesHi = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateString(d);
    const dayIndex = d.getDay();
    last7Days.push({
      date: dateStr,
      dayIndex,
      dayNameEn: dayNamesEn[dayIndex],
      dayNameHi: dayNamesHi[dayIndex],
      dayNum: d.getDate(),
      isToday: i === 0,
      studied: validDates.has(dateStr)
    });
  }

  // Next Milestone and Progress
  let nextMilestone = STREAK_MILESTONES.find((m) => m.days > currentStreak);
  if (!nextMilestone) {
    nextMilestone = STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  }

  let prevMilestoneDays = 0;
  for (const m of STREAK_MILESTONES) {
    if (m.days <= currentStreak) prevMilestoneDays = m.days;
  }

  const milestoneRange = Math.max(1, nextMilestone.days - prevMilestoneDays);
  const progressInRange = Math.max(0, currentStreak - prevMilestoneDays);
  const milestonePercent = Math.min(100, Math.round((progressInRange / milestoneRange) * 100));

  // Bilingual motivational status message
  let motivationalMessageEn = '';
  let motivationalMessageHi = '';

  if (isActiveToday) {
    motivationalMessageEn = currentStreak === 1
      ? "Great start! You've studied today. Come back tomorrow to build a streak!"
      : `Streak Active! You've studied ${currentStreak} days in a row. Exceptional consistency!`;
    motivationalMessageHi = currentStreak === 1
      ? 'शानदार शुरुआत! आज की पढ़ाई पूरी हुई। कल दोबारा आकर अपनी स्ट्रीक बनाएं!'
      : `आज की स्ट्रीक पूरी! आप लगातार ${currentStreak} दिन से पढ़ रहे हैं। अद्भुत लगन!`;
  } else if (currentStreak > 0) {
    motivationalMessageEn = `Keep your ${currentStreak}-day streak alive! Complete a test, quiz or tool review today.`;
    motivationalMessageHi = `अपनी ${currentStreak}-दिन की स्ट्रीक जारी रखने के लिए आज 1 टेस्ट, क्विज या टूल का अभ्यास करें!`;
  } else {
    motivationalMessageEn = 'Start a fresh study streak today! Daily deliberate practice leads to top ranks.';
    motivationalMessageHi = 'आज से नई अध्ययन स्ट्रीक शुरू करें! रोज का छोटा अभ्यास आपको टॉपर बनाता है।';
  }

  return {
    currentStreak,
    longestStreak,
    isActiveToday,
    wasActiveYesterday,
    streakAtRisk: !isActiveToday && currentStreak > 0,
    last7Days,
    milestones: STREAK_MILESTONES.map((m) => ({
      ...m,
      unlocked: currentStreak >= m.days
    })),
    nextMilestone,
    milestonePercent,
    totalActiveDays: validDates.size,
    motivationalMessageEn,
    motivationalMessageHi
  };
}

/**
 * Retrieve saved activity dates from LocalStorage
 */
export function getStoredActivityDates(userId = 'guest') {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${STREAK_STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save activity dates to LocalStorage
 */
export function saveStoredActivityDates(userId = 'guest', dates = []) {
  if (typeof window === 'undefined') return;
  try {
    const unique = [...new Set((dates || []).map((d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toLocalDateString(d))).filter(Boolean))];
    window.localStorage.setItem(`${STREAK_STORAGE_PREFIX}${userId}`, JSON.stringify(unique));
  } catch {
    // Graceful fallback for private browsing storage limits
  }
}

/**
 * Synchronize database test attempts, profile data, and local storage dates
 */
export function syncAttemptsWithStreak(userId = 'guest', attempts = [], profile = null) {
  const stored = getStoredActivityDates(userId);
  const dateSet = new Set(stored);

  // Extract from test attempts
  (Array.isArray(attempts) ? attempts : []).forEach((att) => {
    const ts = att?.completed_at || att?.submitted_at || att?.finished_at || att?.created_at;
    if (ts) {
      const key = toLocalDateString(ts);
      if (key) dateSet.add(key);
    }
  });

  // Extract from profile's last_active_date
  if (profile?.last_active_date) {
    const key = toLocalDateString(profile.last_active_date);
    if (key) dateSet.add(key);
  }

  const mergedDates = Array.from(dateSet);
  saveStoredActivityDates(userId, mergedDates);

  const streakData = calculateStreakData(mergedDates);

  // If profile has a higher streak recorded, take the maximum for user encouragement
  if (profile?.current_streak && Number(profile.current_streak) > streakData.currentStreak) {
    streakData.currentStreak = Number(profile.current_streak);
    if (streakData.currentStreak > streakData.longestStreak) {
      streakData.longestStreak = streakData.currentStreak;
    }
  }

  return streakData;
}

/**
 * Record a study activity (test submission, tool usage, chapter practice)
 */
export async function recordStudyActivity(supabase = null, userId = 'guest', activityType = 'study_session') {
  const todayKey = toLocalDateString();
  const stored = getStoredActivityDates(userId);
  const dateSet = new Set(stored);
  dateSet.add(todayKey);

  const mergedDates = Array.from(dateSet);
  saveStoredActivityDates(userId, mergedDates);

  const streakData = calculateStreakData(mergedDates);

  // Sync with Supabase profiles table if authenticated
  if (supabase && userId && userId !== 'guest') {
    try {
      await supabase
        .from('profiles')
        .update({
          current_streak: streakData.currentStreak,
          last_active_date: todayKey,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (err) {
      console.warn('Could not update streak in Supabase profiles:', err);
    }
  }

  // Broadcast custom event for reactive UI update
  if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new window.CustomEvent('zyvra:streak-updated', {
      detail: { streakData, activityType, timestamp: Date.now() }
    }));
  }

  return streakData;
}

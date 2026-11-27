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
 * Format any Date or ISO timestamp into an IST ('Asia/Kolkata') 'YYYY-MM-DD' key
 */
export function toISTDateString(dateInput = new Date()) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    const istOffsetMs = 330 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffsetMs);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

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
  const safeUserId = typeof userId === 'string' && userId.trim() ? userId : 'guest';
  const stored = getStoredActivityDates(safeUserId);
  const dateSet = new Set(stored.map((d) => toISTDateString(d)).filter(Boolean));

  // Extract from test attempts (using IST date keys)
  (Array.isArray(attempts) ? attempts : []).forEach((att) => {
    const ts = att?.completed_at || att?.submitted_at || att?.finished_at || att?.created_at;
    if (ts) {
      const key = toISTDateString(ts);
      if (key) dateSet.add(key);
    }
  });

  // Extract from profile's last_active_date
  if (profile?.last_active_date) {
    const key = toISTDateString(profile.last_active_date);
    if (key) dateSet.add(key);
  }

  const mergedDates = Array.from(dateSet);
  saveStoredActivityDates(safeUserId, mergedDates);

  const todayISTKey = toISTDateString(new Date());
  const refDate = todayISTKey ? new Date(`${todayISTKey}T12:00:00`) : new Date();
  const streakData = calculateStreakData(mergedDates, refDate);

  // If profile has a higher streak recorded and last_active_date is today or yesterday, preserve it
  const profileStreak = Number(profile?.current_streak || 0);
  if (profileStreak > streakData.currentStreak) {
    const lastActiveKey = profile?.last_active_date ? toISTDateString(profile.last_active_date) : null;
    const yesterdayISTKey = toISTDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (!lastActiveKey || lastActiveKey === todayISTKey || lastActiveKey === yesterdayISTKey) {
      streakData.currentStreak = profileStreak;
      if (streakData.currentStreak > streakData.longestStreak) {
        streakData.longestStreak = streakData.currentStreak;
      }
      if (lastActiveKey === todayISTKey) {
        streakData.isActiveToday = true;
        streakData.streakAtRisk = false;
      }
    }
  }

  return streakData;
}

/**
 * Record a study activity (test submission, tool usage, chapter practice)
 */
export async function recordStudyActivity(supabase = null, userId = 'guest', activityType = 'study_session') {
  const safeUserId = typeof userId === 'string' && userId.trim() ? userId : 'guest';
  const todayKey = toISTDateString(new Date());
  const yesterdayKey = toISTDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const stored = getStoredActivityDates(safeUserId);
  const dateSet = new Set(stored.map((d) => toISTDateString(d)).filter(Boolean));
  if (todayKey) dateSet.add(todayKey);

  const mergedDates = Array.from(dateSet);
  saveStoredActivityDates(safeUserId, mergedDates);

  const refDate = todayKey ? new Date(`${todayKey}T12:00:00`) : new Date();
  const streakData = calculateStreakData(mergedDates, refDate);

  // Sync with Supabase profiles table if authenticated, never downgrading an active DB streak
  if (supabase && safeUserId !== 'guest') {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('current_streak, last_active_date')
        .eq('id', safeUserId)
        .maybeSingle();

      let nextStreak = Math.max(1, streakData.currentStreak);
      const dbStreak = Number(existingProfile?.current_streak || 0);
      const dbLastActive = existingProfile?.last_active_date ? toISTDateString(existingProfile.last_active_date) : null;

      if (dbStreak > 0) {
        if (dbLastActive === todayKey) {
          nextStreak = Math.max(nextStreak, dbStreak);
        } else if (dbLastActive === yesterdayKey) {
          nextStreak = Math.max(nextStreak, dbStreak + 1);
        }
      }

      streakData.currentStreak = nextStreak;
      if (nextStreak > streakData.longestStreak) {
        streakData.longestStreak = nextStreak;
      }

      await supabase
        .from('profiles')
        .update({
          current_streak: nextStreak,
          last_active_date: todayKey,
          updated_at: new Date().toISOString()
        })
        .eq('id', safeUserId);
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

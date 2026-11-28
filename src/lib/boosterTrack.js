export function resolveBoosterTrack({ profile, dynamicExams = [], userId = null, storage = null } = {}) {
  const ls = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const cacheKey = userId ? `zyvra_booster_track_${userId}` : null;

  if (profile) {
    const targets = Array.isArray(profile.target_exams)
      ? profile.target_exams.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const hasBpsc = targets.some((t) => {
      const up = t.toUpperCase();
      return up.includes('BPSC') || up.includes('PCS');
    });
    const resolved = hasBpsc
      ? 'BPSC & PCS'
      : (targets[0] || dynamicExams?.[0]?.title || 'NCERT');

    if (ls && cacheKey) {
      try {
        ls.setItem(cacheKey, resolved);
      } catch { /* ignore */ }
    }
    return resolved;
  }

  if (ls && cacheKey) {
    try {
      const cached = ls.getItem(cacheKey);
      if (cached && cached.trim()) return cached.trim();
    } catch { /* ignore */ }
  }

  return null;
}

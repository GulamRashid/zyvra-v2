import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { computeStudentStats, isAttemptCompleted } from '../lib/studentStats';

const StudentStatsContext = createContext(null);

const QUERY_PAGE_SIZE = 1000;
const ID_BATCH_SIZE = 500;

async function fetchAllPages(makeQuery) {
  const rows = [];
  for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
    const { data, error } = await makeQuery(offset, offset + QUERY_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < QUERY_PAGE_SIZE) return rows;
  }
}

async function fetchByIds(makeQuery, ids) {
  const rows = [];
  for (let index = 0; index < ids.length; index += ID_BATCH_SIZE) {
    const batch = ids.slice(index, index + ID_BATCH_SIZE);
    rows.push(...await fetchAllPages((start, end) => makeQuery(batch).range(start, end)));
  }
  return rows;
}

export function StudentStatsProvider({ children }) {
  const { user, profile, supabase, loading: authLoading } = useAuth();
  const [allAttempts, setAllAttempts] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [streakTick, setStreakTick] = useState(0);

  const refreshStats = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const handleStreakUpdate = () => setStreakTick((t) => t + 1);
    const handleTestSubmitted = () => setRefreshTick((t) => t + 1);
    window.addEventListener('zyvra:streak-updated', handleStreakUpdate);
    window.addEventListener('zyvra:test-submitted', handleTestSubmitted);
    return () => {
      window.removeEventListener('zyvra:streak-updated', handleStreakUpdate);
      window.removeEventListener('zyvra:test-submitted', handleTestSubmitted);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      if (authLoading) return;

      if (!supabase || !user?.id) {
        if (active) {
          setAllAttempts([]);
          setResponses([]);
          setLoadedUserId(null);
          setError('');
          setLoading(false);
        }
        return;
      }

      const cacheKey = `zyvra_cached_stats_${user.id}`;
      let hydratedFromCache = false;
      try {
        const cachedRaw = sessionStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && Array.isArray(cached.attempts) && Date.now() - Number(cached.ts || 0) < 180000) {
            setAllAttempts(cached.attempts);
            setResponses(Array.isArray(cached.responses) ? cached.responses : []);
            setLoadedUserId(user.id);
            setLoading(false);
            hydratedFromCache = true;
          }
        }
      } catch {}

      if (active && !hydratedFromCache) {
        setLoading(true);
        setError('');
      }

      try {
        const attemptRows = await fetchAllPages((start, end) =>
          supabase
            .from('test_attempts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(start, end)
        );

        const completedIds = (attemptRows || [])
          .filter(isAttemptCompleted)
          .map((a) => a.id)
          .filter(Boolean);

        let responseRows = [];
        if (completedIds.length > 0) {
          responseRows = await fetchByIds(
            (batch) => supabase.from('test_responses').select('*').in('attempt_id', batch),
            completedIds
          );
        }

        if (!active) return;
        setAllAttempts(attemptRows || []);
        setResponses(responseRows || []);
        setLoadedUserId(user.id);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            attempts: attemptRows || [],
            responses: responseRows || [],
            ts: Date.now()
          }));
        } catch {}
      } catch (err) {
        console.warn('Unable to load unified student stats:', err);
        if (active) {
          setError(err?.message || 'Unable to load stats.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadStats();
    return () => {
      active = false;
    };
  }, [supabase, user?.id, authLoading, refreshTick]);

  const isStatsLoading = Boolean(authLoading || loading || (user?.id && loadedUserId !== user.id && !error));

  const computed = useMemo(() => {
    void streakTick;
    return computeStudentStats({
      allAttempts,
      responses,
      profile,
      userId: user?.id || 'guest'
    });
  }, [allAttempts, responses, profile, user?.id, streakTick]);

  const value = useMemo(() => ({
    ...computed,
    loading: isStatsLoading,
    error,
    refreshStats
  }), [computed, isStatsLoading, error, refreshStats]);

  return (
    <StudentStatsContext.Provider value={value}>
      {children}
    </StudentStatsContext.Provider>
  );
}

export function useStudentStats() {
  const ctx = useContext(StudentStatsContext);
  if (!ctx) {
    throw new Error('useStudentStats must be used inside StudentStatsProvider');
  }
  return ctx;
}

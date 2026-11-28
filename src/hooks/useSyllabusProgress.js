import { useCallback, useEffect, useMemo, useState } from 'react';
import useContentCatalog from './useContentCatalog';
import useStudentToolboxData from './useStudentToolboxData';
import { useStudentStats } from '../context/StudentStatsContext';
import { supabase } from '../lib/supabase';
import { computeSyllabusProgress } from '../lib/syllabusProgress';

export default function useSyllabusProgress() {
  const { exams, folders, chapters, loading: catalogLoading, error: catalogError } = useContentCatalog();
  const { allAttempts, loading: statsLoading } = useStudentStats();
  const [mistakes] = useStudentToolboxData('mistakes', []);

  const [tests, setTests] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [testsLoading, setTestsLoading] = useState(true);
  const [testsError, setTestsError] = useState('');

  const loadTestsAndCounts = useCallback(async () => {
    if (!supabase) {
      setTestsLoading(false);
      return;
    }
    setTestsLoading(true);
    setTestsError('');
    try {
      const { data: testRows, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .in('status', ['published', 'live', 'available']);
      if (testErr) throw testErr;

      const safeTests = testRows || [];
      setTests(safeTests);

      if (safeTests.length > 0) {
        const { data: countRows, error: countErr } = await supabase.rpc('get_published_test_question_counts', {
          p_test_ids: safeTests.map((t) => t.id)
        });
        if (!countErr && Array.isArray(countRows)) {
          const map = {};
          countRows.forEach((row) => {
            map[row.test_id] = Number(row.question_count) || 0;
          });
          setQuestionCounts(map);
        }
      } else {
        setQuestionCounts({});
      }
    } catch (err) {
      console.warn('Unable to load syllabus test counts:', err);
      setTestsError(err?.message || 'Unable to load syllabus progress.');
    } finally {
      setTestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestsAndCounts();
    const handleTestSubmitted = () => loadTestsAndCounts();
    window.addEventListener('zyvra:test-submitted', handleTestSubmitted);
    return () => window.removeEventListener('zyvra:test-submitted', handleTestSubmitted);
  }, [loadTestsAndCounts]);

  const progress = useMemo(() => {
    return computeSyllabusProgress({
      exams,
      folders,
      chapters,
      tests,
      questionCounts,
      allAttempts,
      mistakes
    });
  }, [exams, folders, chapters, tests, questionCounts, allAttempts, mistakes]);

  return {
    ...progress,
    loading: catalogLoading || statsLoading || testsLoading,
    error: catalogError || testsError,
    refresh: loadTestsAndCounts
  };
}

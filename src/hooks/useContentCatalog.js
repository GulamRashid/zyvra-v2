import { useCallback, useEffect, useState } from 'react';
import { contentTables } from '../lib/content';
import { supabase, supabaseConfigurationError } from '../lib/supabase';

export default function useContentCatalog() {
  const [catalog, setCatalog] = useState({ exams: [], folders: [], chapters: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError(supabaseConfigurationError);
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    const results = await Promise.all(contentTables.map((table) => supabase.from(table).select('*').order('display_order', { ascending: true })));
    const failed = results.find((result) => result.error);
    if (failed) {
      setError(`Unable to load content hierarchy: ${failed.error.message}`);
      setLoading(false);
      return;
    }
    setCatalog({
      exams: results[0].data || [],
      folders: results[1].data || [],
      chapters: results[2].data || []
    });
    setLoading(false);
  }, []);

  const removeExam = useCallback((examId) => {
    setCatalog((current) => {
      const examFolderIds = new Set(current.folders.filter((folder) => folder.exam_id === examId).map((folder) => folder.id));
      return {
        exams: current.exams.filter((exam) => exam.id !== examId),
        folders: current.folders.filter((folder) => folder.exam_id !== examId),
        chapters: current.chapters.filter((chapter) => !examFolderIds.has(chapter.folder_id))
      };
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        setError(supabaseConfigurationError);
        setLoading(false);
        return;
      }
      const results = await Promise.all(contentTables.map((table) => supabase.from(table).select('*').order('display_order', { ascending: true })));
      if (!active) return;
      const failed = results.find((result) => result.error);
      if (failed) setError(`Unable to load content hierarchy: ${failed.error.message}`);
      else setCatalog({ exams: results[0].data || [], folders: results[1].data || [], chapters: results[2].data || [] });
      setLoading(false);
    };
    load().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load content hierarchy.');
        setLoading(false);
      }
    });
    if (!supabase) return () => { active = false; };
    const channel = supabase.channel(`content-catalog-${Math.random().toString(36).slice(2)}`);
    for (const table of contentTables) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      if (active) refresh().catch((loadError) => setError(loadError.message || 'Unable to refresh content hierarchy.'));
    });
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Content realtime subscription ${status.toLowerCase()}.`);
      }
    });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { ...catalog, loading, error, refresh, removeExam };
}

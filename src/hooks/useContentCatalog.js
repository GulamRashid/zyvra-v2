import { useCallback, useEffect, useState } from 'react';
import { contentTables, getContentErrorMessage, sortContentItems } from '../lib/content';
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
      setError(getContentErrorMessage(failed.error, 'Unable to load content hierarchy.'));
      setLoading(false);
      return;
    }
    setCatalog({
      exams: sortContentItems(results[0].data || []),
      folders: sortContentItems(results[1].data || []),
      chapters: sortContentItems(results[2].data || [])
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

  const removeFolder = useCallback((folderId) => {
    setCatalog((current) => {
      const childrenByParent = new Map();
      current.folders.forEach((f) => {
        const parent = f.parent_folder_id || f.parent_id;
        const list = childrenByParent.get(parent) || [];
        list.push(f.id);
        childrenByParent.set(parent, list);
      });
      const toRemove = new Set();
      const queue = [folderId];
      while (queue.length > 0) {
        const id = queue.shift();
        if (toRemove.has(id)) continue;
        toRemove.add(id);
        const children = childrenByParent.get(id) || [];
        queue.push(...children);
      }
      return {
        exams: current.exams,
        folders: current.folders.filter((f) => !toRemove.has(f.id)),
        chapters: current.chapters.filter((c) => !toRemove.has(c.folder_id))
      };
    });
  }, []);

  const removeChapter = useCallback((chapterId) => {
    setCatalog((current) => ({
      exams: current.exams,
      folders: current.folders,
      chapters: current.chapters.filter((c) => c.id !== chapterId)
    }));
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
      if (failed) setError(getContentErrorMessage(failed.error, 'Unable to load content hierarchy.'));
      else setCatalog({
        exams: sortContentItems(results[0].data || []),
        folders: sortContentItems(results[1].data || []),
        chapters: sortContentItems(results[2].data || [])
      });
      setLoading(false);
    };
    load().catch((loadError) => {
      if (active) {
        setError(getContentErrorMessage(loadError, 'Unable to load content hierarchy.'));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { ...catalog, loading, error, refresh, removeExam, removeFolder, removeChapter };
}

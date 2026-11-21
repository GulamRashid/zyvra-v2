import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contentTables, getContentErrorMessage, sortContentItems } from '../lib/content';
import { supabase, supabaseConfigurationError } from '../lib/supabase';

async function fetchContentCatalog() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError);
  }
  const results = await Promise.all(
    contentTables.map((table) =>
      supabase.from(table).select('*').order('display_order', { ascending: true })
    )
  );
  const failed = results.find((result) => result.error);
  if (failed) {
    throw new Error(getContentErrorMessage(failed.error, 'Unable to load content hierarchy.'));
  }
  return {
    exams: sortContentItems(results[0].data || []),
    folders: sortContentItems(results[1].data || []),
    chapters: sortContentItems(results[2].data || [])
  };
}

export default function useContentCatalog() {
  const queryClient = useQueryClient();

  const {
    data = { exams: [], folders: [], chapters: [] },
    isLoading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: ['content-catalog'],
    queryFn: fetchContentCatalog,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    gcTime: 1000 * 60 * 30
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const removeExam = useCallback((examId) => {
    queryClient.setQueryData(['content-catalog'], (current) => {
      if (!current) return { exams: [], folders: [], chapters: [] };
      const examFolderIds = new Set(
        current.folders.filter((folder) => folder.exam_id === examId).map((folder) => folder.id)
      );
      return {
        exams: current.exams.filter((exam) => exam.id !== examId),
        folders: current.folders.filter((folder) => folder.exam_id !== examId),
        chapters: current.chapters.filter((chapter) => !examFolderIds.has(chapter.folder_id))
      };
    });
  }, [queryClient]);

  const removeFolder = useCallback((folderId) => {
    queryClient.setQueryData(['content-catalog'], (current) => {
      if (!current) return { exams: [], folders: [], chapters: [] };
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
  }, [queryClient]);

  const removeChapter = useCallback((chapterId) => {
    queryClient.setQueryData(['content-catalog'], (current) => {
      if (!current) return { exams: [], folders: [], chapters: [] };
      return {
        exams: current.exams,
        folders: current.folders,
        chapters: current.chapters.filter((c) => c.id !== chapterId)
      };
    });
  }, [queryClient]);

  const error = useMemo(() => {
    if (!queryError) return '';
    return getContentErrorMessage(queryError, 'Unable to load content hierarchy.');
  }, [queryError]);

  return {
    ...data,
    loading: isLoading,
    error,
    refresh,
    removeExam,
    removeFolder,
    removeChapter
  };
}


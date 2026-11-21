import React, { useMemo, useState } from 'react';
import { Filter, Layers, Search, CheckCircle2 } from 'lucide-react';
import { getChapterHierarchyPath } from '../../pages/admin/QBankManager';

/**
 * HierarchicalChapterSelect
 * Eliminates confusion when selecting chapters for tests or questions.
 * Groups chapters by Exam and Folder / Subject with full breadcrumbs,
 * and provides optional cascading quick-filters and search.
 */
export default function HierarchicalChapterSelect({
  chapters = [],
  folders = [],
  exams = [],
  value = '',
  onChange,
  required = false,
  className = 'text-input',
  placeholder = 'Select a chapter...',
  showFilters = true,
  disabled = false
}) {
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const chaptersMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const foldersMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const examsMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  // Compute full hierarchy path for each chapter
  const enrichedChapters = useMemo(() => {
    return chapters.map((chapter) => {
      const hierarchy = getChapterHierarchyPath(chapter.id, chaptersMap, foldersMap, examsMap);
      return {
        ...chapter,
        hierarchy,
        examId: hierarchy.examId,
        examTitle: hierarchy.examTitle || 'General / Unassigned',
        folderChainTitle: hierarchy.parts
          .filter((p) => p.type === 'folder')
          .map((p) => p.title)
          .join(' › ') || 'General',
        fullLabel: `${chapter.title} (${hierarchy.parts.slice(0, -1).map((p) => p.title).join(' • ') || 'Unassigned'})`
      };
    });
  }, [chapters, chaptersMap, foldersMap, examsMap]);

  // Available subjects/folders for currently selected exam filter
  const availableFolders = useMemo(() => {
    if (!selectedExamId) return folders;
    return folders.filter((f) => f.exam_id === selectedExamId);
  }, [folders, selectedExamId]);

  // Filtered chapters based on user selection
  const filteredChapters = useMemo(() => {
    return enrichedChapters.filter((c) => {
      if (selectedExamId && c.examId !== selectedExamId) return false;
      if (selectedFolderId && !c.hierarchy.folderIds.includes(selectedFolderId)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesBreadcrumb = c.hierarchy.breadcrumb.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBreadcrumb) return false;
      }
      return true;
    });
  }, [enrichedChapters, selectedExamId, selectedFolderId, searchQuery]);

  // Group filtered chapters by Exam & Subject Folder for <optgroup>
  const groupedChapters = useMemo(() => {
    const groups = new Map();
    filteredChapters.forEach((chapter) => {
      const groupKey = chapter.hierarchy.parts.length > 1
        ? chapter.hierarchy.parts.slice(0, -1).map((p) => p.title).join(' › ')
        : 'General / Other';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(chapter);
    });
    return Array.from(groups.entries());
  }, [filteredChapters]);

  // Currently selected chapter hierarchy info
  const activeChapter = useMemo(() => {
    if (!value) return null;
    return enrichedChapters.find((c) => c.id === value) || null;
  }, [value, enrichedChapters]);

  return (
    <div className="space-y-2">
      {showFilters && exams.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Filter size={12} className="text-amber-400" /> Filter:
          </span>

          {/* Exam Filter Pills */}
          <select
            className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:ring-1 focus:ring-amber-400"
            value={selectedExamId}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              setSelectedFolderId('');
            }}
          >
            <option value="">All Exams</option>
            {exams.map((exam) => (
              <option value={exam.id} key={exam.id}>{exam.title}</option>
            ))}
          </select>

          {/* Subject / Folder Filter */}
          {availableFolders.length > 0 && (
            <select
              className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:ring-1 focus:ring-amber-400"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
            >
              <option value="">All Subjects / Folders</option>
              {availableFolders.map((f) => (
                <option value={f.id} key={f.id}>{f.title}</option>
              ))}
            </select>
          )}

          {/* Search box if there are more than 10 chapters */}
          {chapters.length > 10 && (
            <div className="relative flex-1 min-w-[140px]">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-7 pr-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="Search chapter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {(selectedExamId || selectedFolderId || searchQuery) && (
            <button
              type="button"
              className="px-2 py-1 text-slate-400 hover:text-white underline text-[11px]"
              onClick={() => {
                setSelectedExamId('');
                setSelectedFolderId('');
                setSearchQuery('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Main Select Dropdown */}
      <select
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {groupedChapters.map(([groupName, chaps]) => (
          <optgroup label={`📁 ${groupName}`} key={groupName}>
            {chaps.map((chapter) => (
              <option value={chapter.id} key={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Selected Breadcrumb Badge */}
      {activeChapter && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300">
          <CheckCircle2 size={13} className="text-amber-400 flex-shrink-0" />
          <span className="font-semibold text-slate-400">Hierarchy:</span>
          <span className="font-medium text-slate-200">{activeChapter.hierarchy.breadcrumb}</span>
        </div>
      )}
    </div>
  );
}

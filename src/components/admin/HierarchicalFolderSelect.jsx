import React, { useMemo, useState } from 'react';
import { CheckCircle2, Folder, Search, X } from 'lucide-react';
import { getFolderPath } from '../../lib/content';

/**
 * HierarchicalFolderSelect
 * Eliminates confusion when selecting folders across thousands of categories.
 * Groups folders by Exam and Parent category with full breadcrumbs,
 * and provides instant live search so identical sub-folder names (like "Economics" or "History")
 * are never confused.
 */
export default function HierarchicalFolderSelect({
  folders = [],
  exams = [],
  value = 'all',
  onChange,
  selectedExamId = 'all',
  placeholder = 'Select folder...',
  showAllOption = true,
  allOptionLabel = 'All folders',
  showSearch = false,
  className = 'text-input',
  disabled = false,
  required = false
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const examsMap = useMemo(() => new Map((exams || []).map((e) => [e.id, e])), [exams]);
  const foldersMap = useMemo(() => new Map((folders || []).map((f) => [f.id, f])), [folders]);

  // Compute full hierarchy path and breadcrumbs for each folder
  const enrichedFolders = useMemo(() => {
    return (folders || []).map((folder) => {
      const pathParts = getFolderPath(folder, folders);
      const exam = examsMap.get(folder.exam_id);
      const examTitle = exam?.title || 'General / Other';

      const pathTitles = pathParts.map((p) => p.title);
      const fullBreadcrumb = [examTitle, ...pathTitles].join(' › ');
      const groupLabel = pathParts.length > 1
        ? [examTitle, ...pathParts.slice(0, -1).map((p) => p.title)].join(' › ')
        : examTitle;

      return {
        ...folder,
        examTitle,
        pathParts,
        breadcrumb: fullBreadcrumb,
        groupLabel,
        displayName: folder.title
      };
    });
  }, [folders, examsMap]);

  // Filter folders by selectedExamId (if passed) and search query
  const filteredFolders = useMemo(() => {
    return enrichedFolders.filter((f) => {
      if (selectedExamId && selectedExamId !== 'all' && f.exam_id !== selectedExamId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = f.title.toLowerCase().includes(q);
        const matchesBreadcrumb = f.breadcrumb.toLowerCase().includes(q);
        if (!matchesName && !matchesBreadcrumb) return false;
      }
      return true;
    });
  }, [enrichedFolders, selectedExamId, searchQuery]);

  // Group filtered folders by Parent Category / Exam for <optgroup>
  const groupedFolders = useMemo(() => {
    const groups = new Map();
    filteredFolders.forEach((folder) => {
      const key = folder.groupLabel || 'General';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(folder);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredFolders]);

  // Currently selected folder info
  const activeFolder = useMemo(() => {
    if (!value || value === 'all') return null;
    return enrichedFolders.find((f) => f.id === value) || null;
  }, [value, enrichedFolders]);

  return (
    <div className="space-y-1.5 w-full">
      {/* Live Search Box for folders (only when showSearch is explicitly enabled) */}
      {showSearch && folders.length > 5 && (
        <div className="relative w-full">
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-7 pr-6 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-200 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder="Search folder (e.g. Science, Class 10)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setSearchQuery('')}
              title="Clear folder search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Main Folder Select */}
      <select
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        {showAllOption && <option value="all">{allOptionLabel}</option>}
        {!showAllOption && <option value="">{placeholder}</option>}
        {groupedFolders.map(([groupName, fList]) => (
          <optgroup label={`📁 ${groupName}`} key={groupName}>
            {fList.map((folder) => (
              <option value={folder.id} key={folder.id}>
                {folder.displayName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Active Selection Breadcrumb Indicator */}
      {activeFolder && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[11px] text-indigo-900 dark:text-indigo-300">
          <CheckCircle2 size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-semibold text-slate-500 dark:text-slate-400">Path:</span>
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{activeFolder.breadcrumb}</span>
        </div>
      )}
    </div>
  );
}

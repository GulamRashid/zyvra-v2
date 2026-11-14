import { useMemo, useState } from 'react';
import {
  Atom, BookMarked, BookOpen, Brain, Calculator, FlaskConical,
  Globe2, GraduationCap, Landmark, ScrollText, Search, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import useContentCatalog from '../../hooks/useContentCatalog';
import { isPublished } from '../../lib/content';

const examIcons = { BookOpen, GraduationCap, Landmark, Atom, Calculator, Globe2, Brain, ScrollText, FlaskConical, BookMarked };

export default function ExploreExams() {
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Dynamically derive categories from actual exams in database
  const categories = useMemo(() => {
    const list = ['All'];
    exams.forEach((exam) => {
      const cat = exam.category || exam.title;
      if (cat && !list.includes(cat)) {
        list.push(cat);
      }
    });
    return list;
  }, [exams]);

  const visibleExams = useMemo(() => exams.filter((exam) => {
    if (!isPublished(exam)) return false;
    if (selectedCategory !== 'All') {
      const matchCat = (exam.category || exam.title || '').toLowerCase() === selectedCategory.toLowerCase();
      if (!matchCat) return false;
    }
    return !search.trim() || `${exam.title} ${exam.slug} ${exam.description || ''}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [exams, selectedCategory, search]);

  return (
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading Banner */}
        <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#07261b] dark:to-[#04140e] bg-gradient-to-br from-emerald-100/90 via-teal-50 to-white border dark:border-emerald-500/25 border-emerald-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
              Your Next Goal Starts Here
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
              Explore Exams
            </h1>
            <p className="text-xs sm:text-sm dark:text-emerald-200/80 text-slate-600 font-medium mt-0.5">
              Choose your exam. We’ll help you take it one step at a time.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full dark:bg-emerald-950/80 bg-white border dark:border-emerald-500/30 border-slate-200 text-xs font-bold dark:text-emerald-300 text-emerald-800 shadow-xs shrink-0">
            <GraduationCap size={16} />
            <span>
              {visibleExams.length} {visibleExams.length === 1 ? 'Exam' : 'Exams'}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-emerald-400/60" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exams, subjects or syllabus…"
            aria-label="Search exams"
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 dark:text-white text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 min-h-[44px]"
          />
        </div>

        {/* Category Filters */}
        {categories.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" aria-label="Filter by exam category">
            {categories.map((item) => {
              const isSelected = selectedCategory === item;
              return (
                <button
                  key={item}
                  onClick={() => setSelectedCategory(item)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all min-h-[44px] ${
                    isSelected
                      ? 'bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white'
                      : 'dark:bg-[#072117]/85 bg-white border dark:border-emerald-500/20 border-slate-200 dark:text-emerald-200 text-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {loading && <LoadingSkeleton rows={4} />}

        {!loading && !error && !visibleExams.length && (
          <div className="p-8 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
            <BookOpen size={28} className="mx-auto text-emerald-500 opacity-60" />
            <strong className="block text-sm dark:text-white text-slate-900">No exams available matching your search.</strong>
            <span className="text-xs text-slate-500 dark:text-emerald-300/80">Try a different keyword or view all exams.</span>
          </div>
        )}

        {/* Exams Grid (1-column on mobile 360px, 2-column on tablet+) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {visibleExams.map((exam) => {
            const Icon = examIcons[exam.icon] || GraduationCap;
            const examFolders = folders.filter((folder) => folder.exam_id === exam.id && isPublished(folder));
            const folderIds = new Set(examFolders.map((folder) => folder.id));
            const chapterCount = chapters.filter((chapter) => folderIds.has(chapter.folder_id) && isPublished(chapter)).length;

            return (
              <article
                className="p-4 sm:p-5 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-400/60 transition-all flex flex-col justify-between space-y-3"
                key={exam.id}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-2xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Icon size={20} />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      {exam.category || 'Exam'}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
                      {exam.title}
                    </h2>
                    <p className="text-sm dark:text-emerald-200/80 text-slate-600 font-medium line-clamp-2 mt-0.5">
                      {exam.description || 'A structured learning path with topics, practice and tests to help you prepare.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t dark:border-emerald-800/30 border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-emerald-400/70">
                    <span className="flex items-center gap-1">
                      <BookOpen size={13} /> {examFolders.length} {examFolders.length === 1 ? 'folder' : 'folders'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} /> {chapterCount} chapters
                    </span>
                  </div>

                  <Link
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white font-black text-sm inline-flex items-center gap-1 min-h-[44px]"
                    to={`/explore/${encodeURIComponent(exam.slug || exam.id)}`}
                  >
                    <span>Syllabus</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && !error && visibleExams.length > 0 && (
          <p className="text-center text-xs dark:text-emerald-400/70 text-slate-500 font-medium pt-2">
            ✨ Curated paths to keep your study focused.
          </p>
        )}
      </div>
    </div>
  );
}

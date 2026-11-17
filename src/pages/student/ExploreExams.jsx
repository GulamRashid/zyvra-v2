import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Folder, GraduationCap, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ContentIcon from '../../components/common/ContentIcon';
import useContentCatalog from '../../hooks/useContentCatalog';
import { isPublished } from '../../lib/content';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function ExploreExams() {
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { language } = useThemeLanguage();
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
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#f4faf7] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading Banner */}
        <div className="page-heading relative overflow-hidden rounded-2xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50/80 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-3.5 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <h1 className="text-lg sm:text-xl font-black dark:text-white text-slate-900 tracking-tight">
              {language === 'hi' ? 'परीक्षाएं और पाठ्यक्रम' : 'Explore Exams'}
            </h1>
            <p className="text-xs dark:text-slate-300 text-slate-600 font-medium mt-0.5">
              {language === 'hi' ? 'अपनी परीक्षा चुनें और विषयवार नोट्स व टेस्ट सीरीज एक्सप्लोर करें।' : 'Choose an exam to view its syllabus and available study materials.'}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-bold dark:text-indigo-300 text-indigo-800 shadow-xs shrink-0">
            <GraduationCap size={15} />
            <span>
              {visibleExams.length} {language === 'hi' ? 'परीक्षाएं' : visibleExams.length === 1 ? 'Exam' : 'Exams'}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={language === 'hi' ? 'परीक्षा, विषय या टॉपिक खोजें...' : 'Search exams, subjects or syllabus...'}
            aria-label="Search exams"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 dark:text-white text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 min-h-[40px]"
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
                      ? 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white'
                      : 'dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-indigo-400'
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
          <div className="p-8 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
            <BookOpen size={28} className="mx-auto text-indigo-500 opacity-60" />
            <strong className="block text-sm dark:text-white text-slate-900">No exams available matching your search.</strong>
            <span className="text-xs text-slate-500 dark:text-slate-400">Try a different keyword or view all exams.</span>
          </div>
        )}

        {/* Exams Grid (Compact, tap-friendly, responsive) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleExams.map((exam) => {
            const examFolders = folders.filter((folder) => folder.exam_id === exam.id && isPublished(folder));
            const folderIds = new Set(examFolders.map((folder) => folder.id));
            const chapterCount = chapters.filter((chapter) => folderIds.has(chapter.folder_id) && isPublished(chapter)).length;

            return (
              <Link
                key={exam.id}
                to={`/explore/${encodeURIComponent(exam.slug || exam.id)}`}
                className="group relative p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-xs hover:shadow-md border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 transition-all flex flex-col justify-between space-y-2.5 text-left active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl dark:bg-slate-800 bg-indigo-50/80 border dark:border-slate-700 border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                    <ContentIcon icon={exam.icon_url || exam.icon} className="w-5 h-5 text-indigo-500" fallback={GraduationCap} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight truncate group-hover:text-indigo-400 transition-colors">
                        {exam.title}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                        {exam.category || 'Exam'}
                      </span>
                    </div>

                    <p className="text-xs dark:text-slate-400 text-slate-600 font-medium line-clamp-2 mt-0.5 leading-snug">
                      {exam.description || 'A structured learning path with topics, practice and tests to help you prepare.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold dark:text-slate-400 text-slate-500">
                    <span className="flex items-center gap-1">
                      <Folder size={12} className="text-indigo-400" />
                      <span>{examFolders.length} {language === 'hi' ? 'विषय' : examFolders.length === 1 ? 'folder' : 'folders'}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} className="text-indigo-400" />
                      <span>{chapterCount} {language === 'hi' ? 'अध्याय' : chapterCount === 1 ? 'chapter' : 'chapters'}</span>
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500 group-hover:text-indigo-400 transition-colors">
                    <span>{language === 'hi' ? 'सिलेबस देखें' : 'View Syllabus'}</span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
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

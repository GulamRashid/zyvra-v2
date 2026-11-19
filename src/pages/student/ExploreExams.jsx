import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Folder, GraduationCap, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ContentIcon from '../../components/common/ContentIcon';
import CheckoutModal from '../../components/common/CheckoutModal';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getExamCategory, isPublished, sortContentItems } from '../../lib/content';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const DEFAULT_FULL_PASS = {
  title: 'ZYVRA All-Access Full Pass',
  subtitle: 'सभी परीक्षाओं, टेस्ट्स और टूल्स का 1 साल का अनलिमिटेड एक्सेस',
  price: 999,
  validity_days: 365,
  is_active: true,
  include_all: true,
  included_exam_ids: [],
  included_tool_ids: ['mistake-notebook', 'flashcards', 'math-shortcuts', 'formula-sheet', 'polity-articles', 'risk-simulator']
};

export default function ExploreExams() {
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user, supabase } = useAuth();
  const { language } = useThemeLanguage();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [fullPassConfig, setFullPassConfig] = useState(DEFAULT_FULL_PASS);
  const [hasFullPass, setHasFullPass] = useState(false);
  const [checkout, setCheckout] = useState(null);

  // Load platform full pass configuration and verify user access
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadFullPass = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('setting_value, value')
          .or('setting_key.eq.full_pass_config,key.eq.full_pass_config')
          .maybeSingle();

        if (!active) return;
        let val = data?.setting_value ?? data?.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch { val = null; }
        }
        if (val && typeof val === 'object') {
          setFullPassConfig((prev) => ({
            ...prev,
            ...val,
            price: val.price !== undefined ? Number(val.price) : prev.price,
            validity_days: val.validity_days !== undefined ? Number(val.validity_days) : prev.validity_days,
            is_active: val.is_active !== false,
            include_all: val.include_all !== false
          }));
        } else if (!data) {
          // Auto-seed default row in platform_settings if missing
          supabase
            .from('platform_settings')
            .upsert({
              setting_key: 'full_pass_config',
              key: 'full_pass_config',
              setting_value: DEFAULT_FULL_PASS
            }, { onConflict: 'setting_key' })
            .then(() => {})
            .catch(() => {});
        }

        if (user?.id) {
          const { data: accessData } = await supabase.rpc('check_user_access', {
            p_user_id: user.id,
            p_item_type: 'full_pass',
            p_item_id: 'global'
          });
          if (active) {
            setHasFullPass(Boolean(accessData));
          }
        }
      } catch (e) {
        console.warn('Could not load full pass config in ExploreExams:', e);
      }
    };
    loadFullPass();
    return () => { active = false; };
  }, [supabase, user?.id]);

  // Dynamically derive categories and counts using standard exam taxonomy
  const categories = useMemo(() => {
    const published = exams.filter(isPublished);
    const catMap = new Map();
    catMap.set('All', published.length);

    published.forEach((exam) => {
      const cat = getExamCategory(exam);
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });

    return Array.from(catMap.entries()).map(([name, count]) => ({
      name,
      count
    }));
  }, [exams]);

  const visibleExams = useMemo(() => {
    const filtered = exams.filter((exam) => {
      if (!isPublished(exam)) return false;
      if (selectedCategory !== 'All') {
        const cat = getExamCategory(exam);
        if (cat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return `${exam.title} ${exam.slug} ${exam.description || ''} ${getExamCategory(exam)}`.toLowerCase().includes(q);
      }
      return true;
    });

    return sortContentItems(filtered);
  }, [exams, selectedCategory, search]);

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
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" aria-label="Filter by exam category">
            {categories.map((item) => {
              const isSelected = selectedCategory === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setSelectedCategory(item.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[38px] ${
                    isSelected
                      ? 'bg-indigo-600 border border-indigo-400/30 text-white shadow-xs'
                      : 'dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <span>{item.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'dark:bg-slate-800 bg-slate-100 text-slate-500'
                  }`}>
                    {item.count}
                  </span>
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

        {/* All-Access Platform Full Pass Banner */}
        {fullPassConfig && fullPassConfig.is_active !== false && !search.trim() && (
          <div className="relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-indigo-50/70 dark:from-[#1E293B] dark:via-slate-900 dark:to-[#1E293B] border-2 border-amber-400 dark:border-amber-400/50 shadow-md transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 flex items-center gap-1 shadow-xs">
                    👑 {language === 'hi' ? 'ऑल-एक्सेस प्लेटफॉर्म पास' : 'All-Access Platform Pass'}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400">
                    {fullPassConfig.validity_days || 365} {language === 'hi' ? 'दिन अनलिमिटेड' : 'Days Unlimited'}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
                  {fullPassConfig.title || 'ZYVRA All-Access Full Pass'}
                </h2>
                <p className="text-xs dark:text-slate-300 text-slate-700 font-medium">
                  {fullPassConfig.subtitle || (language === 'hi' ? 'सभी परीक्षाओं, टेस्ट्स और टूल्स का अनलिमिटेड 1 साल का एक्सेस' : 'Unlimited 1-year access to all exams, tests and study tools')}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">✓ {language === 'hi' ? 'सभी वर्तमान और भविष्य की परीक्षाएं' : 'All Current & Future Exams'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">✓ {language === 'hi' ? 'पूर्ण टेस्ट सीरीज और मॉक टेस्ट' : 'Full Test Series & Mock Tests'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">✓ {language === 'hi' ? 'प्रो स्टडी टूल्स' : 'Pro Study Tools'}</span>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 dark:border-slate-800 border-slate-300/80 pt-2.5 sm:pt-0">
                {hasFullPass ? (
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-xs">
                    <span>✓</span>
                    <span>{language === 'hi' ? 'फुल पास एक्टिव है' : 'Full Pass Active'}</span>
                  </div>
                ) : (
                  <>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 leading-none">
                        ₹{fullPassConfig.price || 999}
                      </div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                        {fullPassConfig.validity_days || 365} {language === 'hi' ? 'दिनों के लिए' : 'days validity'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckout({
                        itemType: 'full_pass',
                        itemId: 'global',
                        itemTitle: fullPassConfig.title || 'ZYVRA All-Access Full Pass',
                        basePrice: fullPassConfig.price || 999,
                        validityDays: fullPassConfig.validity_days || 365
                      })}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-glowGold transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <span>{language === 'hi' ? 'पूरा पास अनलॉक करें' : 'Unlock Full Pass'}</span>
                      <ArrowRight size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
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
                        {getExamCategory(exam)}
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

        {/* Full Pass Checkout Modal */}
        {checkout && (
          <CheckoutModal
            {...checkout}
            onClose={() => setCheckout(null)}
            onCompleted={() => {
              setHasFullPass(true);
              setCheckout(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

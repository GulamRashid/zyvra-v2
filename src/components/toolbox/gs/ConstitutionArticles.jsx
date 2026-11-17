import { useMemo, useState } from 'react';
import { BookOpen, Landmark, Scale, ScrollText, Search, Sparkles } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import {
  CONSTITUTION_SCHEDULES,
  LANDMARK_CASES,
  MAJOR_AMENDMENTS,
  POLITY_ARTICLES
} from '../../../data/polityArticlesData';

export default function ConstitutionArticles() {
  const { language } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState('articles'); // 'articles' | 'amendments' | 'cases' | 'schedules'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = useMemo(() => {
    const set = new Set(POLITY_ARTICLES.map((a) => a.category));
    return ['all', ...Array.from(set)];
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    return POLITY_ARTICLES.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${item.number} ${item.part} ${item.category} ${item.title_en} ${item.title_hi} ${item.detail_en} ${item.detail_hi}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [categoryFilter, normalizedQuery]);

  const filteredAmendments = useMemo(() => {
    if (!normalizedQuery) return MAJOR_AMENDMENTS;
    return MAJOR_AMENDMENTS.filter((item) =>
      `${item.number} ${item.year} ${item.title} ${item.title_hi || ''} ${item.detail}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredCases = useMemo(() => {
    if (!normalizedQuery) return LANDMARK_CASES;
    return LANDMARK_CASES.filter((item) =>
      `${item.name} ${item.year} ${item.significance} ${item.detail}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const isHindi = language === 'hi';

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="section-heading flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow">
            {isHindi ? 'भारतीय राजव्यवस्था एवं संविधान' : 'INDIAN POLITY & CONSTITUTION'}
          </div>
          <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900 flex items-center gap-2">
            <Landmark size={20} className="text-amber-500" />
            <span>{isHindi ? 'हाई-यील्ड संविधान एवं राजव्यवस्था वॉल्ट' : 'High-Yield Polity & Articles Vault'}</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {isHindi
              ? 'BPSC, UPSC और State PCS परीक्षाओं के लिए सर्वाधिक पूछे जाने वाले प्रावधान'
              : 'Most frequently tested articles, amendments, cases & schedules'}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
          80+ High Yield
        </span>
      </div>

      {/* Main Mode Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200">
        {[
          { id: 'articles', label: isHindi ? 'अनुच्छेद (Articles)' : 'Articles', icon: BookOpen, count: POLITY_ARTICLES.length },
          { id: 'amendments', label: isHindi ? 'संशोधन (Amendments)' : 'Amendments', icon: ScrollText, count: MAJOR_AMENDMENTS.length },
          { id: 'cases', label: isHindi ? 'प्रमुख वाद (Cases)' : 'Landmark Cases', icon: Scale, count: LANDMARK_CASES.length },
          { id: 'schedules', label: isHindi ? 'अनुसूचियां (Schedules)' : '12 Schedules', icon: Landmark, count: 12 }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={`w-full py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-glowIndigo'
                  : 'dark:text-slate-300 text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black shrink-0 ${
                isSelected ? 'bg-indigo-700 text-white' : 'dark:bg-slate-700 bg-slate-200 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative">
        <label className="flex items-center gap-2 rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-slate-800/60 bg-white px-3.5 py-2.5 shadow-sm min-h-[46px]">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'articles'
                ? isHindi ? 'अनुच्छेद संख्या या विषय खोजें (उदा: 14, 21, 32, DPSP, राष्ट्रपति)...' : 'Search by article number or keyword (e.g. 14, 32, President, DPSP)...'
                : activeTab === 'amendments'
                ? isHindi ? 'संशोधन खोजें (उदा: 42, 44, 73, GST, EWS)...' : 'Search amendment (e.g. 42nd, 44th, 73rd, GST, EWS)...'
                : activeTab === 'cases'
                ? isHindi ? 'केस खोजें (उदा: Kesavananda, Bommai, Privacy)...' : 'Search case (e.g. Kesavananda, Bommai, Privacy)...'
                : isHindi ? 'अनुसूची खोजें...' : 'Search schedules...'
            }
            className="w-full bg-transparent text-base sm:text-sm font-semibold outline-none placeholder:text-slate-400 dark:text-white text-slate-900"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-indigo-500 hover:underline px-1"
            >
              {isHindi ? 'साफ़ करें' : 'Clear'}
            </button>
          )}
        </label>
      </div>

      {/* Category Pills (Articles Tab Only) */}
      {activeTab === 'articles' && !searchQuery && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'dark:bg-slate-800 bg-slate-100 dark:text-slate-300 text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat === 'all' ? (isHindi ? 'सभी विषय' : 'All Topics') : cat}
            </button>
          ))}
        </div>
      )}

      {/* VIEW 1: ARTICLES TAB */}
      {activeTab === 'articles' && (
        <div className="space-y-2.5">
          {filteredArticles.length ? (
            filteredArticles.map((article) => (
              <details
                key={article.number}
                className="group rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-slate-800/60 bg-white shadow-xs overflow-hidden transition-all"
              >
                <summary className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none list-none hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center shrink-0 font-black text-xs leading-none">
                      <small className="text-[9px] font-bold text-slate-400">ART</small>
                      {article.number}
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-xs sm:text-sm font-bold dark:text-white text-slate-900 leading-snug">
                        {isHindi ? (article.title_hi || article.title_en) : article.title_en}
                      </strong>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                          {article.part}
                        </span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {article.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-500 shrink-0 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="px-4 pb-4 pt-1 border-t dark:border-slate-700/40 border-slate-100 text-xs sm:text-sm leading-relaxed dark:text-slate-300 text-slate-700 space-y-2">
                  <p className="p-3 rounded-xl dark:bg-slate-900/60 bg-indigo-50/50 border dark:border-slate-700/40 border-indigo-100">
                    {isHindi ? article.detail_hi : article.detail_en}
                  </p>
                  {isHindi && article.detail_en && (
                    <p className="text-[11px] text-slate-500 italic">
                      EN: {article.detail_en}
                    </p>
                  )}
                </div>
              </details>
            ))
          ) : (
            <div className="empty-content p-6 text-center text-xs text-slate-500">
              {isHindi ? 'कोई अनुच्छेद नहीं मिला। कृपया अन्य शब्द खोजें।' : 'No articles match this query.'}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: AMENDMENTS TAB */}
      {activeTab === 'amendments' && (
        <div className="space-y-3">
          {filteredAmendments.map((item) => (
            <article
              key={item.number}
              className="p-4 rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-slate-800/60 bg-white shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-black text-xs">
                  {item.number} Amendment ({item.year})
                </span>
                <span className="text-[11px] font-bold text-slate-400">Constitution of India</span>
              </div>
              <h4 className="text-sm font-black dark:text-white text-slate-900">
                {isHindi ? (item.title_hi || item.title) : item.title}
              </h4>
              <p className="text-xs sm:text-sm leading-relaxed dark:text-slate-300 text-slate-700">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      )}

      {/* VIEW 3: LANDMARK CASES TAB */}
      {activeTab === 'cases' && (
        <div className="space-y-3">
          {filteredCases.map((item) => (
            <article
              key={item.name}
              className="p-4 rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-slate-800/60 bg-white shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5">
                  <Scale size={15} className="text-amber-500" />
                  <span>{item.name}</span>
                </h4>
                <span className="text-xs font-extrabold text-indigo-500">{item.year}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles size={13} />
                <span>{item.significance}</span>
              </div>
              <p className="text-xs leading-relaxed dark:text-slate-300 text-slate-700">
                {item.detail}
              </p>
              <small className="block text-[10px] text-slate-400">Bench: {item.bench}</small>
            </article>
          ))}
        </div>
      )}

      {/* VIEW 4: SCHEDULES TAB */}
      {activeTab === 'schedules' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CONSTITUTION_SCHEDULES.map((sch) => (
            <div
              key={sch.number}
              className="p-3.5 rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-slate-800/60 bg-white shadow-xs space-y-1"
            >
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">
                {isHindi ? `अनुसूची ${sch.number}` : `Schedule ${sch.number}`}
              </span>
              <p className="text-xs font-semibold dark:text-slate-200 text-slate-800 pt-1 leading-relaxed">
                {isHindi ? sch.title_hi : sch.title_en}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

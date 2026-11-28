import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Layers,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSyllabusProgress from '../../hooks/useSyllabusProgress';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { SYLLABUS_STATUS } from '../../lib/syllabusProgress';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const FILTERS = [
  { id: 'all', en: 'All', hi: 'सभी' },
  { id: SYLLABUS_STATUS.NOT_STARTED, en: 'Not Started', hi: 'शुरू नहीं' },
  { id: SYLLABUS_STATUS.IN_PROGRESS, en: 'In Progress', hi: 'जारी' },
  { id: SYLLABUS_STATUS.DONE, en: 'Done', hi: 'पूर्ण' },
  { id: SYLLABUS_STATUS.WEAK, en: 'Weak', hi: 'कमज़ोर' }
];

function getStatusMeta(status, isComingSoon, language) {
  const hi = language === 'hi';
  if (isComingSoon) {
    return {
      label: hi ? 'जल्द आ रहा है' : 'Coming Soon',
      classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
      Icon: Clock3
    };
  }
  switch (status) {
    case SYLLABUS_STATUS.DONE:
      return {
        label: hi ? 'पूर्ण' : 'Done',
        classes: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        Icon: CheckCircle2
      };
    case SYLLABUS_STATUS.WEAK:
      return {
        label: hi ? 'कमज़ोर' : 'Weak',
        classes: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        Icon: AlertTriangle
      };
    case SYLLABUS_STATUS.IN_PROGRESS:
      return {
        label: hi ? 'जारी' : 'In Progress',
        classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        Icon: Clock3
      };
    default:
      return {
        label: hi ? 'शुरू नहीं' : 'Not Started',
        classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
        Icon: BookOpen
      };
  }
}

export default function SyllabusTracker() {
  const { examSlug } = useParams();
  const navigate = useNavigate();
  const { language } = useThemeLanguage();
  const hi = language === 'hi';
  const { exams, loading, error, refresh } = useSyllabusProgress();

  const [selectedExamSlug, setSelectedExamSlug] = useState(examSlug || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState({});

  useEffect(() => {
    if (examSlug) {
      setSelectedExamSlug(examSlug);
    } else if (exams.length > 0 && !selectedExamSlug) {
      const ncert = exams.find((e) => String(e.title || '').toLowerCase().includes('ncert')) || exams[0];
      setSelectedExamSlug(ncert.slug || ncert.examId);
    }
  }, [examSlug, exams, selectedExamSlug]);

  const activeExam = useMemo(() => {
    if (!exams.length) return null;
    return (
      exams.find((e) => e.slug === selectedExamSlug || e.examId === selectedExamSlug)
      || exams.find((e) => String(e.title || '').toLowerCase().includes('ncert'))
      || exams[0]
    );
  }, [exams, selectedExamSlug]);

  // Expand the first subject with actual attempts/progress or playable chapters (never a purely empty Coming Soon group)
  useEffect(() => {
    if (!activeExam?.subjects?.length) return;
    setExpandedSubjects((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const withActivity = activeExam.subjects.find(
        (s) => (s.doneCount + s.weakCount + s.inProgressCount) > 0
      );
      const withTests = activeExam.subjects.find((s) => s.totalChapters > 0);
      const target = withActivity || withTests;
      return target ? { [target.id]: true } : {};
    });
  }, [activeExam]);

  const firstPlayableChapter = useMemo(() => {
    if (!activeExam) return null;
    for (const subj of activeExam.subjects) {
      const ch = subj.chapters.find((c) => !c.isComingSoon && c.primaryTestId);
      if (ch) return ch;
    }
    return null;
  }, [activeExam]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleSubjects = useMemo(() => {
    if (!activeExam) return [];
    return activeExam.subjects
      .map((subj) => {
        const subjectMatches = normalizedSearch && String(subj.title || '').toLowerCase().includes(normalizedSearch);

        let filtered = subj.chapters.filter((ch) => {
          if (statusFilter !== 'all') {
            if (ch.isComingSoon) return false;
            if (ch.status !== statusFilter) return false;
          }
          if (normalizedSearch && !subjectMatches) {
            return String(ch.title || '').toLowerCase().includes(normalizedSearch);
          }
          return true;
        });

        if (statusFilter === SYLLABUS_STATUS.WEAK) {
          filtered = filtered.slice().sort((a, b) => {
            if ((b.mistakeCount || 0) !== (a.mistakeCount || 0)) {
              return (b.mistakeCount || 0) - (a.mistakeCount || 0);
            }
            return (a.latestScore ?? 100) - (b.latestScore ?? 100);
          });
        }

        return {
          ...subj,
          visibleChapters: filtered
        };
      })
      .filter((subj) => subj.visibleChapters.length > 0);
  }, [activeExam, statusFilter, normalizedSearch]);

  const toggleSubject = (subjectId) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  const hasAttempts = Boolean(activeExam && activeExam.attemptedChaptersCount > 0);
  const ringRadius = 26;
  const ringCirc = 2 * Math.PI * ringRadius;
  const pct = activeExam?.progressPercent ?? 0;
  const ringOffset = ringCirc - (pct / 100) * ringCirc;

  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to="/"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:border-indigo-500/50 transition-colors shrink-0"
            aria-label={hi ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
              {hi ? 'सिलेबस ट्रैकर' : 'Syllabus Tracker'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              {hi ? 'अध्याय-वार प्रगति, स्कोर और कमज़ोर विषय' : 'Chapter-by-chapter progress, scores and weak areas'}
            </p>
          </div>
        </div>
      </div>

      {/* Exam Switcher (only published/active exams) */}
      {exams.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {exams.map((ex) => {
            const isActive = activeExam?.examId === ex.examId;
            return (
              <button
                key={ex.examId}
                type="button"
                onClick={() => {
                  setSelectedExamSlug(ex.slug || ex.examId);
                  setExpandedSubjects({});
                }}
                className={`px-3.5 py-2 min-h-[44px] rounded-2xl text-xs font-extrabold whitespace-nowrap border transition-colors shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                    : 'dark:bg-[#1E293B] bg-white dark:border-slate-800 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-indigo-500/40'
                }`}
              >
                {ex.title}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200 text-sm font-medium flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-1.5 min-h-[44px] rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0"
          >
            {hi ? 'पुनः प्रयास करें' : 'Retry'}
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? null : !activeExam ? (
        <div className="p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 text-center space-y-2">
          <Layers size={28} className="mx-auto text-indigo-500" />
          <p className="text-sm font-bold dark:text-white text-slate-900">
            {hi ? 'कोई सक्रिय पाठ्यक्रम उपलब्ध नहीं है।' : 'No active exam syllabus available right now.'}
          </p>
        </div>
      ) : (
        <>
          {/* Overall Progress Card (Clean minimalist card — no decorative axisless background graphic) */}
          <section className="rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {hasAttempts ? (
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r={ringRadius} strokeWidth="6" fill="none" className="dark:stroke-slate-800 stroke-slate-200" />
                      <circle
                        cx="32"
                        cy="32"
                        r={ringRadius}
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={ringCirc}
                        strokeDashoffset={ringOffset}
                        className="stroke-emerald-500 transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute text-xs font-black dark:text-white text-slate-900">
                      {activeExam.progressPercent}%
                    </span>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Sparkles size={24} />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black dark:text-white text-slate-900">
                      {activeExam.title}
                    </h2>
                    {activeExam.comingSoonCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                        {activeExam.comingSoonCount} {hi ? 'जल्द आ रहे हैं' : 'Coming Soon'}
                      </span>
                    )}
                  </div>

                  {hasAttempts ? (
                    <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                      {hi
                        ? `टेस्ट वाले ${activeExam.totalChapters} अध्यायों में से ${activeExam.doneCount} पूर्ण`
                        : `${activeExam.doneCount} of ${activeExam.totalChapters} chapters with tests done`}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {hi
                        ? `अभी कोई प्रयास नहीं — ${activeExam.totalChapters} अध्याय अभ्यास के लिए तैयार हैं`
                        : `No attempts yet — start with Chapter 1 (${activeExam.totalChapters} chapters ready)`}
                    </p>
                  )}

                  {hasAttempts && (
                    <div className="flex items-center gap-3 flex-wrap text-[11px] font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">{activeExam.doneCount} {hi ? 'पूर्ण' : 'Done'}</span>
                      <span className="text-amber-600 dark:text-amber-400">{activeExam.inProgressCount} {hi ? 'जारी' : 'In Progress'}</span>
                      <span className="text-rose-600 dark:text-rose-400">{activeExam.weakCount} {hi ? 'कमज़ोर' : 'Weak'}</span>
                      <span className="text-slate-500 dark:text-slate-400">{activeExam.notStartedCount} {hi ? 'बाकी' : 'Not Started'}</span>
                    </div>
                  )}
                </div>
              </div>

              {!hasAttempts && firstPlayableChapter && (
                <button
                  type="button"
                  onClick={() => navigate(`/quiz/${firstPlayableChapter.primaryTestId}`, { state: { returnTo: `/syllabus/${activeExam.slug}` } })}
                  className="px-4 py-2.5 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-xs shrink-0 transition-colors"
                >
                  <Play size={14} />
                  <span>{hi ? 'अध्याय 1 शुरू करें' : 'Start Chapter 1'}</span>
                </button>
              )}
            </div>

            {/* Clear Status Rule Explanation (Explains why high Best score can still be Weak) */}
            <div className="pt-2.5 border-t dark:border-slate-800 border-slate-200/80 text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-start sm:items-center gap-1.5">
              <AlertTriangle size={13} className="text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                {hi
                  ? 'नियम: कमज़ोर = अंतिम स्कोर 50% से कम या मिस्टेक नोटबुक में 3+ गलतियाँ (पूर्ण ≥70% को भी कमज़ोर में रखता है)।'
                  : 'Rule: Weak = latest score <50% or 3+ mistakes in Mistake Notebook (overrides Done ≥70%).'}
              </span>
            </div>
          </section>

          {/* Search Box + Status Filters */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={hi ? 'अध्याय या विषय खोजें (उदा. Light, History)…' : 'Search chapters or subjects (e.g. Light, History)…'}
                aria-label={hi ? 'अध्याय खोजें' : 'Search syllabus chapters'}
                className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 text-xs sm:text-sm font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={hi ? 'खोज साफ करें' : 'Clear search'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {FILTERS.map((f) => {
                const active = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3.5 py-2 min-h-[44px] rounded-2xl text-xs font-extrabold whitespace-nowrap border transition-colors shrink-0 ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'dark:bg-[#1E293B] bg-white dark:border-slate-800 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-indigo-500/40'
                    }`}
                  >
                    {hi ? f.hi : f.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subjects & Chapter Rows */}
          {visibleSubjects.length === 0 ? (
            <div className="p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 text-center space-y-2">
              <p className="text-sm font-bold dark:text-white text-slate-900">
                {hi ? 'इस खोज या फ़िल्टर में कोई अध्याय नहीं मिला।' : 'No chapters match this search or filter.'}
              </p>
              {(statusFilter !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  {hi ? 'सभी अध्याय देखें' : 'Show All Chapters'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSubjects.map((subj) => {
                const isExpanded = statusFilter !== 'all' || Boolean(normalizedSearch) || Boolean(expandedSubjects[subj.id]);
                return (
                  <section
                    key={subj.id}
                    className="rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200/90 overflow-hidden shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubject(subj.id)}
                      className="w-full px-4 py-3.5 min-h-[52px] flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black dark:text-white text-slate-900">
                            {subj.title}
                          </h3>
                          {subj.isPyq && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              PYQ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                          {subj.totalChapters > 0 ? (
                            <>
                              {hi
                                ? `${subj.totalChapters} में से ${subj.doneCount} पूर्ण`
                                : `${subj.doneCount} of ${subj.totalChapters} done`}
                              {subj.comingSoonCount > 0 ? ` · ${subj.comingSoonCount} ${hi ? 'जल्द आ रहे हैं' : 'Coming Soon'}` : ''}
                            </>
                          ) : (
                            <span>
                              {subj.comingSoonCount} {hi ? 'अध्याय जल्द आ रहे हैं' : 'chapters coming soon'}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="w-8 h-8 rounded-xl dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="divide-y dark:divide-slate-800 divide-slate-200 border-t dark:border-slate-800 border-slate-200">
                        {subj.visibleChapters.map((ch) => {
                          const meta = getStatusMeta(ch.status, ch.isComingSoon, language);
                          const StatusIcon = meta.Icon;
                          const isWeak = ch.status === SYLLABUS_STATUS.WEAK;
                          const hasAction = !ch.isComingSoon && (ch.primaryTestId || ch.slug);
                          const actionTarget = ch.primaryTestId
                            ? `/quiz/${ch.primaryTestId}${(ch.completedCount || 0) > 0 ? '?reattempt=1' : ''}`
                            : `/chapter/${encodeURIComponent(ch.slug)}`;
                          const actionLabel = ch.attemptsCount > 0
                            ? (hi ? 'पुनः अभ्यास' : 'Retake')
                            : (hi ? 'अभ्यास' : 'Practice');

                          return (
                            <div
                              key={ch.chapterId}
                              className="px-4 py-3 min-h-[56px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-start sm:items-center justify-between sm:justify-start gap-2 flex-wrap">
                                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 leading-snug">
                                    {ch.title}
                                  </span>
                                  {!ch.isComingSoon && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${meta.classes}`}>
                                      <StatusIcon size={11} />
                                      {meta.label}
                                    </span>
                                  )}
                                  {ch.isPyq && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                                      PYQ
                                    </span>
                                  )}
                                </div>

                                {!ch.isComingSoon && (
                                  <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>
                                      {hi ? 'सर्वश्रेष्ठ (सभी टेस्ट):' : 'Best (all tests):'}{' '}
                                      <strong className="dark:text-slate-200 text-slate-800">
                                        {ch.completedCount > 0 && ch.bestScore !== null
                                          ? `${ch.bestScore}%`
                                          : ch.attemptsCount > 0
                                            ? (hi ? '— (जारी)' : '— (in progress)')
                                            : '—'}
                                      </strong>
                                    </span>
                                    <span>
                                      {ch.attemptsCount}{' '}
                                      {hi ? 'प्रयास' : (ch.attemptsCount === 1 ? 'attempt' : 'attempts')}
                                    </span>
                                    {isWeak && ch.mistakeCount > 0 && (
                                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                                        {ch.mistakeCount} {hi ? 'गलतियाँ नोटबुक में' : (ch.mistakeCount === 1 ? 'mistake' : 'mistakes')}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center">
                                {hasAction ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate(actionTarget, { state: { returnTo: `/syllabus/${activeExam.slug}`, reattempt: (ch.completedCount || 0) > 0 } })}
                                    className="w-full sm:w-auto px-3.5 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                                  >
                                    {ch.attemptsCount > 0 ? <RotateCcw size={13} /> : <ArrowRight size={13} />}
                                    <span>{actionLabel}</span>
                                  </button>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold ${meta.classes}`}>
                                    <StatusIcon size={12} />
                                    {meta.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

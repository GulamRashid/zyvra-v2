import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Trash2, ArrowRight, BookOpen, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import MathRenderer from '../../components/common/MathRenderer';

const LOCAL_STORAGE_BOOKMARKS_KEY = 'zyvra_saved_question_bookmarks';

export default function StudentBookmarks() {
  const { user, supabase } = useAuth();
  const [localBookmarks, setLocalBookmarks] = useState([]);
  const [dbBookmarks, setDbBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealedAnswers, setRevealedAnswers] = useState(new Set());
  const [error, setError] = useState('');

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    setError('');
    // 1. Read local bookmarks (both question and attempt bookmarks)
    try {
      const rawQuestions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BOOKMARKS_KEY) || '[]');
      const rawResults = JSON.parse(localStorage.getItem('zyvra_bookmarks') || '[]');
      const qBookmarks = Array.isArray(rawQuestions) ? rawQuestions : [];
      const resultBookmarks = Array.isArray(rawResults) ? rawResults : [];
      if (user?.id) {
        const migratedQuestions = qBookmarks.map((item) => item.user_id ? item : { ...item, user_id: user.id });
        const migratedResults = resultBookmarks.map((item) => item.user_id ? item : { ...item, user_id: user.id });
        if (migratedQuestions.some((item, index) => item !== qBookmarks[index])) {
          localStorage.setItem(LOCAL_STORAGE_BOOKMARKS_KEY, JSON.stringify(migratedQuestions));
        }
        if (migratedResults.some((item, index) => item !== resultBookmarks[index])) {
          localStorage.setItem('zyvra_bookmarks', JSON.stringify(migratedResults));
        }
        qBookmarks.splice(0, qBookmarks.length, ...migratedQuestions);
        resultBookmarks.splice(0, resultBookmarks.length, ...migratedResults);
      }
      const belongsToUser = (item) => !item.user_id || item.user_id === user?.id;
      const combined = [
        ...qBookmarks.filter(belongsToUser),
        ...resultBookmarks.filter(belongsToUser)
      ];
      setLocalBookmarks(combined);
    } catch {
      setLocalBookmarks([]);
    }

    // 2. Read DB bookmarks if authenticated
    setDbBookmarks([]);
    if (supabase && user) {
      try {
        const { data, error: bErr } = await supabase
          .from('student_bookmarks')
          .select('*, chapters(id, title)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (bErr) throw bErr;
        setDbBookmarks(data || []);
      } catch (err) {
        console.warn('Error loading db bookmarks:', err);
        setError('Unable to load saved chapters. Please try again.');
      }
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const removeLocalBookmark = (id) => {
    const next = localBookmarks.filter((b) => b.id !== id);
    setLocalBookmarks(next);
    try {
      const questionBookmarks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BOOKMARKS_KEY) || '[]');
      const resultBookmarks = JSON.parse(localStorage.getItem('zyvra_bookmarks') || '[]');
      const belongsToCurrentUser = (item) => !item.user_id || item.user_id === user?.id;
      localStorage.setItem(LOCAL_STORAGE_BOOKMARKS_KEY, JSON.stringify((Array.isArray(questionBookmarks) ? questionBookmarks : []).filter((item) => item.id !== id || !belongsToCurrentUser(item))));
      localStorage.setItem('zyvra_bookmarks', JSON.stringify((Array.isArray(resultBookmarks) ? resultBookmarks : []).filter((item) => (item.id !== id && item.attemptId !== id) || !belongsToCurrentUser(item))));
    } catch {
      setError('This bookmark could not be removed from this device.');
    }
  };

  const removeDbBookmark = async (id) => {
    if (!supabase) return;
    try {
      const { error: deleteError } = await supabase.from('student_bookmarks').delete().eq('id', id).eq('user_id', user.id);
      if (deleteError) throw deleteError;
      setDbBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.warn('Error deleting bookmark:', err);
      setError('Unable to remove this saved chapter. Please try again.');
    }
  };

  const toggleReveal = (id) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCount = localBookmarks.length + dbBookmarks.length;

  return (
    <div className="bookmarks-page min-h-screen dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6">
        {/* Page Heading Banner */}
        <div className="page-heading relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">
              YOUR PERSONAL REVISION VAULT
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
              <Bookmark className="text-amber-500 w-6 h-6 fill-amber-500" />
              <span>Saved Bookmarks</span>
            </h1>
            <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
              Review important questions and study chapters you flagged during practice.
            </p>
          </div>

          <button
            type="button"
            onClick={loadBookmarks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-bold dark:text-slate-200 text-slate-700 shadow-xs hover:border-indigo-500 transition-colors shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : error ? (
          <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
        ) : totalCount === 0 ? (
          <div className="p-8 rounded-3xl dark:bg-[#1E293B]/80 bg-white border dark:border-slate-800 border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mx-auto flex items-center justify-center">
              <Bookmark size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black dark:text-white text-slate-900">No bookmarks saved yet</h3>
              <p className="text-xs dark:text-slate-400 text-slate-600 max-w-sm mx-auto">
                While taking tests or practicing questions, tap the bookmark icon to save challenging questions here for revision.
              </p>
            </div>
            <div>
              <Link
                to="/tests"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform active:scale-95 shadow-glowIndigo"
              >
                <span>Start Practice & Tests</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bookmarked Questions & Test Results */}
            {localBookmarks.map((item, idx) => {
              if (item.type === 'test_result') {
                return (
                  <div
                    key={item.id || idx}
                    className="p-3 sm:p-3.5 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                        <Bookmark size={20} className="fill-amber-500" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">
                          Test Analysis Report
                        </span>
                        <h3 className="text-sm font-extrabold dark:text-white text-slate-900">
                          {item.title || 'Completed Mock Test'}
                        </h3>
                        {item.savedAt && (
                          <span className="text-[10px] dark:text-slate-400 text-slate-500 block">
                            Saved on {new Date(item.savedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/quiz/result/${item.attemptId || item.id}`}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <span>View Result</span>
                        <ArrowRight size={13} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeLocalBookmark(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              }

              const isRevealed = revealedAnswers.has(item.id);

              return (
                <div
                  key={item.id || idx}
                  className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase dark:bg-amber-500/15 bg-amber-50 dark:text-amber-400 text-amber-700 border border-amber-500/30">
                      Saved Question {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLocalBookmark(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Remove bookmark"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="text-sm font-semibold dark:text-white text-slate-900 leading-relaxed">
                    <MathRenderer content={item.question_text || item.text || item.question || ''} />
                  </div>

                  {/* Options */}
                  {Array.isArray(item.options) && (
                    <div className="space-y-1.5 pt-1">
                      {item.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className="px-3 py-2 rounded-xl dark:bg-slate-900/40 bg-slate-50 border dark:border-slate-800 border-slate-200 text-xs font-medium dark:text-slate-200 text-slate-800"
                        >
                          <MathRenderer content={typeof opt === 'object' ? opt.text || opt.en || '' : String(opt)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Solution / Answer Reveal */}
                  <div className="pt-2 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleReveal(item.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{isRevealed ? 'Hide Answer' : 'View Correct Answer & Explanation'}</span>
                    </button>

                    {item.test_id && (
                      <Link
                        to={`/quiz/${item.test_id}`}
                        className="text-xs font-bold text-slate-500 hover:text-indigo-500 inline-flex items-center gap-1"
                      >
                        <span>Open Test</span>
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>

                  {isRevealed && (
                    <div className="p-3 rounded-2xl dark:bg-emerald-950/30 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 text-xs space-y-1.5 animate-fadeIn">
                      <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        Correct Answer: {item.correct_answer || item.answer || 'Authoritative key on test submission'}
                      </div>
                      {item.explanation && (
                        <div className="dark:text-slate-300 text-slate-700">
                          <MathRenderer content={item.explanation} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bookmarked Chapters / Content */}
            {dbBookmarks.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-3xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">
                      Study Chapter
                    </span>
                    <h3 className="text-sm font-extrabold dark:text-white text-slate-900">
                      {b.chapters?.title || 'Chapter Material'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {b.chapter_id && (
                    <Link
                      to={`/chapter/${b.chapter_id}`}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <span>Study</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDbBookmark(b.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

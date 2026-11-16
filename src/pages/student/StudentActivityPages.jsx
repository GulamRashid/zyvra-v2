import { useCallback, useEffect, useState } from 'react';
import { Bell, Bookmark, ExternalLink, RefreshCw, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const BOOKMARKS_KEY = 'zyvra_bookmarks';

function readBookmarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function StudentActivityPages({ type }) {
  const { user, supabase, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (type === 'bookmarks') {
        const localBookmarks = readBookmarks();
        if (supabase && user) {
          const { data, error: bookmarkError } = await supabase.from('student_bookmarks')
            .select('id,chapter_id,resource_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
          if (bookmarkError) throw bookmarkError;
          const rows = data || [];
          const chapterIds = [...new Set(rows.map((row) => row.chapter_id).filter(Boolean))];
          const resourceIds = [...new Set(rows.map((row) => row.resource_id).filter(Boolean))];
          const [chaptersResult, resourcesResult] = await Promise.all([
            chapterIds.length ? supabase.from('chapters').select('id,title').in('id', chapterIds) : Promise.resolve({ data: [], error: null }),
            resourceIds.length ? supabase.from('chapter_resources').select('id,title').in('id', resourceIds) : Promise.resolve({ data: [], error: null })
          ]);
          if (chaptersResult.error) throw chaptersResult.error;
          if (resourcesResult.error) throw resourcesResult.error;
          const chapters = new Map((chaptersResult.data || []).map((row) => [row.id, row.title]));
          const resources = new Map((resourcesResult.data || []).map((row) => [row.id, row.title]));
          setItems([
            ...rows.map((row) => ({
              ...row,
              kind: 'content',
              title: row.resource_id ? resources.get(row.resource_id) || 'Saved resource' : chapters.get(row.chapter_id) || 'Saved chapter',
              savedAt: row.created_at
            })),
            ...localBookmarks.map((item) => ({ ...item, kind: 'result' }))
          ]);
        } else {
          setItems(localBookmarks.map((item) => ({ ...item, kind: 'result' })));
        }
      } else if (!supabase || !user) {
        throw new Error('Sign in to view this page.');
      } else if (type === 'purchases') {
        const { data, error: queryError } = await supabase.from('payment_orders').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setItems(data || []);
      } else {
        const { data, error: queryError } = await supabase.from('platform_settings').select('key,setting_key,value,setting_value')
          .or('key.eq.platform_announcements,setting_key.eq.platform_announcements');
        if (queryError) throw queryError;
        const row = data?.[0];
        const value = row?.setting_value ?? row?.value;
        const audience = new Set((profile?.target_exams || []).map((exam) => String(exam).toLowerCase()));
        const notices = (Array.isArray(value) ? value : []).filter((notice) =>
          !notice.audience || notice.audience === 'all' || audience.has(String(notice.audience).toLowerCase())
        );
        setItems(notices);
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this page.');
    } finally {
      setLoading(false);
    }
  }, [type, supabase, user, profile?.target_exams]);

  useEffect(() => { load(); }, [load]);

  const removeBookmark = async (item) => {
    try {
      if (item.kind === 'content') {
        const { error: deleteError } = await supabase.from('student_bookmarks').delete().eq('id', item.id).eq('user_id', user.id);
        if (deleteError) throw deleteError;
      } else {
        const next = readBookmarks().filter((saved) => saved.id !== item.id && saved.attemptId !== item.id);
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      }
      setItems((current) => current.filter((saved) => saved.id !== item.id));
    } catch {
      setError('This bookmark could not be removed from this device.');
    }
  };

  const config = {
    bookmarks: { title: 'Bookmarks', subtitle: 'Your saved test results for quick review.', icon: Bookmark },
    purchases: { title: 'My purchases', subtitle: 'Payment history and learning access.', icon: ShoppingBag },
    notifications: { title: 'Notifications', subtitle: 'Updates and announcements from Zyvra.', icon: Bell }
  }[type];
  const Icon = config.icon;

  return (
    <div className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">YOUR LEARNING SPACE</div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text)]">{config.title}</h1>
          <p className="text-sm text-[var(--muted)]">{config.subtitle}</p>
        </div>
        <button type="button" className="icon-button" onClick={load} disabled={loading} aria-label="Refresh">
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </header>
      {error && <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</div>}
      {loading ? <LoadingSkeleton rows={4} /> : items.length === 0 ? (
        <section className="panel-card p-6 rounded-3xl text-center space-y-2">
          <Icon size={28} className="mx-auto text-indigo-400" />
          <h2 className="font-bold text-[var(--text)]">{type === 'notifications' ? 'You are all caught up' : 'Nothing here yet'}</h2>
          <p className="text-sm text-[var(--muted)]">{type === 'bookmarks' ? 'Save a result from its review page to find it here.' : type === 'purchases' ? 'Your successful purchases will appear here.' : 'New announcements will appear here.'}</p>
          {type === 'bookmarks' && <Link className="button button-primary inline-flex mt-2" to="/tests">Explore tests</Link>}
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const id = item.id || item.attemptId || `${type}-${index}`;
            if (type === 'bookmarks') return (
              <article key={id} className="panel-card p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3">
                <div className="min-w-0"><h2 className="font-bold text-[var(--text)] truncate">{item.title || 'Saved test result'}</h2><p className="text-xs text-[var(--muted)]">Saved {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : ''}</p></div>
                <div className="flex items-center gap-2 shrink-0"><Link className="button button-outline min-h-10" to={item.kind === 'content' ? `/chapter/${item.chapter_id}` : `/quiz/result/${item.attemptId || item.id}`} aria-label={item.kind === 'content' ? 'Open saved chapter' : 'Open saved result'}><ExternalLink size={16} /></Link><button className="icon-button" onClick={() => removeBookmark(item)} aria-label="Remove bookmark"><Trash2 size={16} /></button></div>
              </article>
            );
            if (type === 'purchases') {
              const status = String(item.status || 'pending').toLowerCase();
              return <article key={id} className="panel-card p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-[var(--text)]">{item.item_title || `${item.item_type || item.order_type || 'Learning'} access`}</h2><p className="text-xs text-[var(--muted)]">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''} · {item.currency || 'INR'} {Number(item.amount ?? item.final_amount ?? 0).toFixed(2)}</p></div><span className={`status-badge ${['paid', 'captured', 'completed', 'fulfilled'].includes(status) ? 'completed' : 'in-progress'}`}>{status}</span></article>;
            }
            return <article key={id} className="panel-card p-4 sm:p-5 rounded-2xl"><div className="flex items-center gap-2 mb-1"><span className={`w-2 h-2 rounded-full ${item.priority === 'high' ? 'bg-rose-500' : 'bg-indigo-500'}`} /><h2 className="font-bold text-[var(--text)]">{item.title || 'Announcement'}</h2></div><p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{item.content || item.message}</p><p className="text-xs text-[var(--muted)] mt-3">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}{item.author ? ` · ${item.author}` : ''}</p></article>;
          })}
        </div>
      )}
    </div>
  );
}

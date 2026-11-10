import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, CheckCircle2, Clock3, FileText, Pause, Play, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import useContentCatalog from '../../hooks/useContentCatalog';
import PdfReaderModal from '../../components/common/PdfReaderModal';
import { getChapterAccess } from '../../lib/content';

const STUDY_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function playChime() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + index * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.18 + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + index * 0.18);
    oscillator.stop(context.currentTime + index * 0.18 + 0.24);
  });
  window.setTimeout(() => context.close(), 800);
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function currentDayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCompletedSessions(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(`zyvra-focus-sessions-${userId || 'guest'}`) || 'null');
    return stored?.date === currentDayKey() ? Math.max(0, Number(stored.count) || 0) : 0;
  } catch (error) {
    console.error('Unable to read completed focus sessions:', error);
    return 0;
  }
}

export default function StudentToolbox() {
  const { user } = useAuth();
  const { t, language } = useThemeLanguage();
  const { chapters, folders } = useContentCatalog();
  const navigate = useNavigate();
  const [mode, setMode] = useState('study');
  const [remaining, setRemaining] = useState(STUDY_SECONDS);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(() => getCompletedSessions(user?.id));
  const [resources, setResources] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [reader, setReader] = useState(null);
  const [readerError, setReaderError] = useState('');
  const completionHandled = useRef(false);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || remaining !== 0 || completionHandled.current) return;
    completionHandled.current = true;
    setRunning(false);
    playChime();
    if (mode === 'study') {
      setSessions((value) => {
        const next = value + 1;
        try {
          localStorage.setItem(`zyvra-focus-sessions-${user?.id || 'guest'}`, JSON.stringify({ date: currentDayKey(), count: next }));
          const dailyKey = `zyvra-daily-study-${user?.id || 'guest'}`;
          const saved = JSON.parse(localStorage.getItem(dailyKey) || 'null');
          const minutes = saved?.date === currentDayKey() ? Math.max(0, Number(saved.minutes) || 0) : 0;
          localStorage.setItem(dailyKey, JSON.stringify({ date: currentDayKey(), minutes: minutes + 25 }));
        } catch (storageError) {
          console.error('Unable to save focus session progress:', storageError);
        }
        return next;
      });
    }
    const nextMode = mode === 'study' ? 'break' : 'study';
    setMode(nextMode);
    setRemaining(nextMode === 'study' ? STUDY_SECONDS : BREAK_SECONDS);
  }, [mode, remaining, running, user?.id]);

  useEffect(() => {
    setSessions(getCompletedSessions(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      if (!supabase) {
        setError('Connect to Zyvra to load your bookmarks and revision sheets.');
        setLoading(false);
        return;
      }
      const [resourceResult, bookmarkResult] = await Promise.all([
        supabase.from('chapter_resources').select('id,chapter_id,title,resource_type,file_size,page_count,is_downloadable,is_free_preview,status'),
        user ? supabase.from('student_bookmarks').select('*').eq('user_id', user.id) : Promise.resolve({ data: [], error: null })
      ]);
      if (resourceResult.error) throw resourceResult.error;
      if (bookmarkResult.error) throw bookmarkResult.error;
      if (!active) return;
      const availableResources = (resourceResult.data || []).filter((item) => !['archived', 'draft', 'unpublished'].includes(String(item.status || '').toLowerCase()));
      setResources(availableResources);
      setBookmarks(bookmarkResult.data || []);
      setLoading(false);
    };
    load().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load your study toolbox.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [user]);

  const bookmarkIds = useMemo(() => new Set(bookmarks.map((item) => item.resource_id).filter(Boolean)), [bookmarks]);
  const sheets = useMemo(() => resources.filter((resource) => {
    const isSheet = /formula|revision|sheet|notes/i.test(`${resource.title || ''} ${resource.resource_type || ''}`);
    return isSheet && (filter === 'all' || bookmarkIds.has(resource.id));
  }), [resources, filter, bookmarkIds]);
  const savedBookmarks = useMemo(() => bookmarks.map((bookmark) => {
    const resource = resources.find((item) => item.id === bookmark.resource_id);
    const chapter = chapters.find((item) => item.id === bookmark.chapter_id);
    return { ...bookmark, resource, chapter };
  }), [bookmarks, resources, chapters]);

  const canReadResource = (resource) => {
    if (resource.is_free_preview) return true;
    if (!resource.is_downloadable) return false;
    const resourceChapter = chapters.find((item) => item.id === resource.chapter_id);
    if (!resourceChapter) return false;
    const parentFolder = folders.find((item) => item.id === resourceChapter?.folder_id);
    return getChapterAccess(resourceChapter, parentFolder, folders).amount === 0;
  };

  const openResource = async (resource) => {
    setReaderError('');
    try {
      const { data: file, error: fileError } = await supabase.from('chapter_resources')
        .select('file_url')
        .eq('id', resource.id)
        .single();
      if (fileError) throw fileError;
      const fileUrl = file.file_url;
      if (!fileUrl) throw new Error('This resource does not have a document URL yet.');
      let url = fileUrl;
      if (!/^https?:\/\//i.test(fileUrl)) {
        const { data, error: urlError } = await supabase.storage
          .from('chapter-resources')
          .createSignedUrl(fileUrl, 300);
        if (urlError) throw urlError;
        url = data.signedUrl;
      }
      setReader({ resource, url });
    } catch (openError) {
      setReaderError(openError.message || 'Unable to open this document.');
    }
  };

  const resetTimer = () => {
    setRunning(false);
    completionHandled.current = false;
    setRemaining(mode === 'study' ? STUDY_SECONDS : BREAK_SECONDS);
  };
  const changeMode = (nextMode) => {
    setRunning(false);
    completionHandled.current = false;
    setMode(nextMode);
    setRemaining(nextMode === 'study' ? STUDY_SECONDS : BREAK_SECONDS);
  };

  return <div className="toolbox-page">
    <div className="page-heading"><div><div className="eyebrow">{language === 'hi' ? 'आपका अध्ययन स्थान / टूलबॉक्स' : 'YOUR LEARNING SPACE / TOOLBOX'}</div><h1>{t('toolboxTitle')}</h1><p>{t('toolboxDescription')}</p></div></div>
    <section className={`pomodoro-card ${mode === 'break' ? 'break-mode' : ''}`}>
      <div className="pomodoro-copy"><span className="toolbox-icon"><Clock3 size={21} /></span><div><div className="eyebrow">{mode === 'study' ? t('focusSession').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US') : t('restInterval').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{mode === 'study' ? t('oneThing') : t('mindfulBreak')}</h2><p>{mode === 'study' ? t('focusSprint') : t('breakDescription')}</p></div></div>
      <div className="pomodoro-clock" aria-live="polite">{formatTime(remaining)}</div>
      <div className="pomodoro-actions"><button className="button button-gold" onClick={() => { completionHandled.current = false; setRunning((value) => !value); }}>{running ? <><Pause size={15} /> {t('pause')}</> : <><Play size={15} /> {t('startFocus')}</>}</button><button className="button button-outline" onClick={resetTimer}><RotateCcw size={15} /> {t('reset')}</button><button className={`pomodoro-mode ${mode === 'study' ? 'active' : ''}`} onClick={() => changeMode('study')}>{t('study25')}</button><button className={`pomodoro-mode ${mode === 'break' ? 'active' : ''}`} onClick={() => changeMode('break')}>{t('break5')}</button></div>
      <div className="pomodoro-completed"><CheckCircle2 size={15} /> {sessions} {t('focusSessions')}</div>
    </section>

    <section className="toolbox-section">
      <div className="section-heading"><div><div className="eyebrow">{t('quickRevision').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{t('formulaSheets')}</h2></div><div className="toolbox-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('highYield')}</button><button className={filter === 'saved' ? 'active' : ''} onClick={() => setFilter('saved')}>{t('bookmarked')}</button></div></div>
      {loading ? <p className="field-hint">{t('loadingSheets')}</p> : error ? <div className="feedback error-feedback">{error}</div> : !sheets.length ? <div className="empty-content"><Sparkles size={22} /><strong>{t('noRevisionSheets')}</strong><span>{t('revisionEmpty')}</span></div> : <div className="toolbox-resource-grid">{sheets.map((resource) => <article className="toolbox-resource-card" key={resource.id}><span className="toolbox-resource-icon"><FileText size={18} /></span><div><strong>{resource.title}</strong><small>{resource.resource_type || resource.type || (language === 'hi' ? 'अध्ययन शीट' : 'Study sheet')}{resource.file_size ? ` · ${resource.file_size}` : ''}</small></div><button className="icon-button" aria-label={`${language === 'hi' ? 'खोलें' : 'Open'} ${resource.title}`} onClick={() => canReadResource(resource) ? openResource(resource) : navigate(`/chapter/${resource.chapter_id}`)}><BookOpen size={16} /></button></article>)}</div>}
      {readerError && <div className="feedback error-feedback">{readerError}</div>}
    </section>

    <section className="toolbox-section">
      <div className="section-heading"><div><div className="eyebrow">{t('savedForLater').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{t('savedBookmarks')}</h2></div><span className="chapter-item-count">{bookmarks.length} {t('saved')}</span></div>
      {loading ? <p className="field-hint">{t('loadingBookmarks')}</p> : !savedBookmarks.length ? <div className="empty-content"><Bookmark size={22} /><strong>{t('bookmarksEmpty')}</strong><span>{t('bookmarkHint')}</span></div> : <div className="toolbox-bookmark-list">{savedBookmarks.map((bookmark) => {
        const title = bookmark.resource?.title || bookmark.chapter?.title || bookmark.title || (bookmark.question_id ? t('question') : bookmark.chapter_id ? t('chapter') : t('saved'));
        const destination = bookmark.resource?.chapter_id || bookmark.chapter_id ? `/chapter/${bookmark.resource?.chapter_id || bookmark.chapter_id}` : '/tests';
        return <button className="toolbox-bookmark-row" key={bookmark.id || `${bookmark.user_id}-${bookmark.item_id || bookmark.resource_id || bookmark.chapter_id || bookmark.question_id}`} onClick={() => navigate(destination)}><Bookmark size={16} /><span><strong>{title}</strong><small>{bookmark.question_id ? t('question') : bookmark.resource_id ? t('studyResource') : t('chapter')}</small></span><BookOpen size={15} /></button>;
      })}</div>}
    </section>
    <p className="toolbox-footnote"><Wrench size={14} /> {t('timerLocalNote')}</p>
    {reader && <PdfReaderModal resource={reader.resource} url={reader.url} onClose={() => setReader(null)} />}
  </div>;
}

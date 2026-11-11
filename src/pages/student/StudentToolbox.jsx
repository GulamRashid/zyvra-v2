import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bookmark, BookOpen, Brain, CheckCircle2, Clock3, FileText, LockKeyhole, Pause, Play, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { normalizeAccessResult } from '../../lib/commerce';
import useContentCatalog from '../../hooks/useContentCatalog';
import PdfReaderModal from '../../components/common/PdfReaderModal';
import CheckoutModal from '../../components/common/CheckoutModal';
import InteractiveMathTool from '../../components/toolbox/InteractiveMathTool';
import MathRenderer from '../../components/common/MathRenderer';
import ToolAccessGuard from '../../components/common/ToolAccessGuard';
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
  const [visibleTools, setVisibleTools] = useState({
    pomodoro: true,
    'math-shortcuts': true,
    'polity-articles': true,
    'formula-sheet': true
  });
  const [toolPricing, setToolPricing] = useState({});
  const [comboPricing, setComboPricing] = useState({ price: 0, validity_days: 30 });
  const [toolAccess, setToolAccess] = useState({});
  const [toolboxLoaded, setToolboxLoaded] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [checkout, setCheckout] = useState(null);
  const completionHandled = useRef(false);

  const refreshToolAccess = async (pricing = toolPricing, comboEnabled = comboPricing.price > 0) => {
    setAccessError('');
    if (!user?.id || !supabase) {
      setToolAccess({});
      setToolboxLoaded(true);
      return;
    }
    const premiumToolIds = Object.entries(pricing)
      .filter(([, value]) => value?.access_type === 'premium')
      .map(([id]) => id);
    if (!premiumToolIds.length) {
      setToolAccess({});
      setToolboxLoaded(true);
      return;
    }
    const requests = [
      ...premiumToolIds.map((id) => [id, supabase.rpc('check_user_access', {
          p_user_id: user.id,
          p_item_type: 'tool',
          p_item_id: id
        })]),
      ...(comboEnabled ? [['__combo', supabase.rpc('check_user_access', {
        p_user_id: user.id,
        p_item_type: 'toolbox_combo',
        p_item_id: 'all-tools'
      })]] : [])
    ];
    const results = await Promise.all(requests.map(async ([id, request]) => {
      try {
        const { data, error: accessError } = await request;
        if (accessError) throw accessError;
        return { id, allowed: normalizeAccessResult(data) };
      } catch (accessError) {
        return { id, allowed: false, error: accessError };
      }
    }));
    setToolAccess(Object.fromEntries(results.map(({ id, allowed }) => [id, allowed])));
    setToolboxLoaded(true);
    const failed = results.find((result) => result.error);
    if (failed) setAccessError(failed.error.message || 'Access check failed. Premium tools remain locked.');
  };

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
      setToolboxLoaded(false);
      setToolAccess({});
        setAccessError('');
      if (!supabase) {
        setError('Connect to Zyvra to load your bookmarks and revision sheets.');
          setAccessError('Pricing and purchase status could not be verified.');
          setLoading(false);
          return;
      }
      const [resourceResult, bookmarkResult, settingsResult] = await Promise.all([
        supabase.from('chapter_resources').select('id,chapter_id,title,resource_type,file_size,page_count,is_downloadable,is_free_preview,status'),
        user ? supabase.from('student_bookmarks').select('*').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
        supabase.from('platform_settings').select('*')
      ]);
      if (resourceResult.error) throw resourceResult.error;
      if (bookmarkResult.error) throw bookmarkResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (!active) return;
      const availableResources = (resourceResult.data || []).filter((item) => !['archived', 'draft', 'unpublished'].includes(String(item.status || '').toLowerCase()));
      const toolboxSetting = (settingsResult.data || []).find((item) => item?.setting_key === 'study_toolbox_config' || item?.key === 'study_toolbox_config');
      const rawTools = toolboxSetting?.setting_value ?? toolboxSetting?.value;
      const configuredTools = typeof rawTools === 'string' ? JSON.parse(rawTools) : rawTools;
      if (Array.isArray(configuredTools)) {
        setVisibleTools((current) => configuredTools.reduce((visibility, tool) => {
          if (tool?.id && Object.prototype.hasOwnProperty.call(visibility, tool.id)) {
            visibility[tool.id] = tool.enabled !== false;
          }
          return visibility;
        }, { ...current }));
      }
      const pricingSetting = (settingsResult.data || []).find((item) => item?.setting_key === 'toolbox_pricing' || item?.key === 'toolbox_pricing');
      const rawPricing = pricingSetting?.setting_value ?? pricingSetting?.value;
      const parsedPricing = typeof rawPricing === 'string' ? JSON.parse(rawPricing) : rawPricing;
      const savedToolPricing = parsedPricing?.tools && typeof parsedPricing.tools === 'object' ? parsedPricing.tools : {};
      const legacyToolPricing = Array.isArray(configuredTools)
        ? Object.fromEntries(configuredTools.filter((tool) => tool?.id).map((tool) => [tool.id, tool]))
        : {};
      const pricingTools = { ...legacyToolPricing, ...savedToolPricing };
      const safePricing = Object.fromEntries(Object.entries(pricingTools).map(([id, value]) => [id, {
        access_type: value?.access_type === 'premium' ? 'premium' : 'free',
        price: Math.max(0, Number(value?.price) || 0),
        validity_days: Math.max(1, Number(value?.validity_days) || 30)
      }]));
      const safeCombo = {
        price: Math.max(0, Number(parsedPricing?.combo?.price) || 0),
        validity_days: Math.max(1, Number(parsedPricing?.combo?.validity_days) || 30)
      };
      setToolPricing(safePricing);
      setComboPricing(safeCombo);
      await refreshToolAccess(safePricing, safeCombo.price > 0);
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

  useEffect(() => {
    const hasPremiumTools = Object.values(toolPricing).some((config) => config?.access_type === 'premium');
    if (!user?.id || !toolboxLoaded || !hasPremiumTools) return undefined;
    const interval = window.setInterval(() => {
      refreshToolAccess(toolPricing, comboPricing.price > 0).catch((accessLoadError) => {
        setAccessError(accessLoadError.message || 'Unable to refresh premium tool access.');
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user?.id, toolboxLoaded, toolPricing, comboPricing.price]);

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
  const toolLocked = (id) => !toolboxLoaded
    || (toolPricing[id]?.access_type === 'premium' && !toolAccess[id] && !toolAccess.__combo);
  const toolGuardProps = (id) => ({
    locked: toolLocked(id),
    price: toolPricing[id]?.price,
    validityDays: toolPricing[id]?.validity_days,
    comboPrice: comboPricing.price,
    comboValidityDays: comboPricing.validity_days,
    onBuyTool: () => openToolCheckout(id),
    onBuyCombo: openComboCheckout
  });
  const openToolCheckout = (id) => {
    const config = toolPricing[id];
    if (config?.price > 0) {
      setCheckout({
        itemType: 'tool',
        itemId: id,
        itemTitle: `Study Toolbox: ${({
          pomodoro: 'Pomodoro Study Timer',
          'math-shortcuts': 'Speed Math & Mental Calculation',
          'polity-articles': 'Constitution & Articles Navigator',
          'formula-sheet': 'Reasoning & Logic Formula Hub'
        })[id] || 'Premium tool'}`,
        tier: `${config.validity_days} days access`,
        basePrice: config.price
      });
    }
  };
  const openComboCheckout = () => {
    if (comboPricing.price > 0) {
      setCheckout({
        itemType: 'toolbox_combo',
        itemId: 'all-tools',
        itemTitle: 'Study Toolbox: Unlock All Tools',
        tier: `${comboPricing.validity_days} days access`,
        basePrice: comboPricing.price
      });
    }
  };

  return <div className="toolbox-page">
    <div className="page-heading"><div><div className="eyebrow">{language === 'hi' ? 'आपका अध्ययन स्थान / टूलबॉक्स' : 'YOUR LEARNING SPACE / TOOLBOX'}</div><h1>{t('toolboxTitle')}</h1><p>{t('toolboxDescription')}</p></div></div>
    {accessError && <div className="feedback error-feedback"><LockKeyhole size={15} /> Access verification failed; premium tools stay locked. {accessError}</div>}
    {visibleTools.pomodoro && <ToolAccessGuard {...toolGuardProps('pomodoro')}><section className={`pomodoro-card ${mode === 'break' ? 'break-mode' : ''}`}>
      <div className="pomodoro-copy"><span className="toolbox-icon"><Clock3 size={21} /></span><div><div className="eyebrow">{mode === 'study' ? t('focusSession').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US') : t('restInterval').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{mode === 'study' ? t('oneThing') : t('mindfulBreak')}</h2><p>{mode === 'study' ? t('focusSprint') : t('breakDescription')}</p></div></div>
      <div className="pomodoro-clock" aria-live="polite">{formatTime(remaining)}</div>
      <div className="pomodoro-actions"><button className="button button-gold" onClick={() => { completionHandled.current = false; setRunning((value) => !value); }}>{running ? <><Pause size={15} /> {t('pause')}</> : <><Play size={15} /> {t('startFocus')}</>}</button><button className="button button-outline" onClick={resetTimer}><RotateCcw size={15} /> {t('reset')}</button><button className={`pomodoro-mode ${mode === 'study' ? 'active' : ''}`} onClick={() => changeMode('study')}>{t('study25')}</button><button className={`pomodoro-mode ${mode === 'break' ? 'active' : ''}`} onClick={() => changeMode('break')}>{t('break5')}</button></div>
      <div className="pomodoro-completed"><CheckCircle2 size={15} /> {sessions} {t('focusSessions')}</div>
    </section></ToolAccessGuard>}

    {visibleTools['math-shortcuts'] && <ToolAccessGuard {...toolGuardProps('math-shortcuts')}><InteractiveMathTool /></ToolAccessGuard>}

    {visibleTools['formula-sheet'] && <ToolAccessGuard {...toolGuardProps('formula-sheet')}><section className="toolbox-section">
      <div className="section-heading"><div><div className="eyebrow">FORMULA & REVISION HUB</div><h2><Brain size={17} /> Quick reference</h2></div></div>
      <div className="toolbox-formula-grid">
        <article className="toolbox-formula-card"><strong>Percentage</strong><MathRenderer formula="\frac{part}{whole} \times 100" /><small>Use for ratios, marks and change calculations.</small></article>
        <article className="toolbox-formula-card"><strong>Simple Interest</strong><MathRenderer formula="SI = \frac{Principal \times Rate \times Time}{100}" /><small>Keep rate and time in matching units.</small></article>
        <article className="toolbox-formula-card"><strong>Average</strong><MathRenderer formula="Average = \frac{Sum\ of\ values}{Number\ of\ values}" /><small>For a combined average, add totals before dividing.</small></article>
      </div>
    </section></ToolAccessGuard>}

    {visibleTools['polity-articles'] && <ToolAccessGuard {...toolGuardProps('polity-articles')}><section className="toolbox-deep-link-card">
      <span className="toolbox-icon"><BookOpen size={19} /></span>
      <div><strong>Constitution & Articles</strong><p>Open your syllabus to browse polity chapters and revision resources.</p></div>
      <button type="button" className="button button-outline" onClick={() => navigate('/explore')}>Explore syllabus <ArrowRight size={15} /></button>
    </section></ToolAccessGuard>}

    {visibleTools['formula-sheet'] && <ToolAccessGuard {...toolGuardProps('formula-sheet')}><section className="toolbox-section">
      <div className="section-heading"><div><div className="eyebrow">{t('quickRevision').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{t('formulaSheets')}</h2></div><div className="toolbox-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('highYield')}</button><button className={filter === 'saved' ? 'active' : ''} onClick={() => setFilter('saved')}>{t('bookmarked')}</button></div></div>
      {loading ? <p className="field-hint">{t('loadingSheets')}</p> : error ? <div className="feedback error-feedback">{error}</div> : !sheets.length ? <div className="empty-content"><Sparkles size={22} /><strong>{t('noRevisionSheets')}</strong><span>{t('revisionEmpty')}</span></div> : <div className="toolbox-resource-grid">{sheets.map((resource) => <article className="toolbox-resource-card" key={resource.id}><span className="toolbox-resource-icon"><FileText size={18} /></span><div><strong>{resource.title}</strong><small>{resource.resource_type || resource.type || (language === 'hi' ? 'अध्ययन शीट' : 'Study sheet')}{resource.file_size ? ` · ${resource.file_size}` : ''}</small></div><button className="icon-button" aria-label={`${language === 'hi' ? 'खोलें' : 'Open'} ${resource.title}`} onClick={() => canReadResource(resource) ? openResource(resource) : navigate(`/chapter/${resource.chapter_id}`)}><BookOpen size={16} /></button></article>)}</div>}
      {readerError && <div className="feedback error-feedback">{readerError}</div>}
    </section></ToolAccessGuard>}

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
    {checkout && <CheckoutModal {...checkout} onClose={() => setCheckout(null)} onCompleted={() => refreshToolAccess().catch((accessError) => setError(accessError.message || 'Unable to verify your Toolbox purchase.'))} />}
  </div>;
}

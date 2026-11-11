import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookOpen, Brain, Calculator, Clock3, LockKeyhole, Percent, Shapes, Superscript, Wrench, ChevronRight, StickyNote, ListChecks, Compass, Dices, Scale, Sigma, Binary, TrendingUp, Landmark } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { normalizeAccessResult } from '../../lib/commerce';
import CheckoutModal from '../../components/common/CheckoutModal';
import SmartCalculator from '../../components/toolbox/math/SmartCalculator';
import FractionConverter from '../../components/toolbox/math/FractionConverter';
import SquaresCubes from '../../components/toolbox/math/SquaresCubes';
import MathFormulaHub from '../../components/toolbox/math/MathFormulaHub';
import UnitConverter from '../../components/toolbox/math/UnitConverter';
import ProfitLossCalculator from '../../components/toolbox/math/ProfitLossCalculator';
import InterestCalculator from '../../components/toolbox/math/InterestCalculator';
import AlphabetPositions from '../../components/toolbox/reasoning/AlphabetPositions';
import BloodRelations from '../../components/toolbox/reasoning/BloodRelations';
import DirectionCompass from '../../components/toolbox/reasoning/DirectionCompass';
import DiceRules from '../../components/toolbox/reasoning/DiceRules';
import ConstitutionArticles from '../../components/toolbox/gs/ConstitutionArticles';
import StickyNotes from '../../components/toolbox/productivity/StickyNotes';
import PomodoroTimer from '../../components/toolbox/productivity/PomodoroTimer';
import DailyTargets from '../../components/toolbox/productivity/DailyTargets';
import ToolUnlockModal from '../../components/toolbox/ToolUnlockModal';

const CATEGORY_CONFIG = [
  { id: 'math', titleKey: 'tbCategoryMath', subtitleKey: 'tbCategoryMathDesc', Icon: Calculator, color: 'gold' },
  { id: 'reasoning', titleKey: 'tbCategoryReasoning', subtitleKey: 'tbCategoryReasoningDesc', Icon: Brain, color: 'violet' },
  { id: 'productivity', titleKey: 'tbCategoryProductivity', subtitleKey: 'tbCategoryProductivityDesc', Icon: Clock3, color: 'green' },
  { id: 'general-studies', titleKey: 'tbCategoryGs', subtitleKey: 'tbCategoryGsDesc', Icon: BookOpen, color: 'blue' }
];

const CATEGORY_TOOLS = {
  math: [
    { id: 'calculator', titleKey: 'tbCalculator', subtitleKey: 'tbCalculatorDesc', Icon: Calculator, accessKey: 'math-shortcuts' },
    { id: 'fraction-converter', titleKey: 'tbFraction', subtitleKey: 'tbFractionDesc', Icon: Percent, accessKey: 'math-shortcuts' },
    { id: 'powers-roots', titleKey: 'tbSquares', subtitleKey: 'tbSquaresDesc', Icon: Superscript, accessKey: 'math-shortcuts' },
    { id: 'geometry-formulas', titleKey: 'tbMathFormulas', subtitleKey: 'tbMathFormulasDesc', Icon: Shapes, accessKey: 'math-shortcuts' },
    { id: 'unit-converter', titleKey: 'tbUnitConverter', subtitleKey: 'tbUnitConverterDesc', Icon: Scale, accessKey: 'math-shortcuts' },
    { id: 'profit-loss', titleKey: 'tbProfitLoss', subtitleKey: 'tbProfitLossDesc', Icon: TrendingUp, accessKey: 'math-shortcuts' },
    { id: 'interest-calculator', titleKey: 'tbInterest', subtitleKey: 'tbInterestDesc', Icon: Percent, accessKey: 'math-shortcuts' }
  ],
  reasoning: [
    { id: 'alphabet-positions', titleKey: 'tbAlphabet', subtitleKey: 'tbAlphabetDesc', Icon: Binary, accessKey: 'formula-sheet' },
    { id: 'blood-relations', titleKey: 'tbBlood', subtitleKey: 'tbBloodDesc', Icon: Brain, accessKey: 'formula-sheet' },
    { id: 'direction-compass', titleKey: 'tbDirectionTool', subtitleKey: 'tbDirectionDesc', Icon: Compass, accessKey: 'formula-sheet' },
    { id: 'dice-rules', titleKey: 'tbDice', subtitleKey: 'tbDiceDesc', Icon: Dices, accessKey: 'formula-sheet' },
    { id: 'reasoning-formulas', titleKey: 'tbReasoningFormulas', subtitleKey: 'tbReasoningFormulasDesc', Icon: Sigma, accessKey: 'formula-sheet' }
  ],
  productivity: [
    { id: 'pomodoro', titleKey: 'tbPomodoro', subtitleKey: 'tbPomodoroDesc', Icon: Clock3, accessKey: 'pomodoro' },
    { id: 'sticky-notes', titleKey: 'tbStickyNotes', subtitleKey: 'tbStickyNotesDesc', Icon: StickyNote, accessKey: 'pomodoro' },
    { id: 'daily-targets', titleKey: 'tbDailyTargets', subtitleKey: 'tbDailyTargetsDesc', Icon: ListChecks, accessKey: 'pomodoro' }
  ],
  'general-studies': [
    { id: 'constitution-articles', titleKey: 'tbConstitution', subtitleKey: 'tbConstitutionDesc', Icon: Landmark, accessKey: 'polity-articles' },
    { id: 'saved-bookmarks', titleKey: 'tbBookmarks', subtitleKey: 'tbBookmarksDesc', Icon: Bookmark, accessKey: null }
  ]
};

const POMODORO_STORAGE_KEY = 'zyvra-toolbox-pomodoro';

function readPomodoro() {
  const fallback = { mode: 'focus', remaining: 25 * 60, running: false, completed: 0, focusMinutes: 25, breakMinutes: 5 };
  try {
    const stored = JSON.parse(window.localStorage.getItem(POMODORO_STORAGE_KEY) || 'null');
    if (!stored || !['focus', 'break'].includes(stored.mode)) return fallback;
    const state = {
      mode: stored.mode,
      remaining: Math.max(0, Math.floor(Number(stored.remaining) || 0)),
      running: stored.running === true,
      completed: Math.max(0, Math.floor(Number(stored.completed) || 0)),
      focusMinutes: Math.min(180, Math.max(1, Math.floor(Number(stored.focusMinutes) || 25))),
      breakMinutes: Math.min(60, Math.max(1, Math.floor(Number(stored.breakMinutes) || 5)))
    };
    if (!state.running) return state;
    let elapsed = Math.max(0, Math.floor((Date.now() - Number(stored.updatedAt || Date.now())) / 1000));
    state.remaining = Math.max(1, state.remaining);
    while (elapsed >= state.remaining) {
      elapsed -= state.remaining;
      if (state.mode === 'focus') state.completed += 1;
      state.mode = state.mode === 'focus' ? 'break' : 'focus';
      state.remaining = (state.mode === 'focus' ? state.focusMinutes : state.breakMinutes) * 60;
    }
    state.remaining = Math.max(0, state.remaining - elapsed);
    return state;
  } catch (error) {
    console.error('Unable to restore the Toolbox timer:', error);
    return fallback;
  }
}

export default function StudentToolbox() {
  const { user } = useAuth();
  const { t, language } = useThemeLanguage();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [settingsUnavailable, setSettingsUnavailable] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [currentView, setCurrentView] = useState('main-menu');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [unlockTool, setUnlockTool] = useState(null);
  const [pomodoro, setPomodoro] = useState(readPomodoro);
  const [timerPersistenceError, setTimerPersistenceError] = useState('');
  useEffect(() => {
    if (!pomodoro.running) return undefined;
    const timer = window.setInterval(() => setPomodoro((current) => {
      if (current.remaining > 1) return { ...current, remaining: current.remaining - 1 };
      const nextMode = current.mode === 'focus' ? 'break' : 'focus';
      return {
        ...current,
        mode: nextMode,
        remaining: (nextMode === 'focus' ? current.focusMinutes : current.breakMinutes) * 60,
        completed: current.completed + (current.mode === 'focus' ? 1 : 0)
      };
    }), 1000);
    return () => window.clearInterval(timer);
  }, [pomodoro.running]);
  useEffect(() => {
    try {
      window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({ ...pomodoro, updatedAt: Date.now() }));
      setTimerPersistenceError('');
    } catch (storageError) {
      console.error('Unable to save the Toolbox timer:', storageError);
      setTimerPersistenceError('tbTimerSaveError');
    }
  }, [pomodoro, t]);
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
    if (failed) setAccessError(failed.error.message || t('tbAccessError'));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      setToolboxLoaded(false);
      setToolAccess({});
      setAccessError('');
      setSettingsUnavailable(false);
      if (!supabase) {
          setError(t('tbNoSupabase'));
          setAccessError(t('tbPricingUnavailable'));
          setSettingsUnavailable(true);
          setToolboxLoaded(true);
          setLoading(false);
          return;
      }
      const [bookmarkResult, settingsResult] = await Promise.all([
          user ? supabase.from('student_bookmarks').select('*').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
          supabase.from('platform_settings').select('*')
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (!active) return;
      if (bookmarkResult.error) {
          setError(`${t('tbBookmarksLoadError')}: ${bookmarkResult.error.message}`);
      } else {
          setBookmarks(bookmarkResult.data || []);
      }
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
      setSettingsUnavailable(false);
      await refreshToolAccess(safePricing, safeCombo.price > 0);
      setLoading(false);
    };
    load().catch((loadError) => {
      if (active) {
        setError(loadError.message || t('tbLoadError'));
        setAccessError(loadError.message || t('tbPricingUnavailable'));
        setSettingsUnavailable(true);
        setToolboxLoaded(true);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [user, t]);

  useEffect(() => {
    const hasPremiumTools = Object.values(toolPricing).some((config) => config?.access_type === 'premium');
    if (!user?.id || !toolboxLoaded || !hasPremiumTools) return undefined;
    const interval = window.setInterval(() => {
      refreshToolAccess(toolPricing, comboPricing.price > 0).catch((accessLoadError) => {
        setAccessError(accessLoadError.message || t('tbAccessError'));
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user?.id, toolboxLoaded, toolPricing, comboPricing.price, t]);

  const savedBookmarks = bookmarks;

  const getToolConfig = (tool) => toolPricing[tool.id] || (tool.accessKey ? toolPricing[tool.accessKey] : null) || {};
  const isToolLocked = (tool) => {
    if (!tool.accessKey) return false;
    if (settingsUnavailable) return true;
    if (!toolboxLoaded) return false;
    const specificConfig = toolPricing[tool.id];
    const accessKey = specificConfig ? tool.id : tool.accessKey;
    return getToolConfig(tool).access_type === 'premium' && !toolAccess[accessKey] && !toolAccess.__combo;
  };
  const isToolVisible = (tool) => !tool.accessKey || visibleTools[tool.accessKey] !== false;
  const openCategory = (categoryId) => {
    setActiveCategory(categoryId);
    setCurrentView('category-menu');
  };
  const openTool = (tool) => {
    if (!toolboxLoaded && tool.accessKey) {
      setActiveTool(tool.id);
      setCurrentView('active-tool');
      return;
    }
    if (isToolLocked(tool)) {
      setUnlockTool(tool);
      return;
    }
    setActiveTool(tool.id);
    setCurrentView('active-tool');
  };
  const goBack = () => {
    if (currentView === 'active-tool') {
      setActiveTool(null);
      setCurrentView('category-menu');
    } else if (currentView === 'category-menu') {
      setActiveCategory(null);
      setCurrentView('main-menu');
    }
  };
  const openToolCheckout = (tool) => {
    const specificConfig = toolPricing[tool.id];
    const itemId = specificConfig ? tool.id : tool.accessKey;
    const config = toolPricing[itemId];
    if (config?.price > 0) {
      setCheckout({
        itemType: 'tool',
        itemId,
        itemTitle: `${t('toolboxTitle')}: ${t(tool.titleKey)}`,
        tier: `${config.validity_days} ${t('tbDays')}`,
        basePrice: config.price
      });
    }
  };
  const openComboCheckout = () => {
    if (comboPricing.price > 0) {
      setCheckout({
        itemType: 'toolbox_combo',
        itemId: 'all-tools',
        itemTitle: `${t('toolboxTitle')}: ${t('tbUnlockAllTools')}`,
        tier: `${comboPricing.validity_days} ${t('tbDays')}`,
        basePrice: comboPricing.price
      });
    }
  };

  const currentCategory = CATEGORY_CONFIG.find((category) => category.id === activeCategory);
  const currentTool = (CATEGORY_TOOLS[activeCategory] || []).find((tool) => tool.id === activeTool);
  const currentCategoryTitle = currentCategory ? t(currentCategory.titleKey) : '';
  const currentToolTitle = currentTool ? t(currentTool.titleKey) : '';
  const visibleCategories = CATEGORY_CONFIG.filter((category) => (CATEGORY_TOOLS[category.id] || []).some(isToolVisible));

  const renderReasoningHub = () => <section className="toolbox-section mini-tool">
    <div className="section-heading"><div><div className="eyebrow">{t('tbReasoningEyebrow')}</div><h2>{t('tbReasoningTitle')}</h2></div></div>
    <div className="toolbox-formula-grid">
      <article className="toolbox-formula-card"><strong>{t('tbSyllogism')}</strong><span>{t('tbSyllogism1')}</span><span>{t('tbSyllogism2')}</span><span>{t('tbSyllogism3')}</span><span>{t('tbSyllogism4')}</span></article>
      <article className="toolbox-formula-card"><strong>{t('tbClock')}</strong><span>{t('tbClockFormula')}</span></article>
      <article className="toolbox-formula-card"><strong>{t('tbCalendar')}</strong><span>{t('tbOddDays')}</span><span>{t('tbLeapYear')}</span><span>{t('tbCalendarCentury')}</span></article>
    </div>
  </section>;

  const renderBookmarks = () => <section className="toolbox-section">
    <div className="section-heading"><div><div className="eyebrow">{t('savedForLater').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{t('savedBookmarks')}</h2></div><span className="chapter-item-count">{bookmarks.length} {t('saved')}</span></div>
    {loading ? <p className="field-hint">{t('loadingBookmarks')}</p> : !savedBookmarks.length ? <div className="bookmarks-guidance">
      <div className="empty-content"><Bookmark size={22} /><strong>{t('tbBookmarksEmptyTitle')}</strong><span>{t('bookmarkHint')}</span></div>
      <h3>{t('tbBookmarksHowTo')}</h3>
      <ol><li>{t('tbBookmarkInstruction1')}</li><li>{t('tbBookmarkInstruction2')}</li><li>{t('tbBookmarkInstruction3')}</li></ol>
      {!user?.id && <p className="field-hint">{t('tbNoBookmarksSignIn')}</p>}
    </div> : <div className="toolbox-bookmark-list">{savedBookmarks.map((bookmark) => {
      const title = bookmark.title || (bookmark.question_id ? t('question') : bookmark.chapter_id ? t('chapter') : t('saved'));
      const destination = bookmark.chapter_id ? `/chapter/${bookmark.chapter_id}` : '/tests';
      return <button className="toolbox-bookmark-row" key={bookmark.id || `${bookmark.user_id}-${bookmark.item_id || bookmark.resource_id || bookmark.chapter_id || bookmark.question_id}`} onClick={() => navigate(destination)}><Bookmark size={16} /><span><strong>{title}</strong><small>{bookmark.question_id ? t('question') : bookmark.resource_id ? t('studyResource') : t('chapter')}</small></span><BookOpen size={15} /></button>;
    })}</div>}
  </section>;

  const renderActiveTool = () => {
    if (activeTool === 'calculator') return <SmartCalculator />;
    if (activeTool === 'fraction-converter') return <FractionConverter />;
    if (activeTool === 'powers-roots') return <SquaresCubes />;
    if (activeTool === 'geometry-formulas') return <MathFormulaHub />;
    if (activeTool === 'unit-converter') return <UnitConverter />;
    if (activeTool === 'profit-loss') return <ProfitLossCalculator />;
    if (activeTool === 'interest-calculator') return <InterestCalculator />;
    if (activeTool === 'alphabet-positions') return <AlphabetPositions />;
    if (activeTool === 'blood-relations') return <BloodRelations />;
    if (activeTool === 'direction-compass') return <DirectionCompass />;
    if (activeTool === 'dice-rules') return <DiceRules />;
    if (activeTool === 'constitution-articles') return <ConstitutionArticles />;
    if (activeTool === 'unit-converter') return <UnitConverter />;
    if (activeTool === 'sticky-notes') return <StickyNotes />;
    if (activeTool === 'daily-targets') return <DailyTargets />;
    if (activeTool === 'reasoning-formulas') return renderReasoningHub();
    if (activeTool === 'saved-bookmarks') return renderBookmarks();
    if (activeTool === 'pomodoro') return <PomodoroTimer
      mode={pomodoro.mode}
      remaining={pomodoro.remaining}
      running={pomodoro.running}
      completed={pomodoro.completed}
      focusMinutes={pomodoro.focusMinutes}
      breakMinutes={pomodoro.breakMinutes}
      onToggle={() => setPomodoro((current) => ({ ...current, running: !current.running }))}
      onReset={() => setPomodoro((current) => ({ ...current, running: false, remaining: (current.mode === 'focus' ? current.focusMinutes : current.breakMinutes) * 60 }))}
      onSelectMode={(mode) => setPomodoro((current) => ({ ...current, mode, running: false, remaining: (mode === 'focus' ? current.focusMinutes : current.breakMinutes) * 60 }))}
      onApplyTimes={(focusMinutes, breakMinutes) => setPomodoro((current) => ({
        ...current,
        focusMinutes,
        breakMinutes,
        remaining: (current.mode === 'focus' ? focusMinutes : breakMinutes) * 60
      }))}
    />;
    return null;
  };

  return <div className="toolbox-page mini-app-os">
    <div className="page-heading toolbox-os-heading">
      <div>
        <div className="eyebrow">{t('tbLearningSpace')}</div>
        <h1>{currentToolTitle || currentCategoryTitle || t('toolboxTitle')}</h1>
        <p>{(currentTool ? t(currentTool.subtitleKey) : currentCategory ? t(currentCategory.subtitleKey) : t('toolboxDescription'))}</p>
      </div>
    </div>
    {(currentView !== 'main-menu') && <div className="toolbox-breadcrumb">
      <button type="button" className="button button-outline" onClick={goBack}><ArrowLeft size={16} /> {currentView === 'active-tool' ? `${t('tbBack')} ${currentCategoryTitle}` : t('tbBackToolbox')}</button>
      <div aria-label={t('tbBreadcrumb')}><span>{t('tbBreadcrumb')}</span><ChevronRight size={14} /><span>{currentCategoryTitle}</span>{currentView === 'active-tool' && <><ChevronRight size={14} /><strong>{currentToolTitle}</strong></>}</div>
    </div>}
    {accessError && <div className="feedback error-feedback"><LockKeyhole size={15} /> {t('tbAccessError')} {accessError}</div>}
    {error && <div className="feedback error-feedback">{error}</div>}
    {timerPersistenceError && <div className="feedback error-feedback">{t(timerPersistenceError)}</div>}

    {currentView === 'main-menu' && <section className="toolbox-app-grid" aria-label={t('tbAllCategories')}>
      {visibleCategories.map(({ id, titleKey, subtitleKey, Icon, color }) => <button type="button" className={`toolbox-app-card ${color}`} key={id} onClick={() => openCategory(id)}>
        <span className="toolbox-app-icon"><Icon size={24} /></span><span className="toolbox-app-copy"><strong>{t(titleKey)}</strong><small>{t(subtitleKey)}</small></span><ChevronRight className="toolbox-app-arrow" size={18} />
      </button>)}
      {!visibleCategories.length && <div className="empty-content"><Wrench size={22} /><strong>{t('tbNoCategories')}</strong></div>}
    </section>}

    {currentView === 'category-menu' && <section className="toolbox-tool-grid" aria-label={currentCategoryTitle}>
      {(CATEGORY_TOOLS[activeCategory] || []).filter(isToolVisible).map((tool) => {
        const locked = isToolLocked(tool);
        const Icon = tool.Icon;
        return <button type="button" className={`toolbox-tool-card ${locked ? 'locked' : ''}`} key={tool.id} onClick={() => openTool(tool)}>
          <span className="toolbox-app-icon"><Icon size={23} /></span>
          <span className="toolbox-app-copy"><strong>{t(tool.titleKey)}</strong><small>{t(tool.subtitleKey)}</small></span>
          {locked ? <LockKeyhole className="toolbox-tool-lock" size={17} /> : <ChevronRight className="toolbox-app-arrow" size={18} />}
          {locked && <span className="toolbox-tool-price">{`₹${Number(getToolConfig(tool).price || 0).toLocaleString('en-IN')}`}</span>}
        </button>;
      })}
      {!loading && !(CATEGORY_TOOLS[activeCategory] || []).some(isToolVisible) && <div className="empty-content"><Wrench size={22} /><strong>{t('tbNoTools')}</strong></div>}
    </section>}

    {currentView === 'active-tool' && currentTool && !toolboxLoaded && <div className="toolbox-access-loading" role="status">{t('tbCheckingAccess')}</div>}
    {currentView === 'active-tool' && currentTool && toolboxLoaded && isToolLocked(currentTool) && <ToolUnlockModal
      title={currentToolTitle}
      price={getToolConfig(currentTool).price}
      validityDays={getToolConfig(currentTool).validity_days}
      comboPrice={comboPricing.price}
      comboValidityDays={comboPricing.validity_days}
      onBuy={() => openToolCheckout(currentTool)}
      onBuyCombo={openComboCheckout}
      onClose={goBack}
    />}
    {currentView === 'active-tool' && currentTool && toolboxLoaded && !isToolLocked(currentTool) && renderActiveTool()}
    {currentView === 'active-tool' && <p className="toolbox-footnote"><Wrench size={14} /> {t('tbActiveToolNote')}</p>}
    {checkout && <CheckoutModal {...checkout} onClose={() => setCheckout(null)} onCompleted={() => refreshToolAccess().catch((accessError) => setError(accessError.message || t('tbPurchaseVerifyError')))} />}
    {unlockTool && <ToolUnlockModal
      title={t(unlockTool.titleKey)}
      price={getToolConfig(unlockTool).price}
      validityDays={getToolConfig(unlockTool).validity_days}
      comboPrice={comboPricing.price}
      comboValidityDays={comboPricing.validity_days}
      onBuy={() => {
        const selectedTool = unlockTool;
        setUnlockTool(null);
        openToolCheckout(selectedTool);
      }}
      onBuyCombo={() => {
        setUnlockTool(null);
        openComboCheckout();
      }}
      onClose={() => setUnlockTool(null)}
    />}
  </div>;
}

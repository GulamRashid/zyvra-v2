import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, Brain, Calculator, Clock3, Percent, Shapes, Superscript, StickyNote, ListChecks, Compass, Dices, Scale, Sigma, Binary, TrendingUp, Landmark } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { normalizeAccessResult } from '../../lib/commerce';
import { getFriendlyErrorMessage } from '../../lib/errors';

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
    if (failed) setAccessError(getFriendlyErrorMessage(failed.error, t('tbAccessError')));
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
          setError(getFriendlyErrorMessage(bookmarkResult.error, t('tbBookmarksLoadError')));
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
        setError(getFriendlyErrorMessage(loadError, t('tbLoadError')));
        setAccessError(getFriendlyErrorMessage(loadError, t('tbPricingUnavailable')));
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
        setAccessError(getFriendlyErrorMessage(accessLoadError, t('tbAccessError')));
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
  const handleUnlockTool = (toolId, price) => {
    const tool = Object.values(CATEGORY_TOOLS).flat().find((item) => item.id === toolId);
    if (!tool) {
      setError(t('tbLoadError'));
      return;
    }
    const specificConfig = toolPricing[tool.id];
    const itemId = specificConfig ? tool.id : tool.accessKey;
    const config = toolPricing[itemId];
    if (config?.price > 0 && Number(config.price) === Number(price)) {
      setCheckout({
        itemType: 'tool',
        itemId,
        itemTitle: `${t('toolboxTitle')}: ${t(tool.titleKey)}`,
        tier: `${config.validity_days} ${t('tbDays')}`,
        basePrice: config.price
      });
    } else {
      setError(t('tbPriceChanged'));
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

  const renderReasoningHub = () => (
    <section className="space-y-4">
      <div>
        <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">{t('tbReasoningEyebrow')}</div>
        <h2 className="text-base font-black dark:text-white text-slate-900">{t('tbReasoningTitle')}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <article className="p-4 rounded-2xl dark:bg-emerald-950/60 bg-slate-50 border dark:border-emerald-500/20 border-slate-200 space-y-1 text-sm">
          <strong className="block text-amber-500 font-extrabold">{t('tbSyllogism')}</strong>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbSyllogism1')}</span>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbSyllogism2')}</span>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbSyllogism3')}</span>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbSyllogism4')}</span>
        </article>
        <article className="p-4 rounded-2xl dark:bg-emerald-950/60 bg-slate-50 border dark:border-emerald-500/20 border-slate-200 space-y-1 text-sm">
          <strong className="block text-amber-500 font-extrabold">{t('tbClock')}</strong>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbClockFormula')}</span>
        </article>
        <article className="p-4 rounded-2xl dark:bg-emerald-950/60 bg-slate-50 border dark:border-emerald-500/20 border-slate-200 space-y-1 text-sm sm:col-span-2">
          <strong className="block text-amber-500 font-extrabold">{t('tbCalendar')}</strong>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbOddDays')}</span>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbLeapYear')}</span>
          <span className="block dark:text-emerald-200/90 text-slate-700">{t('tbCalendarCentury')}</span>
        </article>
      </div>
    </section>
  );

  const renderBookmarks = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
            {t('savedForLater').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}
          </div>
          <h2 className="text-base font-black dark:text-white text-slate-900">{t('savedBookmarks')}</h2>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-black dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-300 text-emerald-800">
          {bookmarks.length} {t('saved')}
        </span>
      </div>

      {loading ? (
        <p className="text-xs dark:text-emerald-300 text-slate-600 font-medium">{t('loadingBookmarks')}</p>
      ) : !savedBookmarks.length ? (
        <div className="p-6 rounded-2xl dark:bg-emerald-950/40 bg-slate-50 border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
          <Bookmark size={24} className="mx-auto text-emerald-500 opacity-60" />
          <strong className="block text-sm dark:text-white text-slate-900">{t('tbBookmarksEmptyTitle')}</strong>
          <span className="text-xs dark:text-emerald-300/80 text-slate-600 block">{t('bookmarkHint')}</span>
        </div>
      ) : (
        <div className="divide-y dark:divide-emerald-800/30 divide-slate-200 rounded-2xl dark:bg-emerald-950/40 bg-white border dark:border-emerald-500/20 border-slate-200 overflow-hidden">
          {savedBookmarks.map((bookmark) => {
            const title = bookmark.title || (bookmark.question_id ? t('question') : bookmark.chapter_id ? t('chapter') : t('saved'));
            const destination = bookmark.chapter_id ? `/chapter/${bookmark.chapter_id}` : '/tests';
            return (
              <button
                type="button"
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-emerald-900/40 transition-colors text-left min-h-[48px]"
                key={bookmark.id || `${bookmark.user_id}-${bookmark.item_id || bookmark.resource_id || bookmark.chapter_id || bookmark.question_id}`}
                onClick={() => navigate(destination)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Bookmark size={16} className="text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <strong className="block text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">{title}</strong>
                    <small className="text-[10px] dark:text-emerald-300/70 text-slate-500">
                      {bookmark.question_id ? t('question') : bookmark.resource_id ? t('studyResource') : t('chapter')}
                    </small>
                  </div>
                </div>
                <BookOpen size={16} className="text-slate-400 dark:text-emerald-400/60 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

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

  return (
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      <div className="max-w-2xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Top Header / Breadcrumb */}
        {currentView !== 'main-menu' ? (
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-emerald-950/80 bg-slate-100 hover:bg-slate-200 dark:hover:bg-emerald-900 dark:text-emerald-300 text-slate-800 text-xs font-bold transition-colors min-h-[44px]"
            >
              <ArrowLeft size={16} />
              <span>{currentView === 'active-tool' ? 'Back to Tools' : 'Back to Toolbox'}</span>
            </button>
            <div className="text-xs font-black dark:text-white text-slate-900 truncate">
              {currentToolTitle || currentCategoryTitle}
            </div>
          </div>
        ) : (
          /* Main Hero Banner (Matching Mockup 1794580797580_48eb471c.jpg) */
          <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-r dark:from-[#052317] dark:via-[#072e1f] dark:to-[#041710] bg-gradient-to-r from-emerald-100 via-teal-50 to-white border dark:border-emerald-500/30 border-emerald-300/60 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-base">
                    🧰
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Zyvra Study Suite
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  Study Toolbox
                </h1>
                <p className="text-xs dark:text-emerald-200/80 text-slate-600 font-medium">
                  Smart utilities, calculators & quick reference tools for exam success
                </p>
              </div>

              {comboPricing.price > 0 && !toolAccess.__combo && (
                <button
                  type="button"
                  onClick={openComboCheckout}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-105 active:scale-95"
                >
                  ⚡ Unlock All (₹{comboPricing.price})
                </button>
              )}
            </div>

            {/* Quick capability badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 text-[11px] font-bold">
              {['✓ Calculate', '✓ Convert', '✓ Revise', '✓ Memorize', '✓ Focus Timer'].map((pill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full dark:bg-emerald-950/80 bg-white/90 border dark:border-emerald-500/25 border-emerald-200 dark:text-emerald-300 text-emerald-800 whitespace-nowrap shadow-xs"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback / Alerts */}
        {accessError && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <LockKeyhole size={15} className="shrink-0" />
            <span>{accessError}</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: MAIN MENU (Dashboard View with Categories & Popular) */}
        {/* ======================================================== */}
        {currentView === 'main-menu' && (
          <div className="space-y-4">
            {/* Category Filter Pills (Matching Mockup 1794580797580_48eb471c.jpg) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[44px] ${
                  activeCategory === null
                    ? 'bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white'
                    : 'dark:bg-[#072117]/85 bg-white border dark:border-emerald-500/20 border-slate-200 dark:text-emerald-200 text-slate-700 hover:border-emerald-400'
                }`}
              >
                <span>All Tools</span>
              </button>
              {visibleCategories.map(({ id, titleKey, Icon }) => {
                const isSelected = activeCategory === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveCategory(isSelected ? null : id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[44px] ${
                      isSelected
                        ? 'bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white'
                        : 'dark:bg-[#072117]/85 bg-white border dark:border-emerald-500/20 border-slate-200 dark:text-emerald-200 text-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{t(titleKey)}</span>
                  </button>
                );
              })}
            </div>

            {/* Popular Quick Tools Row (Matching Mockup 1794580797580_48eb471c.jpg) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span className="text-emerald-400">🔥</span>
                  <span>Popular Tools</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Quick Access</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {[
                  { id: 'calculator', cat: 'math', label: 'Calculator', icon: Calculator, color: 'text-emerald-500' },
                  { id: 'fraction-converter', cat: 'math', label: 'Percentage', icon: Percent, color: 'text-cyan-500' },
                  { id: 'constitution-articles', cat: 'general-studies', label: 'Articles', icon: Landmark, color: 'text-emerald-500' },
                  { id: 'geometry-formulas', cat: 'math', label: 'Formulas', icon: Sigma, color: 'text-indigo-500' },
                  { id: 'pomodoro', cat: 'productivity', label: 'Timer', icon: Clock3, color: 'text-rose-500' }
                ].map((item) => {
                  const toolObj = (CATEGORY_TOOLS[item.cat] || []).find((t) => t.id === item.id);
                  const locked = toolObj ? isToolLocked(toolObj) : false;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(item.cat);
                        if (toolObj) openTool(toolObj);
                      }}
                      className="p-2 sm:p-2.5 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-400 flex flex-col items-center justify-center text-center transition-all hover:scale-105 active:scale-95 group min-h-[72px]"
                    >
                      <div className="relative mb-1">
                        <Icon size={18} className={`${item.color} group-hover:scale-110 transition-transform`} />
                        {locked && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[9px] font-black">
                            🔒
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold dark:text-white text-slate-800 leading-tight">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tools by Subject Accordions / Groups */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5">
                  <Wrench size={14} className="text-emerald-500" />
                  <span>Tools by Subject</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500 dark:text-emerald-400/70">
                  {visibleCategories.length} Subjects
                </span>
              </div>

              {visibleCategories
                .filter((cat) => !activeCategory || cat.id === activeCategory)
                .map((category) => {
                  const Icon = category.Icon;
                  const tools = (CATEGORY_TOOLS[category.id] || []).filter(isToolVisible);

                  return (
                    <div
                      key={category.id}
                      className="rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 overflow-hidden"
                    >
                      {/* Subject Header */}
                      <button
                        type="button"
                        onClick={() => openCategory(category.id)}
                        className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Icon size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold dark:text-white text-slate-900">
                              {t(category.titleKey)}
                            </h4>
                            <p className="text-sm dark:text-emerald-300/70 text-slate-500">
                              {tools.length} Tools Available
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold dark:text-emerald-300 text-emerald-700">Open</span>
                          <ChevronRight size={16} className="text-slate-400 dark:text-emerald-400/50" />
                        </div>
                      </button>

                      {/* Preview of first 3 tools */}
                      <div className="px-3.5 pb-3 pt-1 border-t dark:border-emerald-800/30 border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tools.slice(0, 4).map((tool) => {
                          const locked = isToolLocked(tool);
                          const ToolIcon = tool.Icon;

                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => {
                                setActiveCategory(category.id);
                                openTool(tool);
                              }}
                              className="p-2.5 rounded-xl dark:bg-emerald-950/50 bg-slate-50 hover:bg-slate-100 dark:hover:bg-emerald-900/60 border dark:border-emerald-500/15 border-slate-200/80 flex items-center justify-between gap-2 text-left transition-colors min-h-[44px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ToolIcon size={15} className="text-emerald-500 shrink-0" />
                                <span className="text-xs font-bold dark:text-white text-slate-800 truncate">
                                  {t(tool.titleKey)}
                                </span>
                              </div>
                              {locked ? (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30 shrink-0">
                                  🔒 ₹{getToolConfig(tool).price || 'Premium'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  Free
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: CATEGORY MENU (List of all tools in category) */}
        {/* ======================================================== */}
        {currentView === 'category-menu' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black dark:text-white text-slate-900">
                  {currentCategoryTitle}
                </h3>
                <p className="text-xs dark:text-emerald-300/80 text-slate-600">
                  Select a tool below to open its full interactive interface
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(CATEGORY_TOOLS[activeCategory] || []).filter(isToolVisible).map((tool) => {
                const locked = isToolLocked(tool);
                const Icon = tool.Icon;

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => openTool(tool)}
                    className="p-3.5 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-400 flex items-center justify-between gap-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[56px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                          {t(tool.titleKey)}
                        </strong>
                        <small className="text-sm dark:text-emerald-300/70 text-slate-500 line-clamp-1">
                          {t(tool.subtitleKey)}
                        </small>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {locked ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 text-[11px] font-black">
                          <LockKeyhole size={12} />
                          <span>₹{getToolConfig(tool).price || 49}</span>
                        </div>
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 dark:text-emerald-400/50" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: ACTIVE TOOL (Full Interactive Screen) */}
        {/* ======================================================== */}
        {currentView === 'active-tool' && currentTool && (
          <div className="space-y-4">
            {!toolboxLoaded ? (
              <div className="p-8 text-center text-xs dark:text-emerald-300 text-slate-600 font-bold">
                Checking tool permissions...
              </div>
            ) : isToolLocked(currentTool) ? (
              <ToolUnlockModal
                title={currentToolTitle}
                price={getToolConfig(currentTool).price}
                validityDays={getToolConfig(currentTool).validity_days}
                comboPrice={comboPricing.price}
                comboValidityDays={comboPricing.validity_days}
                onBuy={() => handleUnlockTool(currentTool.id, getToolConfig(currentTool).price)}
                onBuyCombo={openComboCheckout}
                onClose={goBack}
              />
            ) : (
              <div className="rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 p-4 sm:p-5">
                {renderActiveTool()}
              </div>
            )}
          </div>
        )}

        {/* Unlock Modal & Checkout Modal */}
        {checkout && (
          <CheckoutModal
            {...checkout}
            onClose={() => setCheckout(null)}
            onCompleted={() => refreshToolAccess().catch((accessError) => setError(accessError.message || t('tbPurchaseVerifyError')))}
          />
        )}

        {unlockTool && (
          <ToolUnlockModal
            title={t(unlockTool.titleKey)}
            price={getToolConfig(unlockTool).price}
            validityDays={getToolConfig(unlockTool).validity_days}
            comboPrice={comboPricing.price}
            comboValidityDays={comboPricing.validity_days}
            onBuy={() => {
              const selectedTool = unlockTool;
              setUnlockTool(null);
              handleUnlockTool(selectedTool.id, getToolConfig(selectedTool).price);
            }}
            onBuyCombo={() => {
              setUnlockTool(null);
              openComboCheckout();
            }}
            onClose={() => setUnlockTool(null)}
          />
        )}
      </div>
    </div>
  );
}

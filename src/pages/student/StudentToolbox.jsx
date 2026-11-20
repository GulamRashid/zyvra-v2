import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Binary, Bookmark, BookOpen, Brain, Calculator, Calendar, CalendarDays, ChevronRight,
  Clock, Clock3, Compass, Dices, Heart, Landmark, ListChecks, LockKeyhole, MapPin, Percent, Search,
  Scale, Shapes, Sigma, StickyNote, Superscript, Target, TrendingUp, Wrench, Zap
} from 'lucide-react';
import CheckoutModal from '../../components/common/CheckoutModal';
import SmartCalculator from '../../components/toolbox/math/SmartCalculator';
import FractionConverter from '../../components/toolbox/math/FractionConverter';
import SquaresCubes from '../../components/toolbox/math/SquaresCubes';
import MathFormulaHub from '../../components/toolbox/math/MathFormulaHub';
import UnitConverter from '../../components/toolbox/math/UnitConverter';
import ProfitLossCalculator from '../../components/toolbox/math/ProfitLossCalculator';
import InterestCalculator from '../../components/toolbox/math/InterestCalculator';
import SpeedMathTricks from '../../components/toolbox/math/SpeedMathTricks';
import AlphabetPositions from '../../components/toolbox/reasoning/AlphabetPositions';
import BloodRelations from '../../components/toolbox/reasoning/BloodRelations';
import DirectionCompass from '../../components/toolbox/reasoning/DirectionCompass';
import DiceRules from '../../components/toolbox/reasoning/DiceRules';
import ClockMirrorTool from '../../components/toolbox/reasoning/ClockMirrorTool';
import CalendarDayTool from '../../components/toolbox/reasoning/CalendarDayTool';
import ConstitutionArticles from '../../components/toolbox/gs/ConstitutionArticles';
import IndiaGeoMap from '../../components/toolbox/gs/IndiaGeoMap';
import NegativeMarkingSimulator from '../../components/toolbox/productivity/NegativeMarkingSimulator';
import StickyNotes from '../../components/toolbox/productivity/StickyNotes';
import PomodoroTimer from '../../components/toolbox/productivity/PomodoroTimer';
import DailyTargets from '../../components/toolbox/productivity/DailyTargets';
import ExamCountdown from '../../components/toolbox/productivity/ExamCountdown';
import Flashcards from '../../components/toolbox/productivity/Flashcards';
import MistakeNotebook from '../../components/toolbox/productivity/MistakeNotebook';
import ToolUnlockModal from '../../components/toolbox/ToolUnlockModal';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { normalizeAccessResult } from '../../lib/commerce';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { readMistakesLocal } from '../../lib/studentToolbox';
import useStudentToolboxData from '../../hooks/useStudentToolboxData';
import { recordStudyActivity } from '../../lib/streak';

const CATEGORY_CONFIG = [
  { id: 'math', titleKey: 'tbCategoryMath', subtitleKey: 'tbCategoryMathDesc', Icon: Calculator, color: 'gold' },
  { id: 'reasoning', titleKey: 'tbCategoryReasoning', subtitleKey: 'tbCategoryReasoningDesc', Icon: Brain, color: 'violet' },
  { id: 'productivity', titleKey: 'tbCategoryProductivity', subtitleKey: 'tbCategoryProductivityDesc', Icon: Clock3, color: 'green' },
  { id: 'general-studies', titleKey: 'tbCategoryGs', subtitleKey: 'tbCategoryGsDesc', Icon: BookOpen, color: 'blue' },
  { id: 'revision', titleKey: 'tbRevision', subtitleKey: 'tbRevisionDesc', Icon: Brain, color: 'violet' }
];

const CATEGORY_TOOLS = {
  math: [
    { id: 'speed-math-tricks', titleKey: 'tbSpeedMath', subtitleKey: 'tbSpeedMathDesc', Icon: Zap, accessKey: 'math-shortcuts' },
    { id: 'calculator', titleKey: 'tbCalculator', subtitleKey: 'tbCalculatorDesc', Icon: Calculator, accessKey: null, isFree: true },
    { id: 'fraction-converter', titleKey: 'tbFraction', subtitleKey: 'tbFractionDesc', Icon: Percent, accessKey: null, isFree: true },
    { id: 'powers-roots', titleKey: 'tbSquares', subtitleKey: 'tbSquaresDesc', Icon: Superscript, accessKey: null, isFree: true },
    { id: 'geometry-formulas', titleKey: 'tbMathFormulas', subtitleKey: 'tbMathFormulasDesc', Icon: Shapes, accessKey: 'math-shortcuts' },
    { id: 'unit-converter', titleKey: 'tbUnitConverter', subtitleKey: 'tbUnitConverterDesc', Icon: Scale, accessKey: null, isFree: true },
    { id: 'profit-loss', titleKey: 'tbProfitLoss', subtitleKey: 'tbProfitLossDesc', Icon: TrendingUp, accessKey: 'math-shortcuts' },
    { id: 'interest-calculator', titleKey: 'tbInterest', subtitleKey: 'tbInterestDesc', Icon: Percent, accessKey: 'math-shortcuts' }
  ],
  reasoning: [
    { id: 'clock-mirror', titleKey: 'tbClockMirror', subtitleKey: 'tbClockMirrorDesc', Icon: Clock, accessKey: 'formula-sheet' },
    { id: 'calendar-day', titleKey: 'tbCalendarDay', subtitleKey: 'tbCalendarDayDesc', Icon: Calendar, accessKey: 'formula-sheet' },
    { id: 'alphabet-positions', titleKey: 'tbAlphabet', subtitleKey: 'tbAlphabetDesc', Icon: Binary, accessKey: null, isFree: true },
    { id: 'blood-relations', titleKey: 'tbBlood', subtitleKey: 'tbBloodDesc', Icon: Brain, accessKey: 'formula-sheet' },
    { id: 'direction-compass', titleKey: 'tbDirectionTool', subtitleKey: 'tbDirectionDesc', Icon: Compass, accessKey: null, isFree: true },
    { id: 'dice-rules', titleKey: 'tbDice', subtitleKey: 'tbDiceDesc', Icon: Dices, accessKey: null, isFree: true },
    { id: 'reasoning-formulas', titleKey: 'tbReasoningFormulas', subtitleKey: 'tbReasoningFormulasDesc', Icon: Sigma, accessKey: 'formula-sheet' }
  ],
  productivity: [
    { id: 'risk-simulator', titleKey: 'tbRiskSimulator', subtitleKey: 'tbRiskSimulatorDesc', Icon: Target, accessKey: null, isFree: true },
    { id: 'pomodoro', titleKey: 'tbPomodoro', subtitleKey: 'tbPomodoroDesc', Icon: Clock3, accessKey: null, isFree: true },
    { id: 'sticky-notes', titleKey: 'tbStickyNotes', subtitleKey: 'tbStickyNotesDesc', Icon: StickyNote, accessKey: null, isFree: true },
    { id: 'daily-targets', titleKey: 'tbDailyTargets', subtitleKey: 'tbDailyTargetsDesc', Icon: ListChecks, accessKey: null, isFree: true },
    { id: 'exam-countdown', titleKey: 'tbExamCountdown', subtitleKey: 'tbExamCountdownDesc', Icon: CalendarDays, accessKey: null, isFree: true }
  ],
  'general-studies': [
    { id: 'geo-map-explorer', titleKey: 'tbGeoMap', subtitleKey: 'tbGeoMapDesc', Icon: MapPin, accessKey: 'polity-articles' },
    { id: 'constitution-articles', titleKey: 'tbConstitution', subtitleKey: 'tbConstitutionDesc', Icon: Landmark, accessKey: 'polity-articles' },
    { id: 'saved-bookmarks', titleKey: 'tbBookmarks', subtitleKey: 'tbBookmarksDesc', Icon: Bookmark, accessKey: null, isFree: true }
  ],
  revision: [
    { id: 'flashcards', titleKey: 'tbFlashcards', subtitleKey: 'tbFlashcardsDesc', Icon: BookOpen, accessKey: 'flashcards', isFreemium: true },
    { id: 'mistake-notebook', titleKey: 'tbMistakeNotebook', subtitleKey: 'tbMistakeNotebookDesc', Icon: ListChecks, accessKey: 'mistake-notebook', isFreemium: true }
  ]
};

const POMODORO_DEFAULT = { mode: 'focus', remaining: 25 * 60, running: false, completed: 0, focusMinutes: 25, breakMinutes: 5 };
const readToolList = (key, userId) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(`${key}:${userId || 'guest'}`) || '[]');
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
};

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
    'formula-sheet': true,
    'clock-mirror': true,
    'calendar-day': true,
    'geo-map-explorer': true
  });
  const [toolPricing, setToolPricing] = useState({});
  const [comboPricing, setComboPricing] = useState({ price: 0, validity_days: 30 });
  const [fullPassPricing, setFullPassPricing] = useState({ price: 0, validity_days: 365, included_exam_ids: [], included_tool_ids: [], included_exam_titles: [] });
  const [toolAccess, setToolAccess] = useState({});
  const [toolboxLoaded, setToolboxLoaded] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [settingsUnavailable, setSettingsUnavailable] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [currentView, setCurrentView] = useState('main-menu');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [unlockTool, setUnlockTool] = useState(null);
  const [pomodoro, setPomodoro, pomodoroSyncState] = useStudentToolboxData('pomodoro', POMODORO_DEFAULT);
  const [toolSearch, setToolSearch] = useState('');
  const [favorites, setFavorites] = useState(() => readToolList('zyvra-toolbox-favorites', user?.id));
  const [recentTools, setRecentTools] = useState(() => readToolList('zyvra-toolbox-recents', user?.id));
  const [preferenceOwner, setPreferenceOwner] = useState(user?.id || 'guest');
  const searchText = toolSearch.trim().toLocaleLowerCase(language === 'hi' ? 'hi-IN' : 'en-IN');
  const allTools = Object.values(CATEGORY_TOOLS).flat();
  const matchesToolSearch = (tool) => !searchText || `${t(tool.titleKey)} ${t(tool.subtitleKey)} ${tool.id}`.toLocaleLowerCase(language === 'hi' ? 'hi-IN' : 'en-IN').includes(searchText);
  const toggleFavorite = (id) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]);
  const categoryForTool = (toolId) => Object.entries(CATEGORY_TOOLS).find(([, items]) => items.some((item) => item.id === toolId))?.[0] || null;
  useEffect(() => {
    setFavorites(readToolList('zyvra-toolbox-favorites', user?.id));
    setRecentTools(readToolList('zyvra-toolbox-recents', user?.id));
    setPreferenceOwner(user?.id || 'guest');
  }, [user?.id]);
  useEffect(() => {
    if (preferenceOwner !== (user?.id || 'guest')) return;
    try {
      window.localStorage.setItem(`zyvra-toolbox-favorites:${user?.id || 'guest'}`, JSON.stringify(favorites));
      window.localStorage.setItem(`zyvra-toolbox-recents:${user?.id || 'guest'}`, JSON.stringify(recentTools));
    } catch { /* Keep the current session usable when storage is unavailable. */ }
  }, [favorites, recentTools, user?.id, preferenceOwner]);
  const todayDateStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [userMistakes, setUserMistakes] = useState(() => readMistakesLocal(user?.id));
  useEffect(() => {
    setUserMistakes(readMistakesLocal(user?.id));
    const onMistakesChange = () => setUserMistakes(readMistakesLocal(user?.id));
    window.addEventListener('zyvra:mistakes-updated', onMistakesChange);
    return () => window.removeEventListener('zyvra:mistakes-updated', onMistakesChange);
  }, [user?.id]);
  const dueMistakesCount = userMistakes.filter((m) => !m.nextReview || m.nextReview <= todayDateStr).length;

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
  }, [pomodoro.running, setPomodoro]);
  const refreshToolAccess = useCallback(async (pricing, comboEnabled) => {
    setAccessError('');
    if (!user?.id || !supabase) {
      setToolAccess({});
      setToolboxLoaded(true);
      return;
    }
    const premiumToolIds = Object.entries(pricing)
      .filter(([, value]) => value?.access_type === 'premium')
      .map(([id]) => id);
    const requests = [
      ['__full_pass', supabase.rpc('check_user_access', {
        p_user_id: user.id,
        p_item_type: 'full_pass',
        p_item_id: 'global'
      })],
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
  }, [user?.id, t]);

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
      const [bookmarkResult, settingsResult, examsResult] = await Promise.all([
          user ? supabase.from('student_bookmarks').select('*').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
          supabase.from('platform_settings').select('*'),
          supabase.from('exams').select('id,title')
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
        // AdminTools stores access as "paid" while the student checkout uses
        // "premium". Normalize both forms so admin pricing actually locks
        // and unlocks the matching student tools.
        access_type: ['premium', 'paid'].includes(String(value?.access_type || value?.accessType || '').toLowerCase()) ? 'premium' : 'free',
        price: Math.max(0, Number(value?.price) || 0),
        validity_days: Math.max(1, Number(value?.validity_days) || 30)
      }]));
      const safeCombo = {
        price: Math.max(0, Number(parsedPricing?.combo?.price) || 0),
        validity_days: Math.max(1, Number(parsedPricing?.combo?.validity_days) || 30)
      };
      const passSetting = (settingsResult.data || []).find((item) => item?.setting_key === 'full_pass_config' || item?.key === 'full_pass_config');
      const rawPass = passSetting?.setting_value ?? passSetting?.value;
      const parsedPass = typeof rawPass === 'string' ? JSON.parse(rawPass) : rawPass;
      const safePass = {
        price: Math.max(0, Number(parsedPass?.price) || 0),
        validity_days: Math.min(3650, Math.max(1, Number(parsedPass?.validity_days) || 365)),
        included_exam_ids: Array.isArray(parsedPass?.included_exam_ids) ? parsedPass.included_exam_ids : [],
        included_tool_ids: Array.isArray(parsedPass?.included_tool_ids) ? parsedPass.included_tool_ids : [],
        included_exam_titles: (examsResult.data || []).filter((exam) => (parsedPass?.included_exam_ids || []).includes(exam.id)).map((exam) => exam.title),
        included_tool_titles: (configuredTools || []).filter((tool) => (parsedPass?.included_tool_ids || []).includes(tool.id)).map((tool) => tool.name || tool.title).filter(Boolean)
      };
      setToolPricing(safePricing);
      setComboPricing(safeCombo);
      setFullPassPricing(safePass);
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
  }, [user, t, refreshToolAccess]);

  useEffect(() => {
    const hasPremiumTools = Object.values(toolPricing).some((config) => config?.access_type === 'premium');
    if (!user?.id || !toolboxLoaded || !hasPremiumTools) return undefined;
    const interval = window.setInterval(() => {
      refreshToolAccess(toolPricing, comboPricing.price > 0).catch((accessLoadError) => {
        setAccessError(getFriendlyErrorMessage(accessLoadError, t('tbAccessError')));
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user?.id, toolboxLoaded, toolPricing, comboPricing.price, t, refreshToolAccess]);

  const savedBookmarks = bookmarks;

  const getToolConfig = (tool) => toolPricing[tool.id] || (tool.accessKey ? toolPricing[tool.accessKey] : null) || {};
  const isToolLocked = (tool) => {
    if (tool.isFree || !tool.accessKey) return false;
    if (settingsUnavailable) return true;
    if (!toolboxLoaded) return false;
    const specificConfig = toolPricing[tool.id];
    const accessKey = specificConfig ? tool.id : tool.accessKey;
    const isPaid = getToolConfig(tool).access_type === 'premium';
    const hasAccess = Boolean(toolAccess[accessKey] || toolAccess[tool.id] || toolAccess[tool.accessKey] || toolAccess.__combo || toolAccess.__full_pass);
    return isPaid && !hasAccess;
  };
  const isToolVisible = (tool) => !tool.accessKey || visibleTools[tool.accessKey] !== false;
  const openCategory = (categoryId) => {
    setActiveCategory(categoryId);
    setCurrentView('category-menu');
  };
  const openTool = (tool) => {
    recordStudyActivity(supabase, user?.id, 'toolbox_practice');
    const categoryId = categoryForTool(tool.id);
    if (categoryId) setActiveCategory(categoryId);
    setRecentTools((current) => [tool.id, ...current.filter((id) => id !== tool.id)].slice(0, 6));
    if (!toolboxLoaded && tool.accessKey) {
      setActiveTool(tool.id);
      setCurrentView('active-tool');
      return;
    }
    // Freemium tools (Mistake Notebook, Flashcards) are openable by all students (up to free limits)
    if (tool.isFreemium) {
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
    setActiveTool(null);
    setCurrentView('main-menu');
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
  const openFullPassCheckout = () => {
    const hasIncludedItems = fullPassPricing.included_exam_ids.length + fullPassPricing.included_tool_ids.length > 0;
    if (fullPassPricing.price > 0 && hasIncludedItems && !toolAccess.__full_pass) {
      setCheckout({
        itemType: 'full_pass',
        itemId: 'global',
        itemTitle: 'Zyvra Full Pass',
        tier: `${fullPassPricing.validity_days} ${t('tbDays')}`,
        basePrice: fullPassPricing.price
      });
    }
  };

  const currentCategory = CATEGORY_CONFIG.find((category) => category.id === activeCategory);
  const currentTool = (CATEGORY_TOOLS[activeCategory] || []).find((tool) => tool.id === activeTool);
  const currentCategoryTitle = currentCategory ? t(currentCategory.titleKey) : '';
  const currentToolTitle = currentTool ? t(currentTool.titleKey) : '';
  const visibleCategories = CATEGORY_CONFIG.filter((category) => (CATEGORY_TOOLS[category.id] || []).some(isToolVisible));
  const searchResultCount = visibleCategories
    .filter((category) => !activeCategory || category.id === activeCategory)
    .reduce((count, category) => count + (CATEGORY_TOOLS[category.id] || []).filter((tool) => isToolVisible(tool) && matchesToolSearch(tool)).length, 0);

  const renderReasoningHub = () => (
    <section className="space-y-4">
      <div>
        <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">{t('tbReasoningEyebrow')}</div>
        <h2 className="text-base font-black dark:text-white text-slate-900">{t('tbReasoningTitle')}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <article className="p-4 rounded-2xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700/60 border-slate-200 space-y-1 text-sm">
          <strong className="block text-amber-500 font-extrabold">{t('tbSyllogism')}</strong>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbSyllogism1')}</span>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbSyllogism2')}</span>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbSyllogism3')}</span>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbSyllogism4')}</span>
        </article>
        <article className="p-4 rounded-2xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700/60 border-slate-200 space-y-1 text-sm">
          <strong className="block text-amber-500 font-extrabold">{t('tbClock')}</strong>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbClockFormula')}</span>
        </article>
        <article className="p-4 rounded-2xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700/60 border-slate-200 space-y-1 text-sm sm:col-span-2">
          <strong className="block text-amber-500 font-extrabold">{t('tbCalendar')}</strong>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbOddDays')}</span>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbLeapYear')}</span>
          <span className="block dark:text-slate-300 text-slate-700">{t('tbCalendarCentury')}</span>
        </article>
      </div>
    </section>
  );

  const renderBookmarks = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
            {t('savedForLater').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}
          </div>
          <h2 className="text-base font-black dark:text-white text-slate-900">{t('savedBookmarks')}</h2>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-black dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-300 text-indigo-800">
          {bookmarks.length} {t('saved')}
        </span>
      </div>

      {loading ? (
        <p className="text-xs dark:text-slate-400 text-slate-600 font-medium">{t('loadingBookmarks')}</p>
      ) : !savedBookmarks.length ? (
        <div className="p-6 rounded-2xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
          <Bookmark size={24} className="mx-auto text-amber-500 opacity-60" />
          <strong className="block text-sm dark:text-white text-slate-900">{t('tbBookmarksEmptyTitle')}</strong>
          <span className="text-xs dark:text-slate-400 text-slate-600 block">{t('bookmarkHint')}</span>
        </div>
      ) : (
        <div className="divide-y dark:divide-slate-700/40 divide-slate-200 rounded-2xl dark:bg-slate-800 bg-white border dark:border-slate-700/60 border-slate-200 overflow-hidden">
          {savedBookmarks.map((bookmark) => {
            const title = bookmark.title || (bookmark.question_id ? t('question') : bookmark.chapter_id ? t('chapter') : t('saved'));
            const destination = bookmark.chapter_id ? `/chapter/${bookmark.chapter_id}` : '/tests';
            return (
              <button
                type="button"
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left min-h-[48px]"
                key={bookmark.id || `${bookmark.user_id}-${bookmark.item_id || bookmark.resource_id || bookmark.chapter_id || bookmark.question_id}`}
                onClick={() => navigate(destination)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Bookmark size={16} className="text-amber-500 shrink-0" />
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
    if (activeTool === 'speed-math-tricks') return <SpeedMathTricks />;
    if (activeTool === 'calculator') return <SmartCalculator />;
    if (activeTool === 'fraction-converter') return <FractionConverter />;
    if (activeTool === 'powers-roots') return <SquaresCubes />;
    if (activeTool === 'geometry-formulas') return <MathFormulaHub />;
    if (activeTool === 'unit-converter') return <UnitConverter />;
    if (activeTool === 'profit-loss') return <ProfitLossCalculator />;
    if (activeTool === 'interest-calculator') return <InterestCalculator />;
    if (activeTool === 'clock-mirror') return <ClockMirrorTool />;
    if (activeTool === 'calendar-day') return <CalendarDayTool />;
    if (activeTool === 'alphabet-positions') return <AlphabetPositions />;
    if (activeTool === 'blood-relations') return <BloodRelations />;
    if (activeTool === 'direction-compass') return <DirectionCompass />;
    if (activeTool === 'dice-rules') return <DiceRules />;
    if (activeTool === 'risk-simulator') return <NegativeMarkingSimulator />;
    if (activeTool === 'geo-map-explorer') return <IndiaGeoMap />;
    if (activeTool === 'constitution-articles') return <ConstitutionArticles />;
    if (activeTool === 'unit-converter') return <UnitConverter />;
    if (activeTool === 'sticky-notes') return <StickyNotes />;
    if (activeTool === 'daily-targets') return <DailyTargets />;
    if (activeTool === 'exam-countdown') return <ExamCountdown />;
    if (activeTool === 'flashcards') return <Flashcards isPremium={!isToolLocked(currentTool)} onUnlock={() => setUnlockTool(currentTool)} />;
    if (activeTool === 'mistake-notebook') return <MistakeNotebook isPremium={!isToolLocked(currentTool)} onUnlock={() => setUnlockTool(currentTool)} />;
    if (activeTool === 'reasoning-formulas') return renderReasoningHub();
    if (activeTool === 'saved-bookmarks') return renderBookmarks();
    if (activeTool === 'pomodoro') return <PomodoroTimer
      mode={pomodoro.mode}
      remaining={pomodoro.remaining}
      running={pomodoro.running}
      completed={pomodoro.completed}
      focusMinutes={pomodoro.focusMinutes}
      breakMinutes={pomodoro.breakMinutes}
      syncState={pomodoroSyncState}
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
    <div className="toolbox-page min-h-screen min-w-0 dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="max-w-2xl min-w-0 mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Top Header / Breadcrumb */}
        {currentView !== 'main-menu' ? (
          <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 min-w-0">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-200 text-slate-800 text-xs font-bold transition-colors min-h-[40px] shrink-0"
            >
              <ArrowLeft size={15} />
              <span>{language === 'hi' ? 'वापस' : 'Back'}</span>
            </button>
            <div className="text-xs font-black dark:text-white text-slate-900 truncate text-right min-w-0 flex-1">
              {currentToolTitle || currentCategoryTitle}
            </div>
          </div>
        ) : (
          /* Main Hero Banner (Matching Mockup 1794580797580_48eb471c.jpg) */
          <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-r dark:from-slate-900 dark:via-[#1E293B] dark:to-slate-900 bg-gradient-to-r from-indigo-50 via-slate-50 to-white border dark:border-indigo-500/30 border-indigo-200/60 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-base">
                    🧰
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {language === 'hi' ? 'ज़ीव्रा स्टडी सूट' : 'Zyvra Study Suite'}
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {language === 'hi' ? 'अध्ययन टूलबॉक्स' : 'Study Toolbox'}
                </h1>
                <p className="text-xs dark:text-slate-300 text-slate-600 font-medium">
                  {language === 'hi'
                    ? 'परीक्षा में सफलता हेतु स्मार्ट टूल्स, कैलकुलेटर, संविधान वॉल्ट और रिवीजन टूल्स'
                    : 'Smart utilities, calculators & quick reference tools for exam success'}
                </p>
              </div>

              <div className="flex flex-row flex-wrap sm:flex-col sm:items-end gap-1.5">
                {fullPassPricing.price > 0 && fullPassPricing.included_exam_ids.length + fullPassPricing.included_tool_ids.length > 0 && !toolAccess.__full_pass && (
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={openFullPassCheckout}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-[11px] shadow-glowGold transition-transform active:scale-95"
                    >
                      🌟 {language === 'hi' ? 'फुल पास' : 'Full Pass'} · ₹{fullPassPricing.price}
                    </button>
                    <span className="text-[10px] font-semibold dark:text-slate-300 text-slate-600">
                      {language === 'hi' ? 'शामिल:' : 'Includes'} {fullPassPricing.included_exam_titles.slice(0, 3).join(', ') || (language === 'hi' ? 'कोई परीक्षा नहीं' : 'no exams')}{fullPassPricing.included_exam_titles.length > 3 ? ` +${fullPassPricing.included_exam_titles.length - 3}` : ''}{fullPassPricing.included_tool_titles.length ? ` · ${fullPassPricing.included_tool_titles.slice(0, 2).join(', ')}${fullPassPricing.included_tool_titles.length > 2 ? ` +${fullPassPricing.included_tool_titles.length - 2}` : ''}` : ''}
                    </span>
                  </div>
                )}
                {toolAccess.__full_pass && (
                  <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-black">
                    {language === 'hi' ? 'फुल पास सक्रिय' : 'Full Pass active'}
                  </span>
                )}
                {comboPricing.price > 0 && !toolAccess.__combo && !toolAccess.__full_pass && (
                  <button
                    type="button"
                    onClick={openComboCheckout}
                    className="px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-[10px] transition-transform active:scale-95"
                  >
                    ⚡ {language === 'hi' ? 'केवल टूलबॉक्स' : 'Toolbox only'} · ₹{comboPricing.price}
                  </button>
                )}
              </div>
            </div>

            {/* Quick capability badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 text-[11px] font-bold">
              {(language === 'hi'
                ? ['✓ गणना (Calculate)', '✓ रूपांतरण (Convert)', '✓ संविधान (Polity)', '✓ दोहराव (Revise)', '✓ फोकस टाइमर (Focus)']
                : ['✓ Calculate', '✓ Convert', '✓ Revise', '✓ Memorize', '✓ Focus Timer']
              ).map((pill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full dark:bg-slate-800/80 bg-white/90 border dark:border-slate-700/40 border-slate-200 dark:text-slate-200 text-slate-800 whitespace-nowrap shadow-xs"
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
            {/* Today's Revision Workout Bar (Mobile First Cockpit) */}
            {!searchText && (
              <div className="rounded-3xl p-3.5 sm:p-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-500/25 dark:border-indigo-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg shrink-0 shadow-glowIndigo">
                    {dueMistakesCount > 0 ? '⚡' : '🎯'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {language === 'hi' ? 'आज का दोहराव सत्र' : "Today's Revision Workout"}
                      </span>
                      {dueMistakesCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                          {dueMistakesCount} {language === 'hi' ? 'बाकी' : 'Due'}
                        </span>
                      )}
                    </div>
                    <strong className="block text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">
                      {dueMistakesCount > 0
                        ? language === 'hi'
                          ? `आज दोहराने के लिए ${dueMistakesCount} गलतियां पेंडिंग हैं`
                          : `${dueMistakesCount} errors need spaced review today`
                        : userMistakes.length > 0
                        ? language === 'hi'
                          ? 'शाबाश! आज की सभी गलतियां दोहरा ली गई हैं'
                          : 'All caught up! No mistakes due today'
                        : language === 'hi'
                        ? 'मॉक टेस्ट से 1-क्लिक में गलतियां जोड़ें और दोहराएं'
                        : 'Practice mocks & track your error notebook'}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dueMistakesCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const tool = allTools.find((t) => t.id === 'mistake-notebook');
                        if (tool) openTool(tool);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-glowIndigo flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95 transition-transform"
                    >
                      <span>⚡ {language === 'hi' ? '5-मिनट दोहराव शुरू करें' : 'Start 5-Min Recap'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const tool = allTools.find((t) => t.id === 'risk-simulator');
                        if (tool) openTool(tool);
                      }}
                      className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-slate-800 dark:text-slate-100 font-extrabold text-xs flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95 transition-transform"
                    >
                      <span>🎯 {language === 'hi' ? 'रिस्क सिम्युलेटर' : 'Risk Simulator'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <label className="flex min-h-12 items-center gap-2 rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-[#1E293B]/85 bg-white px-3.5 shadow-sm">
              <Search size={18} className="shrink-0 text-slate-500" />
              <input type="search" value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} placeholder={t('tbSearchTools')} aria-label={t('tbSearchTools')} className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold outline-none placeholder:text-slate-500" />
              {toolSearch && <button type="button" onClick={() => setToolSearch('')} className="min-h-10 px-2 text-xs font-bold text-indigo-500">{t('tbClearSearch')}</button>}
            </label>
            {(favorites.length > 0 || recentTools.length > 0) && !searchText && (
              <div className="grid gap-3 sm:grid-cols-2">
                {favorites.length > 0 && <section className="rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-[#1E293B]/85 bg-white p-3"><h3 className="mb-2 flex items-center gap-2 text-xs font-black"><Heart size={14} className="text-rose-500" />{t('tbFavorites')}</h3><div className="flex flex-wrap gap-2">{favorites.map((id) => { const tool = allTools.find((item) => item.id === id); if (!tool) return null; return <button key={id} type="button" onClick={() => openTool(tool)} className="min-h-10 rounded-xl bg-indigo-500/10 px-3 text-left text-xs font-bold text-indigo-700 dark:text-indigo-200">{t(tool.titleKey)}</button>; })}</div></section>}
                {recentTools.length > 0 && <section className="rounded-2xl border dark:border-slate-700/60 border-slate-200 dark:bg-[#1E293B]/85 bg-white p-3"><h3 className="mb-2 flex items-center gap-2 text-xs font-black"><Clock3 size={14} className="text-indigo-500" />{t('tbRecentlyUsed')}</h3><div className="flex flex-wrap gap-2">{recentTools.map((id) => { const tool = allTools.find((item) => item.id === id); if (!tool) return null; return <button key={id} type="button" onClick={() => openTool(tool)} className="min-h-10 rounded-xl dark:bg-slate-800 bg-slate-100 px-3 text-left text-xs font-bold">{t(tool.titleKey)}</button>; })}</div></section>}
              </div>
            )}
            {/* Category Filter Pills (Matching Mockup 1794580797580_48eb471c.jpg) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[44px] ${
                  activeCategory === null
                    ? 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white shadow-glowIndigo'
                    : 'dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-indigo-500'
                }`}
              >
                <span>{language === 'hi' ? 'सभी टूल्स' : 'All Tools'}</span>
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
                        ? 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white shadow-glowIndigo'
                        : 'dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 dark:text-slate-300 text-slate-700 hover:border-indigo-500'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{t(titleKey)}</span>
                  </button>
                );
              })}
            </div>

            {/* Popular Quick Tools Row (Matching Mockup 1794580797580_48eb471c.jpg) */}
            {!searchText && <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5">
                  <span className="text-amber-500">🔥</span>
                  <span>{language === 'hi' ? 'लोकप्रिय टूल्स' : 'Popular Tools'}</span>
                </h3>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {language === 'hi' ? 'त्वरित एक्सेस' : 'Quick Access'}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 min-w-0 gap-1.5 sm:gap-2">
                {[
                  { id: 'risk-simulator', cat: 'productivity', label: language === 'hi' ? 'रिस्क कैलकुलेटर' : 'Risk Simulator', icon: Target, color: 'text-amber-500' },
                  { id: 'mistake-notebook', cat: 'revision', label: language === 'hi' ? 'गलती नोटबुक' : 'Mistake Vault', icon: ListChecks, color: 'text-indigo-500' },
                  { id: 'constitution-articles', cat: 'general-studies', label: language === 'hi' ? 'संविधान अनुच्छेद' : 'Polity Vault', icon: Landmark, color: 'text-emerald-500' },
                  { id: 'calculator', cat: 'math', label: language === 'hi' ? 'कैलकुलेटर' : 'Calculator', icon: Calculator, color: 'text-cyan-500' },
                  { id: 'fraction-converter', cat: 'math', label: language === 'hi' ? 'प्रतिशत' : 'Percentage', icon: Percent, color: 'text-indigo-500' },
                  { id: 'pomodoro', cat: 'productivity', label: language === 'hi' ? 'फोकस टाइमर' : 'Focus Timer', icon: Clock3, color: 'text-rose-500' }
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
                      className="p-2 sm:p-2.5 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500 flex flex-col items-center justify-center text-center transition-all hover:scale-105 active:scale-95 group min-h-[72px]"
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
            </div>}

            {/* Tools by Subject Accordions / Groups */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5">
                  <Wrench size={14} className="text-indigo-500" />
                  <span>{language === 'hi' ? 'विषय अनुसार टूल्स' : 'Tools by Subject'}</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {visibleCategories.length} {language === 'hi' ? 'विषय' : 'Subjects'}
                </span>
              </div>

              {visibleCategories
                .filter((cat) => !activeCategory || cat.id === activeCategory)
                .map((category) => {
                  const Icon = category.Icon;
                  const tools = (CATEGORY_TOOLS[category.id] || []).filter((tool) => isToolVisible(tool) && matchesToolSearch(tool));
                  if (searchText && tools.length === 0) return null;

                  return (
                    <div
                      key={category.id}
                      className="rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 overflow-hidden"
                    >
                      {/* Subject Header */}
                      <button
                        type="button"
                        onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)}
                        className={`w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left ${category.color || ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl dark:bg-indigo-500/10 bg-indigo-50 border dark:border-indigo-500/20 border-indigo-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Icon size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold dark:text-white text-slate-900">
                              {t(category.titleKey)}
                            </h4>
                            <p className="text-xs dark:text-slate-400 text-slate-500">
                              {tools.length} {language === 'hi' ? 'टूल्स उपलब्ध' : 'Tools Available'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold dark:text-indigo-400 text-indigo-600">
                            {activeCategory === category.id ? (language === 'hi' ? 'सभी देखें' : 'Show All') : (language === 'hi' ? 'खोलें' : 'Expand')}
                          </span>
                          <ChevronRight size={16} className={`text-slate-400 dark:text-slate-500 transition-transform ${activeCategory === category.id ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {/* All tools in category */}
                      <div className="px-3.5 pb-3.5 pt-1 border-t dark:border-slate-700/40 border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tools.map((tool) => {
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
                              className="p-2.5 rounded-xl dark:bg-slate-900/50 bg-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800/60 border dark:border-slate-700/40 border-slate-200/80 flex items-center justify-between gap-2 text-left transition-colors min-h-[44px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ToolIcon size={15} className="text-indigo-500 shrink-0" />
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
                                  {language === 'hi' ? 'मुफ़्त' : 'Free'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              {searchText && searchResultCount === 0 && <div className="rounded-2xl border border-dashed dark:border-slate-700 border-slate-300 p-6 text-center text-sm text-slate-500">{t('tbNoSearchResults')}</div>}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: CATEGORY MENU (List of all tools in category) */}
        {/* ======================================================== */}
        {currentView === 'category-menu' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black dark:text-white text-slate-900">
                  {currentCategoryTitle}
                </h3>
                <p className="text-xs dark:text-slate-400 text-slate-600">
                  {language === 'hi' ? 'पूरा इंटरफ़ेस खोलने के लिए नीचे दिए गए टूल को चुनें' : 'Select a tool below to open its full interactive interface'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(CATEGORY_TOOLS[activeCategory] || []).filter((tool) => isToolVisible(tool) && matchesToolSearch(tool)).map((tool) => {
                const locked = isToolLocked(tool);
                const Icon = tool.Icon;

                return (
                  <div
                    key={tool.id}
                    className="group relative rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/80 transition-all flex items-center justify-between p-3 sm:p-3.5 gap-2.5 min-w-0"
                  >
                    {/* Main Clickable Area to open tool */}
                    <button
                      type="button"
                      onClick={() => openTool(tool)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left active:scale-[0.99] transition-transform"
                    >
                      <div className="w-10 h-10 rounded-xl dark:bg-indigo-500/10 bg-indigo-50 border dark:border-indigo-500/20 border-indigo-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                          {t(tool.titleKey)}
                        </strong>
                        <small className="text-[11px] sm:text-xs dark:text-slate-400 text-slate-500 block truncate">
                          {t(tool.subtitleKey)}
                        </small>
                      </div>
                    </button>

                    {/* Integrated Action Buttons on Right */}
                    <div className="shrink-0 flex items-center gap-1 sm:gap-2">
                      {locked ? (
                        <button
                          type="button"
                          onClick={() => openTool(tool)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 text-[11px] font-black"
                        >
                          <LockKeyhole size={12} />
                          <span>₹{getToolConfig(tool).price || 49}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openTool(tool)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
                          aria-label="Open tool"
                        >
                          <ChevronRight size={18} />
                        </button>
                      )}

                      {/* Favorite Button Neatly Integrated Inside Card */}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(tool.id)}
                        aria-label={favorites.includes(tool.id) ? t('tbRemoveFavorite') : t('tbAddFavorite')}
                        aria-pressed={favorites.includes(tool.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <Heart
                          size={16}
                          className={favorites.includes(tool.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400 dark:text-slate-500'}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(CATEGORY_TOOLS[activeCategory] || []).filter((tool) => isToolVisible(tool) && matchesToolSearch(tool)).length === 0 && <div className="col-span-full rounded-2xl border border-dashed dark:border-slate-700 border-slate-300 p-6 text-center text-sm text-slate-500">{t('tbNoSearchResults')}</div>}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: ACTIVE TOOL (Full Interactive Screen) */}
        {/* ======================================================== */}
        {currentView === 'active-tool' && currentTool && (
          <div className="space-y-4">
            {!toolboxLoaded ? (
              <div className="p-8 text-center text-xs dark:text-slate-400 text-slate-600 font-bold">
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
              <div className="rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 p-3.5 sm:p-5 min-w-0 overflow-hidden">
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
            onCompleted={() => refreshToolAccess(toolPricing, comboPricing.price > 0).catch((accessError) => setError(accessError.message || t('tbPurchaseVerifyError')))}
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

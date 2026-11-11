import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Brain, Calculator, Clock3, LockKeyhole, Percent, Shapes, Superscript, Wrench, ChevronRight, StickyNote, ListChecks, Compass, Dices, Scale, Sigma, Binary } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { normalizeAccessResult } from '../../lib/commerce';
import CheckoutModal from '../../components/common/CheckoutModal';
import SmartCalculator from '../../components/toolbox/math/SmartCalculator';
import FractionConverter from '../../components/toolbox/math/FractionConverter';
import SquaresCubes from '../../components/toolbox/math/SquaresCubes';
import MathFormulaHub from '../../components/toolbox/math/MathFormulaHub';
import AlphabetPositions from '../../components/toolbox/reasoning/AlphabetPositions';
import BloodRelations from '../../components/toolbox/reasoning/BloodRelations';
import DirectionCompass from '../../components/toolbox/reasoning/DirectionCompass';
import DiceRules from '../../components/toolbox/reasoning/DiceRules';
import ConstitutionArticles from '../../components/toolbox/gs/ConstitutionArticles';
import UnitConverter from '../../components/toolbox/gs/UnitConverter';
import StickyNotes from '../../components/toolbox/productivity/StickyNotes';
import PomodoroTimer from '../../components/toolbox/productivity/PomodoroTimer';
import DailyTargets from '../../components/toolbox/productivity/DailyTargets';
import ToolUnlockModal from '../../components/toolbox/ToolUnlockModal';

const TOOL_TITLES = {
  calculator: 'Smart Calculator',
  'fraction-converter': 'Fraction & Percentage Converter',
  'powers-roots': 'Squares, Cubes & Roots',
  'geometry-formulas': 'Math Formula Hub',
  'alphabet-positions': 'Alphabet Positions',
  'blood-relations': 'Blood Relations',
  'direction-compass': 'Direction Compass',
  'dice-rules': 'Dice Rules',
  'constitution-articles': 'Constitution Articles',
  'unit-converter': 'Unit Converter',
  'sticky-notes': 'Sticky Notes',
  'daily-targets': 'Daily Targets',
  'reasoning-formulas': 'Reasoning & Logic Formulas',
  pomodoro: 'Pomodoro Study Timer',
  'polity-articles': 'Constitution & Articles',
  'saved-bookmarks': 'Saved Bookmarks'
};

const CATEGORY_CONFIG = [
  { id: 'math', title: 'Quantitative Aptitude', subtitle: 'Calculate, convert and revise formulas', Icon: Calculator, color: 'gold' },
  { id: 'reasoning', title: 'Reasoning & Logic', subtitle: 'Patterns, rules and revision sheets', Icon: Brain, color: 'violet' },
  { id: 'productivity', title: 'Productivity', subtitle: 'Focus sessions and mindful breaks', Icon: Clock3, color: 'green' },
  { id: 'general-studies', title: 'General Studies', subtitle: 'Polity references and study resources', Icon: BookOpen, color: 'blue' }
];

const CATEGORY_TOOLS = {
  math: [
    { id: 'calculator', title: TOOL_TITLES.calculator, subtitle: 'Everyday calculations', Icon: Calculator, accessKey: 'math-shortcuts' },
    { id: 'fraction-converter', title: TOOL_TITLES['fraction-converter'], subtitle: 'Convert percentages to fractions', Icon: Percent, accessKey: 'math-shortcuts' },
    { id: 'powers-roots', title: TOOL_TITLES['powers-roots'], subtitle: 'Squares, cubes, roots and a 1–30 reference table', Icon: Superscript, accessKey: 'math-shortcuts' },
    { id: 'geometry-formulas', title: TOOL_TITLES['geometry-formulas'], subtitle: 'Algebra, mensuration and trigonometry', Icon: Shapes, accessKey: 'math-shortcuts' }
  ],
  reasoning: [
    { id: 'alphabet-positions', title: TOOL_TITLES['alphabet-positions'], subtitle: 'Forward positions and reverse pairs', Icon: Binary, accessKey: 'formula-sheet' },
    { id: 'blood-relations', title: TOOL_TITLES['blood-relations'], subtitle: 'Family-tree symbols and generations', Icon: Brain, accessKey: 'formula-sheet' },
    { id: 'direction-compass', title: TOOL_TITLES['direction-compass'], subtitle: 'Eight directions with clockwise angles', Icon: Compass, accessKey: 'formula-sheet' },
    { id: 'dice-rules', title: TOOL_TITLES['dice-rules'], subtitle: 'Standard and general dice rules', Icon: Dices, accessKey: 'formula-sheet' },
    { id: 'reasoning-formulas', title: TOOL_TITLES['reasoning-formulas'], subtitle: 'Quick quantitative reasoning reference', Icon: Sigma, accessKey: 'formula-sheet' }
  ],
  productivity: [
    { id: 'pomodoro', title: TOOL_TITLES.pomodoro, subtitle: '25-minute focus and 5-minute break cycles', Icon: Clock3, accessKey: 'pomodoro' },
    { id: 'sticky-notes', title: TOOL_TITLES['sticky-notes'], subtitle: 'A private, locally saved rough pad', Icon: StickyNote, accessKey: 'pomodoro' },
    { id: 'daily-targets', title: TOOL_TITLES['daily-targets'], subtitle: 'Create and track today’s study checklist', Icon: ListChecks, accessKey: 'pomodoro' }
  ],
  'general-studies': [
    { id: 'constitution-articles', title: TOOL_TITLES['constitution-articles'], subtitle: 'Search frequently asked Indian Constitution articles', Icon: BookOpen, accessKey: 'polity-articles' },
    { id: 'unit-converter', title: TOOL_TITLES['unit-converter'], subtitle: 'Length, temperature and land area conversions', Icon: Scale, accessKey: 'polity-articles' },
    { id: 'polity-articles', title: TOOL_TITLES['polity-articles'], subtitle: 'Browse the syllabus and polity chapters', Icon: BookOpen, accessKey: 'polity-articles' },
    { id: 'saved-bookmarks', title: TOOL_TITLES['saved-bookmarks'], subtitle: 'Continue from saved items', Icon: Bookmark, accessKey: null }
  ]
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
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      setToolboxLoaded(false);
      setToolAccess({});
      setAccessError('');
      setSettingsUnavailable(false);
      if (!supabase) {
          setError('Connect to Zyvra to verify Toolbox access and load your bookmarks.');
          setAccessError('Pricing and purchase status could not be verified.');
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
          setError(`Bookmarks could not be loaded: ${bookmarkResult.error.message}`);
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
        setError(loadError.message || 'Unable to load your study toolbox.');
        setAccessError(loadError.message || 'Pricing and purchase status could not be verified.');
        setSettingsUnavailable(true);
        setToolboxLoaded(true);
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
        itemTitle: `Study Toolbox: ${TOOL_TITLES[tool.id] || tool.title || 'Premium tool'}`,
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

  const currentCategory = CATEGORY_CONFIG.find((category) => category.id === activeCategory);
  const currentTool = (CATEGORY_TOOLS[activeCategory] || []).find((tool) => tool.id === activeTool);
  const visibleCategories = CATEGORY_CONFIG.filter((category) => (CATEGORY_TOOLS[category.id] || []).some(isToolVisible));

  const renderReasoningHub = () => <section className="toolbox-section mini-tool">
    <div className="section-heading"><div><div className="eyebrow">QUICK REFERENCE</div><h2>Reasoning & Logic</h2></div></div>
    <div className="toolbox-formula-grid">
      <article className="toolbox-formula-card"><strong>Average</strong><span>Sum of observations ÷ Number of observations</span></article>
      <article className="toolbox-formula-card"><strong>Speed</strong><span>Distance ÷ Time</span></article>
      <article className="toolbox-formula-card"><strong>Percentage</strong><span>(Part ÷ Whole) × 100</span></article>
      <article className="toolbox-formula-card"><strong>Ratio</strong><span>Compare quantities in the same units.</span></article>
    </div>
  </section>;

  const renderBookmarks = () => <section className="toolbox-section">
    <div className="section-heading"><div><div className="eyebrow">{t('savedForLater').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{t('savedBookmarks')}</h2></div><span className="chapter-item-count">{bookmarks.length} {t('saved')}</span></div>
    {loading ? <p className="field-hint">{t('loadingBookmarks')}</p> : !savedBookmarks.length ? <div className="empty-content"><Bookmark size={22} /><strong>{t('bookmarksEmpty')}</strong><span>{t('bookmarkHint')}</span></div> : <div className="toolbox-bookmark-list">{savedBookmarks.map((bookmark) => {
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
    if (activeTool === 'polity-articles') return <section className="toolbox-deep-link-card">
      <span className="toolbox-icon"><BookOpen size={19} /></span>
      <div><strong>Constitution & Articles</strong><p>Open your syllabus to browse polity chapters and revision resources.</p></div>
      <button type="button" className="button button-outline" onClick={() => navigate('/explore')}>Explore syllabus <ArrowRight size={15} /></button>
    </section>;
    if (activeTool === 'pomodoro') return <PomodoroTimer />;
    return null;
  };

  return <div className="toolbox-page mini-app-os">
    <div className="page-heading toolbox-os-heading">
      <div>
        <div className="eyebrow">{language === 'hi' ? 'आपका अध्ययन स्थान / टूलबॉक्स' : 'YOUR LEARNING SPACE / TOOLBOX'}</div>
        <h1>{currentTool?.title || currentCategory?.title || t('toolboxTitle')}</h1>
        <p>{currentTool?.subtitle || currentCategory?.subtitle || t('toolboxDescription')}</p>
      </div>
    </div>
    {(currentView !== 'main-menu') && <div className="toolbox-breadcrumb">
      <button type="button" className="button button-outline" onClick={goBack}><ArrowLeft size={16} /> {currentView === 'active-tool' ? `Back to ${currentCategory?.title || 'Category'}` : 'Back to Toolbox'}</button>
      <div aria-label="Breadcrumb"><span>Toolbox</span><ChevronRight size={14} /><span>{currentCategory?.title}</span>{currentView === 'active-tool' && <><ChevronRight size={14} /><strong>{currentTool?.title}</strong></>}</div>
    </div>}
    {accessError && <div className="feedback error-feedback"><LockKeyhole size={15} /> Access verification failed; premium tools stay locked. {accessError}</div>}
    {error && <div className="feedback error-feedback">{error}</div>}

    {currentView === 'main-menu' && <section className="toolbox-app-grid" aria-label="Toolbox categories">
      {visibleCategories.map(({ id, title, subtitle, Icon, color }) => <button type="button" className={`toolbox-app-card ${color}`} key={id} onClick={() => openCategory(id)}>
        <span className="toolbox-app-icon"><Icon size={24} /></span><span className="toolbox-app-copy"><strong>{title}</strong><small>{subtitle}</small></span><ChevronRight className="toolbox-app-arrow" size={18} />
      </button>)}
      {!visibleCategories.length && <div className="empty-content"><Wrench size={22} /><strong>No Toolbox categories are available right now.</strong></div>}
    </section>}

    {currentView === 'category-menu' && <section className="toolbox-tool-grid" aria-label={`${currentCategory?.title || 'Tool'} tools`}>
      {(CATEGORY_TOOLS[activeCategory] || []).filter(isToolVisible).map((tool) => {
        const locked = isToolLocked(tool);
        const Icon = tool.Icon;
        return <button type="button" className={`toolbox-tool-card ${locked ? 'locked' : ''}`} key={tool.id} onClick={() => openTool(tool)}>
          <span className="toolbox-app-icon"><Icon size={23} /></span>
          <span className="toolbox-app-copy"><strong>{tool.title}</strong><small>{tool.subtitle}</small></span>
          {locked ? <LockKeyhole className="toolbox-tool-lock" size={17} /> : <ChevronRight className="toolbox-app-arrow" size={18} />}
          {locked && <span className="toolbox-tool-price">{`₹${Number(getToolConfig(tool).price || 0).toLocaleString('en-IN')}`}</span>}
        </button>;
      })}
      {!loading && !(CATEGORY_TOOLS[activeCategory] || []).some(isToolVisible) && <div className="empty-content"><Wrench size={22} /><strong>No tools are available in this category right now.</strong></div>}
    </section>}

    {currentView === 'active-tool' && currentTool && !toolboxLoaded && <div className="toolbox-access-loading" role="status">Checking access…</div>}
    {currentView === 'active-tool' && currentTool && toolboxLoaded && isToolLocked(currentTool) && <ToolUnlockModal
      title={currentTool.title}
      price={getToolConfig(currentTool).price}
      validityDays={getToolConfig(currentTool).validity_days}
      comboPrice={comboPricing.price}
      comboValidityDays={comboPricing.validity_days}
      onBuy={() => openToolCheckout(currentTool)}
      onBuyCombo={openComboCheckout}
      onClose={goBack}
    />}
    {currentView === 'active-tool' && currentTool && toolboxLoaded && !isToolLocked(currentTool) && renderActiveTool()}
    {currentView === 'active-tool' && <p className="toolbox-footnote"><Wrench size={14} /> {t('timerLocalNote')}</p>}
    {checkout && <CheckoutModal {...checkout} onClose={() => setCheckout(null)} onCompleted={() => refreshToolAccess().catch((accessError) => setError(accessError.message || 'Unable to verify your Toolbox purchase.'))} />}
    {unlockTool && <ToolUnlockModal
      title={unlockTool.title}
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

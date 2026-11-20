import { useState, useMemo } from 'react';
import {
  MapPin, Waves, Mountain, Compass, Trees, Droplets, Globe, Search,
  ZoomIn, ZoomOut, RotateCcw, Sparkles, BookOpen, X, HelpCircle,
  CheckCircle2, AlertCircle, ArrowRight, Share2, Copy, Check,
  Layers, Eye, EyeOff, Info, Sun, Moon
} from 'lucide-react';
import {
  GEO_CATEGORIES, REGIONS_FILTER, RIVERS_DATA, MOUNTAINS_PEAKS_DATA,
  MOUNTAIN_PASSES_DATA, NATIONAL_PARKS_DATA, LAKES_WATERFALLS_DATA,
  TROPIC_MERIDIAN_DATA, MAP_QUIZ_QUESTIONS
} from '../../../data/geographyData';
import {
  MAP_VIEWBOX, INDIA_STATES, SRI_LANKA_PATH, RIVERS_SVG_PATHS, PHYSICAL_REGIONS_PATHS
} from '../../../data/indiaMapPaths';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

export default function IndiaGeoMap() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';

  const [activeCategory, setActiveCategory] = useState('rivers'); // 'rivers' | 'mountains' | 'passes' | 'parks' | 'lakes' | 'meridians'
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(RIVERS_DATA[0]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeTabMode, setActiveTabMode] = useState('map'); // 'map' | 'list' | 'quiz'
  const [copiedId, setCopiedId] = useState(null);

  // Map Theme: 'light' (Classic Atlas) | 'dark' (Satellite/Night)
  const [mapTheme, setMapTheme] = useState(() => {
    try {
      return localStorage.getItem('india-geo-map-theme') || 'light';
    } catch {
      return 'light';
    }
  });

  const toggleMapTheme = (newTheme) => {
    const next = newTheme || (mapTheme === 'light' ? 'dark' : 'light');
    setMapTheme(next);
    try {
      localStorage.setItem('india-geo-map-theme', next);
    } catch {
      // ignore
    }
  };

  const isLight = mapTheme === 'light';

  // State interaction & Layer Visibility
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [layerStates, setLayerStates] = useState(true);
  const [layerRivers, setLayerRivers] = useState(true);
  const [layerPhysical, setLayerPhysical] = useState(true);
  const [layerLines, setLayerLines] = useState(true);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Quiz State
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);

  // Get current dataset based on category
  const currentDataset = useMemo(() => {
    switch (activeCategory) {
      case 'rivers':
        return RIVERS_DATA;
      case 'mountains':
        return MOUNTAINS_PEAKS_DATA;
      case 'passes':
        return MOUNTAIN_PASSES_DATA;
      case 'parks':
        return NATIONAL_PARKS_DATA;
      case 'lakes':
        return LAKES_WATERFALLS_DATA;
      case 'meridians':
        return TROPIC_MERIDIAN_DATA;
      default:
        return RIVERS_DATA;
    }
  }, [activeCategory]);

  // Filter items by region and search
  const filteredItems = useMemo(() => {
    let items = currentDataset;

    // Apply Region bounds filter if not 'all'
    if (selectedRegion !== 'all') {
      const reg = REGIONS_FILTER.find((r) => r.id === selectedRegion);
      if (reg && reg.bounds) {
        items = items.filter((item) => {
          const { minX = 0, maxX = 100, minY = 0, maxY = 100 } = reg.bounds;
          return item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY;
        });
      }
    }

    // Apply Search Query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) =>
        item.nameEn.toLowerCase().includes(q) ||
        item.nameHi.toLowerCase().includes(q) ||
        (item.states && (Array.isArray(item.states) ? item.states.some((s) => (typeof s === 'string' ? s.toLowerCase() : (s?.en?.toLowerCase() || '')).includes(q)) : false)) ||
        (item.stateEn && item.stateEn.toLowerCase().includes(q)) ||
        (item.stateHi && item.stateHi.toLowerCase().includes(q))
      );
    }

    // If a state is selected on the map, prioritize or filter items related to it
    if (selectedState) {
      const stNameEn = selectedState.nameEn.toLowerCase();
      const stNameHi = selectedState.nameHi.toLowerCase();
      const stateMatches = items.filter((item) =>
        (item.stateEn && item.stateEn.toLowerCase().includes(stNameEn)) ||
        (item.stateHi && item.stateHi.toLowerCase().includes(stNameHi)) ||
        (item.states && Array.isArray(item.states) && item.states.some((s) => (typeof s === 'string' ? s.toLowerCase().includes(stNameEn) : false)))
      );
      if (stateMatches.length > 0) {
        return stateMatches;
      }
    }

    return items;
  }, [currentDataset, selectedRegion, searchQuery, selectedState]);

  const handleSelect = (item) => {
    setSelectedItem(item);
  };

  const handleCopyFact = (item) => {
    const activeFact = isHi
      ? (item.examFactsHi ? item.examFactsHi[0] : (item.examFacts ? item.examFacts[0] : ''))
      : (item.examFacts ? item.examFacts[0] : '');
    const textToCopy = `${isHi ? item.nameHi : item.nameEn} - ${activeFact}`;
    navigator.clipboard?.writeText?.(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetZoom = () => setZoomLevel(1);
  const zoomIn = () => setZoomLevel((z) => Math.min(1.8, Number((z + 0.2).toFixed(1))));
  const zoomOut = () => setZoomLevel((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))));

  const getPinColor = () => {
    switch (activeCategory) {
      case 'rivers':
        return 'bg-blue-600 border-white text-white';
      case 'mountains':
        return 'bg-amber-600 border-white text-white';
      case 'passes':
        return 'bg-indigo-600 border-white text-white';
      case 'parks':
        return 'bg-emerald-600 border-white text-white';
      case 'lakes':
        return 'bg-cyan-600 border-white text-white';
      case 'meridians':
        return 'bg-rose-600 border-white text-white';
      default:
        return 'bg-purple-600 border-white text-white';
    }
  };

  // Handle Quiz Option click
  const currentQ = MAP_QUIZ_QUESTIONS[quizIndex];
  const handleQuizAnswer = (idx) => {
    if (quizAnswered) return;
    setSelectedOption(idx);
    setQuizAnswered(true);
    if (idx === currentQ.correctIndex) {
      setQuizScore((s) => s + 1);
    }
  };

  const handleNextQuiz = () => {
    setSelectedOption(null);
    setQuizAnswered(false);
    setQuizIndex((prev) => (prev + 1) % MAP_QUIZ_QUESTIONS.length);
  };

  return (
    <section className="toolbox-section mini-tool space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-neutral-800 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <MapPin size={14} />
            {isHi ? 'सामान्य अध्ययन भूगोल टूल' : 'General Studies Geography Engine'}
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isHi ? 'भारत का सम्पूर्ण भूगोल एवं मानचित्र' : 'India Geography & High-Precision Map Explorer'}
          </h3>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTabMode('map')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTabMode === 'map'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'नक्शा (Map)' : 'Interactive Map'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode('list')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTabMode === 'list'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'तालिका (List)' : 'Index List'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode('quiz')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTabMode === 'quiz'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? '⚡ रैपिड क्विज़' : '⚡ Map Quiz'}
          </button>
        </div>
      </div>

      {/* ================= MAP OR LIST CONTROLS ================= */}
      {activeTabMode !== 'quiz' && (
        <div className="space-y-2.5">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {GEO_CATEGORIES.map((cat) => {
              const isCatActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const firstItem =
                      cat.id === 'rivers' ? RIVERS_DATA[0] :
                      cat.id === 'mountains' ? MOUNTAINS_PEAKS_DATA[0] :
                      cat.id === 'passes' ? MOUNTAIN_PASSES_DATA[0] :
                      cat.id === 'parks' ? NATIONAL_PARKS_DATA[0] :
                      cat.id === 'lakes' ? LAKES_WATERFALLS_DATA[0] :
                      TROPIC_MERIDIAN_DATA[0];
                    setSelectedItem(firstItem);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isCatActive
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-emerald-500'
                  }`}
                >
                  {cat.id === 'rivers' && <Waves size={13} className="text-blue-400" />}
                  {cat.id === 'mountains' && <Mountain size={13} className="text-amber-400" />}
                  {cat.id === 'passes' && <Compass size={13} className="text-indigo-400" />}
                  {cat.id === 'parks' && <Trees size={13} className="text-emerald-400" />}
                  {cat.id === 'lakes' && <Droplets size={13} className="text-cyan-400" />}
                  {cat.id === 'meridians' && <Globe size={13} className="text-rose-400" />}
                  <span>{isHi ? cat.labelHi : cat.labelEn}</span>
                </button>
              );
            })}
          </div>

          {/* Region Filters, Theme Switcher & Live Search Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Region Filter Selector */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {REGIONS_FILTER.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(reg.id);
                    setSelectedState(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedRegion === reg.id && !selectedState
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {isHi ? reg.labelHi : reg.labelEn}
                </button>
              ))}
            </div>

            {/* Quick Map Theme Switcher Pill (Light Atlas vs Dark Mode) */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => toggleMapTheme('light')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isLight
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title={isHi ? 'स्पष्ट एटलस मानचित्र (लाइट व्यू)' : 'Crisp Atlas View (Light Mode)'}
              >
                <Sun size={13} className="text-amber-500" />
                <span>{isHi ? 'लाइट एटलस' : 'Light Atlas'}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleMapTheme('dark')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  !isLight
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title={isHi ? 'सैटेलाइट/नाइट मानचित्र (डार्क व्यू)' : 'Night View (Dark Mode)'}
              >
                <Moon size={13} className="text-blue-400" />
                <span>{isHi ? 'डार्क मोड' : 'Dark Mode'}</span>
              </button>
            </div>

            {/* Live Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isHi ? 'खोजें (उदा. Ganga, K2, रोहतांग, Corbett, चिल्का)...' : 'Search river, peak, pass, park, lake...'}
                className="w-full text-xs font-bold pl-8 pr-7 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 1: INTERACTIVE MAP ================= */}
      {activeTabMode === 'map' && (
        <div className="space-y-4">
          <div
            className={`relative overflow-hidden rounded-2xl transition-colors duration-300 p-2 sm:p-4 min-h-[460px] flex items-center justify-center border shadow-inner ${
              isLight
                ? 'bg-gradient-to-b from-sky-50/90 via-blue-50/40 to-slate-100/80 border-slate-300 shadow-sky-950/5'
                : 'bg-neutral-950 border-neutral-800'
            }`}
          >
            {/* Top Bar Status: Hovered / Selected State Notification */}
            <div className="absolute top-3 left-3 z-20 max-w-[260px] sm:max-w-[340px] pointer-events-none">
              {(hoveredState || selectedState) ? (
                <div
                  className={`backdrop-blur-md px-3 py-1.5 rounded-xl border text-xs shadow-lg animate-fadeIn ${
                    isLight
                      ? 'bg-white/95 border-emerald-500 text-neutral-900 shadow-emerald-950/10'
                      : 'bg-neutral-900/90 border-emerald-500/40 text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className={`font-black ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                      {isHi ? (hoveredState || selectedState).nameHi : (hoveredState || selectedState).nameEn}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {(hoveredState || selectedState).isUt ? (isHi ? 'केंद्रशासित' : 'UT') : (isHi ? 'राज्य' : 'State')}
                    </span>
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    {isHi ? 'राजधानी:' : 'Capital:'}{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {isHi ? (hoveredState || selectedState).capHi : (hoveredState || selectedState).capEn}
                    </span>
                  </div>
                </div>
              ) : selectedItem ? (
                <div
                  className={`hidden sm:flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1 rounded-lg border text-[11px] shadow-xs ${
                    isLight
                      ? 'bg-white/90 border-slate-200 text-slate-700'
                      : 'bg-neutral-900/80 border-neutral-800 text-neutral-300'
                  }`}
                >
                  <Sparkles size={12} className="text-emerald-500" />
                  <span>
                    {isHi ? 'सक्रिय:' : 'Active:'} <strong>{isHi ? selectedItem.nameHi : selectedItem.nameEn}</strong>
                  </span>
                </div>
              ) : null}
            </div>

            {/* Top Right Controls: Theme, Zoom & Layers */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
              {/* Quick Toggle Map Theme */}
              <button
                type="button"
                onClick={() => toggleMapTheme()}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border shadow-md ${
                  isLight
                    ? 'bg-white border-amber-300 text-amber-600 hover:bg-amber-50 shadow-amber-500/10'
                    : 'bg-neutral-900/90 border-neutral-700 text-amber-400 hover:text-white hover:bg-neutral-800'
                }`}
                title={
                  isLight
                    ? (isHi ? 'डार्क मोड पर बदलें' : 'Switch to Dark Mode')
                    : (isHi ? 'लाइट मोड (एटलस व्यू) पर बदलें' : 'Switch to Light Atlas Mode')
                }
              >
                {isLight ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Zoom Controls */}
              <div
                className={`flex flex-col gap-1 backdrop-blur-md p-1 rounded-xl border shadow-md ${
                  isLight ? 'bg-white/95 border-slate-200' : 'bg-neutral-900/90 border-neutral-700'
                }`}
              >
                <button
                  type="button"
                  onClick={zoomIn}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-neutral-800'
                  }`}
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={zoomOut}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-neutral-800'
                  }`}
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Reset Zoom"
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {/* Layer Toggles Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLayerMenu(!showLayerMenu)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors border shadow-md ${
                    showLayerMenu
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : isLight
                      ? 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-neutral-900/90 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Toggle Map Layers"
                >
                  <Layers size={15} />
                </button>

                {showLayerMenu && (
                  <div
                    className={`absolute right-0 top-10 w-48 backdrop-blur-md border rounded-xl p-2 shadow-2xl z-30 space-y-1 text-xs ${
                      isLight
                        ? 'bg-white/95 border-slate-200 text-slate-800'
                        : 'bg-neutral-900/95 border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-b ${
                        isLight ? 'text-slate-500 border-slate-100' : 'text-neutral-400 border-neutral-800'
                      }`}
                    >
                      {isHi ? 'मानचित्र परतें (Layers)' : 'Map Layers'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLayerStates(!layerStates)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left ${
                        isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <span>{isHi ? 'राज्य सीमाएं' : 'State Borders'}</span>
                      {layerStates ? (
                        <Eye size={13} className="text-emerald-500" />
                      ) : (
                        <EyeOff size={13} className="text-neutral-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayerRivers(!layerRivers)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left ${
                        isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <span>{isHi ? 'नदियाँ' : 'Rivers'}</span>
                      {layerRivers ? (
                        <Eye size={13} className="text-blue-500" />
                      ) : (
                        <EyeOff size={13} className="text-neutral-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayerPhysical(!layerPhysical)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left ${
                        isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <span>{isHi ? 'पर्वतमाला' : 'Mountain Arcs'}</span>
                      {layerPhysical ? (
                        <Eye size={13} className="text-amber-500" />
                      ) : (
                        <EyeOff size={13} className="text-neutral-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayerLines(!layerLines)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left ${
                        isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <span>{isHi ? 'कर्क व 82.5° रेखा' : 'Tropic & IST'}</span>
                      {layerLines ? (
                        <Eye size={13} className="text-rose-500" />
                      ) : (
                        <EyeOff size={13} className="text-neutral-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Map Legend (Bottom Left) */}
            <div
              className={`absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-2 backdrop-blur-md px-2.5 py-1.5 rounded-lg border text-[10px] shadow-sm ${
                isLight
                  ? 'bg-white/90 border-slate-200 text-slate-700'
                  : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
              }`}
            >
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> 🌊 River
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> ⛰️ Peak
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                <span className="w-2 h-0.5 bg-rose-500" /> 23.5° N
              </span>
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                <span className="w-0.5 h-2 bg-purple-500" /> 82.5° E
              </span>
            </div>

            {/* Map Canvas with transform scale */}
            <div
              className="relative w-full max-w-[480px] aspect-[700/800] transition-transform duration-300 ease-out select-none"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* Scalable Vector SVG Map of India (ViewBox: 0 0 700 800) */}
              <svg
                viewBox={MAP_VIEWBOX}
                className="w-full h-full drop-shadow-xl"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Light Ocean Gradient */}
                  <linearGradient id="lightOceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e0f2fe" />
                    <stop offset="60%" stopColor="#bae6fd" />
                    <stop offset="100%" stopColor="#93c5fd" />
                  </linearGradient>

                  {/* Dark Ocean Gradient */}
                  <linearGradient id="darkOceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#060914" />
                    <stop offset="50%" stopColor="#080e1e" />
                    <stop offset="100%" stopColor="#050811" />
                  </linearGradient>

                  {/* River Glow Filter */}
                  <filter id="riverGlowLight" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#0284c7" floodOpacity="0.4" />
                  </filter>
                  <filter id="riverGlowDark" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#38bdf8" floodOpacity="0.7" />
                  </filter>

                  {/* Beacon Glow */}
                  <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#fbbf24" floodOpacity="0.8" />
                  </filter>
                </defs>

                {/* Ocean Background */}
                <rect
                  x="0"
                  y="0"
                  width="700"
                  height="800"
                  fill={isLight ? 'url(#lightOceanGrad)' : 'url(#darkOceanGrad)'}
                  rx="14"
                />

                {/* Graticule Latitude & Longitude Grid Lines */}
                <g
                  stroke={isLight ? '#7dd3fc' : '#1e293b'}
                  strokeWidth={isLight ? '0.7' : '0.5'}
                  strokeDasharray="4,4"
                  opacity={isLight ? '0.7' : '0.6'}
                >
                  {/* Latitudes: 10°N, 20°N, 30°N */}
                  <line x1="30" y1="688" x2="670" y2="688" />
                  <line x1="30" y1="461" x2="670" y2="461" />
                  <line x1="30" y1="221" x2="670" y2="221" />

                  {/* Longitudes: 72°E, 80°E, 88°E */}
                  <line x1="125" y1="30" x2="125" y2="770" />
                  <line x1="292" y1="30" x2="292" y2="770" />
                  <line x1="460" y1="30" x2="460" y2="770" />
                  <line x1="627" y1="30" x2="627" y2="770" />
                </g>

                {/* Ocean Water Names */}
                <text
                  x="60"
                  y="575"
                  fill={isLight ? '#0369a1' : '#60a5fa'}
                  fontSize="13"
                  fontWeight="900"
                  letterSpacing="1"
                >
                  Arabian Sea
                </text>
                <text
                  x="60"
                  y="592"
                  fill={isLight ? '#0284c7' : '#3b82f6'}
                  fontSize="10.5"
                  fontWeight="bold"
                >
                  (अरब सागर)
                </text>

                <text
                  x="470"
                  y="535"
                  fill={isLight ? '#0369a1' : '#60a5fa'}
                  fontSize="13"
                  fontWeight="900"
                  letterSpacing="1"
                >
                  Bay of Bengal
                </text>
                <text
                  x="470"
                  y="552"
                  fill={isLight ? '#0284c7' : '#3b82f6'}
                  fontSize="10.5"
                  fontWeight="bold"
                >
                  (बंगाल की खाड़ी)
                </text>

                <text
                  x="260"
                  y="785"
                  fill={isLight ? '#0369a1' : '#60a5fa'}
                  fontSize="11.5"
                  fontWeight="900"
                  letterSpacing="2"
                >
                  INDIAN OCEAN (हिन्द महासागर)
                </text>

                <text
                  x="590"
                  y="660"
                  fill={isLight ? '#0284c7' : '#3b82f6'}
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  Andaman Sea
                </text>

                <text
                  x="130"
                  y="705"
                  fill={isLight ? '#0284c7' : '#3b82f6'}
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  Lakshadweep Sea
                </text>

                {/* Neighboring Country: Sri Lanka */}
                <path
                  d={SRI_LANKA_PATH}
                  fill={isLight ? '#f1f5f9' : '#0f172a'}
                  stroke={isLight ? '#94a3b8' : '#334155'}
                  strokeWidth="1"
                  opacity="0.9"
                />
                <text
                  x="296"
                  y="746"
                  fill={isLight ? '#475569' : '#64748b'}
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  Sri Lanka
                </text>

                {/* ================= ALL 37 STATES & UNION TERRITORIES ================= */}
                <g id="india-states-layer">
                  {INDIA_STATES.map((state) => {
                    const isHovered = hoveredState?.id === state.id;
                    const isSelected = selectedState?.id === state.id;

                    let fillColor = isLight ? '#ffffff' : '#1e293b';
                    let strokeColor = layerStates
                      ? (isLight ? '#64748b' : '#475569')
                      : 'transparent';
                    let strokeW = isLight ? '1.0' : '0.8';

                    if (isSelected) {
                      fillColor = isLight ? '#10b981' : '#065f46';
                      strokeColor = isLight ? '#047857' : '#34d399';
                      strokeW = '2.2';
                    } else if (isHovered) {
                      fillColor = isLight ? '#bbf7d0' : '#1e324d';
                      strokeColor = isLight ? '#16a34a' : '#38bdf8';
                      strokeW = '1.8';
                    }

                    return (
                      <path
                        key={state.id}
                        d={state.d}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        className="cursor-pointer transition-colors duration-150"
                        onMouseEnter={() => setHoveredState(state)}
                        onMouseLeave={() => setHoveredState(null)}
                        onClick={() => setSelectedState(isSelected ? null : state)}
                      >
                        <title>
                          {isHi ? state.nameHi : state.nameEn} ({isHi ? state.capHi : state.capEn})
                        </title>
                      </path>
                    );
                  })}
                </g>

                {/* ================= PHYSICAL GEOGRAPHIC ARCS ================= */}
                {layerPhysical && (
                  <g id="physical-regions-layer" opacity={isLight ? '0.4' : '0.35'}>
                    {/* Himalayan Arc */}
                    <path
                      d={PHYSICAL_REGIONS_PATHS[0].d}
                      fill="none"
                      stroke={isLight ? '#64748b' : '#94a3b8'}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeDasharray="5,4"
                    />
                    {activeCategory === 'mountains' && (
                      <text
                        x="280"
                        y="155"
                        fill={isLight ? '#334155' : '#cbd5e1'}
                        fontSize="9"
                        fontWeight="900"
                      >
                        Himalayan Crest (हिमालय)
                      </text>
                    )}

                    {/* Western Ghats */}
                    <path
                      d={PHYSICAL_REGIONS_PATHS[1].d}
                      fill="none"
                      stroke={isLight ? '#15803d' : '#10b981'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeDasharray="4,3"
                    />

                    {/* Eastern Ghats */}
                    <path
                      d={PHYSICAL_REGIONS_PATHS[2].d}
                      fill="none"
                      stroke={isLight ? '#0f766e' : '#14b8a6'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeDasharray="5,3"
                    />

                    {/* Aravalli Range */}
                    <path
                      d={PHYSICAL_REGIONS_PATHS[3].d}
                      fill="none"
                      stroke={isLight ? '#b45309' : '#d97706'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeDasharray="4,3"
                    />
                  </g>
                )}

                {/* ================= RIVER VECTOR PATHS ================= */}
                {layerRivers && (
                  <g id="rivers-layer">
                    {RIVERS_SVG_PATHS.map((river) => (
                      <path
                        key={river.id}
                        d={river.d}
                        fill="none"
                        stroke={isLight ? (river.id === 'brahmaputra' ? '#0891b2' : '#0284c7') : river.color}
                        strokeWidth={isLight ? '2.2' : '1.8'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={isLight ? '0.95' : '0.85'}
                        filter={isLight ? 'url(#riverGlowLight)' : 'url(#riverGlowDark)'}
                      />
                    ))}
                  </g>
                )}

                {/* ================= TROPIC OF CANCER & IST MERIDIAN ================= */}
                {layerLines && (
                  <g id="graticule-lines-layer">
                    {/* Tropic of Cancer (23.5° N) */}
                    <line
                      x1="35"
                      y1="380"
                      x2="615"
                      y2="380"
                      stroke={isLight ? '#e11d48' : '#f43f5e'}
                      strokeWidth={isLight ? '1.5' : '1.2'}
                      strokeDasharray="5,4"
                      opacity="0.9"
                    />
                    <text
                      x="38"
                      y="374"
                      fill={isLight ? '#be123c' : '#fb7185'}
                      fontSize="9"
                      fontWeight="black"
                    >
                      23.5° N (कर्क रेखा)
                    </text>

                    {/* IST Meridian (82.5° E) */}
                    <line
                      x1="345"
                      y1="45"
                      x2="345"
                      y2="670"
                      stroke={isLight ? '#7e22ce' : '#a855f7'}
                      strokeWidth={isLight ? '1.5' : '1.2'}
                      strokeDasharray="5,4"
                      opacity="0.9"
                    />
                    <text
                      x="348"
                      y="42"
                      fill={isLight ? '#6b21a8' : '#c084fc'}
                      fontSize="9"
                      fontWeight="black"
                    >
                      82.5° E (IST)
                    </text>

                    {/* Intersection Point: Koriya, Chhattisgarh (345, 380) */}
                    <circle
                      cx="345"
                      cy="380"
                      r="4.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      filter="url(#beaconGlow)"
                    />
                    {activeCategory === 'meridians' && (
                      <g>
                        <rect
                          x="355"
                          y="372"
                          width="110"
                          height="16"
                          rx="4"
                          fill={isLight ? '#fef3c7' : '#78350f'}
                          stroke="#f59e0b"
                          strokeWidth="0.8"
                        />
                        <text
                          x="360"
                          y="384"
                          fill={isLight ? '#92400e' : '#fef3c7'}
                          fontSize="8.5"
                          fontWeight="black"
                        >
                          Koriya (कोरिया)
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </svg>

              {/* Pins rendered on top based on calibrated (x%, y%) coordinates */}
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-150 z-20 ${
                      isSelected ? 'z-30 scale-110' : 'hover:scale-110'
                    }`}
                  >
                    {/* Pulsing ring around active item */}
                    {isSelected && (
                      <span className="absolute -inset-2 rounded-full bg-emerald-500/40 animate-ping pointer-events-none" />
                    )}

                    {/* Pin Icon Badge */}
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform shadow-md ${
                        isSelected
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-white ring-4 ring-emerald-400/60 scale-115 shadow-emerald-600/50'
                          : isLight
                          ? `${getPinColor()} border-white shadow-slate-900/15`
                          : `${getPinColor()} border-neutral-900 shadow-black/40`
                      }`}
                    >
                      {activeCategory === 'rivers' && <Waves size={13} className="text-white drop-shadow-xs" />}
                      {activeCategory === 'mountains' && <Mountain size={13} className="text-white drop-shadow-xs" />}
                      {activeCategory === 'passes' && <Compass size={13} className="text-white drop-shadow-xs" />}
                      {activeCategory === 'parks' && <Trees size={13} className="text-white drop-shadow-xs" />}
                      {activeCategory === 'lakes' && <Droplets size={13} className="text-white drop-shadow-xs" />}
                      {activeCategory === 'meridians' && <Globe size={13} className="text-white drop-shadow-xs" />}
                    </div>

                    {/* Pin Label: High-contrast, clean & legible on mobile/desktop */}
                    <span
                      className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap pointer-events-none transition-all ${
                        isSelected
                          ? isLight
                            ? 'z-40 px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-600 text-white border-2 border-white shadow-xl'
                            : 'z-40 px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500 text-neutral-950 border-2 border-white shadow-xl'
                          : isLight
                          ? 'z-10 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-slate-800 border border-slate-300 shadow-xs'
                          : 'z-10 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/90 text-slate-200 border border-slate-700 shadow-xs'
                      }`}
                    >
                      {isHi ? item.nameHi.split(' ')[0] : item.nameEn.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: LIST VIEW ================= */}
      {activeTabMode === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-neutral-900 dark:text-white">
                    {isHi ? item.nameHi : item.nameEn}
                  </span>
                  {item.lengthKm && (
                    <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                      {item.lengthKm} km
                    </span>
                  )}
                  {item.elevationM && (
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                      {item.elevationM} m
                    </span>
                  )}
                  {item.typeHi && (
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded">
                      {isHi ? item.typeHi.split(' ')[0] : item.typeEn.split(' ')[0]}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {item.originHi && (isHi ? `उद्गम: ${item.originHi}` : `Origin: ${item.originEn}`)}
                  {item.rangeHi && (isHi ? `पर्वतमाला: ${item.rangeHi}` : `Range: ${item.rangeEn}`)}
                  {item.connectsHi && (isHi ? `मार्ग: ${item.connectsHi}` : `Route: ${item.connectsEn}`)}
                  {item.keySpeciesHi && (isHi ? `जीव: ${item.keySpeciesHi}` : `Fauna: ${item.keySpeciesEn}`)}
                  {item.mnemonicHi && (isHi ? item.mnemonicHi : item.mnemonicEn)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= VIEW 3: RAPID MAP QUIZ ================= */}
      {activeTabMode === 'quiz' && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              {isHi ? `प्रश्न ${quizIndex + 1} / ${MAP_QUIZ_QUESTIONS.length}` : `Question ${quizIndex + 1} of ${MAP_QUIZ_QUESTIONS.length}`}
            </span>
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              {isHi ? 'स्कोर:' : 'Score:'} <strong className="text-emerald-600 dark:text-emerald-400">{quizScore}</strong>
            </span>
          </div>

          <div className="text-sm font-black text-neutral-900 dark:text-white leading-relaxed">
            {isHi ? currentQ.questionHi : currentQ.questionEn}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(isHi ? currentQ.optionsHi : currentQ.optionsEn).map((opt, idx) => {
              const isPicked = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;
              let btnClass = 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200';

              if (quizAnswered) {
                if (isCorrect) {
                  btnClass = 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
                } else if (isPicked) {
                  btnClass = 'bg-rose-600 text-white border-rose-600 shadow-sm';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={quizAnswered}
                  onClick={() => handleQuizAnswer(idx)}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${btnClass}`}
                >
                  <span className="mr-2 font-mono opacity-60">[{String.fromCharCode(65 + idx)}]</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Explanation Banner */}
          {quizAnswered && (
            <div className="p-3.5 rounded-xl bg-neutral-900 text-white space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <CheckCircle2 size={14} />
                {isHi ? 'व्याख्या (Explanation):' : 'Explanation:'}
              </div>
              <p className="text-neutral-300 leading-relaxed">
                {isHi ? currentQ.explanationHi : currentQ.explanationEn}
              </p>
              <div className="pt-2 border-t border-neutral-800 text-right">
                <button
                  type="button"
                  onClick={handleNextQuiz}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
                >
                  {isHi ? 'अगला प्रश्न' : 'Next Question'}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= BOTTOM FACT CARD (Selected Hotspot) ================= */}
      {selectedItem && activeTabMode !== 'quiz' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800/95 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-lg space-y-3">
          <div className="flex items-start justify-between gap-2 border-b dark:border-neutral-700/60 pb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-0.5">
                <Sparkles size={13} />
                {isHi ? 'विस्तृत परीक्षा तथ्य' : 'Detailed Exam Overview'}
              </div>
              <h4 className="text-base font-black text-neutral-900 dark:text-white">
                {isHi ? selectedItem.nameHi : selectedItem.nameEn}
              </h4>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {isHi ? selectedItem.nameEn : selectedItem.nameHi}
              </span>
            </div>

            {/* Quick Metrics & Copy Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyFact(selectedItem)}
                className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-emerald-500 transition-colors"
                title={isHi ? 'तथ्य कॉपी करें' : 'Copy facts'}
              >
                {copiedId === selectedItem.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>

              {selectedItem.lengthKm && (
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-mono font-black text-center">
                  {selectedItem.lengthKm} KM
                  <span className="block text-[9px] font-bold opacity-80">{isHi ? 'कुल लम्बाई' : 'Length'}</span>
                </div>
              )}
              {selectedItem.elevationM && (
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-xs font-mono font-black text-center">
                  {selectedItem.elevationM} M
                  <span className="block text-[9px] font-bold opacity-80">{isHi ? 'ऊंचाई' : 'Elevation'}</span>
                </div>
              )}
              {selectedItem.established && (
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-black text-center">
                  {selectedItem.established}
                  <span className="block text-[9px] font-bold opacity-80">{isHi ? 'स्थापना' : 'Established'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Categorical Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Origin & Outflow (for rivers) */}
            {selectedItem.originHi && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  📍 {isHi ? 'उद्गम (Source):' : 'Origin / Source:'}
                </strong>
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isHi ? selectedItem.originHi : selectedItem.originEn}
                </span>
              </div>
            )}

            {selectedItem.outflowHi && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  🌊 {isHi ? 'समाप्ति मुहाना (Outflow):' : 'Mouth / Outflow:'}
                </strong>
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isHi ? selectedItem.outflowHi : selectedItem.outflowEn}
                </span>
              </div>
            )}

            {/* Mountain Range / State */}
            {selectedItem.rangeHi && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  ⛰️ {isHi ? 'पर्वतमाला (Mountain Range):' : 'Mountain Range:'}
                </strong>
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isHi ? selectedItem.rangeHi : selectedItem.rangeEn} ({isHi ? selectedItem.stateHi : selectedItem.stateEn})
                </span>
              </div>
            )}

            {/* Pass Route */}
            {selectedItem.connectsHi && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  🛣️ {isHi ? 'जोड़ने वाला मार्ग (Connects):' : 'Connects:'}
                </strong>
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isHi ? selectedItem.connectsHi : selectedItem.connectsEn}
                </span>
              </div>
            )}

            {/* Key Fauna for Parks */}
            {selectedItem.keySpeciesHi && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  🐅 {isHi ? 'प्रमुख वन्यजीव (Key Species):' : 'Key Species:'}
                </strong>
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isHi ? selectedItem.keySpeciesHi : selectedItem.keySpeciesEn} ({isHi ? selectedItem.stateHi : selectedItem.stateEn})
                </span>
              </div>
            )}

            {/* Mnemonic for Tropic of Cancer */}
            {selectedItem.mnemonicHi && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 sm:col-span-2">
                <strong className="text-rose-700 dark:text-rose-300 block mb-0.5">
                  💡 {isHi ? 'याद रखने की ट्रिक (Mnemonic):' : 'Mnemonic Shortcut:'}
                </strong>
                <span className="text-neutral-800 dark:text-neutral-200 font-bold">
                  {isHi ? selectedItem.mnemonicHi : selectedItem.mnemonicEn}
                </span>
              </div>
            )}

            {/* Major Dams (for rivers) */}
            {selectedItem.dams && selectedItem.dams.length > 0 && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 sm:col-span-2">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  🏗️ {isHi ? 'प्रमुख बांध व परियोजनाएं:' : 'Major Dams & Projects:'}
                </strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(isHi && selectedItem.damsHi ? selectedItem.damsHi : selectedItem.dams).map((dam, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 border border-neutral-200 dark:border-neutral-700"
                    >
                      {dam}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3 Golden Exam Facts (PYQ Highlights) */}
          {(selectedItem.examFacts || selectedItem.examFactsHi) && (
            <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <BookOpen size={13} />
                {isHi ? 'परीक्षा में बार-बार पूछे जाने वाले महत्वपूर्ण बिंदु (PYQ Golden Points):' : 'High-Yield Exam Points (PYQ Golden Points):'}
              </span>
              <ul className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                {((isHi && selectedItem.examFactsHi) ? selectedItem.examFactsHi : selectedItem.examFacts).map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold leading-relaxed">•</span>
                    <span className="leading-relaxed">{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

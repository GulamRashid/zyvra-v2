import { useState, useMemo } from 'react';
import {
  MapPin, Waves, Mountain, Compass, Trees, Search, ZoomIn, ZoomOut,
  RotateCcw, Sparkles, BookOpen, ChevronRight, X, Layers, ListFilter
} from 'lucide-react';
import {
  GEO_CATEGORIES, RIVERS_DATA, MOUNTAINS_PEAKS_DATA,
  MOUNTAIN_PASSES_DATA, NATIONAL_PARKS_DATA
} from '../../../data/geographyData';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

export default function IndiaGeoMap() {
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';

  const [activeCategory, setActiveCategory] = useState('rivers'); // 'rivers' | 'mountains' | 'passes' | 'parks'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(RIVERS_DATA[0]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'

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
      default:
        return RIVERS_DATA;
    }
  }, [activeCategory]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return currentDataset;
    const q = searchQuery.toLowerCase();
    return currentDataset.filter((item) =>
      item.nameEn.toLowerCase().includes(q) ||
      item.nameHi.toLowerCase().includes(q) ||
      (item.states && item.states.some((s) => s.toLowerCase().includes(q))) ||
      (item.stateEn && item.stateEn.toLowerCase().includes(q)) ||
      (item.stateHi && item.stateHi.toLowerCase().includes(q))
    );
  }, [currentDataset, searchQuery]);

  const handleSelect = (item) => {
    setSelectedItem(item);
  };

  const resetZoom = () => setZoomLevel(1);
  const zoomIn = () => setZoomLevel((z) => Math.min(1.8, Number((z + 0.2).toFixed(1))));
  const zoomOut = () => setZoomLevel((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))));

  const getPinColor = () => {
    switch (activeCategory) {
      case 'rivers':
        return 'bg-blue-600 border-blue-200 text-white shadow-blue-500/50';
      case 'mountains':
        return 'bg-amber-600 border-amber-200 text-white shadow-amber-500/50';
      case 'passes':
        return 'bg-indigo-600 border-indigo-200 text-white shadow-indigo-500/50';
      case 'parks':
        return 'bg-emerald-600 border-emerald-200 text-white shadow-emerald-500/50';
      default:
        return 'bg-purple-600 border-purple-200 text-white shadow-purple-500/50';
    }
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
            {isHi ? 'भारत का भूगोल एवं मानचित्र (India Geo-Map Explorer)' : 'India Geography & Interactive Map Explorer'}
          </h3>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'map'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'मानचित्र दृश्य' : 'Map View'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'सूची दृश्य' : 'List View'}
          </button>
        </div>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="space-y-2.5">
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
                    NATIONAL_PARKS_DATA[0];
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
                <span>{isHi ? cat.labelHi : cat.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Live Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isHi ? 'नदी, पर्वत, दर्रा या राष्ट्रीय उद्यान खोजें (उदा. Ganga, K2, Corbett)...' : 'Search river, peak, pass or national park...'}
            className="w-full text-xs font-bold pl-9 pr-8 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ================= VIEW 1: INTERACTIVE MAP ================= */}
      {viewMode === 'map' && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 p-2 sm:p-4 min-h-[380px] flex items-center justify-center">
            {/* Zoom Controls */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-neutral-800/90 backdrop-blur-md p-1 rounded-xl border border-neutral-700 shadow-md">
              <button
                type="button"
                onClick={zoomIn}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:bg-neutral-700 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={zoomOut}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:bg-neutral-700 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Map Canvas with transform scale */}
            <div
              className="relative w-full max-w-[460px] aspect-[4/4.6] transition-transform duration-300 ease-out"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* Scalable Vector SVG Map of India (Simplified Accurate Silhouette & River Basins) */}
              <svg
                viewBox="0 0 100 115"
                className="w-full h-full drop-shadow-2xl"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background Water (Arabian Sea, Bay of Bengal, Indian Ocean) */}
                <rect x="0" y="0" width="100" height="115" fill="#0c1322" rx="6" />

                {/* Ocean Waves Accent Lines */}
                <path d="M 5 95 Q 15 90 25 95 T 45 95" fill="none" stroke="#172554" strokeWidth="0.4" strokeDasharray="1,1" />
                <path d="M 65 95 Q 75 90 85 95 T 95 95" fill="none" stroke="#172554" strokeWidth="0.4" strokeDasharray="1,1" />
                <text x="12" y="75" fill="#1e3a8a" fontSize="3" fontWeight="bold">Arabian Sea</text>
                <text x="68" y="75" fill="#1e3a8a" fontSize="3" fontWeight="bold">Bay of Bengal</text>
                <text x="35" y="110" fill="#1e3a8a" fontSize="2.8" fontWeight="bold">Indian Ocean</text>

                {/* India Landmass Vector Polygon */}
                <path
                  d="
                    M 28 8
                    L 34 11 L 38 18 L 46 25 L 53 28 L 65 31 L 70 34 L 75 30 L 88 30 L 92 36 L 85 40 L 78 40 L 72 45 L 68 53
                    L 63 60 L 58 70 L 51 83 L 42 98 L 38 88 L 34 76 L 31 66 L 24 58 L 22 50 L 26 44 L 28 35 L 24 28 L 26 18 Z
                  "
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth="0.8"
                />

                {/* Regional Shading Accents (Himalayas, Deccan Plateau, Western Ghats) */}
                {/* Himalayan Arc */}
                <path
                  d="M 28 15 Q 50 25 72 34"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                {/* Western Ghats Strip */}
                <path
                  d="M 33 62 Q 36 78 40 88"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="1.2"
                  opacity="0.3"
                />

                {/* Ganga Basin River Curve Line */}
                <path
                  d="M 44 28 Q 50 36 68 50"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                  opacity="0.6"
                />

                {/* Brahmaputra Curve */}
                <path
                  d="M 88 31 Q 80 34 72 42"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                  opacity="0.6"
                />

                {/* Narmada Rift Line */}
                <path
                  d="M 50 51 L 28 53"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                  opacity="0.5"
                />

                {/* Godavari Basin Curve */}
                <path
                  d="M 35 60 Q 48 62 60 67"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
              </svg>

              {/* Pins rendered on top based on (x%, y%) coordinates */}
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-200 z-10 ${
                      isSelected ? 'scale-125 z-20' : 'hover:scale-115'
                    }`}
                  >
                    {/* Pulsing ring around active item */}
                    {isSelected && (
                      <span className="absolute -inset-1.5 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
                    )}

                    {/* Pin Icon Badge */}
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-md ${
                        isSelected
                          ? 'bg-white text-neutral-900 border-white scale-110 shadow-white/40'
                          : getPinColor()
                      }`}
                    >
                      {activeCategory === 'rivers' && <Waves size={11} />}
                      {activeCategory === 'mountains' && <Mountain size={11} />}
                      {activeCategory === 'passes' && <Compass size={11} />}
                      {activeCategory === 'parks' && <Trees size={11} />}
                    </div>

                    {/* Compact Label */}
                    <span
                      className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap shadow-md pointer-events-none transition-all ${
                        isSelected
                          ? 'bg-white text-neutral-900 opacity-100'
                          : 'bg-neutral-900/90 text-neutral-200 opacity-0 group-hover:opacity-100'
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
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
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
                  {item.established && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      Est. {item.established}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {item.originHi && (isHi ? `उद्गम: ${item.originHi}` : `Origin: ${item.originEn}`)}
                  {item.rangeHi && (isHi ? `पर्वत: ${item.rangeHi}` : `Range: ${item.rangeEn}`)}
                  {item.connectsHi && (isHi ? `मार्ग: ${item.connectsHi}` : `Route: ${item.connectsEn}`)}
                  {item.keySpeciesHi && (isHi ? `प्रमुख जीव: ${item.keySpeciesHi}` : `Fauna: ${item.keySpeciesEn}`)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= BOTTOM FACT CARD (Selected Hotspot) ================= */}
      {selectedItem && (
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

            {/* Quick Metrics Badge */}
            <div className="text-right shrink-0">
              {selectedItem.lengthKm && (
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-mono font-black">
                  {selectedItem.lengthKm} KM
                  <span className="block text-[9px] font-bold opacity-80">{isHi ? 'कुल लम्बाई' : 'Length'}</span>
                </div>
              )}
              {selectedItem.elevationM && (
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-xs font-mono font-black">
                  {selectedItem.elevationM} M
                  <span className="block text-[9px] font-bold opacity-80">{isHi ? 'ऊंचाई' : 'Elevation'}</span>
                </div>
              )}
              {selectedItem.established && (
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-black">
                  {selectedItem.established}
                  <span className="block text-[9px] font-bold opacity-80">{isHi ? 'स्थापना वर्ष' : 'Established'}</span>
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

            {/* Major Dams (for rivers) */}
            {selectedItem.dams && selectedItem.dams.length > 0 && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 sm:col-span-2">
                <strong className="text-neutral-900 dark:text-white block mb-0.5">
                  🏗️ {isHi ? 'प्रमुख बांध व परियोजनाएं:' : 'Major Dams & Projects:'}
                </strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedItem.dams.map((dam, idx) => (
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
          {selectedItem.examFacts && selectedItem.examFacts.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <BookOpen size={13} />
                {isHi ? 'परीक्षा में बार-बार पूछे जाने वाले बिंदु (PYQ Golden Points):' : 'High-Yield Exam Points (PYQ):'}
              </span>
              <ul className="space-y-1 text-xs text-neutral-700 dark:text-neutral-300">
                {selectedItem.examFacts.map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{fact}</span>
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

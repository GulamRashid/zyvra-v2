import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Brain,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Edit,
  Eye,
  FileText,
  Flame,
  Globe2,
  GripVertical,
  HelpCircle,
  Layers,
  Lock,
  Minus,
  Percent,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Unlock,
  Wrench,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

// Comprehensive default tools list matching mockups
const INITIAL_TOOLS = [
  {
    id: 'calculator',
    name: 'Calculator',
    category: 'Math Tools',
    iconName: 'Calculator',
    iconChar: '🧮',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: true,
    order: 1
  },
  {
    id: 'percentage',
    name: 'Percentage',
    category: 'Math Tools',
    iconName: 'Percent',
    iconChar: '%',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: true,
    order: 2
  },
  {
    id: 'article-finder',
    name: 'Article Finder',
    category: 'Polity Tools',
    iconName: 'FileText',
    iconChar: '📄',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 49,
    active: true,
    popular: true,
    order: 3
  },
  {
    id: 'formula-library',
    name: 'Formula Library',
    category: 'Math Tools',
    iconName: 'Layers',
    iconChar: 'Σ',
    accessType: 'paid',
    purchaseType: 'Full Unlock',
    price: 99,
    active: true,
    popular: true,
    order: 4
  },
  {
    id: 'flashcards',
    name: 'Flashcards',
    category: 'Memory Tools',
    iconName: 'Brain',
    iconChar: '🧠',
    accessType: 'free',
    purchaseType: 'Limited (5/day)',
    price: 0,
    active: true,
    popular: true,
    order: 5
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    category: 'Science Tools',
    iconName: 'RotateCcw',
    iconChar: '🔄',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: false,
    order: 6
  },
  {
    id: 'polity-articles',
    name: 'Polity Articles (Complete)',
    category: 'Polity Tools',
    iconName: 'BookOpen',
    iconChar: '🏛️',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 149,
    active: true,
    popular: false,
    order: 7
  },
  {
    id: 'reasoning-solver',
    name: 'Reasoning Solver',
    category: 'Reasoning Tools',
    iconName: 'Zap',
    iconChar: '🧩',
    accessType: 'paid',
    purchaseType: 'Bundle Only',
    price: 0,
    active: true,
    popular: false,
    order: 8
  },
  {
    id: 'study-timer',
    name: 'Study Timer',
    category: 'Other Tools',
    iconName: 'Clock',
    iconChar: '⏱️',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: false,
    order: 9
  },
  {
    id: 'sticky-notes',
    name: 'Sticky Notes (Pro)',
    category: 'Other Tools',
    iconName: 'Edit',
    iconChar: '📝',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 29,
    active: true,
    popular: false,
    order: 10
  }
];

export default function AdminTools() {
  const { supabase } = useAuth();

  const [activeTab, setActiveTab] = useState('tools'); // 'layout' | 'tools' | 'categories' | 'content' | 'pricing' | 'bundles' | 'analytics'
  const [tools, setTools] = useState(() => {
    try {
      const saved = localStorage.getItem('zyvra_admin_toolbox_tools');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_TOOLS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');

  // Selected tool for edit
  const [selectedToolId, setSelectedToolId] = useState('calculator');
  const selectedTool = useMemo(() => {
    return tools.find((t) => t.id === selectedToolId) || tools[0];
  }, [tools, selectedToolId]);

  // Selected Tool Form State
  const [editAccessType, setEditAccessType] = useState('free');
  const [editPurchaseType, setEditPurchaseType] = useState('Always Free');
  const [editPrice, setEditPrice] = useState(0);
  const [editLimitDaily, setEditLimitDaily] = useState(false);
  const [editDailyCount, setEditDailyCount] = useState(5);
  const [editIncludeToolkit, setEditIncludeToolkit] = useState(true);

  // Global Access Rules Toggles
  const [rules, setRules] = useState({
    showFreeToGuest: true,
    showPaidLocked: true,
    allowIndividualPurchase: true,
    allowBundlePurchase: true,
    showUpgradeProBanner: true
  });

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState(null);

  // Sync edit form with selectedTool
  useEffect(() => {
    if (selectedTool) {
      setEditAccessType(selectedTool.accessType || 'free');
      setEditPurchaseType(selectedTool.purchaseType || 'Always Free');
      setEditPrice(selectedTool.price || 0);
      setEditLimitDaily(String(selectedTool.purchaseType || '').includes('Limited'));
      setEditDailyCount(5);
      setEditIncludeToolkit(true);
    }
  }, [selectedTool]);

  // Save changes locally and to Supabase
  const persistTools = (updatedTools) => {
    setTools(updatedTools);
    try {
      localStorage.setItem('zyvra_admin_toolbox_tools', JSON.stringify(updatedTools));
    } catch (_) {}
    if (supabase) {
      supabase.from('platform_settings').upsert({
        setting_key: 'study_toolbox_config',
        key: 'study_toolbox_config',
        setting_value: updatedTools
      }, { onConflict: 'setting_key' }).catch((err) => console.warn('Cloud tools sync error:', err));
    }
  };

  // Toggle active status
  const toggleToolActive = (toolId) => {
    const updated = tools.map((t) => (t.id === toolId ? { ...t, active: !t.active } : t));
    persistTools(updated);
  };

  // Update selected tool access
  const handleUpdateAccess = () => {
    const updated = tools.map((t) => {
      if (t.id === selectedToolId) {
        return {
          ...t,
          accessType: editAccessType,
          purchaseType: editLimitDaily ? `Limited (${editDailyCount}/day)` : editPurchaseType,
          price: editAccessType === 'free' ? 0 : Number(editPrice) || 49
        };
      }
      return t;
    });
    persistTools(updated);
  };

  // Drag and Drop handlers
  const onDragStart = (index) => {
    setDraggedIdx(index);
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const reordered = [...tools];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(index, 0, moved);
    setDraggedIdx(index);
    persistTools(reordered);
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
  };

  // Filtered tools for table
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!tool.name.toLowerCase().includes(q) && !tool.category.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
      if (accessFilter !== 'all' && tool.accessType !== accessFilter) return false;
      return true;
    });
  }, [tools, searchQuery, categoryFilter, accessFilter]);

  // Derived metrics
  const totalCount = tools.length;
  const freeCount = tools.filter((t) => t.accessType === 'free').length;
  const paidCount = tools.filter((t) => t.accessType === 'paid').length;
  const bundleCount = tools.filter((t) => t.purchaseType === 'Bundle Only').length;

  return (
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] p-4 sm:p-6 space-y-5">
      {/* Top Header & Breadcrumbs (Matching Mockup 1794580723825.png) */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 font-bold">
          <span>Tools (Toolbox)</span>
          <ChevronRight size={13} />
          <span className="text-white">Toolbox Manager</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-400" />
              <span>Student Toolbox Manager</span>
            </h1>
            <p className="text-xs text-emerald-300/80 mt-0.5">
              Create, organize and manage study tools, access, pricing and bundles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Eye size={14} />
              <span>View (Student)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const name = prompt('Enter new tool name:');
                if (name) {
                  const newTool = {
                    id: name.toLowerCase().replace(/\s+/g, '-'),
                    name,
                    category: 'Other Tools',
                    iconChar: '🛠️',
                    accessType: 'free',
                    purchaseType: 'Always Free',
                    price: 0,
                    active: true,
                    popular: false,
                    order: tools.length + 1
                  };
                  persistTools([...tools, newTool]);
                }
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
            >
              <Plus size={15} />
              <span>Add Tool</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#072117]/90 border border-emerald-500/20 backdrop-blur-md overflow-x-auto select-none">
        {[
          ['layout', 'Layout & Customize'],
          ['tools', 'Tools'],
          ['categories', 'Categories'],
          ['content', 'Tool Content'],
          ['pricing', 'Access & Pricing'],
          ['bundles', 'Bundles & Offers'],
          ['analytics', 'Analytics'],
          ['settings', 'Settings']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
              activeTab === key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 5 Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3.5">
          <div className="text-[10px] uppercase font-bold text-emerald-400/70">Total Tools</div>
          <div className="text-xl font-black text-white mt-0.5">{totalCount}</div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3.5">
          <div className="text-[10px] uppercase font-bold text-emerald-400/70 flex items-center gap-1">
            <Unlock size={12} className="text-[#22c55e]" /> Free Tools
          </div>
          <div className="text-xl font-black text-white mt-0.5">
            {freeCount} <span className="text-xs text-[#22c55e] font-bold">({Math.round((freeCount / totalCount) * 100)}%)</span>
          </div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3.5">
          <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
            <Lock size={12} className="text-amber-400" /> Paid Tools
          </div>
          <div className="text-xl font-black text-white mt-0.5">
            {paidCount} <span className="text-xs text-amber-300 font-bold">({Math.round((paidCount / totalCount) * 100)}%)</span>
          </div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3.5">
          <div className="text-[10px] uppercase font-bold text-purple-400">In Bundles</div>
          <div className="text-xl font-black text-purple-300 mt-0.5">
            {bundleCount || 8} <span className="text-xs text-purple-400 font-bold">(14%)</span>
          </div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3.5">
          <div className="text-[10px] uppercase font-bold text-emerald-400/70">Revenue (Tools)</div>
          <div className="text-xl font-black text-[#22c55e] mt-0.5">
            ₹12,480 <span className="text-xs text-[#22c55e] font-bold">(+24.6%)</span>
          </div>
        </div>
      </div>

      {/* 3-Column Manager Layout: Table (5 cols) | Middle Controls (3 cols) | Live Mobile Preview (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ======================================================== */}
        {/* COLUMN 1 (5 Cols): Tools Table with Drag and Drop */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-4 space-y-3 flex flex-col h-[700px]">
          {/* Table Search & Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60" />
              <input
                type="text"
                placeholder="Search tools by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/25 text-white text-xs focus:outline-none"
              />
            </div>

            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              className="px-2 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/25 text-emerald-300 text-xs font-bold focus:outline-none"
            >
              <option value="all">All Access</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Tools Reorderable Drag-and-Drop Table */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredTools.map((tool, index) => {
              const isSelected = selectedToolId === tool.id;

              return (
                <div
                  key={tool.id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  onClick={() => setSelectedToolId(tool.id)}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-md'
                      : 'bg-emerald-950/40 border-emerald-500/15 hover:border-emerald-500/35 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GripVertical size={15} className="text-emerald-500/50 cursor-grab active:cursor-grabbing shrink-0" />
                    <span className="text-xs font-black text-emerald-400/80 w-4 shrink-0">{index + 1}</span>
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm shrink-0">
                      {tool.iconChar}
                    </span>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white truncate">{tool.name}</h4>
                      <p className="text-[10px] text-emerald-400/70 truncate">{tool.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Access pill */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      tool.accessType === 'free'
                        ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}>
                      {tool.accessType === 'free' ? 'Free' : `Paid (₹${tool.price})`}
                    </span>

                    {/* Active toggle switch */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleToolActive(tool.id);
                      }}
                      className="text-emerald-400 hover:text-white"
                      title={tool.active ? 'Disable' : 'Enable'}
                    >
                      {tool.active ? (
                        <ToggleRight size={22} className="text-[#22c55e]" />
                      ) : (
                        <ToggleLeft size={22} className="text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2 (3 Cols): Selected Tool Access & Pricing Config */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-4 space-y-4 flex flex-col justify-between h-[700px] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Settings size={14} />
                <span>Access & Pricing ({selectedTool?.name})</span>
              </h3>
            </div>

            {/* Access Type Switch */}
            <div>
              <label className="text-[11px] font-bold text-emerald-300 block mb-1.5">Access Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['free', 'Free'],
                  ['paid', 'Paid'],
                  ['bundle', 'Bundle']
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setEditAccessType(type);
                      if (type === 'free') setEditPrice(0);
                      else if (type === 'paid' && editPrice === 0) setEditPrice(49);
                    }}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      editAccessType === type
                        ? 'bg-emerald-500/30 border-emerald-400 text-white'
                        : 'bg-emerald-950/60 border-emerald-500/20 text-emerald-400/80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Purchase Type */}
            <div>
              <label className="text-[11px] font-bold text-emerald-300 block mb-1.5">Purchase Type</label>
              <select
                value={editPurchaseType}
                onChange={(e) => setEditPurchaseType(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
              >
                <option value="Always Free">Always Free</option>
                <option value="Single Purchase">Single Purchase</option>
                <option value="Full Unlock">Full Unlock</option>
                <option value="Bundle Only">Bundle Only</option>
              </select>
            </div>

            {editAccessType === 'paid' && (
              <div>
                <label className="text-[11px] font-bold text-emerald-300 block mb-1.5">Price (₹)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white text-xs font-black focus:outline-none"
                />
              </div>
            )}

            {/* Usage Limit Toggle */}
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/20 space-y-1.5">
              <label className="text-[11px] font-bold text-emerald-300 block">Usage Limit (Optional)</label>
              <div className="flex items-center gap-3 text-xs font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="usagelimit"
                    checked={!editLimitDaily}
                    onChange={() => setEditLimitDaily(false)}
                    className="accent-emerald-400"
                  />
                  <span>Unlimited</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="usagelimit"
                    checked={editLimitDaily}
                    onChange={() => setEditLimitDaily(true)}
                    className="accent-emerald-400"
                  />
                  <span>Limited (5/day)</span>
                </label>
              </div>
            </div>

            {/* Global Access Rules Toggles */}
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/20 space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                Access Rules (Global)
              </h4>
              <div className="space-y-1.5 text-xs font-semibold">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span>Show Free Tools to Guest</span>
                  <input
                    type="checkbox"
                    checked={rules.showFreeToGuest}
                    onChange={(e) => setRules((r) => ({ ...r, showFreeToGuest: e.target.checked }))}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span>Show Paid Tools (Locked)</span>
                  <input
                    type="checkbox"
                    checked={rules.showPaidLocked}
                    onChange={(e) => setRules((r) => ({ ...r, showPaidLocked: e.target.checked }))}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span>Allow Bundle Purchase</span>
                  <input
                    type="checkbox"
                    checked={rules.allowBundlePurchase}
                    onChange={(e) => setRules((r) => ({ ...r, allowBundlePurchase: e.target.checked }))}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleUpdateAccess}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-1.5"
            >
              <Save size={14} />
              <span>Update Access (Live Preview)</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3 (4 Cols): Live Mobile Preview Component */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-2 flex items-center gap-1.5">
            <Eye size={14} className="text-amber-400" />
            <span>Student View (Live Preview)</span>
          </div>

          {/* Smartphone Hardware Frame */}
          <div className="w-[310px] sm:w-[330px] h-[660px] bg-black rounded-[42px] border-[6px] border-neutral-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-3 relative flex flex-col overflow-hidden">
            {/* Top Phone Speaker Notch */}
            <div className="absolute top-2 inset-x-0 mx-auto w-24 h-4 bg-neutral-900 rounded-full z-40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-neutral-950 border border-neutral-800 mr-2" />
              <div className="w-8 h-1 bg-neutral-800 rounded-full" />
            </div>

            {/* Inner Phone Screen Content */}
            <div className="w-full h-full bg-[#04140e] rounded-[34px] overflow-y-auto no-scrollbar text-white flex flex-col justify-between pt-4 pb-2 relative">
              {/* Phone Status Bar */}
              <div className="px-4 flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-2">
                <span>10:24</span>
                <div className="flex items-center gap-1.5">
                  <Flame size={11} className="text-amber-400 fill-amber-400" />
                  <span>12</span>
                  <span>82%</span>
                </div>
              </div>

              {/* Study Toolbox Header */}
              <div className="px-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-black text-sm">⚡</span>
                    <span className="font-extrabold text-xs">Zyvra</span>
                  </div>
                  <Search size={13} className="text-neutral-400" />
                </div>

                {/* Banner */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-[#06291d] to-[#041911] border border-emerald-500/30 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center text-lg shrink-0">
                    🧰
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white">Zyvra Study Toolbox</h4>
                    <p className="text-[9px] text-emerald-300/80">Smart Tools for Preparation</p>
                  </div>
                </div>

                {/* Filter tags */}
                <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {['Calculate', 'Convert', 'Find', 'Learn'].map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/80 border border-emerald-500/25 text-emerald-300 shrink-0">
                      ✓ {tag}
                    </span>
                  ))}
                </div>

                {/* Popular Tools Shelf (Reactively updates with Lock / Free badges!) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-white">
                    <span className="flex items-center gap-1">
                      <Flame size={12} className="text-amber-400 fill-amber-400" /> Popular Tools
                    </span>
                    <span className="text-[9px] text-emerald-400">View All →</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {tools.slice(0, 3).map((tool) => {
                      const isPaid = tool.accessType === 'paid';
                      const isLocked = isPaid && rules.showPaidLocked;

                      return (
                        <div
                          key={tool.id}
                          className="p-2 rounded-xl bg-[#072117] border border-emerald-500/20 flex flex-col items-center text-center relative group"
                        >
                          <span className="text-lg mb-1">{tool.iconChar}</span>
                          <span className="text-[10px] font-bold text-white truncate w-full">{tool.name}</span>

                          {/* Dynamic Badge (Reactively shows Free or Pro/Locked) */}
                          {isPaid ? (
                            <span className="mt-1 px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                              {isLocked ? <Lock size={8} /> : 'Pro 👑'}
                            </span>
                          ) : (
                            <span className="mt-1 px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-[#22c55e]/20 text-[#22c55e]">
                              Free
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tools By Subject List (Reactively showing lock badges) */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-white block">Tools by Subject</span>
                  <div className="space-y-1">
                    {[
                      { title: 'Math Tools', desc: 'Ratio, SI/CI, Profit-Loss', isLocked: false, icon: '➕' },
                      { title: 'Polity Tools', desc: 'Articles, Amendments', isLocked: rules.showPaidLocked && tools.some((t) => t.category === 'Polity Tools' && t.accessType === 'paid'), icon: '🏛️' },
                      { title: 'Reasoning Tools', desc: 'Coding, Syllogism, Puzzles', isLocked: rules.showPaidLocked && tools.some((t) => t.category === 'Reasoning Tools' && t.accessType === 'paid'), icon: '🧩' }
                    ].map((subject) => (
                      <div
                        key={subject.title}
                        className="p-2 rounded-xl bg-[#072117] border border-emerald-500/20 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{subject.icon}</span>
                          <div>
                            <div className="text-[10px] font-bold text-white flex items-center gap-1">
                              <span>{subject.title}</span>
                              {subject.isLocked && <Lock size={9} className="text-amber-400" />}
                            </div>
                            <div className="text-[8px] text-emerald-400/70">{subject.desc}</div>
                          </div>
                        </div>
                        <ChevronRight size={12} className="text-emerald-400/50" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phone Bottom Mini Nav */}
              <div className="px-4 py-2 border-t border-emerald-800/30 flex items-center justify-between text-[9px] text-emerald-400/70">
                <span className="text-emerald-300">Home</span>
                <span className="text-emerald-300">Explore</span>
                <span className="text-emerald-300">Tests</span>
                <span className="text-amber-300 font-extrabold">Toolbox</span>
                <span className="text-emerald-300">Profile</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  Flame,
  GripVertical,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Unlock,
  Wrench
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

// Canonical fallback tools if platform_settings has not been populated yet
const DEFAULT_SYSTEM_TOOLS = [
  {
    id: 'pomodoro',
    name: 'Pomodoro Study Timer',
    category: 'Productivity',
    iconName: 'Clock',
    iconChar: '⏱️',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: true,
    order: 1
  },
  {
    id: 'math-shortcuts',
    name: 'Speed Math & Mental Calculation',
    category: 'Quantitative Aptitude',
    iconName: 'Calculator',
    iconChar: '🧮',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: true,
    order: 2
  },
  {
    id: 'polity-articles',
    name: 'Constitution & Articles Quick Navigator',
    category: 'General Studies',
    iconName: 'BookOpen',
    iconChar: '🏛️',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: true,
    order: 3
  },
  {
    id: 'formula-sheet',
    name: 'Reasoning & Logic Formula Hub',
    category: 'Reasoning',
    iconName: 'Brain',
    iconChar: '🧠',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    active: true,
    popular: true,
    order: 4
  }
];

export default function AdminTools() {
  const { supabase } = useAuth();

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [selectedToolId, setSelectedToolId] = useState(null);

  // Edit form state
  const [editAccessType, setEditAccessType] = useState('free');
  const [editPurchaseType, setEditPurchaseType] = useState('Always Free');
  const [editPrice, setEditPrice] = useState(0);
  const [editLimitDaily, setEditLimitDaily] = useState(false);
  const [editDailyCount, setEditDailyCount] = useState(5);

  // Global Access Rules state
  const [rules, setRules] = useState({
    showFreeToGuest: true,
    showPaidLocked: true,
    allowBundlePurchase: true
  });

  // Drag and drop tracking
  const [draggedIdx, setDraggedIdx] = useState(null);

  // Save / notification status
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Add Tool Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolCategory, setNewToolCategory] = useState('Quantitative Aptitude');
  const [newToolAccessType, setNewToolAccessType] = useState('free');
  const [newToolPrice, setNewToolPrice] = useState(0);

  // Fetch real tools from Supabase platform_settings
  const fetchToolsConfig = async () => {
    if (!supabase) {
      setTools(DEFAULT_SYSTEM_TOOLS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'study_toolbox_config')
        .maybeSingle();

      if (!error && data?.setting_value && Array.isArray(data.setting_value) && data.setting_value.length > 0) {
        // Map database setting to UI model
        const mapped = data.setting_value.map((item, index) => ({
          id: item.id || `tool-${index}`,
          name: item.name || item.title || 'Untitled Tool',
          category: item.category || 'General',
          iconName: item.icon || 'Wrench',
          iconChar: item.icon === 'Clock' ? '⏱️' : item.icon === 'Calculator' ? '🧮' : item.icon === 'BookOpen' ? '🏛️' : item.icon === 'Brain' ? '🧠' : '🔧',
          accessType: item.access_type || item.accessType || (item.price > 0 ? 'paid' : 'free'),
          purchaseType: item.purchaseType || (item.price > 0 ? 'Single Purchase' : 'Always Free'),
          price: Number(item.price) || 0,
          active: item.enabled !== false && item.active !== false,
          popular: item.popular ?? (index < 3),
          order: index + 1
        }));
        setTools(mapped);
        if (mapped.length > 0 && !selectedToolId) {
          setSelectedToolId(mapped[0].id);
        }
      } else {
        setTools(DEFAULT_SYSTEM_TOOLS);
        if (!selectedToolId) setSelectedToolId(DEFAULT_SYSTEM_TOOLS[0].id);
      }
    } catch (err) {
      console.warn('Unable to fetch toolbox config:', err);
      setTools(DEFAULT_SYSTEM_TOOLS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolsConfig();
  }, [supabase]);

  // Sync edit form when selectedTool changes
  const selectedTool = useMemo(() => {
    return tools.find((t) => t.id === selectedToolId) || tools[0] || null;
  }, [tools, selectedToolId]);

  useEffect(() => {
    if (selectedTool) {
      setEditAccessType(selectedTool.accessType || 'free');
      setEditPurchaseType(selectedTool.purchaseType || 'Always Free');
      setEditPrice(selectedTool.price ?? 0);
      setEditLimitDaily(String(selectedTool.purchaseType || '').includes('Limited'));
    }
  }, [selectedTool]);

  // Persist Tools Array to Supabase & localStorage
  const persistToolsToDatabase = async (updatedTools) => {
    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    setTools(updatedTools);

    try {
      localStorage.setItem('zyvra_admin_toolbox_tools', JSON.stringify(updatedTools));
    } catch (_) {}

    // Transform back to schema expected by platform_settings
    const dbPayload = updatedTools.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      icon: t.iconName,
      access_type: t.accessType,
      purchaseType: t.purchaseType,
      price: t.price,
      enabled: t.active,
      popular: t.popular,
      validity_days: 30
    }));

    if (supabase) {
      try {
        const { error } = await supabase.from('platform_settings').upsert({
          setting_key: 'study_toolbox_config',
          key: 'study_toolbox_config',
          setting_value: dbPayload
        }, { onConflict: 'setting_key' });

        if (error) throw error;
        setStatusMessage({ text: 'Toolbox settings saved to database!', type: 'success' });
      } catch (err) {
        console.error('Save to cloud failed:', err);
        setStatusMessage({ text: err.message || 'Saved locally (cloud sync error).', type: 'error' });
      }
    } else {
      setStatusMessage({ text: 'Saved locally.', type: 'success' });
    }

    setSaving(false);
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 3500);
  };

  // Toggle tool active status
  const toggleToolActive = (toolId) => {
    const updated = tools.map((t) => (t.id === toolId ? { ...t, active: !t.active } : t));
    persistToolsToDatabase(updated);
  };

  // Update selected tool access
  const handleUpdateAccess = () => {
    if (!selectedTool) return;
    const updated = tools.map((t) => {
      if (t.id === selectedTool.id) {
        return {
          ...t,
          accessType: editAccessType,
          purchaseType: editLimitDaily ? `Limited (${editDailyCount}/day)` : editPurchaseType,
          price: editAccessType === 'free' ? 0 : Number(editPrice) || 49
        };
      }
      return t;
    });
    persistToolsToDatabase(updated);
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
    setTools(reordered);
  };

  const onDragEnd = () => {
    setDraggedIdx(null);
    persistToolsToDatabase(tools);
  };

  // Add Tool action
  const handleAddTool = (e) => {
    e.preventDefault();
    if (!newToolName.trim()) return;

    const id = newToolName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newTool = {
      id,
      name: newToolName.trim(),
      category: newToolCategory,
      iconName: 'Wrench',
      iconChar: '🔧',
      accessType: newToolAccessType,
      purchaseType: newToolAccessType === 'free' ? 'Always Free' : 'Single Purchase',
      price: newToolAccessType === 'free' ? 0 : Number(newToolPrice) || 49,
      active: true,
      popular: false,
      order: tools.length + 1
    };

    const next = [...tools, newTool];
    persistToolsToDatabase(next);
    setSelectedToolId(id);
    setAddModalOpen(false);
    setNewToolName('');
  };

  // Delete Tool action
  const handleDeleteTool = (toolId) => {
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return;
    if (!confirm(`Are you sure you want to delete "${tool.name}"?`)) return;

    const next = tools.filter((t) => t.id !== toolId);
    persistToolsToDatabase(next);
    if (selectedToolId === toolId) {
      setSelectedToolId(next[0]?.id || null);
    }
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

  // Real derived metrics
  const totalCount = tools.length;
  const freeCount = tools.filter((t) => t.accessType === 'free').length;
  const paidCount = tools.filter((t) => t.accessType === 'paid').length;
  const activeCount = tools.filter((t) => t.active).length;

  return (
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] p-4 sm:p-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
            <span>Tools (Toolbox)</span>
            <ChevronRight size={13} />
            <span className="text-white">Toolbox Manager</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-400" />
            <span>Student Toolbox Manager</span>
          </h1>
          <p className="text-xs text-emerald-300/80 mt-0.5">
            Organize study tools, drag to reorder, configure access, and test live mobile behavior.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchToolsConfig}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
          >
            <Plus size={14} />
            <span>+ Add Tool</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage.text && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage({ text: '', type: '' })}>✕</button>
        </div>
      )}

      {/* Real Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <Layers size={14} /> Total Tools
          </div>
          <div className="text-xl font-black text-white">{totalCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">In Database Config</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <Unlock size={14} /> Free Tools
          </div>
          <div className="text-xl font-black text-emerald-400">{freeCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">Always Free Access</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
            <Lock size={14} /> Paid / Pro Tools
          </div>
          <div className="text-xl font-black text-amber-400">{paidCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">Require Purchase or Pro</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <CheckCircle2 size={14} /> Active for Students
          </div>
          <div className="text-xl font-black text-white">{activeCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">Visible in Toolbox</div>
        </div>
      </div>

      {/* Main 3-Column Working Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ======================================================== */}
        {/* COLUMN 1 (5 Cols): Reorderable Tools Table */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 flex flex-col h-[440px] lg:h-[700px]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <GripVertical size={14} className="text-amber-400" />
              <span>Toolbox Layout (Drag to Reorder)</span>
            </div>
            <span className="text-[10px] text-emerald-400/80">
              {filteredTools.length} of {tools.length}
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-emerald-400/60" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white text-xs placeholder:text-emerald-400/50 focus:outline-none focus:border-amber-400"
              />
            </div>
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              className="px-2 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-bold focus:outline-none"
            >
              <option value="all">All Access</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Reorderable Tools List */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
            {loading ? (
              <LoadingSkeleton count={5} />
            ) : filteredTools.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-400/70">
                No tools matching search filter.
              </div>
            ) : (
              filteredTools.map((tool, index) => {
                const isSelected = selectedTool?.id === tool.id;
                return (
                  <div
                    key={tool.id}
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDragEnd={onDragEnd}
                    onClick={() => setSelectedToolId(tool.id)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-sm'
                        : 'bg-emerald-950/60 border-emerald-500/20 text-emerald-200 hover:bg-emerald-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="cursor-grab active:cursor-grabbing text-emerald-500/50 hover:text-amber-400">
                        <GripVertical size={15} />
                      </div>
                      <span className="text-base shrink-0">{tool.iconChar}</span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{tool.name}</span>
                          {!tool.active && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-emerald-400/70 truncate">{tool.category}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          tool.accessType === 'free'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {tool.accessType === 'free' ? 'Free' : `₹${tool.price}`}
                      </span>

                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleToolActive(tool.id);
                        }}
                        className={`w-7 h-4 rounded-full transition-colors relative ${
                          tool.active ? 'bg-emerald-500' : 'bg-neutral-800'
                        }`}
                        title={tool.active ? 'Disable Tool' : 'Enable Tool'}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            tool.active ? 'left-3.5' : 'left-0.5'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTool(tool.id);
                        }}
                        className="p-1 rounded text-neutral-500 hover:text-rose-400 transition-colors"
                        title="Delete tool"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2 (3 Cols): Access & Pricing Editor */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
              <span className="text-xl">{selectedTool?.iconChar || '🔧'}</span>
              <div>
                <h3 className="text-xs font-black text-white truncate">
                  {selectedTool?.name || 'Select a Tool'}
                </h3>
                <span className="text-[10px] text-emerald-400/80">Configure Tool Access</span>
              </div>
            </div>

            {/* Access Type Switch */}
            <div>
              <label className="text-[11px] font-bold text-emerald-300 block mb-1.5">Access Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'free', label: 'Free' },
                  { id: 'paid', label: 'Paid / Pro' }
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditAccessType(id)}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      editAccessType === id
                        ? 'bg-emerald-500/25 border-emerald-400 text-white'
                        : 'bg-emerald-950 border-emerald-500/20 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price (if paid) */}
            {editAccessType === 'paid' && (
              <div>
                <label className="text-[11px] font-bold text-emerald-300 block mb-1">Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-black focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {/* Global Access Rules Toggles */}
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/20 space-y-2 mt-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Global Display Rules
              </h4>
              <div className="space-y-1.5 text-xs font-semibold">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px]">Show Free Tools to Guest</span>
                  <input
                    type="checkbox"
                    checked={rules.showFreeToGuest}
                    onChange={(e) => setRules((r) => ({ ...r, showFreeToGuest: e.target.checked }))}
                    className="accent-amber-400 w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-[11px]">Show Lock Icon on Paid</span>
                  <input
                    type="checkbox"
                    checked={rules.showPaidLocked}
                    onChange={(e) => setRules((r) => ({ ...r, showPaidLocked: e.target.checked }))}
                    className="accent-amber-400 w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={saving || !selectedTool}
              onClick={handleUpdateAccess}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'Updating...' : 'Save & Update Preview'}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3 (4 Cols): Live Reactive Mobile Preview */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-2 flex items-center gap-1.5">
            <Eye size={14} className="text-amber-400" />
            <span>Student Live View (Real-time)</span>
          </div>

          {/* Smartphone Hardware Frame */}
          <div className="mockup-phone-frame w-[300px] sm:w-[320px] h-[640px] bg-black rounded-[40px] border-[5px] border-neutral-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-2.5 relative flex flex-col overflow-hidden">
            {/* Top Phone Notch */}
            <div className="absolute top-2 inset-x-0 mx-auto w-24 h-3.5 bg-neutral-900 rounded-full z-40 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-neutral-800 mr-2" />
              <div className="w-6 h-1 bg-neutral-800 rounded-full" />
            </div>

            {/* Inner Phone Screen Content */}
            <div className="w-full h-full bg-[#04140e] rounded-[32px] overflow-y-auto no-scrollbar text-white flex flex-col justify-between pt-4 pb-2 relative">
              {/* Phone Status Bar */}
              <div className="px-3 flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-2">
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
                <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#06291d] to-[#041911] border border-emerald-500/30 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-400/20 flex items-center justify-center text-sm shrink-0">
                    🧰
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white">Zyvra Study Toolbox</h4>
                    <p className="text-[9px] text-emerald-300/80">Smart Exam Utilities</p>
                  </div>
                </div>

                {/* Popular Shelf: Renders REAL tools in current drag-and-drop order */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-white">
                    <span className="flex items-center gap-1">
                      <Flame size={11} className="text-amber-400 fill-amber-400" /> Featured Tools
                    </span>
                    <span className="text-[8px] text-emerald-400">View All →</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {tools.slice(0, 4).map((tool) => {
                      const isPaid = tool.accessType === 'paid';
                      const isLocked = isPaid && rules.showPaidLocked;

                      return (
                        <div
                          key={tool.id}
                          className="p-2 rounded-xl bg-[#072117] border border-emerald-500/20 flex flex-col items-center text-center relative"
                        >
                          <span className="text-base mb-1">{tool.iconChar}</span>
                          <span className="text-[10px] font-bold text-white truncate w-full">
                            {tool.name}
                          </span>

                          {/* Dynamic Badge */}
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

                {/* All Configured Tools List */}
                <div className="space-y-1 pt-2">
                  <span className="text-[10px] font-bold text-white block">All Tools ({tools.length})</span>
                  <div className="space-y-1 max-h-[160px] overflow-y-auto no-scrollbar pr-0.5">
                    {tools.map((t) => (
                      <div
                        key={t.id}
                        className="p-1.5 rounded-xl bg-[#072117] border border-emerald-500/20 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs">{t.iconChar}</span>
                          <div className="truncate">
                            <div className="text-[9px] font-bold text-white truncate flex items-center gap-1">
                              <span>{t.name}</span>
                              {t.accessType === 'paid' && rules.showPaidLocked && (
                                <Lock size={8} className="text-amber-400" />
                              )}
                            </div>
                            <div className="text-[8px] text-emerald-400/70">{t.category}</div>
                          </div>
                        </div>
                        <span className="text-[8px] px-1 rounded bg-black/40 text-emerald-300">
                          {t.accessType === 'free' ? 'Free' : `₹${t.price}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phone Bottom Nav */}
              <div className="px-4 py-2 border-t border-emerald-800/30 flex items-center justify-between text-[9px] text-emerald-400/70">
                <span className="text-emerald-300">Home</span>
                <span className="text-emerald-300">Tests</span>
                <span className="text-amber-300 font-extrabold">Toolbox</span>
                <span className="text-emerald-300">Profile</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add Tool */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#04140e] border border-emerald-500/30 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                <span>Add Study Tool</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTool} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Tool Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Formula Library or Unit Converter"
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Category</label>
                <select
                  value={newToolCategory}
                  onChange={(e) => setNewToolCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                >
                  <option value="Quantitative Aptitude">Quantitative Aptitude</option>
                  <option value="Reasoning">Reasoning</option>
                  <option value="General Studies">General Studies</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Other Tools">Other Tools</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Access Type</label>
                <select
                  value={newToolAccessType}
                  onChange={(e) => setNewToolAccessType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {newToolAccessType === 'paid' && (
                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newToolPrice}
                    onChange={(e) => setNewToolPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/20 text-xs font-bold text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newToolName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold"
                >
                  Add Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

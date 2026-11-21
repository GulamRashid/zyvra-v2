import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Lock,
  Package,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Unlock,
  Wrench,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { getAiConfig, saveAiConfig, DEFAULT_AI_CONFIG } from '../../lib/gemini';

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
    validityDays: 30,
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
    validityDays: 365,
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
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 19,
    validityDays: 365,
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
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 29,
    validityDays: 365,
    active: true,
    popular: true,
    order: 4
  },
  {
    id: 'flashcards',
    name: 'Spaced Repetition Flashcards Pro',
    category: 'Revision & Memory',
    iconName: 'BookOpen',
    iconChar: '🗂️',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 49,
    validityDays: 365,
    active: true,
    popular: true,
    order: 5
  },
  {
    id: 'mistake-notebook',
    name: 'Mistake Notebook & Error Vault Pro',
    category: 'Revision & Memory',
    iconName: 'ListChecks',
    iconChar: '📓',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 49,
    validityDays: 365,
    active: true,
    popular: true,
    order: 6
  },
  {
    id: 'clock-mirror',
    name: 'Clock, Mirror & Water Image Solver',
    category: 'Reasoning',
    iconName: 'Clock',
    iconChar: '⏰',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 29,
    validityDays: 365,
    active: true,
    popular: true,
    order: 7
  },
  {
    id: 'calendar-day',
    name: 'Calendar & Day Calculation Engine',
    category: 'Reasoning',
    iconName: 'Calendar',
    iconChar: '📅',
    accessType: 'free',
    purchaseType: 'Always Free',
    price: 0,
    validityDays: 30,
    active: true,
    popular: true,
    order: 8
  },
  {
    id: 'geo-map-explorer',
    name: 'India Geography & Interactive Map Explorer',
    category: 'General Studies',
    iconName: 'MapPin',
    iconChar: '🗺️',
    accessType: 'paid',
    purchaseType: 'Single Purchase',
    price: 39,
    validityDays: 365,
    active: true,
    popular: true,
    order: 9
  }
];

// These IDs are wired to real student-side tool groups and backend access keys.
const LIVE_STUDENT_TOOL_GROUPS = new Set(DEFAULT_SYSTEM_TOOLS.map((tool) => tool.id));

export default function AdminTools() {
  const { supabase } = useAuth();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState('tools'); // 'tools' | 'bundle_pass' | 'ai_guru'

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState('all');
  const [selectedToolId, setSelectedToolId] = useState(null);

  // Edit form state for selected tool
  const [editAccessType, setEditAccessType] = useState('free');
  const [editPurchaseType, setEditPurchaseType] = useState('Always Free');
  const [editPrice, setEditPrice] = useState(0);
  const [editValidityDays, setEditValidityDays] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editLimitDaily, setEditLimitDaily] = useState(false);
  const [editDailyCount, setEditDailyCount] = useState(5);

  // Global bundle & full pass
  const [bundlePrice, setBundlePrice] = useState(0);
  const [bundleValidityDays, setBundleValidityDays] = useState(30);
  const [fullPassPrice, setFullPassPrice] = useState(0);
  const [fullPassDays, setFullPassDays] = useState(365);
  const [fullPassExamIds, setFullPassExamIds] = useState([]);
  const [fullPassToolIds, setFullPassToolIds] = useState([]);
  const [fullPassExams, setFullPassExams] = useState([]);
  const [toolboxPricing, setToolboxPricing] = useState({ tools: {}, combo: { price: 0, validity_days: 30 } });

  // Drag and drop tracking
  const [draggedIdx, setDraggedIdx] = useState(null);

  // Save / notification status
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Zyvra AI Guru Configuration State
  const [aiConfig, setAiConfig] = useState(DEFAULT_AI_CONFIG);
  const [savingAi, setSavingAi] = useState(false);
  const [aiSaveFeedback, setAiSaveFeedback] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSaveAiConfig = async () => {
    setSavingAi(true);
    setAiSaveFeedback('');
    try {
      await saveAiConfig(supabase, aiConfig);
      setAiSaveFeedback('AI Guru settings saved successfully!');
      setTimeout(() => setAiSaveFeedback(''), 3500);
    } catch (err) {
      console.error('Failed to save AI config:', err);
      setAiSaveFeedback('Error saving AI settings');
    } finally {
      setSavingAi(false);
    }
  };

  // Fetch real tools from Supabase platform_settings
  const fetchToolsConfig = useCallback(async () => {
    if (!supabase) {
      setTools(DEFAULT_SYSTEM_TOOLS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data, error: toolsError }, { data: pricingRow }, { data: passRow }, { data: examsData, error: examsError }] = await Promise.all([
        supabase.from('platform_settings').select('*').or('setting_key.eq.study_toolbox_config,key.eq.study_toolbox_config').maybeSingle(),
        supabase.from('platform_settings').select('*').or('setting_key.eq.toolbox_pricing,key.eq.toolbox_pricing').maybeSingle(),
        supabase.from('platform_settings').select('*').or('setting_key.eq.full_pass_config,key.eq.full_pass_config').maybeSingle(),
        supabase.from('exams').select('id,title,status,access_mode,pricing_mode,price').order('display_order', { ascending: true })
      ]);
      if (examsError) throw examsError;

      // Parse full pass configuration
      const rawPass = passRow?.setting_value ?? passRow?.value;
      const fullPass = typeof rawPass === 'string' ? JSON.parse(rawPass) : (rawPass || {});
      setFullPassPrice(Math.max(0, Number(fullPass.price) || 0));
      setFullPassDays(Math.min(3650, Math.max(1, Number(fullPass.validity_days) || 365)));

      const publishedExams = (examsData || []).filter((exam) => ['published', 'active', 'live', 'coming-soon', 'coming_soon'].includes(String(exam.status || '').toLowerCase()));
      setFullPassExams(publishedExams);
      setFullPassExamIds(Array.isArray(fullPass.included_exam_ids) ? fullPass.included_exam_ids : publishedExams.filter((exam) => Number(exam.price) > 0 || ['paid', 'paid-own', 'paid_own'].includes(String(exam.access_mode || exam.pricing_mode || '').toLowerCase())).map((exam) => exam.id));

      // Parse bundle & tool pricing
      const rawPricing = pricingRow?.setting_value ?? pricingRow?.value;
      const pricing = typeof rawPricing === 'string' ? JSON.parse(rawPricing) : (rawPricing || {});
      const savedToolsPricing = pricing.tools && typeof pricing.tools === 'object' ? pricing.tools : {};
      setToolboxPricing({ tools: savedToolsPricing, combo: pricing.combo || { price: 0, validity_days: 30 } });
      setBundlePrice(Math.max(0, Number(pricing.combo?.price) || 0));
      setBundleValidityDays(Math.min(3650, Math.max(1, Number(pricing.combo?.validity_days) || 30)));

      // Parse tools config
      const rawTools = data?.setting_value ?? data?.value;
      const configured = Array.isArray(rawTools) ? rawTools : (typeof rawTools === 'string' ? JSON.parse(rawTools) : []);
      const sourceList = (configured && configured.length > 0) ? configured : DEFAULT_SYSTEM_TOOLS;

      const mapped = sourceList
        .filter((item) => LIVE_STUDENT_TOOL_GROUPS.has(item?.id))
        .map((item, index) => {
          const pricingInfo = savedToolsPricing[item.id] || {};
          const isPaid = pricingInfo.access_type !== undefined
            ? ['premium', 'paid'].includes(String(pricingInfo.access_type).toLowerCase())
            : ['paid', 'premium'].includes(String(item.access_type || item.accessType || (Number(item.price) > 0 ? 'paid' : 'free')).toLowerCase());

          const price = pricingInfo.price !== undefined
            ? Math.max(0, Number(pricingInfo.price))
            : Math.max(0, Number(item.price) || 0);

          const validityDays = pricingInfo.validity_days !== undefined
            ? Math.min(3650, Math.max(1, Number(pricingInfo.validity_days)))
            : Math.min(3650, Math.max(1, Number(item.validity_days || item.validityDays) || 30));

          return {
            id: item.id || `tool-${index}`,
            name: item.name || item.title || 'Untitled Tool',
            category: item.category || 'General',
            iconName: item.icon || item.iconName || 'Wrench',
            iconChar: item.id === 'geo-map-explorer' ? '🗺️' : item.id === 'clock-mirror' ? '⏰' : item.id === 'calendar-day' ? '📅' : item.id === 'flashcards' ? '🗂️' : item.id === 'mistake-notebook' ? '📓' : item.id === 'polity-articles' ? '🏛️' : item.icon === 'Clock' ? '⏱️' : item.icon === 'Calculator' ? '🧮' : item.icon === 'Brain' ? '🧠' : item.icon === 'BookOpen' ? '📖' : '🔧',
            accessType: isPaid ? 'paid' : 'free',
            purchaseType: isPaid ? (item.purchaseType || 'Single Purchase') : 'Always Free',
            price: isPaid ? price : 0,
            validityDays: validityDays,
            active: item.enabled !== false && item.active !== false,
            popular: item.popular ?? (index < 3),
            order: index + 1
          };
        });

      if (mapped.length > 0) {
        setTools(mapped);
        setSelectedToolId((current) => mapped.some((tool) => tool.id === current) ? current : mapped[0].id);
        const premiumToolIds = mapped.filter((t) => t.active && t.accessType === 'paid').map((t) => t.id);
        setFullPassToolIds((Array.isArray(fullPass.included_tool_ids) ? fullPass.included_tool_ids : premiumToolIds).filter((id) => LIVE_STUDENT_TOOL_GROUPS.has(id)));
      } else {
        setTools(DEFAULT_SYSTEM_TOOLS);
        setSelectedToolId(DEFAULT_SYSTEM_TOOLS[0].id);
      }

      getAiConfig(supabase).then((cfg) => { if (cfg) setAiConfig(cfg); }).catch(() => {});
    } catch (err) {
      console.warn('Unable to fetch toolbox config:', err);
      setTools(DEFAULT_SYSTEM_TOOLS);
      setSelectedToolId(DEFAULT_SYSTEM_TOOLS[0].id);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchToolsConfig();
  }, [fetchToolsConfig]);

  // Selected tool object
  const selectedTool = useMemo(() => {
    return tools.find((t) => t.id === selectedToolId) || tools[0] || null;
  }, [tools, selectedToolId]);

  // Sync edit form when selectedTool changes
  useEffect(() => {
    if (selectedTool) {
      setEditAccessType(selectedTool.accessType || 'free');
      setEditPurchaseType(selectedTool.purchaseType || 'Always Free');
      setEditPrice(selectedTool.price ?? 0);
      setEditValidityDays(selectedTool.validityDays ?? 30);
    }
  }, [selectedTool]);

  // Track if current tool has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedTool) return false;
    const currentPrice = selectedTool.price ?? 0;
    const currentValidity = selectedTool.validityDays ?? 30;
    const currentAccess = selectedTool.accessType || 'free';

    return (
      editAccessType !== currentAccess ||
      (editAccessType === 'paid' && Number(editPrice) !== Number(currentPrice)) ||
      Number(editValidityDays) !== Number(currentValidity)
    );
  }, [selectedTool, editAccessType, editPrice, editValidityDays]);

  // Persist Tools Array & Pricing to Supabase & localStorage
  const persistToolsToDatabase = async (updatedTools) => {
    const previousTools = tools;
    const previousPricing = toolboxPricing;
    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    setTools(updatedTools);

    try {
      localStorage.setItem('zyvra_admin_toolbox_tools', JSON.stringify(updatedTools));
    } catch { /* ignore localStorage error */ }

    // Transform back to schema expected by platform_settings
    const dbPayload = updatedTools.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      icon: t.iconName,
      access_type: t.accessType,
      purchaseType: t.purchaseType,
      price: Number(t.price) || 0,
      enabled: t.active,
      popular: t.popular,
      validity_days: Number(t.validityDays) || 30
    }));

    if (supabase) {
      try {
        const nextPricing = {
          ...toolboxPricing,
          combo: toolboxPricing.combo || { price: bundlePrice || 0, validity_days: bundleValidityDays || 30 },
          tools: { ...(toolboxPricing.tools || {}) }
        };
        dbPayload.forEach((item) => {
          nextPricing.tools[item.id] = {
            ...(nextPricing.tools[item.id] || {}),
            access_type: item.access_type === 'paid' ? 'premium' : 'free',
            price: Number(item.price) || 0,
            validity_days: Number(item.validity_days) || 30
          };
        });

        const now = new Date().toISOString();
        const [{ error: cfgError }, pricingResult] = await Promise.all([
          supabase.from('platform_settings').upsert({
            setting_key: 'study_toolbox_config',
            key: 'study_toolbox_config',
            setting_value: dbPayload,
            value: dbPayload,
            updated_at: now
          }, { onConflict: 'setting_key' }),
          supabase.from('platform_settings').upsert({
            setting_key: 'toolbox_pricing',
            key: 'toolbox_pricing',
            setting_value: nextPricing,
            value: nextPricing,
            updated_at: now
          }, { onConflict: 'setting_key' })
        ]);

        if (cfgError) throw cfgError;
        if (pricingResult.error) throw pricingResult.error;

        setToolboxPricing(nextPricing);
        setStatusMessage({ text: 'Toolbox settings saved to cloud database successfully!', type: 'success' });
      } catch (err) {
        console.error('Save to cloud failed:', err);
        setTools(previousTools);
        setToolboxPricing(previousPricing);
        setStatusMessage({ text: err.message || 'Cloud save failed. Changes were reverted.', type: 'error' });
      }
    } else {
      setTools(previousTools);
      setStatusMessage({ text: 'Database is unavailable. Changes were not saved.', type: 'error' });
    }

    setSaving(false);
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
  };

  // Toggle tool active status
  const toggleToolActive = (toolId) => {
    if (!LIVE_STUDENT_TOOL_GROUPS.has(toolId)) {
      setStatusMessage({ text: 'This item is not connected to a live student tool. It cannot be changed here.', type: 'error' });
      return;
    }
    const updated = tools.map((t) => (t.id === toolId ? { ...t, active: !t.active } : t));
    persistToolsToDatabase(updated);
  };

  // Update selected tool access and price
  const handleUpdateAccess = () => {
    if (!selectedTool) return;
    if (!LIVE_STUDENT_TOOL_GROUPS.has(selectedTool.id)) {
      setStatusMessage({ text: 'This item is not connected to a live student tool. It cannot be sold or changed here.', type: 'error' });
      return;
    }
    const finalPrice = editAccessType === 'free' ? 0 : Math.max(0, Number(editPrice) || 0);
    const finalValidity = Math.min(3650, Math.max(1, Number(editValidityDays) || 30));

    const updated = tools.map((t) => {
      if (t.id === selectedTool.id) {
        return {
          ...t,
          accessType: editAccessType,
          purchaseType: editAccessType === 'free' ? 'Always Free' : editPurchaseType,
          price: finalPrice,
          validityDays: finalValidity
        };
      }
      return t;
    });
    persistToolsToDatabase(updated);
  };

  const saveBundlePricing = async () => {
    if (!supabase) return;
    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    try {
      const now = new Date().toISOString();
      const next = {
        ...toolboxPricing,
        combo: {
          price: Math.max(0, Number(bundlePrice) || 0),
          validity_days: Math.min(3650, Math.max(1, Number(bundleValidityDays) || 30))
        }
      };
      const { error } = await supabase.from('platform_settings').upsert({
        setting_key: 'toolbox_pricing',
        key: 'toolbox_pricing',
        setting_value: next,
        value: next,
        updated_at: now
      }, { onConflict: 'setting_key' });
      if (error) throw error;
      setToolboxPricing(next);
      setStatusMessage({ text: 'Toolbox bundle combo pricing saved to database!', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: err.message || 'Unable to save bundle pricing.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
  };

  const saveFullPassPricing = async () => {
    if (!supabase) return;
    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    try {
      const now = new Date().toISOString();
      const value = {
        price: Math.max(0, Number(fullPassPrice) || 0),
        validity_days: Math.min(3650, Math.max(1, Number(fullPassDays) || 365)),
        included_exam_ids: fullPassExamIds,
        included_tool_ids: fullPassToolIds.filter((id) => LIVE_STUDENT_TOOL_GROUPS.has(id))
      };
      const { error } = await supabase.from('platform_settings').upsert({
        setting_key: 'full_pass_config',
        key: 'full_pass_config',
        setting_value: value,
        value: value,
        updated_at: now
      }, { onConflict: 'setting_key' });
      if (error) throw error;
      setStatusMessage({ text: 'Platform Full Pass settings saved to database!', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: err.message || 'Unable to save Full Pass settings.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
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

  const moveTool = (toolId, direction) => {
    const from = tools.findIndex((tool) => tool.id === toolId);
    const to = Math.min(tools.length - 1, Math.max(0, from + direction));
    if (from < 0 || from === to) return;
    const reordered = [...tools];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    persistToolsToDatabase(reordered);
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
      if (categoryFilter !== 'all') {
        const cat = String(tool.category || '').toLowerCase();
        const filt = String(categoryFilter).toLowerCase();
        if (!cat.includes(filt) && !filt.includes(cat)) return false;
      }
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
    <div className="min-h-screen dark:bg-[#0B1120] bg-slate-50 dark:text-slate-100 text-slate-900 p-4 sm:p-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">
            <span>Tools (Toolbox)</span>
            <ChevronRight size={13} />
            <span className="text-slate-900 dark:text-white">Toolbox Manager</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            <span>Student Toolbox Manager</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage live student tool groups, pricing, visibility, Unlock All bundle, and Full Pass contents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/student/toolbox"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Open real student toolbox in a new tab"
          >
            <ExternalLink size={13} className="text-amber-500 dark:text-amber-400" />
            <span>Open Student Toolbox ↗</span>
          </a>
          <button
            type="button"
            onClick={fetchToolsConfig}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage.text && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/50 text-rose-900 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{statusMessage.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage({ text: '', type: '' })} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
            <Layers size={14} /> Total Tools
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{totalCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Live Student Tools</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
            <Unlock size={14} /> Free Tools
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{freeCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Always Free Access</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
            <Lock size={14} /> Paid / Pro Tools
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">{paidCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Priced Separately</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
            <CheckCircle2 size={14} /> Active in Student App
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{activeCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Visible to Learners</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'tools'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60'
          }`}
        >
          <Wrench size={14} />
          <span>Individual Tools & Pricing</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">{tools.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bundle_pass')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'bundle_pass'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60'
          }`}
        >
          <Package size={14} />
          <span>Bundle & Full Pass Packaging</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai_guru')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'ai_guru'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60'
          }`}
        >
          <Sparkles size={14} className="text-amber-400" />
          <span>Zyvra AI Guru Controls</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INDIVIDUAL TOOLS & PRICING */}
      {/* ======================================================== */}
      {activeTab === 'tools' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* COLUMN 1 (7 Cols): Reorderable Tools Table */}
          <div className="lg:col-span-7 p-4 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col h-[520px] lg:h-[680px]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                <GripVertical size={14} className="text-amber-500 dark:text-amber-400" />
                <span>Toolbox Layout (Click to Edit • Drag to Reorder)</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {filteredTools.length} of {tools.length} tools
              </span>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tools by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Quantitative Aptitude">Math</option>
                <option value="Reasoning">Reasoning</option>
                <option value="General Studies">GS</option>
                <option value="Productivity">Productivity</option>
                <option value="Revision & Memory">Revision & Memory</option>
              </select>
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className="px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none"
              >
                <option value="all">All Access</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {/* Reorderable Tools List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
              {loading ? (
                <LoadingSkeleton count={6} />
              ) : filteredTools.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No tools matching search filter.
                </div>
              ) : (
                filteredTools.map((tool) => {
                  const isSelected = selectedTool?.id === tool.id;
                  const toolIndex = tools.findIndex((item) => item.id === tool.id);
                  return (
                    <div
                      key={tool.id}
                      draggable
                      onDragStart={() => onDragStart(toolIndex)}
                      onDragOver={(e) => onDragOver(e, toolIndex)}
                      onDragEnd={onDragEnd}
                      onClick={() => setSelectedToolId(tool.id)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-600/25 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-white shadow-sm ring-1 ring-indigo-500/30'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400">
                          <GripVertical size={15} />
                        </div>
                        <span className="text-lg shrink-0">{tool.iconChar}</span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{tool.name}</span>
                            {!tool.active && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{tool.category}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            tool.accessType === 'free'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {tool.accessType === 'free' ? 'Free' : `₹${tool.price} • ${tool.validityDays}d`}
                        </span>

                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); moveTool(tool.id, -1); }}
                          disabled={toolIndex <= 0 || saving}
                          aria-label={`Move ${tool.name} up`}
                          className="grid min-h-8 min-w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); moveTool(tool.id, 1); }}
                          disabled={toolIndex >= tools.length - 1 || saving}
                          aria-label={`Move ${tool.name} down`}
                          className="grid min-h-8 min-w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                        >
                          <ChevronDown size={14} />
                        </button>

                        {/* Active Toggle Switch */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleToolActive(tool.id);
                          }}
                          className={`w-7 h-4 rounded-full transition-colors relative ${
                            tool.active ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-neutral-800'
                          }`}
                          title={tool.active ? 'Disable Tool for students' : 'Enable Tool for students'}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              tool.active ? 'left-3.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2 (5 Cols): Dedicated Tool Access & Pricing Editor */}
          <div className="lg:col-span-5 p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Tool Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                <span className="text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
                  {selectedTool?.iconChar || '🔧'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {selectedTool?.category || 'Toolbox'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedTool?.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {selectedTool?.active ? 'Live' : 'Hidden'}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {selectedTool?.name || 'Select a Tool'}
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ID: {selectedTool?.id}
                  </span>
                </div>
              </div>

              {/* Access Type Switch */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tool Access Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAccessType('free');
                      setEditPurchaseType('Always Free');
                      setEditPrice(0);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      editAccessType === 'free'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 text-emerald-950 dark:text-emerald-300 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <Unlock size={14} />
                    <span>Free for all students</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditAccessType('paid');
                      setEditPurchaseType('Single Purchase');
                      if (editPrice === 0) setEditPrice(49);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      editAccessType === 'paid'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-300 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <Lock size={14} />
                    <span>Paid / Pro Tool</span>
                  </button>
                </div>
              </div>

              {/* Price & Validity (if paid) */}
              {editAccessType === 'paid' ? (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Price (₹ INR)
                      </label>
                      <span className="text-[10px] text-amber-500 font-bold">Charged at student checkout</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editPrice}
                        onChange={(e) => setEditPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-black focus:outline-none focus:border-amber-400"
                        placeholder="e.g. 49"
                      />
                    </div>
                    {/* Quick Price Presets */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Presets:</span>
                      {[19, 29, 39, 49, 99].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setEditPrice(amt)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                            editPrice === amt
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Access Validity (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={editValidityDays}
                      onChange={(e) => setEditValidityDays(Math.min(3650, Math.max(1, Number(e.target.value) || 30)))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                    />
                    {/* Quick Validity Presets */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Presets:</span>
                      {[
                        { label: '30d (1 Mo)', days: 30 },
                        { label: '90d (3 Mo)', days: 90 },
                        { label: '365d (1 Yr)', days: 365 },
                        { label: 'Lifetime', days: 3650 }
                      ].map(({ label, days }) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setEditValidityDays(days)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                            editValidityDays === days
                              ? 'bg-indigo-600 text-white font-black'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={15} />
                    <span>Always Free for all registered & guest students</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Students will have unlimited zero-cost access to this tool from the Student Toolbox.
                  </p>
                  <label className="flex items-center justify-between cursor-pointer select-none pt-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Limit daily free uses</span>
                    <input
                      type="checkbox"
                      checked={editLimitDaily}
                      onChange={(e) => setEditLimitDaily(e.target.checked)}
                      className="accent-amber-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                  {editLimitDaily && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editDailyCount}
                        onChange={(e) => setEditDailyCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-400">free uses / day</span>
                    </div>
                  )}
                </div>
              )}

              {/* Student Experience Preview */}
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Student Toolbox Preview
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>{selectedTool?.iconChar}</span>
                    <span>{selectedTool?.name}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    editAccessType === 'paid'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {editAccessType === 'paid' ? `🔒 ₹${editPrice || 0}` : 'Free'}
                  </span>
                </div>
              </div>
            </div>

            {/* PROMINENT SAVE ACTION FOR THIS TOOL */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500 animate-pulse">
                  <AlertCircle size={13} />
                  <span>You have unsaved changes to this tool! Click save below:</span>
                </div>
              )}

              <button
                type="button"
                disabled={saving || !selectedTool}
                onClick={handleUpdateAccess}
                className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 scale-[1.01] ring-2 ring-amber-400/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                } disabled:opacity-50`}
              >
                <Save size={15} />
                <span>
                  {saving
                    ? 'Saving to cloud database...'
                    : hasUnsavedChanges
                    ? `Save Changes to ${selectedTool?.name || 'Tool'}`
                    : `Save Tool Access Settings`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: BUNDLE & FULL PASS PACKAGING */}
      {/* ======================================================== */}
      {activeTab === 'bundle_pass' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: Unlock All Tools Bundle */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Unlock All Tools Bundle (Combo)
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    One-time combo purchase to unlock every tool in Toolbox
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-amber-500 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                ₹{bundlePrice || 0}
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Combo Bundle Price (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={bundlePrice}
                      onChange={(e) => setBundlePrice(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-black focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Combo Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={bundleValidityDays}
                    onChange={(e) => setBundleValidityDays(Math.min(3650, Math.max(1, Number(e.target.value) || 30)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-black focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons for Combo */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold">Quick Presets:</span>
                {[
                  { p: 99, d: 30, label: '₹99 (30d)' },
                  { p: 149, d: 90, label: '₹149 (90d)' },
                  { p: 249, d: 365, label: '₹249 (1 Yr)' }
                ].map(({ p, d, label }) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setBundlePrice(p); setBundleValidityDays(d); }}
                    className="text-[10px] px-2.5 py-1 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                When students buy this bundle, they receive lifetime/duration access to all paid tools including Flashcards, Mistake Notebook, Map Explorer, etc.
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={saveBundlePricing}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Save size={14} />
              <span>{saving ? 'Saving Bundle...' : 'Save Bundle Combo Pricing'}</span>
            </button>
          </div>

          {/* Card 2: Platform Full Pass */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Zyvra Platform Full Pass
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Master subscription unlocking exams + premium toolkits
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-500 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                ₹{fullPassPrice || 0}
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Full Pass Price (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={fullPassPrice}
                      onChange={(e) => setFullPassPrice(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-black focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Pass Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={fullPassDays}
                    onChange={(e) => setFullPassDays(Math.min(3650, Math.max(1, Number(e.target.value) || 365)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-black focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Included Exams Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Included Exams ({fullPassExamIds.length} of {fullPassExams.length})
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFullPassExamIds(fullPassExams.map((exam) => exam.id))}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullPassExamIds([])}
                      className="text-[10px] font-bold text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1 p-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  {fullPassExams.length ? fullPassExams.map((exam) => (
                    <label key={exam.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800/70 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={fullPassExamIds.includes(exam.id)}
                        onChange={(e) => setFullPassExamIds((ids) => e.target.checked ? [...new Set([...ids, exam.id])] : ids.filter((id) => id !== exam.id))}
                        className="accent-emerald-400"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{exam.title}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">all sections</span>
                    </label>
                  )) : (
                    <p className="text-[10px] text-slate-400 p-2 text-center">No published exams found.</p>
                  )}
                </div>
              </div>

              {/* Included Tools Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Included Pro Tools ({fullPassToolIds.length})
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFullPassToolIds(tools.filter((t) => t.active && t.accessType === 'paid').map((t) => t.id))}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullPassToolIds([])}
                      className="text-[10px] font-bold text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1 p-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  {tools.filter((t) => t.active && t.accessType === 'paid').map((tool) => (
                    <label key={tool.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800/70 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={fullPassToolIds.includes(tool.id)}
                        onChange={(e) => setFullPassToolIds((ids) => e.target.checked ? [...new Set([...ids, tool.id])] : ids.filter((id) => id !== tool.id))}
                        className="accent-emerald-400"
                      />
                      <span className="text-sm shrink-0">{tool.iconChar}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{tool.name}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">₹{tool.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={saveFullPassPricing}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Save size={14} />
              <span>{saving ? 'Saving Full Pass...' : 'Save Full Pass Settings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ZYVRA AI GURU CONTROLS */}
      {/* ======================================================== */}
      {activeTab === 'ai_guru' && (
        <div className="max-w-3xl mx-auto p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Zyvra AI Guru Settings & Quotas</span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Configure student daily limits, coin redemption, and persona prompt
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(aiConfig?.enabled)}
                onChange={(e) => setAiConfig((c) => ({ ...c, enabled: e.target.checked }))}
                className="accent-amber-400 w-4 h-4"
              />
              <span className={aiConfig?.enabled ? 'text-emerald-500' : 'text-slate-400'}>
                {aiConfig?.enabled ? 'Active (ON)' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Free Questions / Day
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={aiConfig?.freeQuestionsPerDay ?? 3}
                onChange={(e) => setAiConfig((c) => ({ ...c, freeQuestionsPerDay: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">Free queries granted daily to all users</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Coins / Extra Question
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={aiConfig?.coinsPerQuestion ?? 2}
                onChange={(e) => setAiConfig((c) => ({ ...c, coinsPerQuestion: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">Deducted when daily free queries run out</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Full Pass Daily Limit
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={aiConfig?.passUserDailyLimit ?? 50}
                onChange={(e) => setAiConfig((c) => ({ ...c, passUserDailyLimit: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">Max questions/day for Full Pass subscribers</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Google Gemini API Key (Optional Cloud Override)
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={aiConfig?.apiKey || ''}
                onChange={(e) => setAiConfig((c) => ({ ...c, apiKey: e.target.value.trim() }))}
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-400"
                placeholder="AIzaSy... (leave blank to use default server key)"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              AI Guru Exam Persona & Instructions
            </label>
            <textarea
              rows={5}
              value={aiConfig?.systemPrompt || ''}
              onChange={(e) => setAiConfig((c) => ({ ...c, systemPrompt: e.target.value }))}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs leading-relaxed resize-none focus:outline-none focus:border-amber-400"
              placeholder="Customize Zyvra AI Guru persona, exam focus, tone, and bilingual Hindi/English guidelines..."
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={savingAi}
              onClick={handleSaveAiConfig}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              <Save size={14} />
              <span>{savingAi ? 'Saving AI Settings...' : 'Save AI Guru Controls'}</span>
            </button>

            {aiSaveFeedback && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={15} />
                <span>{aiSaveFeedback}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

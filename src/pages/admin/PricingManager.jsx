import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  CreditCard,
  Eye,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  HelpCircle,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

// Initial Tree Hierarchy
const defaultCatalogTree = [
  {
    id: 'exam_ssc',
    title: 'SSC Exams',
    type: 'exam',
    itemCount: 1240,
    children: [
      { id: 'f_ssc_cgl', title: 'SSC CGL Tier 1 & 2', type: 'folder', itemCount: 680, children: [] },
      { id: 'f_ssc_chsl', title: 'SSC CHSL Track', type: 'folder', itemCount: 560, children: [] }
    ]
  },
  {
    id: 'exam_bpsc',
    title: 'BPSC Exams',
    type: 'exam',
    itemCount: 892,
    children: [
      { id: 'f_bpsc_pre', title: '71st CCE Integrated Prelims', type: 'folder', itemCount: 512, children: [] },
      { id: 'f_bpsc_tre', title: 'Bihar TRE 4.0 Special', type: 'folder', itemCount: 380, children: [] }
    ]
  },
  {
    id: 'exam_ctet',
    title: 'CTET',
    type: 'exam',
    itemCount: 436,
    children: [
      { id: 'f_ctet_p1', title: 'Paper 1 (Class 1 to 5)', type: 'folder', itemCount: 220, children: [] },
      { id: 'f_ctet_p2', title: 'Paper 2 (Class 6 to 8)', type: 'folder', itemCount: 216, children: [] }
    ]
  },
  {
    id: 'exam_ncert',
    title: 'NCERT',
    type: 'exam',
    itemCount: 1120,
    children: [
      { id: 'f_ncert_c6', title: 'Class 6', type: 'folder', itemCount: 128, children: [] },
      { id: 'f_ncert_c7', title: 'Class 7', type: 'folder', itemCount: 132, children: [] },
      {
        id: 'f_ncert_c8',
        title: 'Class 8',
        type: 'folder',
        itemCount: 146,
        children: [
          { id: 'ch_ncert_c8_1', title: 'Ch 1 – फसल उत्पादन', type: 'chapter', questionCount: 24, path: 'NCERT > Class 8' },
          { id: 'ch_ncert_c8_2', title: 'Ch 2 – जल संसाधन', type: 'chapter', questionCount: 26, path: 'NCERT > Class 8' },
          { id: 'ch_ncert_c8_3', title: 'Ch 3 – मिट्टी एवं खनिज', type: 'chapter', questionCount: 22, path: 'NCERT > Class 8' }
        ]
      },
      { id: 'f_ncert_c9', title: 'Class 9', type: 'folder', itemCount: 138, children: [] },
      { id: 'f_ncert_c10', title: 'Class 10', type: 'folder', itemCount: 160, children: [] }
    ]
  },
  {
    id: 'group_tools',
    title: 'Tools (Toolbox)',
    type: 'group',
    itemCount: 56,
    children: []
  },
  {
    id: 'group_notes',
    title: 'Notes & PDFs',
    type: 'group',
    itemCount: 412,
    children: []
  },
  {
    id: 'group_tests',
    title: 'Mock Tests',
    type: 'group',
    itemCount: 384,
    children: []
  }
];

export default function PricingManager() {
  const { supabase } = useAuth();
  const { folders, chapters, exams } = useContentCatalog();

  const [activeTab, setActiveTab] = useState('pricing'); // 'pricing' | 'discount' | 'coupons' | 'coins' | 'bundles' | 'access' | 'templates'
  const [activeSettingSubTab, setActiveSettingSubTab] = useState('pricing_access');
  const [treeSearch, setTreeSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set(['exam_ncert', 'f_ncert_c8']));

  // Content Pricing Rules Map: { [itemId]: Rule }
  const [pricingRules, setPricingRules] = useState(() => {
    try {
      const saved = localStorage.getItem('zyvra_content_pricing_rules');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      f_ncert_c8: {
        accessType: 'paid',
        price: 49,
        discountType: 'percentage',
        discountValue: 30,
        coinAllowed: true,
        coinPrice: 340,
        validity: 'lifetime',
        validityDays: 30,
        inheritToChildren: true,
        includeInPacks: ['ncert_c8_pack']
      }
    };
  });

  // Selected item in the tree
  const [selectedItemId, setSelectedItemId] = useState('ch_ncert_c8_1');

  // Form Editing State
  const [formAccessType, setFormAccessType] = useState('paid');
  const [formPrice, setFormPrice] = useState(49);
  const [formDiscountType, setFormDiscountType] = useState('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState(30);
  const [formCoinAllowed, setFormCoinAllowed] = useState(true);
  const [formCoinPrice, setFormCoinPrice] = useState(340);
  const [formValidity, setFormValidity] = useState('lifetime');
  const [formValidityDays, setFormValidityDays] = useState(30);
  const [formInherit, setFormInherit] = useState(true);
  const [formIncludePacks, setFormIncludePacks] = useState(['ncert_c8_pack']);

  const [saving, setSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState('');

  // Toggle node expansion in tree
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Find item and its parent in tree
  const findItemAndParent = useCallback((nodes, targetId, parent = null) => {
    for (const node of nodes) {
      if (node.id === targetId) return { item: node, parent };
      if (node.children?.length) {
        const found = findItemAndParent(node.children, targetId, node);
        if (found.item) return found;
      }
    }
    return { item: null, parent: null };
  }, []);

  const { item: currentSelectedItem, parent: currentSelectedParent } = useMemo(() => {
    return findItemAndParent(defaultCatalogTree, selectedItemId);
  }, [findItemAndParent, selectedItemId]);

  // Frontend Recursive Pricing Inheritance Logic:
  // If the item doesn't have an explicit rule, look up its parent folder or exam!
  const effectivePricing = useMemo(() => {
    // 1. Direct rule
    if (pricingRules[selectedItemId]) {
      return { ...pricingRules[selectedItemId], isInherited: false, inheritedFrom: null };
    }
    // 2. Inherited from parent folder
    if (currentSelectedParent && pricingRules[currentSelectedParent.id]?.inheritToChildren) {
      return {
        ...pricingRules[currentSelectedParent.id],
        isInherited: true,
        inheritedFrom: currentSelectedParent.title
      };
    }
    // 3. Fallback default
    return {
      accessType: 'free',
      price: 0,
      discountType: 'percentage',
      discountValue: 0,
      coinAllowed: false,
      coinPrice: 0,
      validity: 'lifetime',
      validityDays: 30,
      inheritToChildren: true,
      includeInPacks: [],
      isInherited: false,
      inheritedFrom: null
    };
  }, [pricingRules, selectedItemId, currentSelectedParent]);

  // Sync Form when selected item changes
  useEffect(() => {
    setFormAccessType(effectivePricing.accessType || 'paid');
    setFormPrice(effectivePricing.price ?? 49);
    setFormDiscountType(effectivePricing.discountType || 'percentage');
    setFormDiscountValue(effectivePricing.discountValue ?? 30);
    setFormCoinAllowed(Boolean(effectivePricing.coinAllowed));
    setFormCoinPrice(effectivePricing.coinPrice ?? 340);
    setFormValidity(effectivePricing.validity || 'lifetime');
    setFormValidityDays(effectivePricing.validityDays ?? 30);
    setFormInherit(effectivePricing.inheritToChildren ?? true);
    setFormIncludePacks(effectivePricing.includeInPacks || ['ncert_c8_pack']);
  }, [effectivePricing, selectedItemId]);

  // Calculate final discounted price
  const finalPrice = useMemo(() => {
    const raw = Number(formPrice) || 0;
    if (formAccessType === 'free') return 0;
    if (formDiscountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, Number(formDiscountValue) || 0));
      return Math.round(raw * (1 - pct / 100));
    }
    const flat = Math.max(0, Number(formDiscountValue) || 0);
    return Math.max(0, raw - flat);
  }, [formPrice, formDiscountType, formDiscountValue, formAccessType]);

  // Save Settings: Saves to platform_settings without spamming individual database rows!
  const handleSaveChanges = async () => {
    setSaving(true);
    setSaveSuccessNotice('');

    const newRule = {
      accessType: formAccessType,
      price: Number(formPrice) || 0,
      discountType: formDiscountType,
      discountValue: Number(formDiscountValue) || 0,
      coinAllowed: formCoinAllowed,
      coinPrice: Number(formCoinPrice) || 0,
      validity: formValidity,
      validityDays: Number(formValidityDays) || 30,
      inheritToChildren: formInherit,
      includeInPacks: formIncludePacks,
      updatedAt: new Date().toISOString()
    };

    const nextRules = {
      ...pricingRules,
      [selectedItemId]: newRule
    };

    setPricingRules(nextRules);

    // Save synchronously in localStorage
    try {
      localStorage.setItem('zyvra_content_pricing_rules', JSON.stringify(nextRules));
    } catch (_) {}

    // Save single batch row to platform_settings in Supabase
    if (supabase) {
      try {
        await supabase.from('platform_settings').upsert({
          setting_key: 'content_pricing_rules',
          key: 'content_pricing_rules',
          setting_value: nextRules
        }, { onConflict: 'setting_key' });
      } catch (err) {
        console.warn('Unable to sync pricing rules to cloud (saved locally):', err);
      }
    }

    setSaving(false);
    setSaveSuccessNotice('Pricing & Access rules updated successfully!');
    setTimeout(() => setSaveSuccessNotice(''), 3000);
  };

  // Quick Action: Apply Preset Template
  const applyTemplate = (template) => {
    setFormAccessType('paid');
    setFormPrice(template.price);
    setFormDiscountType(template.discountType || 'percentage');
    setFormDiscountValue(template.discountValue || 0);
    setFormCoinAllowed(true);
    setFormCoinPrice(Math.round(template.price * 7));
    setFormValidity(template.validity || 'lifetime');
  };

  return (
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] p-4 sm:p-6 space-y-5">
      {/* Top Header & Breadcrumbs (Matching Mockup) */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 font-bold">
          <span>Pricing & Offers</span>
          <ChevronRight size={13} />
          <span className="text-white">Pricing Control</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Tag className="w-6 h-6 text-amber-400" />
              <span>Pricing & Offers Control Center</span>
            </h1>
            <p className="text-xs text-emerald-300/80 mt-0.5">
              Set price, discount, coupon, coin value and access for every item (folder, test, note, tool, bundle, etc.).
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs (Pricing Control, Discount & Offers, Coupons, Coins, Bundles, Access Rules, Templates) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#072117]/90 border border-emerald-500/20 backdrop-blur-md overflow-x-auto select-none">
        {[
          ['pricing', 'Pricing Control', Tag],
          ['discount', 'Discount & Offers', BadgePercent],
          ['coupons', 'Coupons', CreditCard],
          ['coins', 'Coins & Rewards', Coins],
          ['bundles', 'Bundles & Packs', Layers],
          ['access', 'Access Rules', Lock],
          ['templates', 'Pricing Templates', FileText]
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === key
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 7 Summary Metrics Cards (Matching Mockup) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-400/70">Total Items</div>
          <div className="text-lg font-black text-white mt-0.5">5,482</div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-400/70 flex items-center gap-1">
            <Unlock size={11} className="text-[#22c55e]" /> Free Items
          </div>
          <div className="text-lg font-black text-white mt-0.5">2,768 <span className="text-[10px] text-[#22c55e] font-bold">(50.4%)</span></div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
            <Lock size={11} className="text-amber-400" /> Paid Items
          </div>
          <div className="text-lg font-black text-white mt-0.5">2,714 <span className="text-[10px] text-amber-300 font-bold">(49.6%)</span></div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-purple-400">Active Discounts</div>
          <div className="text-lg font-black text-purple-300 mt-0.5">18</div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-blue-400">Active Coupons</div>
          <div className="text-lg font-black text-blue-300 mt-0.5">6</div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-amber-400">Coin Rules</div>
          <div className="text-lg font-black text-amber-300 mt-0.5">12</div>
        </div>

        <div className="bg-[#072117]/85 border border-emerald-500/20 rounded-2xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-400/70">Revenue (Month)</div>
          <div className="text-lg font-black text-[#22c55e] mt-0.5">₹18,450 <span className="text-[10px] font-bold text-[#22c55e]">(+32.4%)</span></div>
        </div>
      </div>

      {/* 3-Column Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ======================================================== */}
        {/* COLUMN 1 (4 Cols): Content Tree-View Selector */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-4 space-y-3 flex flex-col h-[680px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
              <Folder size={14} className="text-amber-400" />
              <span>Select Content to Set Price</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                const all = ['exam_ssc', 'exam_bpsc', 'exam_ctet', 'exam_ncert', 'f_ncert_c8'];
                setExpandedNodes(new Set(all));
              }}
              className="text-[10px] font-bold text-emerald-400 hover:text-white"
            >
              Expand All
            </button>
          </div>

          {/* Tree Search Bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60" />
            <input
              type="text"
              placeholder="Search folder, chapter, test, note..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/25 text-white text-xs focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Tree Hierarchy Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {defaultCatalogTree.map((examNode) => {
              const isExpanded = expandedNodes.has(examNode.id);
              const isSelected = selectedItemId === examNode.id;
              const hasRule = pricingRules[examNode.id];

              return (
                <div key={examNode.id} className="space-y-1">
                  {/* Exam Level Row */}
                  <div
                    onClick={() => {
                      setSelectedItemId(examNode.id);
                      if (examNode.children?.length) toggleNode(examNode.id);
                    }}
                    className={`p-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/25 border border-emerald-400 text-white'
                        : 'hover:bg-emerald-950/60 text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {examNode.children?.length > 0 && (
                        <span className="text-emerald-400/80">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      )}
                      <Folder size={15} className="text-amber-400 shrink-0" />
                      <span className="truncate">{examNode.title}</span>
                    </div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/20 text-emerald-300">
                      {examNode.itemCount}
                    </span>
                  </div>

                  {/* Child Folders Level */}
                  {isExpanded && examNode.children?.map((folderNode) => {
                    const isFolderExpanded = expandedNodes.has(folderNode.id);
                    const isFolderSelected = selectedItemId === folderNode.id;
                    const folderHasRule = pricingRules[folderNode.id];

                    return (
                      <div key={folderNode.id} className="pl-4 space-y-1">
                        <div
                          onClick={() => {
                            setSelectedItemId(folderNode.id);
                            if (folderNode.children?.length) toggleNode(folderNode.id);
                          }}
                          className={`p-1.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${
                            isFolderSelected
                              ? 'bg-emerald-500/30 border border-emerald-400 text-white'
                              : 'hover:bg-emerald-950/50 text-emerald-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {folderNode.children?.length > 0 && (
                              <span className="text-emerald-400/80">
                                {isFolderExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </span>
                            )}
                            <FolderOpen size={14} className="text-amber-300 shrink-0" />
                            <span className="truncate">{folderNode.title}</span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400">
                            {folderNode.itemCount}
                          </span>
                        </div>

                        {/* Child Chapters Level (Recursive Children) */}
                        {isFolderExpanded && folderNode.children?.map((chapNode) => {
                          const isChapSelected = selectedItemId === chapNode.id;
                          const isInherited = folderHasRule && !pricingRules[chapNode.id];

                          return (
                            <div
                              key={chapNode.id}
                              onClick={() => setSelectedItemId(chapNode.id)}
                              className={`pl-5 pr-2 py-1.5 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer ${
                                isChapSelected
                                  ? 'bg-emerald-500/35 border border-emerald-400 text-white font-bold'
                                  : 'hover:bg-emerald-950/40 text-emerald-300/80'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileText size={13} className="text-emerald-400 shrink-0" />
                                <span className="truncate">{chapNode.title}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isInherited && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-[#22c55e] border border-[#22c55e]/30">
                                    Inherited
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-emerald-400">
                                  {chapNode.questionCount}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2 (5 Cols): Item Pricing & Access Settings Form */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Item Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-emerald-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-lg shrink-0">
                  📖
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    {currentSelectedItem?.title || 'Ch 1 – फसल उत्पादन'}
                  </h3>
                  <p className="text-[11px] text-emerald-300/80 font-medium">
                    Type: <span className="font-bold text-white capitalize">{currentSelectedItem?.type || 'Chapter'}</span> • Path: <span className="text-amber-300">{currentSelectedItem?.path || 'NCERT > Class 8'}</span> • {currentSelectedItem?.questionCount || 24} Questions
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 shrink-0">
                • Published
              </span>
            </div>

            {/* Recursive Inheritance Banner */}
            {effectivePricing.isInherited && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-[#22c55e]/30 text-xs flex items-center justify-between text-emerald-200">
                <span>
                  Pricing inherited from parent: <strong>{effectivePricing.inheritedFrom}</strong>
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#22c55e] text-black">
                  Recursive Rule
                </span>
              </div>
            )}

            {/* Access Type Selection */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-emerald-300 block mb-2">
                Access Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ['free', 'Free (Everyone)'],
                  ['paid', 'Paid (One-time)'],
                  ['subscription', 'Subscription Only'],
                  ['bundle', 'Bundle Only'],
                  ['coin', 'Free with Coins'],
                  ['restricted', 'Restricted']
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormAccessType(val)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                      formAccessType === val
                        ? 'bg-emerald-500/30 border-emerald-400 text-white shadow-sm'
                        : 'bg-emerald-950/60 border-emerald-500/20 text-emerald-400/80 hover:text-white'
                    }`}
                  >
                    {label} {formAccessType === val && '✓'}
                  </button>
                ))}
              </div>
            </div>

            {/* Price & Discount Settings */}
            {formAccessType === 'paid' && (
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/25">
                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-900/60 border border-emerald-500/30 text-white text-xs font-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">Discount Type</label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-emerald-900/60 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">Discount</label>
                  <input
                    type="number"
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-900/60 border border-emerald-500/30 text-white text-xs font-black focus:outline-none"
                  />
                </div>

                <div className="col-span-3 pt-1 flex items-center justify-between text-xs font-bold border-t border-emerald-800/40">
                  <span className="text-emerald-300/80">Effective Student Price:</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-emerald-500/60">₹{formPrice}</span>
                    <span className="text-base font-black text-amber-300">₹{finalPrice}</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e]">
                      30% OFF
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Coin Option Settings */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/25 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formCoinAllowed}
                  onChange={(e) => setFormCoinAllowed(e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Allow purchase with Coins</span>
              </label>

              {formCoinAllowed && (
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Coins size={16} className="text-amber-400" />
                    <span className="text-xs font-bold text-emerald-300">Coin Price:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formCoinPrice}
                      onChange={(e) => setFormCoinPrice(Number(e.target.value))}
                      className="w-24 px-2.5 py-1.5 rounded-xl bg-emerald-900/60 border border-emerald-500/30 text-amber-300 text-xs font-black text-right focus:outline-none"
                    />
                    <span className="text-[10px] text-emerald-400/70 font-semibold">(1 Coin = ₹0.10)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Validity / Access Period */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-emerald-300 block">
                Validity (Access Period)
              </label>
              <div className="flex items-center gap-3 text-xs font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="validity"
                    value="lifetime"
                    checked={formValidity === 'lifetime'}
                    onChange={() => setFormValidity('lifetime')}
                    className="accent-emerald-400"
                  />
                  <span>Lifetime</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="validity"
                    value="fixed"
                    checked={formValidity === 'fixed'}
                    onChange={() => setFormValidity('fixed')}
                    className="accent-emerald-400"
                  />
                  <span>Fixed Duration (30 Days)</span>
                </label>
              </div>
            </div>

            {/* Recursive Inheritance Toggle for Parents */}
            {currentSelectedItem?.type !== 'chapter' && (
              <div className="p-3 rounded-2xl bg-emerald-900/30 border border-emerald-500/25">
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formInherit}
                    onChange={(e) => setFormInherit(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Recursively apply this pricing to all child folders & chapters</span>
                </label>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-emerald-800/40 space-y-2">
            {saveSuccessNotice && (
              <div className="text-xs font-bold text-[#22c55e] text-center bg-[#22c55e]/15 p-2 rounded-xl border border-[#22c55e]/30">
                {saveSuccessNotice}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormPrice(49);
                  setFormDiscountValue(30);
                  setFormCoinPrice(340);
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-950 border border-emerald-500/25 text-emerald-300 hover:text-white font-bold text-xs"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-2"
              >
                <Save size={15} />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3 (3 Cols): Quick Actions & Pricing Templates */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 space-y-4">
          {/* Quick Actions Card */}
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-4 space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400" />
              <span>Quick Actions</span>
            </h3>

            <div className="space-y-1.5">
              {[
                'Bulk Update Price',
                'Apply Discount (Bulk)',
                'Apply Coupon (Bulk)',
                'Set Coin Price (Bulk)',
                'Change Access Type (Bulk)'
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => alert(`${action} triggered for selected group.`)}
                  className="w-full p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/15 hover:border-emerald-500/40 text-left text-xs font-bold text-emerald-200 flex items-center justify-between group transition-colors"
                >
                  <span>{action}</span>
                  <ChevronRight size={14} className="text-emerald-400/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Templates Card */}
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Pricing Templates
              </h3>
              <Plus size={14} className="text-emerald-400 cursor-pointer" />
            </div>

            <div className="space-y-2">
              {[
                { title: 'Standard Paid', price: 99, validity: 'lifetime', discountValue: 0 },
                { title: 'Launch Offer', price: 79, validity: 'lifetime', discountValue: 20 },
                { title: 'Premium Chapter', price: 149, validity: 'lifetime', discountValue: 15 }
              ].map((tmpl) => (
                <div
                  key={tmpl.title}
                  onClick={() => applyTemplate(tmpl)}
                  className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/15 hover:border-amber-400/40 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      {tmpl.title}
                    </h4>
                    <span className="text-[10px] text-emerald-400/70 font-semibold">
                      ₹{tmpl.price} • Lifetime
                    </span>
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-lg bg-emerald-900 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 group-hover:bg-amber-400 group-hover:text-black transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

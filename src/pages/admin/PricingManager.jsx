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
  FileQuestion,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  FolderPlus,
  GraduationCap,
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

export default function PricingManager() {
  const { supabase } = useAuth();
  const { exams, folders, chapters, loading: catalogLoading, refresh: refreshCatalog } = useContentCatalog();

  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [activeTab, setActiveTab] = useState('pricing'); // 'pricing' | 'discount' | 'coupons' | 'coins' | 'templates'
  const [treeSearch, setTreeSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Real Pricing Rules Map from platform_settings: { [itemId]: Rule }
  const [pricingRules, setPricingRules] = useState({});
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState('folder'); // 'exam' | 'folder' | 'chapter' | 'test'

  // Form Editing State
  const [formAccessType, setFormAccessType] = useState('free');
  const [formPrice, setFormPrice] = useState(0);
  const [formDiscountType, setFormDiscountType] = useState('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState(0);
  const [formCoinAllowed, setFormCoinAllowed] = useState(false);
  const [formCoinPrice, setFormCoinPrice] = useState(0);
  const [formValidity, setFormValidity] = useState('lifetime');
  const [formValidityDays, setFormValidityDays] = useState(30);
  const [formInherit, setFormInherit] = useState(true);

  // Status & modal states
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const [newFolderPricingMode, setNewFolderPricingMode] = useState('free');
  const [newFolderPrice, setNewFolderPrice] = useState(0);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Coupons state from platform_settings
  const [coupons, setCoupons] = useState([]);

  // Fetch tests from Supabase
  const fetchTests = useCallback(async () => {
    if (!supabase) return;
    try {
      setLoadingTests(true);
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, chapter_id, folder_id, is_free, price, status')
        .order('created_at', { ascending: true });
      if (!error && data) {
        setTests(data);
      }
    } catch (err) {
      console.warn('Unable to load tests for pricing tree:', err);
    } finally {
      setLoadingTests(false);
    }
  }, [supabase]);

  // Fetch platform pricing settings & coupons from Supabase
  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .in('setting_key', ['content_pricing_rules', 'coupon_codes']);

      if (data) {
        data.forEach((row) => {
          const key = row.setting_key || row.key;
          const val = row.setting_value || row.value;
          if (key === 'content_pricing_rules' && val && typeof val === 'object') {
            setPricingRules(val);
          } else if (key === 'coupon_codes' && Array.isArray(val)) {
            setCoupons(val);
          }
        });
      }
    } catch (err) {
      console.warn('Unable to load pricing settings:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTests();
    fetchSettings();
  }, [fetchTests, fetchSettings]);

  // Build Real Catalog Hierarchy Tree strictly from actual DB records
  const dynamicTree = useMemo(() => {
    if (!exams.length && !folders.length && !chapters.length) {
      return [];
    }

    // Map chapters to parent folder
    const chaptersByFolder = new Map();
    chapters.forEach((ch) => {
      const list = chaptersByFolder.get(ch.folder_id) || [];
      list.push(ch);
      chaptersByFolder.set(ch.folder_id, list);
    });

    // Map tests to chapter or folder
    const testsByChapter = new Map();
    const testsByFolder = new Map();
    tests.forEach((t) => {
      if (t.chapter_id) {
        const list = testsByChapter.get(t.chapter_id) || [];
        list.push(t);
        testsByChapter.set(t.chapter_id, list);
      } else if (t.folder_id) {
        const list = testsByFolder.get(t.folder_id) || [];
        list.push(t);
        testsByFolder.set(t.folder_id, list);
      }
    });

    // Recursive folder builder
    const buildFolderNode = (folder, allFolders) => {
      const folderId = folder.id;
      const childFolders = allFolders.filter((f) => (f.parent_id === folderId || f.parent_folder_id === folderId));
      const childChapters = chaptersByFolder.get(folderId) || [];
      const directTests = testsByFolder.get(folderId) || [];

      const children = [
        ...childFolders.map((sub) => buildFolderNode(sub, allFolders)),
        ...childChapters.map((ch) => {
          const chTests = testsByChapter.get(ch.id) || [];
          return {
            id: ch.id,
            title: ch.title,
            type: 'chapter',
            raw: ch,
            price: ch.custom_price || ch.price || 0,
            accessMode: ch.access_mode || 'inherit',
            children: chTests.map((t) => ({
              id: t.id,
              title: t.title,
              type: 'test',
              raw: t,
              price: t.price || 0,
              accessMode: t.is_free ? 'free' : 'paid',
              children: []
            }))
          };
        }),
        ...directTests.map((t) => ({
          id: t.id,
          title: t.title,
          type: 'test',
          raw: t,
          price: t.price || 0,
          accessMode: t.is_free ? 'free' : 'paid',
          children: []
        }))
      ];

      return {
        id: folder.id,
        title: folder.title,
        type: 'folder',
        raw: folder,
        price: folder.price || folder.base_price || 0,
        accessMode: folder.pricing_mode || 'free',
        itemCount: children.length,
        children
      };
    };

    // Build Exam root nodes
    return exams.map((exam) => {
      const examFolders = folders.filter((f) => f.exam_id === exam.id);
      const rootFolders = examFolders.filter((f) => !f.parent_id && !f.parent_folder_id);

      return {
        id: exam.id,
        title: exam.title,
        type: 'exam',
        raw: exam,
        price: exam.price || 0,
        accessMode: exam.access_mode || 'free',
        itemCount: examFolders.length,
        children: rootFolders.map((rf) => buildFolderNode(rf, examFolders))
      };
    });
  }, [exams, folders, chapters, tests]);

  // Auto-expand first exam node and select first item if none selected
  useEffect(() => {
    if (dynamicTree.length > 0) {
      setExpandedNodes((prev) => {
        if (prev.size === 0) {
          const initial = new Set();
          initial.add(dynamicTree[0].id);
          if (dynamicTree[0].children?.[0]) {
            initial.add(dynamicTree[0].children[0].id);
          }
          return initial;
        }
        return prev;
      });

      if (!selectedItemId) {
        const firstExam = dynamicTree[0];
        const firstFolder = firstExam.children?.[0];
        const firstChapter = firstFolder?.children?.find((c) => c.type === 'chapter');
        const defaultItem = firstChapter || firstFolder || firstExam;
        setSelectedItemId(defaultItem.id);
        setSelectedItemType(defaultItem.type);
      }
    }
  }, [dynamicTree, selectedItemId]);

  // Toggle node expansion
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Find item and its parent in the dynamic tree
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
    if (!selectedItemId) return { item: null, parent: null };
    return findItemAndParent(dynamicTree, selectedItemId);
  }, [findItemAndParent, dynamicTree, selectedItemId]);

  // Frontend Recursive Pricing Inheritance Logic based on REAL DB objects:
  const effectivePricing = useMemo(() => {
    if (!currentSelectedItem) {
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
        isInherited: false,
        inheritedFrom: null
      };
    }

    // 1. Direct Rule in platform_settings
    if (pricingRules[selectedItemId]) {
      return { ...pricingRules[selectedItemId], isInherited: false, inheritedFrom: null };
    }

    // 2. Direct DB value from the entity
    const raw = currentSelectedItem.raw || {};
    const directAccess = raw.pricing_mode || raw.access_mode || (raw.is_free ? 'free' : (raw.price > 0 ? 'paid' : 'free'));
    const directPrice = Number(raw.price || raw.custom_price || raw.base_price || 0);

    if (directAccess && directAccess !== 'inherit') {
      return {
        accessType: directAccess === 'paid_own' ? 'paid' : directAccess,
        price: directPrice,
        discountType: 'percentage',
        discountValue: 0,
        coinAllowed: directPrice > 0,
        coinPrice: Math.round(directPrice * 10),
        validity: 'lifetime',
        validityDays: 30,
        inheritToChildren: true,
        isInherited: false,
        inheritedFrom: null
      };
    }

    // 3. Inherited from parent folder/exam
    if (currentSelectedParent) {
      const parentRule = pricingRules[currentSelectedParent.id];
      if (parentRule?.inheritToChildren) {
        return {
          ...parentRule,
          isInherited: true,
          inheritedFrom: currentSelectedParent.title
        };
      }
      const parentRaw = currentSelectedParent.raw || {};
      const parentPrice = Number(parentRaw.price || parentRaw.base_price || 0);
      const parentAccess = parentRaw.pricing_mode || parentRaw.access_mode || (parentPrice > 0 ? 'paid' : 'free');
      return {
        accessType: parentAccess === 'paid_own' ? 'paid' : parentAccess,
        price: parentPrice,
        discountType: 'percentage',
        discountValue: 0,
        coinAllowed: parentPrice > 0,
        coinPrice: Math.round(parentPrice * 10),
        validity: 'lifetime',
        validityDays: 30,
        inheritToChildren: true,
        isInherited: true,
        inheritedFrom: currentSelectedParent.title
      };
    }

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
      isInherited: false,
      inheritedFrom: null
    };
  }, [pricingRules, selectedItemId, currentSelectedItem, currentSelectedParent]);

  // Sync Form when selected item changes
  useEffect(() => {
    setFormAccessType(effectivePricing.accessType || 'free');
    setFormPrice(effectivePricing.price ?? 0);
    setFormDiscountType(effectivePricing.discountType || 'percentage');
    setFormDiscountValue(effectivePricing.discountValue ?? 0);
    setFormCoinAllowed(Boolean(effectivePricing.coinAllowed));
    setFormCoinPrice(effectivePricing.coinPrice ?? 0);
    setFormValidity(effectivePricing.validity || 'lifetime');
    setFormValidityDays(effectivePricing.validityDays ?? 30);
    setFormInherit(effectivePricing.inheritToChildren ?? true);
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

  // Real Save Changes: executes REAL Supabase update on the actual entity!
  const handleSaveChanges = async () => {
    if (!supabase || !selectedItemId || !currentSelectedItem) return;
    setSaving(true);
    setStatusMessage({ text: '', type: '' });

    const newRule = {
      accessType: formAccessType,
      price: Number(formPrice) || 0,
      finalPrice,
      discountType: formDiscountType,
      discountValue: Number(formDiscountValue) || 0,
      coinAllowed: formCoinAllowed,
      coinPrice: Number(formCoinPrice) || 0,
      validity: formValidity,
      validityDays: Number(formValidityDays) || 30,
      inheritToChildren: formInherit,
      updatedAt: new Date().toISOString()
    };

    const nextRules = {
      ...pricingRules,
      [selectedItemId]: newRule
    };

    try {
      // 1. Update the real DB record in Supabase
      const itemType = currentSelectedItem.type;
      if (itemType === 'folder') {
        const { error } = await supabase
          .from('folders')
          .update({
            pricing_mode: formAccessType === 'paid' ? 'paid_own' : formAccessType,
            price: finalPrice,
            effective_price: finalPrice
          })
          .eq('id', selectedItemId);
        if (error) throw error;
      } else if (itemType === 'chapter') {
        const { error } = await supabase
          .from('chapters')
          .update({
            access_mode: formAccessType === 'paid' ? 'paid_own' : formAccessType,
            price: finalPrice,
            custom_price: finalPrice
          })
          .eq('id', selectedItemId);
        if (error) throw error;
      } else if (itemType === 'exam') {
        const { error } = await supabase
          .from('exams')
          .update({
            access_mode: formAccessType === 'paid' ? 'paid_own' : formAccessType,
            price: finalPrice
          })
          .eq('id', selectedItemId);
        if (error) throw error;
      } else if (itemType === 'test') {
        const { error } = await supabase
          .from('tests')
          .update({
            is_free: formAccessType === 'free',
            price: finalPrice
          })
          .eq('id', selectedItemId);
        if (error) throw error;
      }

      // 2. Persist rule map into platform_settings for recursive tree lookups
      await supabase.from('platform_settings').upsert({
        setting_key: 'content_pricing_rules',
        key: 'content_pricing_rules',
        setting_value: nextRules
      }, { onConflict: 'setting_key' });

      setPricingRules(nextRules);
      setStatusMessage({ text: 'Access & pricing updated successfully in database!', type: 'success' });
      await refreshCatalog();
      await fetchTests();
    } catch (err) {
      console.error('Save failed:', err);
      setStatusMessage({ text: err.message || 'Failed to update pricing.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
  };

  // Real Delete Item Action
  const handleDeleteItem = async () => {
    if (!currentSelectedItem || !supabase) return;
    const confirmName = prompt(`Type "${currentSelectedItem.title}" to confirm permanent deletion:`);
    if (confirmName !== currentSelectedItem.title) return;

    setSaving(true);
    try {
      const type = currentSelectedItem.type;
      let err = null;
      if (type === 'folder') {
        const res = await supabase.from('folders').delete().eq('id', selectedItemId);
        err = res.error;
      } else if (type === 'chapter') {
        const res = await supabase.from('chapters').delete().eq('id', selectedItemId);
        err = res.error;
      } else if (type === 'test') {
        const res = await supabase.from('tests').delete().eq('id', selectedItemId);
        err = res.error;
      }

      if (err) throw err;
      setStatusMessage({ text: `${currentSelectedItem.title} deleted successfully.`, type: 'success' });
      setSelectedItemId(null);
      await refreshCatalog();
      await fetchTests();
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to delete item.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Real Create Folder Action
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderTitle.trim() || !supabase) return;

    setCreatingFolder(true);
    try {
      let targetExamId = exams[0]?.id;
      let targetParentFolderId = null;

      if (currentSelectedItem) {
        if (currentSelectedItem.type === 'exam') {
          targetExamId = currentSelectedItem.id;
        } else if (currentSelectedItem.type === 'folder') {
          targetExamId = currentSelectedItem.raw?.exam_id || exams[0]?.id;
          targetParentFolderId = currentSelectedItem.id;
        }
      }

      const slug = newFolderTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await supabase.from('folders').insert({
        title: newFolderTitle.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
        exam_id: targetExamId,
        parent_id: targetParentFolderId,
        parent_folder_id: targetParentFolderId,
        pricing_mode: newFolderPricingMode === 'paid' ? 'paid_own' : newFolderPricingMode,
        price: Number(newFolderPrice) || 0,
        status: 'published',
        allow_tests: true,
        allow_practice: true,
        allow_notes: true
      }).select().single();

      if (error) throw error;

      setStatusMessage({ text: `Folder "${newFolderTitle}" created successfully!`, type: 'success' });
      setNewFolderTitle('');
      setCreateFolderModalOpen(false);
      await refreshCatalog();
      if (data?.id) {
        setSelectedItemId(data.id);
        setSelectedItemType('folder');
      }
    } catch (err) {
      setStatusMessage({ text: err.message || 'Failed to create folder.', type: 'error' });
    } finally {
      setCreatingFolder(false);
    }
  };

  // Real stats calculation
  const totalItemsCount = useMemo(() => {
    return exams.length + folders.length + chapters.length + tests.length;
  }, [exams, folders, chapters, tests]);

  const freeItemsCount = useMemo(() => {
    const freeFolders = folders.filter((f) => f.pricing_mode === 'free' || !f.price).length;
    const freeChapters = chapters.filter((c) => c.access_mode === 'free' || !c.price).length;
    const freeTests = tests.filter((t) => t.is_free).length;
    return freeFolders + freeChapters + freeTests;
  }, [folders, chapters, tests]);

  const paidItemsCount = Math.max(0, totalItemsCount - freeItemsCount);

  // Filtered Tree Nodes by search
  const filterTree = (nodes, query) => {
    if (!query) return nodes;
    const lower = query.toLowerCase();
    const result = [];
    for (const node of nodes) {
      const match = node.title.toLowerCase().includes(lower);
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (match || filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }
    return result;
  };

  const visibleTree = useMemo(() => {
    return filterTree(dynamicTree, treeSearch);
  }, [dynamicTree, treeSearch]);

  return (
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] p-4 sm:p-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
            <span>Pricing & Offers</span>
            <ChevronRight size={13} />
            <span className="text-white">Pricing Control</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-400" />
            <span>Pricing & Offers Control Center</span>
          </h1>
          <p className="text-xs text-emerald-300/80 mt-0.5">
            Configure price, discount, and access rules directly on your database content.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { refreshCatalog(); fetchTests(); fetchSettings(); }}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={catalogLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateFolderModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
          >
            <FolderPlus size={14} />
            <span>+ New Folder</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <Layers size={14} /> Total Items
          </div>
          <div className="text-xl font-black text-white">{totalItemsCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">Real Database Content</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <Unlock size={14} /> Free Items
          </div>
          <div className="text-xl font-black text-emerald-400">{freeItemsCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">
            {totalItemsCount > 0 ? Math.round((freeItemsCount / totalItemsCount) * 100) : 0}% of catalog
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
            <Lock size={14} /> Paid Items
          </div>
          <div className="text-xl font-black text-amber-400">{paidItemsCount}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">
            {totalItemsCount > 0 ? Math.round((paidItemsCount / totalItemsCount) * 100) : 0}% of catalog
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <Folder size={14} /> Folders
          </div>
          <div className="text-xl font-black text-white">{folders.length}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">Under {exams.length} Exam(s)</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
            <FileText size={14} /> Chapters
          </div>
          <div className="text-xl font-black text-white">{chapters.length}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">{tests.length} Active Tests</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
            <BadgePercent size={14} /> Active Coupons
          </div>
          <div className="text-xl font-black text-amber-400">{coupons.length}</div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">Configured</div>
        </div>
      </div>

      {/* Main 3-Column Working Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ======================================================== */}
        {/* COLUMN 1 (4 Cols): Real Tree View Content Hierarchy */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 flex flex-col h-[420px] lg:h-[680px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300">
              <FolderOpen size={15} className="text-amber-400" />
              <span>Database Content Tree</span>
            </div>
            <button
              type="button"
              onClick={() => setCreateFolderModalOpen(true)}
              className="p-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 text-[11px] font-bold flex items-center gap-1 px-2"
              title="Add folder under selected"
            >
              <Plus size={12} />
              <span>Folder</span>
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-2.5 text-emerald-400/60" />
            <input
              type="text"
              placeholder="Search content in database..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white text-xs placeholder:text-emerald-400/50 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Real Tree Items List */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 pr-1">
            {catalogLoading || loadingTests ? (
              <LoadingSkeleton count={5} />
            ) : visibleTree.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-400/70 space-y-2">
                <p>No content found in database.</p>
                <button
                  type="button"
                  onClick={() => setCreateFolderModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-bold text-xs"
                >
                  Create First Folder
                </button>
              </div>
            ) : (
              visibleTree.map((examNode) => (
                <div key={examNode.id} className="space-y-0.5">
                  {/* Exam Row */}
                  <div
                    onClick={() => {
                      setSelectedItemId(examNode.id);
                      setSelectedItemType('exam');
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      selectedItemId === examNode.id
                        ? 'bg-emerald-500/30 border border-emerald-400 text-white'
                        : 'hover:bg-emerald-900/40 text-emerald-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNode(examNode.id);
                        }}
                        className="text-emerald-400 hover:text-white"
                      >
                        {expandedNodes.has(examNode.id) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                      <GraduationCap size={15} className="text-amber-400 shrink-0" />
                      <span className="truncate">{examNode.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-900/80 text-emerald-300 shrink-0">
                      Exam · ₹{examNode.price}
                    </span>
                  </div>

                  {/* Child Folders / Items under Exam */}
                  {expandedNodes.has(examNode.id) && examNode.children?.length > 0 && (
                    <div className="pl-4 space-y-0.5 border-l border-emerald-800/40 ml-2">
                      {examNode.children.map((folderNode) => (
                        <div key={folderNode.id} className="space-y-0.5">
                          {/* Folder Row */}
                          <div
                            onClick={() => {
                              setSelectedItemId(folderNode.id);
                              setSelectedItemType('folder');
                            }}
                            className={`flex items-center justify-between p-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                              selectedItemId === folderNode.id
                                ? 'bg-emerald-500/30 border border-emerald-400 text-white'
                                : 'hover:bg-emerald-900/30 text-emerald-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleNode(folderNode.id);
                                }}
                                className="text-emerald-400 hover:text-white"
                              >
                                {folderNode.children?.length > 0 ? (
                                  expandedNodes.has(folderNode.id) ? (
                                    <ChevronDown size={13} />
                                  ) : (
                                    <ChevronRight size={13} />
                                  )
                                ) : (
                                  <span className="w-3 inline-block" />
                                )}
                              </button>
                              <Folder size={14} className="text-emerald-400 shrink-0" />
                              <span className="truncate">{folderNode.title}</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400 shrink-0">
                              {folderNode.accessMode === 'free' ? 'Free' : `₹${folderNode.price}`}
                            </span>
                          </div>

                          {/* Children under Folder (Subfolders, Chapters, Tests) */}
                          {expandedNodes.has(folderNode.id) && folderNode.children?.length > 0 && (
                            <div className="pl-4 space-y-0.5 border-l border-emerald-800/40 ml-2">
                              {folderNode.children.map((child) => (
                                <div
                                  key={child.id}
                                  onClick={() => {
                                    setSelectedItemId(child.id);
                                    setSelectedItemType(child.type);
                                  }}
                                  className={`flex items-center justify-between p-1.5 rounded-xl text-[11px] font-medium cursor-pointer transition-colors ${
                                    selectedItemId === child.id
                                      ? 'bg-amber-500/25 border border-amber-400/80 text-white font-bold'
                                      : 'hover:bg-emerald-900/20 text-emerald-300/90'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {child.type === 'chapter' ? (
                                      <FileText size={13} className="text-teal-400 shrink-0" />
                                    ) : child.type === 'test' ? (
                                      <FileQuestion size={13} className="text-amber-400 shrink-0" />
                                    ) : (
                                      <Folder size={13} className="text-emerald-400 shrink-0" />
                                    )}
                                    <span className="truncate">{child.title}</span>
                                  </div>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-emerald-300 shrink-0">
                                    {child.type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2 (5 Cols): Real Item Pricing & Access Editor */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Header of selected item */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  {selectedItemType === 'exam' ? (
                    <GraduationCap size={20} />
                  ) : selectedItemType === 'folder' ? (
                    <Folder size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white leading-tight">
                    {currentSelectedItem?.title || 'Select Content from Tree'}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400/80 mt-0.5">
                    <span className="capitalize">Type: {selectedItemType}</span>
                    {effectivePricing.isInherited && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        Inherited from {effectivePricing.inheritedFrom}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 transition-colors"
                  title="Delete Item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Access Type Radio Group */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-emerald-300 block mb-2">
                Access Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'free', label: 'Free (Everyone)', desc: 'Instant access without payment' },
                  { id: 'paid', label: 'Paid (One-time)', desc: 'Requires purchase or bundle' },
                  { id: 'subscription', label: 'Subscription Only', desc: 'Included in Zyvra Pro' },
                  { id: 'inherit', label: 'Inherit from Parent', desc: 'Use parent access & price' }
                ].map((type) => (
                  <label
                    key={type.id}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      formAccessType === type.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm'
                        : 'bg-emerald-950/60 border-emerald-500/20 text-emerald-300/80 hover:bg-emerald-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="accessType"
                        value={type.id}
                        checked={formAccessType === type.id}
                        onChange={(e) => setFormAccessType(e.target.value)}
                        className="accent-amber-400 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white">{type.label}</span>
                    </div>
                    <p className="text-[10px] text-emerald-400/70 ml-5 mt-0.5">{type.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Price & Discount Settings (if paid) */}
            {formAccessType === 'paid' && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/30 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                      Base Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-white font-black text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                      Discount ({formDiscountType === 'percentage' ? '%' : '₹'})
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={formDiscountValue}
                        onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-white font-black text-sm focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setFormDiscountType(formDiscountType === 'percentage' ? 'flat' : 'percentage')}
                        className="px-2 rounded-xl bg-emerald-900 border border-emerald-500/30 text-xs font-bold text-emerald-300"
                      >
                        {formDiscountType === 'percentage' ? '%' : '₹'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calculated Effective Price Pill */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-emerald-500/20 text-xs">
                  <span className="text-emerald-300/80">Net Effective Student Price:</span>
                  <div className="flex items-center gap-2">
                    {formPrice > finalPrice && (
                      <span className="text-neutral-400 line-through text-[11px]">₹{formPrice}</span>
                    )}
                    <span className="text-base font-black text-amber-400">₹{finalPrice}</span>
                    {formDiscountValue > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        {formDiscountType === 'percentage' ? `${formDiscountValue}% OFF` : `₹${formDiscountValue} OFF`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Coin Purchase Option */}
                <div className="space-y-1.5 pt-1 border-t border-emerald-500/20">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={formCoinAllowed}
                      onChange={(e) => {
                        setFormCoinAllowed(e.target.checked);
                        if (e.target.checked && !formCoinPrice) {
                          setFormCoinPrice(finalPrice * 10);
                        }
                      }}
                      className="accent-amber-400 w-4 h-4"
                    />
                    <Coins size={14} className="text-amber-400" />
                    <span>Allow purchasing with Zyvra Coins</span>
                  </label>

                  {formCoinAllowed && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[11px] text-emerald-300">Coin Price:</span>
                      <input
                        type="number"
                        min="0"
                        value={formCoinPrice}
                        onChange={(e) => setFormCoinPrice(Number(e.target.value))}
                        className="w-24 px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/30 text-amber-300 font-bold text-xs"
                      />
                      <span className="text-[10px] text-emerald-400/60">(10 Coins = ₹1)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recursive Inheritance Toggle (Zero DB row spamming) */}
            <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/20 space-y-1">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div>
                  <span className="text-xs font-bold text-white block">Recursive Child Inheritance</span>
                  <span className="text-[10px] text-emerald-300/70 block">
                    Automatically applies access rules to all subfolders & chapters without spamming DB rows.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formInherit}
                  onChange={(e) => setFormInherit(e.target.checked)}
                  className="accent-amber-400 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2">
            <button
              type="button"
              disabled={saving || !selectedItemId}
              onClick={handleSaveChanges}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save size={15} />
              <span>{saving ? 'Updating Database...' : 'Save Changes to Database'}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3 (3 Cols): Quick Actions & Real Coupon Codes */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 space-y-4">
          {/* Quick Actions */}
          <div className="p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 mb-2">
              <Zap size={14} className="text-amber-400" />
              <span>Quick Actions</span>
            </h3>

            <button
              type="button"
              onClick={() => {
                setFormAccessType('free');
                setFormPrice(0);
                setFormDiscountValue(0);
              }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/20 text-emerald-200 text-xs font-bold text-left flex items-center justify-between transition-colors"
            >
              <span>Make Item Free</span>
              <Unlock size={13} className="text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setFormAccessType('paid');
                setFormPrice(99);
                setFormDiscountValue(20);
                setFormCoinAllowed(true);
                setFormCoinPrice(800);
              }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/20 text-emerald-200 text-xs font-bold text-left flex items-center justify-between transition-colors"
            >
              <span>Apply Standard ₹99 Pack</span>
              <Tag size={13} className="text-amber-400" />
            </button>

            <button
              type="button"
              onClick={() => setCreateFolderModalOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/20 text-emerald-200 text-xs font-bold text-left flex items-center justify-between transition-colors"
            >
              <span>Create New Folder</span>
              <FolderPlus size={13} className="text-amber-400" />
            </button>
          </div>

          {/* Real Coupons Configured */}
          <div className="p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <BadgePercent size={14} className="text-amber-400" />
                <span>Configured Coupons</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-bold">{coupons.length} Active</span>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {coupons.length === 0 ? (
                <div className="p-3 text-center text-xs text-emerald-400/60">
                  No coupons configured in system.
                </div>
              ) : (
                coupons.map((c) => (
                  <div
                    key={c.id || c.code}
                    className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-mono font-black text-amber-300">{c.code}</div>
                      <div className="text-[10px] text-emerald-400/70">
                        {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`} · {c.scope || 'global'}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create New Folder */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#04140e] border border-emerald-500/30 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <FolderPlus size={18} className="text-amber-400" />
                <span>Create New Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateFolderModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">
                  Folder Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 7 or Science"
                  value={newFolderTitle}
                  onChange={(e) => setNewFolderTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">
                  Initial Access
                </label>
                <select
                  value={newFolderPricingMode}
                  onChange={(e) => setNewFolderPricingMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                >
                  <option value="free">Free (Everyone)</option>
                  <option value="paid">Paid</option>
                  <option value="inherit">Inherit from Exam</option>
                </select>
              </div>

              {newFolderPricingMode === 'paid' && (
                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newFolderPrice}
                    onChange={(e) => setNewFolderPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateFolderModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/20 text-xs font-bold text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderTitle.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold"
                >
                  {creatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  Crown,
  FileQuestion,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  Layers,
  Lock,
  PackageCheck,
  Plus,
  RefreshCw,
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
import SvgIconUploader from '../../components/common/SvgIconUploader';
import ContentIcon from '../../components/common/ContentIcon';

function filterTree(nodes, query) {
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
}

export default function PricingManager() {
  const { supabase } = useAuth();
  const { exams, folders, chapters, loading: catalogLoading, refresh: refreshCatalog } = useContentCatalog();

  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);

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
  const [newFolderIcon, setNewFolderIcon] = useState('');
  const [newFolderPricingMode, setNewFolderPricingMode] = useState('free');
  const [newFolderPrice, setNewFolderPrice] = useState(0);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Coupons state from platform_settings
  const [coupons, setCoupons] = useState([]);
  const [couponDraft, setCouponDraft] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    scope: 'global',
    target_exam_id: '',
    target_folder_id: '',
    active: true
  });
  const [couponSearch, setCouponSearch] = useState('');
  const [createCouponModalOpen, setCreateCouponModalOpen] = useState(false);
  const [copiedCouponCode, setCopiedCouponCode] = useState('');

  // Active top tab: 'tree' | 'full_pass' | 'coupons'
  const [activeTab, setActiveTab] = useState('tree');

  // Platform Full Pass configuration state
  const [fullPassConfig, setFullPassConfig] = useState({
    title: 'ZYVRA All-Access Full Pass',
    subtitle: 'सभी परीक्षाओं, टेस्ट्स और टूल्स का 1 साल का अनलिमिटेड एक्सेस',
    price: 499,
    validity_days: 365,
    is_active: true,
    include_all: true,
    included_exam_ids: [],
    included_tool_ids: ['mistake-notebook', 'flashcards', 'math-shortcuts', 'formula-sheet', 'polity-articles', 'risk-simulator']
  });

  // Fetch tests from Supabase
  const fetchTests = useCallback(async () => {
    if (!supabase) return;
    try {
      setLoadingTests(true);
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, chapter_id, folder_id, is_free, status')
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

  // Fetch platform pricing settings, coupons & full pass from Supabase
  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .or('setting_key.in.(content_pricing_rules,coupon_codes,full_pass_config),key.in.(content_pricing_rules,coupon_codes,full_pass_config)');

      if (data) {
        data.forEach((row) => {
          const key = row.setting_key || row.key;
          let val = row.setting_value ?? row.value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch { /* ignore */ }
          }
          if (key === 'content_pricing_rules' && val && typeof val === 'object') {
            setPricingRules(val);
          } else if (key === 'coupon_codes' && Array.isArray(val)) {
            const normalized = val
              .filter((c) => c && typeof c === 'object')
              .map((c) => ({ ...c, id: c.id || `c-${c.code}` }));
            setCoupons(normalized);
          } else if (key === 'full_pass_config' && val && typeof val === 'object') {
            setFullPassConfig((prev) => ({
              ...prev,
              ...val,
              price: val.price !== undefined ? Number(val.price) : prev.price,
              validity_days: val.validity_days !== undefined ? Number(val.validity_days) : prev.validity_days,
              is_active: val.is_active !== undefined ? Boolean(val.is_active) : true,
              include_all: val.include_all !== undefined ? Boolean(val.include_all) : true,
              included_exam_ids: Array.isArray(val.included_exam_ids) ? val.included_exam_ids : [],
              included_tool_ids: Array.isArray(val.included_tool_ids) ? val.included_tool_ids : prev.included_tool_ids
            }));
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

  // Canonical Tools available for Full Pass inclusion
  const AVAILABLE_FULL_PASS_TOOLS = useMemo(() => [
    { id: 'mistake-notebook', name: 'Mistake Notebook Pro (गलती नोटबुक)', category: 'Revision', icon: '🗂️' },
    { id: 'flashcards', name: 'Spaced Flashcards Pro (स्मरण कार्ड्स)', category: 'Memory', icon: '📑' },
    { id: 'math-shortcuts', name: 'Speed Math & Mental Calc (शॉर्टकट ट्रिक्स)', category: 'Math', icon: '🧮' },
    { id: 'formula-sheet', name: 'Reasoning & Logic Formula Hub (सूत्र संग्रह)', category: 'Reasoning', icon: '🧠' },
    { id: 'polity-articles', name: 'Constitution Articles Navigator (संविधान अनुच्छेद)', category: 'General Studies', icon: '🏛️' },
    { id: 'risk-simulator', name: 'Negative Marking Risk Simulator (रिस्क कैलकुलेटर)', category: 'Strategy', icon: '🎯' }
  ], []);

  // Save Platform Full Pass configuration to platform_settings
  const handleSaveFullPass = async () => {
    if (!supabase) return;
    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    try {
      const allExamIds = exams.map((e) => e.id);
      const toSave = {
        title: fullPassConfig.title?.trim() || 'ZYVRA All-Access Full Pass',
        subtitle: fullPassConfig.subtitle?.trim() || 'सभी परीक्षाओं, टेस्ट्स और टूल्स का 1 साल का अनलिमिटेड एक्सेस',
        price: Math.max(0, Number(fullPassConfig.price) || 0),
        validity_days: Math.min(3650, Math.max(1, Number(fullPassConfig.validity_days) || 365)),
        is_active: Boolean(fullPassConfig.is_active),
        include_all: Boolean(fullPassConfig.include_all),
        included_exam_ids: fullPassConfig.include_all ? allExamIds : (fullPassConfig.included_exam_ids || []),
        included_tool_ids: fullPassConfig.included_tool_ids || []
      };

      const { error } = await supabase.from('platform_settings').upsert({
        setting_key: 'full_pass_config',
        key: 'full_pass_config',
        setting_value: toSave,
        value: toSave
      }, { onConflict: 'setting_key' });

      if (error) throw error;
      setFullPassConfig(toSave);
      setStatusMessage({ text: 'Platform Full Pass settings saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to save Full Pass settings:', err);
      setStatusMessage({ text: err.message || 'Failed to save Full Pass settings.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
  };

  // Save coupons array to platform_settings
  const saveCouponsToDatabase = async (nextCoupons) => {
    if (!supabase) {
      setStatusMessage({ text: 'Database is unavailable. Cannot save coupons.', type: 'error' });
      return false;
    }
    setSaving(true);
    setStatusMessage({ text: '', type: '' });
    try {
      const now = new Date().toISOString();
      const payload = nextCoupons.map((c) => ({
        id: c.id || `c-${Date.now()}-${c.code}`,
        code: String(c.code).trim().toUpperCase(),
        discount_type: c.discount_type || 'percent',
        discount_value: Number(c.discount_value) || 0,
        scope: c.scope || 'global',
        target_folder_id: c.scope === 'folder' ? (c.target_folder_id || null) : null,
        target_exam_id: c.scope === 'exam' ? (c.target_exam_id || null) : null,
        active: c.active !== false,
        created_at: c.created_at || now,
        expires_at: c.expires_at || null
      }));

      const { error: upsertError } = await supabase.from('platform_settings').upsert({
        setting_key: 'coupon_codes',
        key: 'coupon_codes',
        setting_value: payload,
        value: payload,
        updated_at: now
      }, { onConflict: 'setting_key' });

      if (upsertError) throw upsertError;

      setCoupons(payload);
      setStatusMessage({ text: 'Coupons updated successfully in cloud database!', type: 'success' });
      return true;
    } catch (err) {
      console.error('Failed to save coupons:', err);
      setStatusMessage({ text: err.message || 'Failed to save coupons.', type: 'error' });
      return false;
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 4000);
    }
  };

  // Create new coupon
  const handleCreateCoupon = async (e) => {
    e?.preventDefault();
    const code = String(couponDraft.code || '').trim().toUpperCase();
    if (!code) {
      setStatusMessage({ text: 'Please enter a coupon code.', type: 'error' });
      return;
    }
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      setStatusMessage({ text: 'Coupon code must be 3-32 characters using uppercase letters, numbers, or dashes (e.g. ZYVRA50).', type: 'error' });
      return;
    }
    const discountVal = Number(couponDraft.discount_value);
    if (!discountVal || discountVal <= 0) {
      setStatusMessage({ text: 'Please enter a valid discount amount greater than 0.', type: 'error' });
      return;
    }
    if (couponDraft.discount_type === 'percent' && discountVal > 100) {
      setStatusMessage({ text: 'Percentage discount cannot exceed 100%.', type: 'error' });
      return;
    }
    if (coupons.some((c) => String(c.code).trim().toUpperCase() === code)) {
      setStatusMessage({ text: `Coupon code '${code}' already exists!`, type: 'error' });
      return;
    }

    const newCoupon = {
      id: `c-${Date.now()}-${code}`,
      code,
      discount_type: couponDraft.discount_type,
      discount_value: discountVal,
      scope: couponDraft.scope,
      target_folder_id: couponDraft.scope === 'folder' ? couponDraft.target_folder_id : null,
      target_exam_id: couponDraft.scope === 'exam' ? couponDraft.target_exam_id : null,
      active: couponDraft.active !== false,
      created_at: new Date().toISOString()
    };

    const nextCoupons = [newCoupon, ...coupons];
    const success = await saveCouponsToDatabase(nextCoupons);
    if (success) {
      setCouponDraft({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        scope: 'global',
        target_exam_id: '',
        target_folder_id: '',
        active: true
      });
      setCreateCouponModalOpen(false);
    }
  };

  // Delete existing coupon
  const handleDeleteCoupon = async (couponIdOrCode) => {
    const target = coupons.find((c) => (c.id || c.code) === couponIdOrCode || c.code === couponIdOrCode);
    const codeName = target?.code || couponIdOrCode;
    if (!window.confirm(`Are you sure you want to permanently delete coupon "${codeName}"? Students will no longer be able to use it.`)) {
      return;
    }
    const nextCoupons = coupons.filter((c) => (c.id || c.code) !== couponIdOrCode && c.code !== couponIdOrCode);
    await saveCouponsToDatabase(nextCoupons);
  };

  // Toggle active/inactive
  const handleToggleCoupon = async (couponIdOrCode) => {
    const nextCoupons = coupons.map((c) => {
      if ((c.id || c.code) === couponIdOrCode || c.code === couponIdOrCode) {
        return { ...c, active: !c.active };
      }
      return c;
    });
    await saveCouponsToDatabase(nextCoupons);
  };

  const handleCopyCoupon = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCouponCode(code);
    setTimeout(() => setCopiedCouponCode(''), 2000);
  };

  const filteredCoupons = useMemo(() => {
    if (!couponSearch.trim()) return coupons;
    const q = couponSearch.toLowerCase().trim();
    return coupons.filter((c) =>
      c.code.toLowerCase().includes(q) ||
      String(c.discount_value).includes(q) ||
      (c.scope || '').toLowerCase().includes(q)
    );
  }, [coupons, couponSearch]);
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
        icon: newFolderIcon || null,
        icon_url: newFolderIcon || null,
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
      setNewFolderIcon('');
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

  const visibleTree = useMemo(() => {
    return filterTree(dynamicTree, treeSearch);
  }, [dynamicTree, treeSearch]);

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-slate-50 dark:text-slate-100 text-slate-900 p-4 sm:p-6 space-y-5">
      {/* Top Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">
            <span>Pricing & Offers</span>
            <ChevronRight size={13} />
            <span className="text-slate-900 dark:text-white">Pricing Control</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            <span>Pricing & Offers Control Center</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure price, discount, and access rules directly on your database content.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { refreshCatalog(); fetchTests(); fetchSettings(); }}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
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

      <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-950/30 px-3.5 py-2.5 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2 mb-4">
        <span>💡 <strong>स्टेप 4 (मूल्य निर्धारण):</strong> किसी भी परीक्षा, विषय फ़ोल्डर या टेस्ट का चयन करके तय करें कि वह 'Free' रहेगा या 'Paid'। आप यहाँ से डिस्काउंट कूपन कोड (Coupon Codes) भी बना सकते हैं।</span>
      </div>

      {/* Status Notice */}
      {statusMessage.text && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-slate-100 dark:bg-slate-800 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/50 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage({ text: '', type: '' })}>✕</button>
        </div>
      )}

      {/* Real Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
            <Layers size={14} /> Total Items
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{totalItemsCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Real Database Content</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
            <Unlock size={14} /> Free Items
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{freeItemsCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {totalItemsCount > 0 ? Math.round((freeItemsCount / totalItemsCount) * 100) : 0}% of catalog
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
            <Lock size={14} /> Paid Items
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">{paidItemsCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {totalItemsCount > 0 ? Math.round((paidItemsCount / totalItemsCount) * 100) : 0}% of catalog
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
            <Folder size={14} /> Folders
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{folders.length}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Under {exams.length} Exam(s)</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
            <FileText size={14} /> Chapters
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{chapters.length}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{tests.length} Active Tests</div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'coupons'
              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 shadow-glowGold'
              : 'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700/60 hover:border-amber-400/60 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
            <BadgePercent size={14} /> Active Coupons
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">{coupons.length}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Manage & Create ↗</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('full_pass')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'full_pass'
              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 shadow-glowGold'
              : 'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700/60 hover:border-amber-400/60 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
            <Crown size={14} /> Full Pass
          </div>
          <div className="text-xl font-black text-amber-500 dark:text-amber-300">₹{fullPassConfig.price ?? 499}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {fullPassConfig.is_active ? 'Active · Click to Edit' : 'Disabled'}
          </div>
        </button>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('tree')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'tree'
              ? 'bg-indigo-600 text-white shadow-glowIndigo font-black'
              : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold shadow-sm'
          }`}
        >
          <Layers size={14} />
          <span>Syllabus & Tree Pricing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'coupons'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-glowGold'
              : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 border border-slate-200 dark:border-slate-700 font-bold shadow-sm'
          }`}
        >
          <BadgePercent size={14} className={activeTab === 'coupons' ? 'text-slate-950' : 'text-amber-500 dark:text-amber-300'} />
          <span>Discount Coupons Studio</span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
            activeTab === 'coupons' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-500 dark:text-amber-300'
          }`}>
            {coupons.length} Active
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('full_pass')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'full_pass'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-glowGold'
              : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 border border-slate-200 dark:border-slate-700 font-bold shadow-sm'
          }`}
        >
          <Crown size={14} className="text-amber-500 dark:text-amber-300" />
          <span>Platform Full Pass (All-Access Pass)</span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
            fullPassConfig.is_active
              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
              : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
          }`}>
            {fullPassConfig.is_active ? `Active · ₹${fullPassConfig.price ?? 499}` : 'Disabled'}
          </span>
        </button>
      </div>

      {/* Main 3-Column Working Grid (Tree View) */}
      {activeTab === 'tree' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ======================================================== */}
        {/* COLUMN 1 (4 Cols): Real Tree View Content Hierarchy */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 p-4 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col h-[420px] lg:h-[680px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <FolderOpen size={15} className="text-amber-500 dark:text-amber-400" />
              <span>Database Content Tree</span>
            </div>
            <button
              type="button"
              onClick={() => setCreateFolderModalOpen(true)}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-slate-300 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 px-2"
              title="Add folder under selected"
            >
              <Plus size={12} />
              <span>Folder</span>
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search content in database..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Real Tree Items List */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 pr-1">
            {catalogLoading || loadingTests ? (
              <LoadingSkeleton count={5} />
            ) : visibleTree.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
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
                        ? 'bg-indigo-50 dark:bg-indigo-600/25 border border-indigo-300 dark:border-indigo-500 text-indigo-900 dark:text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNode(examNode.id);
                        }}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        {expandedNodes.has(examNode.id) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                      <ContentIcon icon={examNode.raw?.icon_url || examNode.raw?.icon} className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" fallback={GraduationCap} />
                      <span className="truncate">{examNode.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 shrink-0">
                      Exam · ₹{examNode.price}
                    </span>
                  </div>

                  {/* Child Folders / Items under Exam */}
                  {expandedNodes.has(examNode.id) && examNode.children?.length > 0 && (
                    <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-700/60 ml-2">
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
                                ? 'bg-indigo-50 dark:bg-indigo-600/25 border border-indigo-300 dark:border-indigo-500 text-indigo-900 dark:text-white'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleNode(folderNode.id);
                                }}
                                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                              <ContentIcon icon={folderNode.raw?.icon_url || folderNode.raw?.icon} className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" fallback={Folder} />
                              <span className="truncate">{folderNode.title}</span>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shrink-0 ${
                              folderNode.accessMode === 'free' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {folderNode.accessMode === 'free' ? 'Free' : `₹${folderNode.price}`}
                            </span>
                          </div>

                          {/* Children under Folder (Subfolders, Chapters, Tests) */}
                          {expandedNodes.has(folderNode.id) && folderNode.children?.length > 0 && (
                            <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-700/60 ml-2">
                              {folderNode.children.map((child) => (
                                <div
                                  key={child.id}
                                  onClick={() => {
                                    setSelectedItemId(child.id);
                                    setSelectedItemType(child.type);
                                  }}
                                  className={`flex items-center justify-between p-1.5 rounded-xl text-[11px] font-medium cursor-pointer transition-colors ${
                                    selectedItemId === child.id
                                      ? 'bg-indigo-50 dark:bg-indigo-600/25 border border-indigo-300 dark:border-indigo-500 text-indigo-900 dark:text-white font-bold'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {child.type === 'chapter' ? (
                                      <FileText size={13} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                                    ) : child.type === 'test' ? (
                                      <FileQuestion size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
                                    ) : (
                                      <ContentIcon icon={child.raw?.icon_url || child.raw?.icon} className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" fallback={Folder} />
                                    )}
                                    <span className="truncate">{child.title}</span>
                                  </div>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 shrink-0">
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
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Header of selected item */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-500 dark:text-amber-300">
                  {selectedItemType === 'exam' ? (
                    <GraduationCap size={20} />
                  ) : selectedItemType === 'folder' ? (
                    <Folder size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                    {currentSelectedItem?.title || 'Select Content from Tree'}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="capitalize">Type: {selectedItemType}</span>
                    {effectivePricing.isInherited && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-bold">
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
                  className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 transition-colors"
                  title="Delete Item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Access Type Radio Group */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-2">
                Access Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'free', label: 'Free (Everyone)', desc: 'Instant access without payment' },
                  { id: 'paid', label: 'Paid (One-time)', desc: 'Requires purchase or bundle' },
                  { id: 'subscription', label: 'Full Pass Included', desc: 'Included in Zyvra Full Pass' },
                  { id: 'inherit', label: 'Inherit from Parent', desc: 'Use parent access & price' }
                ].map((type) => (
                  <label
                    key={type.id}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      formAccessType === type.id
                        ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="accessType"
                        value={type.id}
                        checked={formAccessType === type.id}
                        onChange={(e) => setFormAccessType(e.target.value)}
                        className="accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{type.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-5 mt-0.5">{type.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Price & Discount Settings (if paid) */}
            {formAccessType === 'paid' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Base Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-black text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Discount ({formDiscountType === 'percentage' ? '%' : '₹'})
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={formDiscountValue}
                        onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-black text-sm focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setFormDiscountType(formDiscountType === 'percentage' ? 'flat' : 'percentage')}
                        className="px-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {formDiscountType === 'percentage' ? '%' : '₹'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calculated Effective Price Pill */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Net Effective Student Price:</span>
                  <div className="flex items-center gap-2">
                    {formPrice > finalPrice && (
                      <span className="text-slate-400 line-through text-[11px]">₹{formPrice}</span>
                    )}
                    <span className="text-base font-black text-amber-500 dark:text-amber-400">₹{finalPrice}</span>
                    {formDiscountValue > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
                        {formDiscountType === 'percentage' ? `${formDiscountValue}% OFF` : `₹${formDiscountValue} OFF`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Coin Purchase Option */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
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
                    <Coins size={14} className="text-amber-500 dark:text-amber-400" />
                    <span>Allow purchasing with Zyvra Coins</span>
                  </label>

                  {formCoinAllowed && (
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">Coin Price:</span>
                      <input
                        type="number"
                        min="0"
                        value={formCoinPrice}
                        onChange={(e) => setFormCoinPrice(Number(e.target.value))}
                        className="w-24 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-300 font-bold text-xs"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">(10 Coins = ₹1)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recursive Inheritance Toggle (Zero DB row spamming) */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Recursive Child Inheritance</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
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
          <div className="p-4 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-2">
              <Zap size={14} className="text-amber-500 dark:text-amber-400" />
              <span>Quick Actions</span>
            </h3>

            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Make this item FREE (₹0) and remove discount? Click Save Changes to persist.')) return;
                setFormAccessType('free');
                setFormPrice(0);
                setFormDiscountValue(0);
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-sm"
            >
              <span>Make Item Free</span>
              <Unlock size={13} className="text-emerald-500 dark:text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Apply Standard ₹99 Pack (₹99, 20% discount, 800 coins)? Click Save Changes to persist.')) return;
                setFormAccessType('paid');
                setFormPrice(99);
                setFormDiscountValue(20);
                setFormCoinAllowed(true);
                setFormCoinPrice(800);
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-sm"
            >
              <span>Apply Standard ₹99 Pack</span>
              <Tag size={13} className="text-amber-500 dark:text-amber-400" />
            </button>

            <button
              type="button"
              onClick={() => setCreateFolderModalOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-sm"
            >
              <span>Create New Folder</span>
              <FolderPlus size={13} className="text-indigo-500 dark:text-indigo-400" />
            </button>
          </div>

          {/* Real Coupons Configured */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <BadgePercent size={14} className="text-amber-500 dark:text-amber-400" />
                <span>Configured Coupons</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">{coupons.length} total</span>
                <button
                  type="button"
                  onClick={() => {
                    setCouponDraft({
                      code: '',
                      discount_type: 'percent',
                      discount_value: '',
                      scope: 'global',
                      target_exam_id: '',
                      target_folder_id: '',
                      active: true
                    });
                    setCreateCouponModalOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-500 dark:text-amber-300 text-[10px] font-black flex items-center gap-1 transition-colors"
                  title="Create a new discount coupon"
                >
                  <Plus size={11} />
                  <span>+ New</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {coupons.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  No coupons configured in system.
                </div>
              ) : (
                coupons.map((c) => (
                  <div
                    key={c.id || c.code}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between shadow-sm"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="text-xs font-mono font-black text-amber-600 dark:text-amber-300 truncate">{c.code}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`} · {c.scope || 'global'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleCoupon(c.id || c.code)}
                        disabled={saving}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                          c.active !== false
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100'
                            : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border-slate-300 dark:border-neutral-700 hover:bg-slate-300'
                        }`}
                        title={c.active !== false ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {c.active !== false ? 'Active' : 'Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(c.id || c.code)}
                        disabled={saving}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        title={`Delete coupon ${c.code}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PLATFORM FULL PASS (ALL-ACCESS PASS) MANAGER */}
      {/* ======================================================== */}
      {activeTab === 'full_pass' && (
        <div className="space-y-5">
          {/* Top Banner Notice */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-indigo-500/15 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center text-2xl shadow-glowGold shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    All-Access Platform Pass
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    fullPassConfig.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {fullPassConfig.is_active ? 'Active on Student Portal' : 'Paused / Hidden'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {fullPassConfig.title || 'ZYVRA All-Access Full Pass'}
                </h2>
                <p className="text-xs text-slate-300 font-medium max-w-2xl mt-0.5">
                  छात्रों को 1 साल के लिए प्लेटफॉर्म के सभी कोर्सेज, टेस्ट्स और टूल्स का एक साथ एक्सेस देने के लिए यह मास्टर बंडल है। आप यहाँ तय कर सकते हैं कि पास चालू रहेगा या बंद, मूल्य कितना होगा, और इसमें कौन-कौन से कोर्सेज और टूल्स शामिल होंगे।
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveFullPass}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-glowGold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 active:scale-95"
            >
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Full Pass Settings'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Columns: Form Controls */}
            <div className="lg:col-span-7 space-y-4">
              {/* Card 1: Core Pass Attributes */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Crown size={15} className="text-amber-500 dark:text-amber-400" />
                    <span>Pass Pricing & Status</span>
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {fullPassConfig.is_active ? 'Active (चालू)' : 'Paused (बंद)'}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(fullPassConfig.is_active)}
                      onChange={(e) => setFullPassConfig((prev) => ({ ...prev, is_active: e.target.checked }))}
                      className="accent-amber-400 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Pass Title (नाम)</label>
                    <input
                      type="text"
                      value={fullPassConfig.title || ''}
                      onChange={(e) => setFullPassConfig((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g. ZYVRA All-Access Full Pass"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Tagline / Subtitle (विवरण)</label>
                    <input
                      type="text"
                      value={fullPassConfig.subtitle || ''}
                      onChange={(e) => setFullPassConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="e.g. सभी परीक्षाओं, टेस्ट्स और टूल्स का 1 साल का अनलिमिटेड एक्सेस"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Price in Rupees (₹ मूल्य)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={fullPassConfig.price ?? 499}
                          onChange={(e) => setFullPassConfig((prev) => ({ ...prev, price: Math.max(0, Number(e.target.value) || 0) }))}
                          className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-300 text-sm font-black focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Validity (दिनों में)</label>
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={fullPassConfig.validity_days ?? 365}
                        onChange={(e) => setFullPassConfig((prev) => ({ ...prev, validity_days: Math.max(1, Number(e.target.value) || 365) }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-black focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Included Courses & Exams */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <GraduationCap size={15} className="text-indigo-500 dark:text-indigo-400" />
                    <span>Included Courses & Exams (शामिल परीक्षाएं)</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {fullPassConfig.include_all ? 'All Exams Included' : `${fullPassConfig.included_exam_ids?.length || 0} of ${exams.length} Selected`}
                  </span>
                </div>

                {/* Scope Mode: All-Inclusive vs Custom Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    fullPassConfig.include_all
                      ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pass_scope"
                        checked={Boolean(fullPassConfig.include_all)}
                        onChange={() => setFullPassConfig((prev) => ({ ...prev, include_all: true }))}
                        className="accent-indigo-500"
                      />
                      <span className="text-xs font-black text-slate-900 dark:text-white">ऑल-इनक्लूसिव (Auto-Include All)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-5 leading-relaxed">
                      वर्तमान और भविष्य में बनने वाली सभी परीक्षाएं अपने आप फुल पास में अनलॉक रहेंगी।
                    </p>
                  </label>

                  <label className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    !fullPassConfig.include_all
                      ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pass_scope"
                        checked={!fullPassConfig.include_all}
                        onChange={() => setFullPassConfig((prev) => ({ ...prev, include_all: false }))}
                        className="accent-indigo-500"
                      />
                      <span className="text-xs font-black text-slate-900 dark:text-white">कस्टम चयन (Select Specific)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-5 leading-relaxed">
                      केवल वे परीक्षाएं जिन्हें आप नीचे चेकबॉक्स से चुनेंगे, वही शामिल होंगी।
                    </p>
                  </label>
                </div>

                {/* Exam Checkbox List */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">उपलब्ध परीक्षाएं (Exams in Catalog):</span>
                    {!fullPassConfig.include_all && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFullPassConfig((prev) => ({ ...prev, included_exam_ids: exams.map((e) => e.id) }))}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-slate-400 dark:text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => setFullPassConfig((prev) => ({ ...prev, included_exam_ids: [] }))}
                          className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto no-scrollbar">
                    {exams.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No published exams found in database.
                      </div>
                    ) : (
                      exams.map((exam) => {
                        const isChecked = fullPassConfig.include_all || (fullPassConfig.included_exam_ids || []).includes(exam.id);
                        const examFolders = folders.filter((f) => f.exam_id === exam.id);

                        return (
                          <label
                            key={exam.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/40 text-indigo-950 dark:text-white'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={fullPassConfig.include_all}
                              checked={isChecked}
                              onChange={(e) => {
                                const current = fullPassConfig.included_exam_ids || [];
                                const next = e.target.checked
                                  ? [...new Set([...current, exam.id])]
                                  : current.filter((id) => id !== exam.id);
                                setFullPassConfig((prev) => ({ ...prev, included_exam_ids: next }));
                              }}
                              className="accent-indigo-500 w-4 h-4 rounded cursor-pointer disabled:opacity-75"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">{exam.title}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                                  {examFolders.length} folders
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                {exam.description || `${exam.category || 'Exam'} syllabus & question sets`}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Included Pro Tools */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <PackageCheck size={15} className="text-emerald-500 dark:text-emerald-400" />
                    <span>Included Study Tools (शामिल टूल्स)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFullPassConfig((prev) => ({ ...prev, included_tool_ids: AVAILABLE_FULL_PASS_TOOLS.map((t) => t.id) }))}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setFullPassConfig((prev) => ({ ...prev, included_tool_ids: [] }))}
                      className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_FULL_PASS_TOOLS.map((tool) => {
                    const isChecked = (fullPassConfig.included_tool_ids || []).includes(tool.id);
                    return (
                      <label
                        key={tool.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-950 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = fullPassConfig.included_tool_ids || [];
                            const next = e.target.checked
                              ? [...new Set([...current, tool.id])]
                              : current.filter((id) => id !== tool.id);
                            setFullPassConfig((prev) => ({ ...prev, included_tool_ids: next }));
                          }}
                          className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-base shrink-0">{tool.icon}</span>
                        <div className="min-w-0 flex-1">
                          <strong className="text-xs font-bold block truncate text-slate-900 dark:text-slate-100">{tool.name}</strong>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{tool.category}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Live Student Preview & Actions */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500 dark:text-amber-400" />
                    <span>Live Student Preview (छात्रों को कैसा दिखेगा)</span>
                  </h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Real-time</span>
                </div>

                {/* Simulated Student Portal Banner */}
                <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-indigo-500/20 border-2 border-amber-400/60 shadow-md space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-1">
                      👑 All-Access Full Pass
                    </span>
                    <span className="text-[10px] font-bold text-amber-300">
                      {fullPassConfig.validity_days || 365} Days Unlimited
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white">
                      {fullPassConfig.title || 'ZYVRA All-Access Full Pass'}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                      {fullPassConfig.subtitle || 'सभी परीक्षाओं, टेस्ट्स और टूल्स का 1 साल का अनलिमिटेड एक्सेस'}
                    </p>
                  </div>

                  <div className="space-y-1 text-[11px] font-medium text-slate-300">
                    <div className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>{fullPassConfig.include_all ? 'सभी वर्तमान और भविष्य की परीक्षाएं' : `${fullPassConfig.included_exam_ids?.length || 0} चुनिंदा परीक्षाएं`}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>पूरा टेस्ट सीरीज व अध्याय-वार मॉक टेस्ट</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>{fullPassConfig.included_tool_ids?.length || 0} प्रो स्टडी टूल्स (गलती नोटबुक, सूत्र...)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-400/30 flex items-center justify-between">
                    <div>
                      <div className="text-xl font-black text-amber-300 leading-none">
                        ₹{fullPassConfig.price ?? 499}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {fullPassConfig.validity_days || 365} दिनों की वैधता
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs shadow-glowGold opacity-95 cursor-default flex items-center gap-1"
                    >
                      <span>पूरा पास अनलॉक करें →</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <strong className="block text-slate-900 dark:text-slate-100 font-bold flex items-center gap-1.5">
                    <span>💡 यह कैसे काम करता है:</span>
                  </strong>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    छात्र जैसे ही इस पास को खरीदेगा, उसका खाता Razorpay से वेरीफाई होते ही डेटाबेस में <code>user_access (item_type: 'full_pass', item_id: 'global')</code> में दर्ज हो जाएगा।
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    इसके बाद छात्र के लिए वे सभी कोर्सेज और टूल्स तुरंत अनलॉक हो जाएंगे जो आपने ऊपर शामिल किए हैं।
                  </p>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveFullPass}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-glowGold transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  <Save size={16} />
                  <span>{saving ? 'Updating Database...' : 'Save Full Pass Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: DISCOUNT COUPONS STUDIO */}
      {/* ======================================================== */}
      {activeTab === 'coupons' && (
        <div className="space-y-5">
          {/* Top Banner Notice */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-slate-950 flex items-center justify-center text-2xl shadow-glowGold shrink-0">
                🏷️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Promotions & Discounts
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {coupons.filter((c) => c.active !== false).length} Active Live
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Discount Coupons Studio
                </h2>
                <p className="text-xs text-slate-300 font-medium max-w-2xl mt-0.5">
                  यहाँ से आप अपने छात्रों के लिए नए डिस्काउंट कोड्स (Flat ₹ या % OFF) बना सकते हैं, चालू/बंद कर सकते हैं, या हमेशा के लिए डिलीट कर सकते हैं। यह चेकआउट के समय लाइव काम करता है।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCouponDraft({
                  code: '',
                  discount_type: 'percent',
                  discount_value: '',
                  scope: 'global',
                  target_exam_id: '',
                  target_folder_id: '',
                  active: true
                });
                setCreateCouponModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-glowGold transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              <Plus size={15} />
              <span>+ Create New Coupon</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 5 Columns: Create Form Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <BadgePercent size={16} className="text-amber-500 dark:text-amber-400" />
                    <span>Create Discount Coupon</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">New Code</span>
                </div>

                <form onSubmit={handleCreateCoupon} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Coupon Code (कूपन कोड) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ZYVRA50, FESTIVAL20, DIWALI75"
                      value={couponDraft.code}
                      onChange={(e) => setCouponDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-mono font-black focus:outline-none focus:border-amber-400 uppercase tracking-wider"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                      छात्र चेकआउट पर यह कोड दर्ज करेंगे (उदा. ZYVRA50)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Discount Type
                      </label>
                      <select
                        value={couponDraft.discount_type}
                        onChange={(e) => setCouponDraft((prev) => ({ ...prev, discount_type: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                      >
                        <option value="percent">Percentage (% छूट)</option>
                        <option value="flat">Flat Amount (₹ छूट)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Discount Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">
                          {couponDraft.discount_type === 'percent' ? '%' : '₹'}
                        </span>
                        <input
                          type="number"
                          required
                          min="1"
                          max={couponDraft.discount_type === 'percent' ? 100 : 100000}
                          placeholder={couponDraft.discount_type === 'percent' ? '50' : '200'}
                          value={couponDraft.discount_value}
                          onChange={(e) => setCouponDraft((prev) => ({ ...prev, discount_value: e.target.value }))}
                          className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-black focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                      Quick Preset Values:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {couponDraft.discount_type === 'percent' ? (
                        [10, 20, 25, 50, 60, 75, 90].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCouponDraft((prev) => ({ ...prev, discount_value: String(val) }))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                              String(couponDraft.discount_value) === String(val)
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {val}%
                          </button>
                        ))
                      ) : (
                        [50, 100, 200, 500, 999].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCouponDraft((prev) => ({ ...prev, discount_value: String(val) }))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                              String(couponDraft.discount_value) === String(val)
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            ₹{val}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Scope Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Applicable Scope (कहाँ लागू होगा)
                    </label>
                    <select
                      value={couponDraft.scope}
                      onChange={(e) => setCouponDraft((prev) => ({ ...prev, scope: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                    >
                      <option value="global">Global (All Platform Items, Passes & Tests)</option>
                      <option value="exam">Specific Exam Only</option>
                      <option value="folder">Specific Folder Only</option>
                    </select>
                  </div>

                  {couponDraft.scope === 'exam' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Select Exam
                      </label>
                      <select
                        value={couponDraft.target_exam_id}
                        onChange={(e) => setCouponDraft((prev) => ({ ...prev, target_exam_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                      >
                        <option value="">-- Choose Exam --</option>
                        {exams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.title} ({exam.category || 'Exam'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {couponDraft.scope === 'folder' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Target Folder ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. folder UUID"
                        value={couponDraft.target_folder_id}
                        onChange={(e) => setCouponDraft((prev) => ({ ...prev, target_folder_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {/* Active Toggle */}
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(couponDraft.active)}
                      onChange={(e) => setCouponDraft((prev) => ({ ...prev, active: e.target.checked }))}
                      className="accent-amber-400 w-4 h-4 rounded cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                        Activate Immediately
                      </strong>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                        बनाते ही छात्र इस कूपन का उपयोग चेकआउट में कर सकेंगे।
                      </span>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={saving || !couponDraft.code.trim() || !couponDraft.discount_value}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-glowGold transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                  >
                    <Plus size={16} />
                    <span>{saving ? 'Saving Coupon...' : 'Save & Publish Coupon'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right 7 Columns: Active & Configured Coupons List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E293B]/70 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Sparkles size={15} className="text-amber-500 dark:text-amber-400" />
                      <span>Configured Coupons ({filteredCoupons.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      क्लिक करके कूपन कोड कॉपी करें, चालू/बंद करें या डिलीट करें।
                    </p>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search coupons..."
                      value={couponSearch}
                      onChange={(e) => setCouponSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {filteredCoupons.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/60 p-6">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-xl mb-3">
                      🏷️
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No coupons found</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      {couponSearch ? 'No coupons match your search query.' : 'No discount coupons have been created yet. Use the form on the left to create your first coupon!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredCoupons.map((coupon) => {
                      const isPercent = coupon.discount_type === 'percent';
                      const isActive = coupon.active !== false;
                      const isCopied = copiedCouponCode === coupon.code;

                      return (
                        <div
                          key={coupon.id || coupon.code}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isActive
                              ? 'bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700/70 hover:border-amber-400/40'
                              : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            {/* Copy button with Code */}
                            <button
                              type="button"
                              onClick={() => handleCopyCoupon(coupon.code)}
                              className="px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-400/30 hover:border-amber-400 text-amber-700 dark:text-amber-300 font-mono font-black text-sm tracking-wider flex items-center gap-1.5 transition-all active:scale-95 group shrink-0"
                              title="Click to copy coupon code"
                            >
                              <span>{coupon.code}</span>
                              {isCopied ? (
                                <Check size={13} className="text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Copy size={13} className="opacity-60 group-hover:opacity-100" />
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isPercent
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {isPercent ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} FLAT OFF`}
                                </span>

                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  Scope: {coupon.scope === 'exam' ? `Exam (${coupon.target_exam_id || 'ID'})` : coupon.scope === 'folder' ? 'Folder' : 'Global (All items)'}
                                </span>
                              </div>

                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1 truncate">
                                {isActive ? 'Live & available to students at checkout' : 'Disabled — cannot be applied by students'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: Toggle Active & Delete */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(coupon.id || coupon.code)}
                              disabled={saving}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                                isActive
                                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100'
                                  : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border-slate-300 dark:border-neutral-700 hover:bg-slate-300'
                              }`}
                              title={isActive ? 'Click to deactivate coupon' : 'Click to activate coupon'}
                            >
                              {isActive ? 'Active (चालू)' : 'Paused (बंद)'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(coupon.id || coupon.code)}
                              disabled={saving}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 border border-slate-200 dark:border-slate-700/60 transition-all active:scale-95"
                              title={`Delete ${coupon.code} coupon permanently`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Coupon Modal */}
      {createCouponModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <BadgePercent size={18} className="text-amber-400" />
                <span>Create New Coupon Code</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateCouponModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ZYVRA50, NEWYEAR25"
                  value={couponDraft.code}
                  onChange={(e) => setCouponDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-mono font-black focus:outline-none focus:border-amber-400 uppercase tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discount Type
                  </label>
                  <select
                    value={couponDraft.discount_type}
                    onChange={(e) => setCouponDraft((prev) => ({ ...prev, discount_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="percent">Percentage (% छूट)</option>
                    <option value="flat">Flat Amount (₹ छूट)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discount Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">
                      {couponDraft.discount_type === 'percent' ? '%' : '₹'}
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      max={couponDraft.discount_type === 'percent' ? 100 : 100000}
                      placeholder={couponDraft.discount_type === 'percent' ? '50' : '200'}
                      value={couponDraft.discount_value}
                      onChange={(e) => setCouponDraft((prev) => ({ ...prev, discount_value: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-black focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Applicable Scope
                </label>
                <select
                  value={couponDraft.scope}
                  onChange={(e) => setCouponDraft((prev) => ({ ...prev, scope: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="global">Global (All Platform Items)</option>
                  <option value="exam">Specific Exam Only</option>
                  <option value="folder">Specific Folder Only</option>
                </select>
              </div>

              {couponDraft.scope === 'exam' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Select Exam
                  </label>
                  <select
                    value={couponDraft.target_exam_id}
                    onChange={(e) => setCouponDraft((prev) => ({ ...prev, target_exam_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Choose Exam --</option>
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(couponDraft.active)}
                  onChange={(e) => setCouponDraft((prev) => ({ ...prev, active: e.target.checked }))}
                  className="accent-amber-400 w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Activate Immediately (कूपन तुरंत चालू रखें)
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateCouponModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !couponDraft.code.trim() || !couponDraft.discount_value}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold"
                >
                  {saving ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Folder */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white space-y-4 shadow-2xl">
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Folder Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 7 or Science"
                  value={newFolderTitle}
                  onChange={(e) => setNewFolderTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <SvgIconUploader
                  value={newFolderIcon}
                  onChange={setNewFolderIcon}
                  label="Folder Custom SVG Icon (Optional)"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Initial Access
                </label>
                <select
                  value={newFolderPricingMode}
                  onChange={(e) => setNewFolderPricingMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="free">Free (Everyone)</option>
                  <option value="paid">Paid</option>
                  <option value="inherit">Inherit from Exam</option>
                </select>
              </div>

              {newFolderPricingMode === 'paid' && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newFolderPrice}
                    onChange={(e) => setNewFolderPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateFolderModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300"
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

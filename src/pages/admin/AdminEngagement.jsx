import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Tag,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Check,
  Search,
  Target,
  Trophy,
  Rocket,
  Coins,
  Flame,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadAsset } from '../../lib/storage';
import UploadGuide from '../../components/common/UploadGuide';
import MathRenderer from '../../components/common/MathRenderer';

const PRESET_ICONS = [
  { id: 'target', label: 'Target / Goal', Icon: Target, color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30' },
  { id: 'trophy', label: 'Trophy / Winner', Icon: Trophy, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
  { id: 'rocket', label: 'Rocket / Launch', Icon: Rocket, color: 'text-sky-400 bg-sky-500/20 border-sky-500/30' },
  { id: 'coins', label: 'Coins / Reward', Icon: Coins, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
  { id: 'sale', label: 'Offer / Flame', Icon: Flame, color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' }
];

const ROUTE_PRESETS = [
  { label: 'Explore Exams', path: '/explore' },
  { label: 'Test Hub', path: '/tests' },
  { label: 'Student Wallet', path: '/wallet' },
  { label: 'Toolbox', path: '/toolbox' },
  { label: 'Profile / Referral', path: '/profile' }
];

export default function AdminEngagement() {
  const [activeTab, setActiveTab] = useState('banners'); // 'banners' | 'qotd'

  // ==========================================
  // BANNERS STATE
  // ==========================================
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState({
    badge_text: 'NEW MOCK',
    title: '',
    subtitle: '',
    cta_text: 'Explore Now',
    cta_link: '/explore',
    banner_mode: 'card',
    graphic_type: 'preset',
    preset_icon: 'target',
    custom_image_url: '',
    is_active: true,
    display_order: 0
  });
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const bannerFileInputRef = useRef(null);

  // ==========================================
  // QUESTION OF THE DAY (QotD) STATE
  // ==========================================
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [rewardCoins, setRewardCoins] = useState(10);
  const [recentChallenges, setRecentChallenges] = useState([]);

  // Question search
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionResults, setQuestionResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [challengeSaving, setChallengeSaving] = useState(false);
  const [qotdFeedback, setQotdFeedback] = useState({ type: '', text: '' });

  // ==========================================
  // LOAD BANNERS
  // ==========================================
  const fetchBanners = useCallback(async () => {
    if (!supabase) return;
    setBannersLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotional_banners')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
    } finally {
      setBannersLoading(false);
    }
  }, []);

  // ==========================================
  // LOAD QotD FOR SELECTED DATE
  // ==========================================
  const fetchChallengeForDate = useCallback(async (date) => {
    if (!supabase) return;
    setChallengeLoading(true);
    setQotdFeedback({ type: '', text: '' });
    try {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*, question:questions(*)')
        .eq('target_date', date)
        .maybeSingle();

      if (error) throw error;
      setActiveChallenge(data);
      if (data) {
        setSelectedQuestion(data.question);
        setRewardCoins(data.reward_coins || 10);
      } else {
        setSelectedQuestion(null);
        setRewardCoins(10);
      }
    } catch (err) {
      console.error('Error fetching challenge:', err);
    } finally {
      setChallengeLoading(false);
    }
  }, []);

  // Load recent challenges overview
  const fetchRecentChallenges = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('id, target_date, reward_coins, question:questions(id, question_text, subject)')
        .order('target_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentChallenges(data || []);
    } catch (err) {
      console.error('Error loading recent challenges:', err);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
    fetchChallengeForDate(selectedDate);
    fetchRecentChallenges();
  }, [fetchBanners, fetchChallengeForDate, fetchRecentChallenges, selectedDate]);

  // Search questions for QotD
  useEffect(() => {
    if (!questionSearch.trim() || !supabase) {
      setQuestionResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const query = questionSearch.trim();
        const { data, error } = await supabase
          .from('questions')
          .select('id, question_text, question_text_hi, subject, topic, correct_answer, options')
          .or(`question_text.ilike.%${query}%,subject.ilike.%${query}%,topic.ilike.%${query}%`)
          .limit(8);

        if (error) throw error;
        setQuestionResults(data || []);
      } catch (err) {
        console.error('Error searching questions:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [questionSearch]);

  // ==========================================
  // BANNER ACTIONS
  // ==========================================
  const handleOpenCreateBanner = () => {
    setEditingBanner(null);
    setBannerForm({
      badge_text: 'NEW MOCK',
      title: '',
      subtitle: '',
      cta_text: 'Explore Now',
      cta_link: '/explore',
      banner_mode: 'card',
      graphic_type: 'preset',
      preset_icon: 'target',
      custom_image_url: '',
      is_active: true,
      display_order: banners.length
    });
    setBannerError('');
    setBannerModalOpen(true);
  };

  const handleOpenEditBanner = (banner) => {
    setEditingBanner(banner);
    setBannerForm({
      badge_text: banner.badge_text || '',
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      cta_text: banner.cta_text || 'Explore Now',
      cta_link: banner.cta_link || '/explore',
      banner_mode: banner.banner_mode || 'card',
      graphic_type: banner.graphic_type || 'preset',
      preset_icon: banner.preset_icon || 'target',
      custom_image_url: banner.custom_image_url || '',
      is_active: banner.is_active ?? true,
      display_order: banner.display_order ?? 0
    });
    setBannerError('');
    setBannerModalOpen(true);
  };

  const handleCustomImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerError('');
    setBannerUploading(true);
    try {
      const isFullImage = bannerForm.banner_mode === 'full_image';
      const result = await uploadAsset(file, {
        folder: 'banners',
        allowedExtensions: isFullImage
          ? ['png', 'webp', 'jpg', 'jpeg']
          : ['svg', 'png', 'webp', 'jpg', 'jpeg'],
        maxSizeBytes: isFullImage ? 1500 * 1024 : 800 * 1024
      });
      setBannerForm((prev) => ({
        ...prev,
        custom_image_url: result.url,
        graphic_type: 'custom'
      }));
    } catch (err) {
      setBannerError(err.message || 'Image upload failed.');
    } finally {
      setBannerUploading(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (!bannerForm.title.trim()) {
      setBannerError('Banner title is required.');
      return;
    }
    if (!bannerForm.cta_link.trim()) {
      setBannerError('Call to action link is required.');
      return;
    }

    const isFullImage = bannerForm.banner_mode === 'full_image';
    if (isFullImage && !bannerForm.custom_image_url) {
      setBannerError('Please upload a banner image for Full Banner Image mode.');
      return;
    }

    setBannerSaving(true);
    setBannerError('');
    try {
      const payload = {
        badge_text: isFullImage ? (bannerForm.badge_text?.trim() || '') : bannerForm.badge_text.trim(),
        title: bannerForm.title.trim(),
        subtitle: isFullImage ? '' : bannerForm.subtitle.trim(),
        cta_text: bannerForm.cta_text.trim() || 'Explore Now',
        cta_link: bannerForm.cta_link.trim(),
        banner_mode: bannerForm.banner_mode || 'card',
        graphic_type: isFullImage ? 'custom' : bannerForm.graphic_type,
        preset_icon: bannerForm.preset_icon,
        custom_image_url: (isFullImage || bannerForm.graphic_type === 'custom') ? bannerForm.custom_image_url : null,
        is_active: bannerForm.is_active,
        display_order: Number(bannerForm.display_order) || 0,
        updated_at: new Date().toISOString()
      };

      if (editingBanner) {
        const { error } = await supabase
          .from('promotional_banners')
          .update(payload)
          .eq('id', editingBanner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('promotional_banners')
          .insert([payload]);
        if (error) throw error;
      }

      setBannerModalOpen(false);
      fetchBanners();
    } catch (err) {
      setBannerError(err.message || 'Failed to save promotional banner.');
    } finally {
      setBannerSaving(false);
    }
  };

  const handleToggleBannerActive = async (banner) => {
    try {
      const { error } = await supabase
        .from('promotional_banners')
        .update({ is_active: !banner.is_active, updated_at: new Date().toISOString() })
        .eq('id', banner.id);

      if (error) throw error;
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
      );
    } catch (err) {
      console.error('Error toggling banner:', err);
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm('Are you sure you want to delete this promotional banner?')) return;
    try {
      const { error } = await supabase
        .from('promotional_banners')
        .delete()
        .eq('id', bannerId);

      if (error) throw error;
      setBanners((prev) => prev.filter((b) => b.id !== bannerId));
    } catch (err) {
      console.error('Error deleting banner:', err);
    }
  };

  // ==========================================
  // QotD ACTIONS
  // ==========================================
  const handleSaveChallenge = async () => {
    if (!selectedQuestion) {
      setQotdFeedback({ type: 'error', text: 'Please select a question from the question bank.' });
      return;
    }
    if (!selectedDate) {
      setQotdFeedback({ type: 'error', text: 'Please select a valid target date.' });
      return;
    }

    setChallengeSaving(true);
    setQotdFeedback({ type: '', text: '' });
    try {
      const payload = {
        target_date: selectedDate,
        question_id: selectedQuestion.id,
        reward_coins: Number(rewardCoins) || 10,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('daily_challenges')
        .upsert(payload, { onConflict: 'target_date' })
        .select('*, question:questions(*)')
        .single();

      if (error) throw error;

      setActiveChallenge(data);
      setQotdFeedback({
        type: 'success',
        text: `Question of the Day for ${selectedDate} saved successfully (+${data.reward_coins} Coins)!`
      });
      fetchRecentChallenges();
    } catch (err) {
      setQotdFeedback({ type: 'error', text: err.message || 'Failed to save Daily Challenge.' });
    } finally {
      setChallengeSaving(false);
    }
  };

  const handleRemoveChallenge = async () => {
    if (!activeChallenge) return;
    if (!window.confirm(`Remove Question of the Day for ${selectedDate}?`)) return;

    setChallengeSaving(true);
    try {
      const { error } = await supabase
        .from('daily_challenges')
        .delete()
        .eq('id', activeChallenge.id);

      if (error) throw error;

      setActiveChallenge(null);
      setSelectedQuestion(null);
      setQotdFeedback({ type: 'success', text: `Challenge for ${selectedDate} removed.` });
      fetchRecentChallenges();
    } catch (err) {
      setQotdFeedback({ type: 'error', text: err.message || 'Failed to remove challenge.' });
    } finally {
      setChallengeSaving(false);
    }
  };

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-800 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            <span>Student Engagement Operations</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
            <span>Banners & Daily Challenge (QotD)</span>
          </h1>
          <p className="text-xs dark:text-slate-400 text-slate-600 mt-0.5">
            Manage interactive hero carousel slides and assign daily questions to incentivize student retention.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-2xl dark:bg-[#1E293B] bg-slate-200 border dark:border-slate-700/60 border-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('banners')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
              activeTab === 'banners'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tag size={13} />
            <span>Promotional Banners ({banners.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qotd')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
              activeTab === 'qotd'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar size={13} />
            <span>Question of the Day (QotD)</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PROMOTIONAL BANNERS */}
      {/* ======================================================== */}
      {activeTab === 'banners' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider dark:text-slate-300 text-slate-700">
              Active & Configured Banners
            </h2>
            <button
              type="button"
              onClick={handleOpenCreateBanner}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Add New Banner</span>
            </button>
          </div>

          {bannersLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading banners...</div>
          ) : banners.length === 0 ? (
            <div className="p-8 rounded-3xl dark:bg-[#1E293B]/60 bg-white border dark:border-slate-700/60 border-slate-200 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto opacity-70" />
              <div className="text-sm font-bold dark:text-white text-slate-800">
                No promotional banners created yet.
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create announcements, test release alerts, or discount banners to display directly in the student dashboard.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateBanner}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Create First Banner</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {banners.map((banner) => {
                const presetObj = PRESET_ICONS.find((p) => p.id === banner.preset_icon) || PRESET_ICONS[0];
                const PresetIcon = presetObj.Icon;

                return (
                  <div
                    key={banner.id}
                    className={`rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3 border transition-all ${
                      banner.is_active
                        ? 'dark:bg-[#1E293B] bg-white dark:border-slate-700/80 border-slate-200 shadow-md'
                        : 'dark:bg-[#1E293B]/40 bg-slate-100 dark:border-slate-800 border-slate-200 opacity-70'
                    }`}
                  >
                    <div>
                      {/* Top Row: Badge & Status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {banner.badge_text && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                              {banner.badge_text}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-slate-800 bg-slate-100 text-slate-400 border dark:border-slate-700 border-slate-300">
                            {banner.banner_mode === 'full_image' ? '🖼️ Full Banner' : '📝 Card'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleBannerActive(banner)}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                              banner.is_active
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-slate-500 hover:bg-slate-700/40'
                            }`}
                            title={banner.is_active ? 'Click to Deactivate' : 'Click to Activate'}
                          >
                            {banner.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span className="text-[10px]">{banner.is_active ? 'Active' : 'Hidden'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Content & Graphic Preview */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black dark:text-white text-slate-900 leading-snug line-clamp-2">
                            {banner.title}
                          </h3>
                          {banner.subtitle && banner.banner_mode !== 'full_image' && (
                            <p className="text-xs dark:text-slate-400 text-slate-600 mt-1 line-clamp-2">
                              {banner.subtitle}
                            </p>
                          )}
                          <div className="mt-2 text-[11px] font-mono text-indigo-400 truncate">
                            🔗 {banner.cta_link}
                          </div>
                        </div>

                        {/* Graphic Icon / Image */}
                        {banner.banner_mode === 'full_image' && banner.custom_image_url ? (
                          <div className="w-20 h-12 rounded-xl dark:bg-[#0F172A] bg-slate-100 border dark:border-slate-700 border-slate-200 overflow-hidden shrink-0 shadow-inner">
                            <img
                              src={banner.custom_image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl dark:bg-[#0F172A] bg-slate-100 border dark:border-slate-700 border-slate-200 flex items-center justify-center shrink-0 p-1.5 shadow-inner">
                            {banner.graphic_type === 'custom' && banner.custom_image_url ? (
                              <img
                                src={banner.custom_image_url}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <PresetIcon size={22} className={presetObj.color.split(' ')[0]} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-2 border-t dark:border-slate-700/60 border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400 font-bold">
                        Order: {banner.display_order}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBanner(banner)}
                          className="p-1.5 rounded-lg dark:hover:bg-slate-700 hover:bg-slate-200 text-slate-400 hover:text-white transition-colors"
                          title="Edit Banner"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="p-1.5 rounded-lg dark:hover:bg-rose-950/60 hover:bg-rose-100 text-rose-400 transition-colors"
                          title="Delete Banner"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: QUESTION OF THE DAY (QotD) */}
      {/* ======================================================== */}
      {activeTab === 'qotd' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Date & Assignment Editor (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-5 sm:p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b dark:border-slate-700/60 border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-amber-400" />
                  <span className="text-sm font-black dark:text-white text-slate-900">
                    Challenge Schedule & Question Assignment
                  </span>
                </div>
                {activeChallenge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Assigned
                  </span>
                )}
              </div>

              {/* Date & Reward Coins Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                    Reward Coins
                  </label>
                  <div className="relative">
                    <Coins size={14} className="absolute left-3 top-2.5 text-amber-400" />
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={rewardCoins}
                      onChange={(e) => setRewardCoins(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Feedback Alert */}
              {qotdFeedback.text && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
                    qotdFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <span>{qotdFeedback.text}</span>
                  <button type="button" onClick={() => setQotdFeedback({ type: '', text: '' })}>
                    ✕
                  </button>
                </div>
              )}

              {/* Current Assigned Question Preview */}
              {challengeLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading challenge...</div>
              ) : selectedQuestion ? (
                <div className="p-4 rounded-2xl dark:bg-[#0F172A] bg-slate-50 border dark:border-slate-700 border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                      {selectedQuestion.subject || 'General'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedQuestion(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="text-xs font-semibold dark:text-slate-200 text-slate-800 leading-relaxed">
                    <MathRenderer text={selectedQuestion.question_text} />
                  </div>

                  {/* Options snippet */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t dark:border-slate-800 border-slate-200">
                    {(selectedQuestion.options || []).map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isCorrect = letter === selectedQuestion.correct_answer;
                      const optText = typeof opt === 'string' ? opt : (opt?.en || opt?.text || '');

                      return (
                        <div
                          key={letter}
                          className={`p-1.5 rounded-lg text-[11px] flex items-center gap-1.5 ${
                            isCorrect
                              ? 'dark:bg-emerald-500/20 bg-emerald-50 border border-emerald-500/30 text-emerald-400 font-bold'
                              : 'dark:bg-slate-900 bg-white text-slate-400'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-bold">
                            {letter}
                          </span>
                          <span className="truncate">{optText}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl dark:bg-slate-900/60 bg-slate-50 border border-dashed dark:border-slate-700 border-slate-300 text-center text-xs text-slate-400">
                  No question assigned for this date yet. Search and select a question below.
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {activeChallenge && (
                  <button
                    type="button"
                    onClick={handleRemoveChallenge}
                    disabled={challengeSaving}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 text-xs font-bold disabled:opacity-50"
                  >
                    Remove QotD
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveChallenge}
                  disabled={challengeSaving || !selectedQuestion}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{challengeSaving ? 'Saving...' : 'Save Daily Challenge'}</span>
                </button>
              </div>
            </div>

            {/* Search Question Selector */}
            <div className="p-5 sm:p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider dark:text-slate-300 text-slate-700">
                  Search Question Bank
                </span>
                <span className="text-[10px] text-slate-400">Type at least 2 characters</span>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by question text, subject, or topic..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-medium dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Search Results List */}
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {searchLoading ? (
                  <div className="p-4 text-center text-xs text-slate-400">Searching questions...</div>
                ) : questionResults.length === 0 ? (
                  questionSearch.trim() ? (
                    <div className="p-4 text-center text-xs text-slate-400">No questions matched.</div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Start typing to search and assign a question.
                    </div>
                  )
                ) : (
                  questionResults.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuestion(q)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedQuestion?.id === q.id
                          ? 'dark:bg-indigo-600/25 border-indigo-500 text-white font-bold'
                          : 'dark:bg-slate-900/80 bg-slate-50 dark:border-slate-700/60 border-slate-200 hover:border-indigo-400 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-indigo-400 font-bold mb-1">
                        <span>{q.subject || 'Question'}</span>
                        <span className="font-mono text-slate-400">Key: {q.correct_answer}</span>
                      </div>
                      <div className="line-clamp-2">
                        <MathRenderer text={q.question_text} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Recent & Upcoming Schedule (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 shadow-md space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-300 text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-amber-400" />
                <span>Scheduled Challenges Overview</span>
              </h3>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {recentChallenges.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No challenges scheduled yet.
                  </div>
                ) : (
                  recentChallenges.map((c) => {
                    const isToday = c.target_date === todayStr;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedDate(c.target_date)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                          selectedDate === c.target_date
                            ? 'dark:bg-indigo-600/20 border-indigo-500 shadow-sm'
                            : 'dark:bg-slate-900/70 bg-slate-50 dark:border-slate-700/60 border-slate-200 hover:dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold dark:text-white text-slate-900 font-mono">
                              {c.target_date}
                            </span>
                            {isToday && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">
                                Today
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                            <Coins size={11} /> +{c.reward_coins}
                          </span>
                        </div>
                        <div className="text-[11px] dark:text-slate-400 text-slate-600 line-clamp-1">
                          {c.question?.question_text || 'Question linked'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BANNER CREATE / EDIT MODAL */}
      {/* ======================================================== */}
      {bannerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg p-6 rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <span>{editingBanner ? 'Edit Promotional Banner' : 'Create Promotional Banner'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {bannerError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {bannerError}
              </div>
            )}

            <form onSubmit={handleSaveBanner} className="space-y-3.5">
              {/* Banner Layout Mode Toggle */}
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1.5">
                  Banner Layout Mode *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBannerForm({ ...bannerForm, banner_mode: 'full_image' })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      bannerForm.banner_mode === 'full_image'
                        ? 'dark:bg-indigo-600/25 bg-indigo-50 border-indigo-500 text-indigo-400 shadow-sm ring-1 ring-indigo-500'
                        : 'dark:bg-slate-900 bg-slate-50 dark:border-slate-800 border-slate-200 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-black dark:text-white text-slate-900">
                      🖼️ Full Banner Image
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 leading-snug">
                      800×320 px (5:2 ratio) — entire image is clickable
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBannerForm({ ...bannerForm, banner_mode: 'card' })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      bannerForm.banner_mode === 'card'
                        ? 'dark:bg-indigo-600/25 bg-indigo-50 border-indigo-500 text-indigo-400 shadow-sm ring-1 ring-indigo-500'
                        : 'dark:bg-slate-900 bg-slate-50 dark:border-slate-800 border-slate-200 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-black dark:text-white text-slate-900">
                      📝 Text + Icon Card
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Title, subtitle, CTA pill & 200×200 px SVG/icon graphic
                    </span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                  {bannerForm.banner_mode === 'full_image' ? 'Banner Name / Alt Text *' : 'Banner Title *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={bannerForm.banner_mode === 'full_image' ? 'e.g. UPSC Prelims 2026 Test Series' : 'e.g. UPSC Prelims 2026 Test Series is Live!'}
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Destination Link */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block">
                    Action Destination Link (`cta_link`) *
                  </label>
                  <span className="text-[10px] text-slate-400">Quick route:</span>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {ROUTE_PRESETS.map((p) => (
                    <button
                      key={p.path}
                      type="button"
                      onClick={() => setBannerForm({ ...bannerForm, cta_link: p.path })}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold dark:bg-slate-800 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-300 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className={bannerForm.banner_mode === 'full_image' ? 'w-full' : 'grid grid-cols-2 gap-2'}>
                  <input
                    type="text"
                    required
                    placeholder="/explore, /tests, or /folder/..."
                    value={bannerForm.cta_link}
                    onChange={(e) => setBannerForm({ ...bannerForm, cta_link: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  {bannerForm.banner_mode !== 'full_image' && (
                    <input
                      type="text"
                      placeholder="Button Text (e.g. Explore Now)"
                      value={bannerForm.cta_text}
                      onChange={(e) => setBannerForm({ ...bannerForm, cta_text: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              </div>

              {/* CARD MODE SPECIFIC FIELDS */}
              {bannerForm.banner_mode === 'card' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                        Badge Tag (e.g. NEW MOCK, OFFER)
                      </label>
                      <input
                        type="text"
                        value={bannerForm.badge_text}
                        onChange={(e) => setBannerForm({ ...bannerForm, badge_text: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={bannerForm.display_order}
                        onChange={(e) => setBannerForm({ ...bannerForm, display_order: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                      Subtitle / Description
                    </label>
                    <textarea
                      rows="2"
                      placeholder="e.g. Full-length mock tests with bilingual solutions and rank prediction."
                      value={bannerForm.subtitle}
                      onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-medium dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Graphic Type: Preset vs Custom */}
                  <div className="space-y-2 pt-1 border-t dark:border-slate-800 border-slate-200">
                    <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block">
                      Card Graphic Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                          bannerForm.graphic_type === 'preset'
                            ? 'dark:bg-indigo-600/20 border-indigo-500 text-white'
                            : 'dark:bg-slate-900 bg-slate-50 dark:border-slate-700 border-slate-300 text-slate-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="graphic_type"
                          value="preset"
                          checked={bannerForm.graphic_type === 'preset'}
                          onChange={() => setBannerForm({ ...bannerForm, graphic_type: 'preset' })}
                          className="accent-indigo-500"
                        />
                        <span className="text-xs font-bold">Glowing SVG Preset</span>
                      </label>

                      <label
                        className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                          bannerForm.graphic_type === 'custom'
                            ? 'dark:bg-indigo-600/20 border-indigo-500 text-white'
                            : 'dark:bg-slate-900 bg-slate-50 dark:border-slate-700 border-slate-300 text-slate-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="graphic_type"
                          value="custom"
                          checked={bannerForm.graphic_type === 'custom'}
                          onChange={() => setBannerForm({ ...bannerForm, graphic_type: 'custom' })}
                          className="accent-indigo-500"
                        />
                        <span className="text-xs font-bold">Custom Uploaded Graphic</span>
                      </label>
                    </div>

                    {bannerForm.graphic_type === 'preset' ? (
                      <div className="flex gap-2 pt-1">
                        {PRESET_ICONS.map((p) => {
                          const IconComponent = p.Icon;
                          const isSelected = bannerForm.preset_icon === p.id;

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setBannerForm({ ...bannerForm, preset_icon: p.id })}
                              className={`flex-1 p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                                isSelected
                                  ? 'dark:bg-indigo-600/30 border-indigo-500 text-white shadow-sm'
                                  : 'dark:bg-slate-900 bg-slate-50 dark:border-slate-800 border-slate-200 text-slate-400 hover:text-white'
                              }`}
                            >
                              <IconComponent size={20} className={p.color.split(' ')[0]} />
                              <span className="text-[10px] font-bold">{p.label.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            ref={bannerFileInputRef}
                            accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
                            onChange={handleCustomImageUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={bannerUploading}
                            onClick={() => bannerFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            {bannerUploading ? (
                              <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload size={13} />
                                <span>Upload SVG/Image</span>
                              </>
                            )}
                          </button>

                          {bannerForm.custom_image_url && (
                            <div className="w-10 h-10 rounded-xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-200 p-1 flex items-center justify-center shrink-0">
                              <img
                                src={bannerForm.custom_image_url}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                        </div>

                        <UploadGuide
                          formats=".svg (vector), .png, .webp"
                          dimensions="200×200 px (1:1 Square)"
                          maxSize="Max 100 KB for SVG, 800 KB for PNG/WebP"
                          notes="Transparent background SVG/PNG cutouts look best against dark surfaces."
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* FULL IMAGE BANNER MODE SPECIFIC FIELDS */}
              {bannerForm.banner_mode === 'full_image' && (
                <div className="space-y-3 pt-1 border-t dark:border-slate-800 border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block">
                        Full Banner Image *
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Entire card will be filled with this image and made clickable.
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block text-right mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={bannerForm.display_order}
                        onChange={(e) => setBannerForm({ ...bannerForm, display_order: Number(e.target.value) })}
                        className="w-20 px-2 py-1 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-white text-slate-900 text-right focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={bannerFileInputRef}
                        accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg"
                        onChange={handleCustomImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={bannerUploading}
                        onClick={() => bannerFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        {bannerUploading ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Uploading Banner...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>{bannerForm.custom_image_url ? 'Change Banner Image' : 'Upload Banner Image'}</span>
                          </>
                        )}
                      </button>

                      {bannerForm.custom_image_url && (
                        <button
                          type="button"
                          onClick={() => setBannerForm({ ...bannerForm, custom_image_url: '' })}
                          className="text-xs text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {bannerForm.custom_image_url && (
                      <div className="w-full h-32 rounded-2xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-200 overflow-hidden shadow-inner">
                        <img
                          src={bannerForm.custom_image_url}
                          alt="Banner Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <UploadGuide
                      formats=".png, .webp, .jpg"
                      dimensions="800×320 px (5:2 ratio recommended)"
                      maxSize="Max 1.5 MB"
                      notes="Full-bleed banner image. The entire banner is clickable with zero text overlay."
                    />
                  </div>
                </div>
              )}

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={bannerForm.is_active}
                    onChange={(e) => setBannerForm({ ...bannerForm, is_active: e.target.checked })}
                    className="accent-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Active (Immediately visible on student dashboard)</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t dark:border-slate-800 border-slate-200">
                <button
                  type="button"
                  onClick={() => setBannerModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bannerSaving}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md disabled:opacity-50"
                >
                  {bannerSaving ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

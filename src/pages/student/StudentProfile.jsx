import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { getFriendlyErrorMessage } from '../../lib/errors';

export default function StudentProfile() {
  const { user, profile, guest, coinBalance, supabase, signOut, refreshAccount } = useAuth();
  const { theme, setTheme, language, setLanguage } = useThemeLanguage();
  const navigate = useNavigate();

  // Modals state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Edit profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [targets, setTargets] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');

  // Goals form state
  const [dailyTarget, setDailyTarget] = useState(50);
  const [savingGoals, setSavingGoals] = useState(false);

  // Password update form state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');

  // Referral copy feedback
  const [copiedCode, setCopiedCode] = useState(false);

  // Deletion modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // User Stats & Access State
  const [attempts, setAttempts] = useState([]);
  const [isPro, setIsPro] = useState(false);
  const [validTill, setValidTill] = useState('Free Tier');
  const [statsLoading, setStatsLoading] = useState(true);

  // Local storage counts
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);

  // Initialize fields from real profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || profile.name || '');
      setPhone(profile.phone || '');
      setTargets(Array.isArray(profile.target_exams) ? profile.target_exams : []);
      setDailyTarget(Number(profile.daily_goal_target || 50));
    }
  }, [profile]);

  // Load real bookmarks / notes counts from storage or DB
  useEffect(() => {
    try {
      const bm = JSON.parse(localStorage.getItem('zyvra_bookmarks') || '[]');
      setBookmarksCount(Array.isArray(bm) ? bm.length : 0);
    } catch {
      setBookmarksCount(0);
    }
    try {
      const nt = JSON.parse(localStorage.getItem('zyvra_study_notes') || '[]');
      setNotesCount(Array.isArray(nt) ? nt.length : 0);
    } catch {
      setNotesCount(0);
    }
  }, []);

  // Load User Stats & Access strictly from Supabase
  useEffect(() => {
    let active = true;
    const fetchUserData = async () => {
      if (!supabase || !user) {
        setStatsLoading(false);
        return;
      }
      try {
        // Fetch test attempts
        const { data: attemptRows } = await supabase
          .from('test_attempts')
          .select('id,score,total_questions,status,completed_at,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500);

        if (!active) return;
        const validAttempts = attemptRows || [];
        setAttempts(validAttempts);

        // Fetch User Access / Subscription
        const { data: accessRows } = await supabase
          .from('user_access')
          .select('*')
          .eq('user_id', user.id);

        if (!active) return;
        const activeGrants = (accessRows || []).filter((g) => {
          if (g.is_active === false || g.active === false) return false;
          if (g.expires_at && new Date(g.expires_at).getTime() <= Date.now()) return false;
          return true;
        });

        const hasActiveGrant = activeGrants.length > 0 || profile?.role === 'admin' || profile?.is_pro === true;
        setIsPro(hasActiveGrant);

        if (hasActiveGrant) {
          const latestExpiry = activeGrants.find((g) => g.expires_at);
          if (latestExpiry?.expires_at) {
            const formatted = new Date(latestExpiry.expires_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
            setValidTill(formatted);
          } else {
            setValidTill('Lifetime Pro');
          }
        } else {
          setValidTill('Free Tier');
        }
      } catch (err) {
        console.warn('Unable to load user profile stats:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    };

    fetchUserData();
    return () => { active = false; };
  }, [supabase, user, profile?.role, profile?.is_pro]);

  // Real Derived Stats
  const testsAttemptedCount = useMemo(() => {
    return attempts.length;
  }, [attempts]);

  const questionsSolvedCount = useMemo(() => {
    return attempts.reduce((acc, att) => acc + (Number(att.score || att.total_questions || 0)), 0);
  }, [attempts]);

  const accuracyPercent = useMemo(() => {
    if (!attempts.length) return 0;
    const scoredAttempts = attempts.filter((att) => Number(att.score) > 0 && Number(att.total_questions) > 0);
    if (!scoredAttempts.length) return 0;
    const avg = scoredAttempts.reduce((acc, att) => acc + (att.score / att.total_questions) * 100, 0) / scoredAttempts.length;
    return Math.min(100, Math.round(avg));
  }, [attempts]);

  const streakDays = Number(profile?.current_streak || 0);

  const displayName = fullName || profile?.full_name || profile?.name || user?.user_metadata?.full_name || (guest ? 'Guest Student' : 'Student');
  const displayEmail = user?.email || (guest ? 'guest@zyvra.in' : '');
  const displayPhone = phone || profile?.phone || 'Not provided';
  const referralCode = profile?.referral_code || '';

  // Save profile updates to Supabase
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback('');
    try {
      if (supabase && user) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            phone: phone,
            target_exams: targets
          })
          .eq('id', user.id);
        if (error) throw error;
        setProfileFeedback('Profile updated successfully!');
        if (refreshAccount) await refreshAccount();
        setTimeout(() => {
          setProfileFeedback('');
          setEditProfileOpen(false);
        }, 1500);
      }
    } catch (err) {
      console.error('Unable to update profile:', err);
      setProfileFeedback(getFriendlyErrorMessage(err, 'Profile update nahi ho paya.'));
    } finally {
      setSavingProfile(false);
    }
  };

  // Save study goals to Supabase
  const handleSaveGoals = async (e) => {
    e.preventDefault();
    setSavingGoals(true);
    try {
      if (supabase && user) {
        await supabase
          .from('profiles')
          .update({ daily_goal_target: Number(dailyTarget) })
          .eq('id', user.id);
        if (refreshAccount) await refreshAccount();
        setGoalsModalOpen(false);
      }
    } catch (err) {
      console.error('Goal update failed:', err);
    } finally {
      setSavingGoals(false);
    }
  };

  // Copy referral code
  const handleCopyReferral = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      {/* Top App Bar & Mountain Sunset Panorama */}
      <div className="relative">
        <MountainSunsetAura height={220} showSun={true} />

        {/* Top Navbar */}
        <div className="absolute top-0 inset-x-0 z-20 px-3 sm:px-6 pt-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full dark:bg-emerald-950/70 bg-white/90 border dark:border-emerald-500/20 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-emerald-900/80 transition-colors shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-xl leading-none">⚡</span>
              <div>
                <span className="dark:text-white text-slate-900 font-black tracking-wider text-base">Zyvra</span>
                <span className="dark:text-emerald-400/80 text-emerald-700 text-[10px] block -mt-0.5 font-bold uppercase tracking-widest">
                  My Profile
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full dark:bg-emerald-950/70 bg-white/90 border dark:border-emerald-500/20 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-emerald-900/80 relative transition-colors shadow-sm"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </Link>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="w-9 h-9 rounded-full dark:bg-emerald-950/70 bg-white/90 border dark:border-emerald-500/20 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-emerald-900/80 transition-colors shadow-sm"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* User Identity Header Card */}
        <div className="relative z-10 px-3 sm:px-6 pt-16 pb-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
              {/* Profile Avatar with Edit Badge */}
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-600 via-teal-500 to-amber-500 p-[2px] shadow-[0_0_20px_rgba(34,197,94,0.25)]">
                  <div className="w-full h-full rounded-full dark:bg-[#07261b] bg-white flex items-center justify-center font-black text-xl sm:text-2xl text-amber-500 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(true)}
                  className="absolute bottom-0 right-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full dark:bg-black/80 bg-white border dark:border-emerald-400 border-slate-300 dark:text-emerald-300 text-slate-700 flex items-center justify-center shadow-md hover:bg-slate-100 dark:hover:bg-emerald-900 transition-colors"
                  aria-label="Edit Profile Picture"
                >
                  <Edit3 size={11} />
                </button>
              </div>

              {/* Name & Contact Info */}
              <div className="space-y-0.5 sm:space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h2 className="text-base sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight truncate">
                    {displayName}
                  </h2>
                  {isPro ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-sm">
                      <span>👑</span>
                      <span>Pro</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold dark:bg-emerald-950 bg-emerald-100 border dark:border-emerald-500/30 border-emerald-300 dark:text-emerald-400 text-emerald-800">
                      Free Member
                    </span>
                  )}
                </div>

                {displayEmail && (
                  <div className="flex items-center gap-1.5 text-xs dark:text-emerald-300/80 text-slate-600 font-medium truncate">
                    <Mail size={12} className="text-emerald-500 shrink-0" />
                    <span className="truncate max-w-[170px] sm:max-w-xs">{displayEmail}</span>
                  </div>
                )}

                {displayPhone !== 'Not provided' && (
                  <div className="flex items-center gap-1.5 text-xs dark:text-emerald-300/80 text-slate-600 font-medium">
                    <Phone size={12} className="text-emerald-500 shrink-0" />
                    <span>{displayPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="px-3 sm:px-3.5 py-1.5 rounded-full dark:bg-emerald-950/70 bg-white border dark:border-emerald-500/30 border-slate-300 hover:border-emerald-400 text-xs font-bold dark:text-emerald-300 text-slate-700 hover:text-black dark:hover:text-white flex items-center gap-1.5 shrink-0 transition-all shadow-sm hover:scale-105 active:scale-95"
            >
              <Edit3 size={13} />
              <span className="hidden xs:inline">Edit</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 max-w-2xl mx-auto space-y-3.5 sm:space-y-4 -mt-2 relative z-10">
        {/* Pro Membership / Upgrade Card */}
        <section className="relative overflow-hidden rounded-2xl dark:bg-gradient-to-r dark:from-[#1c1808] dark:via-[#0f2118] dark:to-[#071811] bg-gradient-to-r from-amber-50 via-emerald-50/70 to-white border dark:border-amber-500/35 border-amber-300/80 p-3.5 sm:p-5 shadow-[0_4px_25px_rgba(245,197,66,0.12)] flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-lg sm:text-xl shadow-[0_0_15px_rgba(245,197,66,0.35)] shrink-0">
              👑
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2 truncate">
                <span>{isPro ? 'Zyvra Pro Active' : 'Upgrade to Zyvra Pro'}</span>
              </h3>
              <p className="text-[11px] sm:text-xs dark:text-amber-200/80 text-amber-900/90 font-medium truncate">
                {isPro ? 'Full access to premium tests & notes' : 'Unlock full mock tests, notes & tools'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            {isPro ? (
              <>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold dark:text-amber-400/80 text-amber-800">Status</div>
                <div className="text-xs sm:text-sm font-extrabold dark:text-white text-slate-900 flex items-center gap-1">
                  <span>{validTill}</span>
                </div>
              </>
            ) : (
              <Link
                to="/purchases"
                className="px-3 sm:px-3.5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-glowGold inline-flex items-center gap-1 min-h-[44px]"
              >
                <span>Plans</span>
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </section>

        {/* 4 Stats Cards Grid (Real Aggregates - 360px optimized) */}
        <section className="grid grid-cols-4 gap-1.5 sm:gap-3">
          {/* Card 1: Tests Attempted */}
          <div className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-teal-500/20 bg-teal-100 dark:text-teal-300 text-teal-800 flex items-center justify-center mb-1">
              <Target size={14} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {testsAttemptedCount}
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-emerald-400/70 text-slate-500 font-semibold leading-tight mt-0.5">
              Tests
            </div>
          </div>

          {/* Card 2: Questions Solved */}
          <div className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-300 text-emerald-800 flex items-center justify-center mb-1">
              <BarChart3 size={14} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {questionsSolvedCount.toLocaleString()}
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-emerald-400/70 text-slate-500 font-semibold leading-tight mt-0.5">
              Questions
            </div>
          </div>

          {/* Card 3: Accuracy */}
          <div className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-cyan-500/20 bg-cyan-100 dark:text-cyan-300 text-cyan-800 flex items-center justify-center mb-1">
              <CheckCircle2 size={14} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {accuracyPercent}%
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-emerald-400/70 text-slate-500 font-semibold leading-tight mt-0.5">
              Accuracy
            </div>
          </div>

          {/* Card 4: Study Streak */}
          <div className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-amber-500/20 bg-amber-100 text-amber-500 flex items-center justify-center mb-1">
              <Flame size={14} className={streakDays > 0 ? 'fill-amber-400' : 'text-neutral-400'} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {streakDays}d
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-emerald-400/70 text-slate-500 font-semibold leading-tight mt-0.5">
              Streak
            </div>
          </div>
        </section>

        {/* Zyvra Coins Banner (Real Balance) */}
        <section>
          <Link
            to="/wallet"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 hover:border-amber-400/40 transition-all group min-h-[52px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl dark:bg-amber-500/20 bg-amber-100 border dark:border-amber-400/30 border-amber-300 flex items-center justify-center text-amber-500 text-lg shrink-0">
                🪙
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Zyvra Coins</span>
                  <span className="text-[10px] dark:text-emerald-400/80 text-emerald-700">ⓘ</span>
                </h4>
                <p className="text-[11px] sm:text-xs dark:text-emerald-400/70 text-slate-500 font-medium">
                  Earn & redeem for tests
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full dark:bg-gradient-to-r dark:from-amber-500/25 dark:to-yellow-600/30 bg-amber-100/80 border dark:border-amber-400/50 border-amber-300 text-amber-700 dark:text-amber-300 font-black text-xs shadow-sm group-hover:scale-105 transition-transform">
              <span>🪙</span>
              <span>{Number(coinBalance || 0).toLocaleString()}</span>
              <ChevronRight size={14} className="text-amber-500" />
            </div>
          </Link>
        </section>

        {/* 4 Quick Tiles Grid */}
        <section className="grid grid-cols-4 gap-1.5 sm:gap-3">
          <Link
            to="/bookmarks"
            className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <Bookmark size={16} className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">Bookmarks</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-emerald-300 text-emerald-700 mt-0.5">{bookmarksCount}</span>
          </Link>

          <Link
            to="/toolbox"
            className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <FileText size={16} className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">My Notes</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-emerald-300 text-emerald-700 mt-0.5">{notesCount}</span>
          </Link>

          <Link
            to="/purchases"
            className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <Download size={16} className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">Purchases</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-emerald-300 text-emerald-700 mt-0.5">{isPro ? 'Pro' : '0'}</span>
          </Link>

          <Link
            to="/analytics"
            className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <Clock size={16} className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">History</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-emerald-300 text-emerald-700 mt-0.5">{testsAttemptedCount}</span>
          </Link>
        </section>

        {/* Action Menu List */}
        <section className="dark:bg-[#072117]/85 bg-white shadow-sm backdrop-blur-md border dark:border-emerald-500/20 border-slate-200 rounded-2xl divide-y dark:divide-emerald-800/40 divide-slate-100 overflow-hidden">
          <Link
            to="/purchases"
            className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors group min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-emerald-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">My Purchases</span>
                <span className="text-[10px] dark:text-emerald-400/70 text-slate-500">View active packages & unlocks</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-emerald-400/50 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </Link>

          <button
            type="button"
            onClick={() => setGoalsModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors group text-left min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <Target size={18} className="text-emerald-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">My Goals & Plan</span>
                <span className="text-[10px] dark:text-emerald-400/70 text-slate-500">Set target: {dailyTarget} questions/day</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-emerald-400/50 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </button>

          <Link
            to="/analytics"
            className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors group min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-emerald-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">Performance Report</span>
                <span className="text-[10px] dark:text-emerald-400/70 text-slate-500">Detailed analysis & weak area detection</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-emerald-400/50 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </Link>

          {referralCode && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors group text-left min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-amber-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900">Invite & Earn</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-black dark:bg-amber-500/20 bg-amber-100 text-amber-700 dark:text-amber-300 border dark:border-amber-500/30 border-amber-300">
                      Earn Coins
                    </span>
                  </div>
                  <span className="text-[10px] dark:text-emerald-400/70 text-slate-500">Invite friends & get bonus coins</span>
                </div>
              </div>
              <ChevronRight size={16} className="dark:text-emerald-400/50 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-emerald-950/60 transition-colors group text-left min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <HelpCircle size={18} className="text-emerald-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">Help & Support</span>
                <span className="text-[10px] dark:text-emerald-400/70 text-slate-500">FAQ, contact details & inquiries</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-emerald-400/50 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </button>
        </section>

        {/* Sign Out Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-950/70 border dark:border-rose-500/30 border-rose-200 dark:text-rose-300 text-rose-700 text-xs font-black flex items-center justify-center gap-2 transition-colors min-h-[44px]"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl dark:bg-[#04140e] bg-white border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Edit3 size={18} className="text-amber-500" />
                <span>Edit Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {profileFeedback && (
              <div className="p-2.5 rounded-xl dark:bg-emerald-950 bg-emerald-50 border dark:border-emerald-500/40 border-emerald-300 dark:text-emerald-300 text-emerald-800 text-xs font-bold">
                {profileFeedback}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs font-bold dark:text-emerald-300 text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-emerald-950 bg-slate-50 border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold dark:text-emerald-300 text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-emerald-950 bg-slate-50 border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl dark:bg-emerald-950 bg-slate-100 border dark:border-emerald-500/20 border-slate-300 text-xs font-bold dark:text-neutral-300 text-slate-700 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold min-h-[44px]"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {goalsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#04140e] bg-white border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Target size={18} className="text-amber-500" />
                <span>Daily Practice Goal</span>
              </h3>
              <button
                type="button"
                onClick={() => setGoalsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGoals} className="space-y-4">
              <div>
                <label className="text-xs font-bold dark:text-emerald-300 text-slate-700 block mb-1">
                  Target Questions Per Day: {dailyTarget}
                </label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGoalsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl dark:bg-emerald-950 bg-slate-100 border dark:border-emerald-500/20 border-slate-300 text-xs font-bold dark:text-neutral-300 text-slate-700 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGoals}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold min-h-[44px]"
                >
                  {savingGoals ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#04140e] bg-white border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 space-y-4 text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl dark:bg-amber-400/20 bg-amber-100 border dark:border-amber-400/30 border-amber-300 flex items-center justify-center mx-auto text-2xl">
              🎁
            </div>
            <div>
              <h3 className="text-base font-black">Invite Friends & Earn Coins</h3>
              <p className="text-xs dark:text-emerald-300/80 text-slate-600 mt-1">
                Share your referral code. When your friend joins, both of you get bonus Zyvra Coins!
              </p>
            </div>

            <div className="p-3 rounded-2xl dark:bg-black/60 bg-slate-100 border dark:border-emerald-500/30 border-slate-300 flex items-center justify-between">
              <span className="font-mono text-sm font-black dark:text-amber-300 text-amber-700">{referralCode}</span>
              <button
                type="button"
                onClick={handleCopyReferral}
                className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black"
              >
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="w-full py-2 rounded-xl dark:bg-emerald-950 bg-slate-100 border dark:border-emerald-500/20 border-slate-300 text-xs font-bold dark:text-neutral-300 text-slate-700 min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#04140e] bg-white border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <HelpCircle size={18} className="text-amber-500" />
                <span>Help & Support</span>
              </h3>
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs dark:text-emerald-300/90 text-slate-600">
              <p>For inquiries, test issues, or billing assistance:</p>
              <div className="p-3 rounded-xl dark:bg-emerald-950/80 bg-slate-50 border dark:border-emerald-500/30 border-slate-300 space-y-1">
                <div>📧 Email: <span className="dark:text-white text-slate-900 font-bold">support@zyvra.in</span></div>
                <div>💬 WhatsApp: <span className="dark:text-white text-slate-900 font-bold">+91 98765 43210</span></div>
                <div>⏰ Support Hours: <span className="dark:text-white text-slate-900 font-bold">10 AM – 7 PM IST</span></div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSupportModalOpen(false)}
              className="w-full py-2 rounded-xl dark:bg-emerald-950 bg-slate-100 border dark:border-emerald-500/20 border-slate-300 text-xs font-bold dark:text-neutral-300 text-slate-700 min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

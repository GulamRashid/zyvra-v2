import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Award, BadgeCheck, BarChart3, Bell,
  Bookmark, Check, CheckCircle2, ChevronRight, Clock, Coins,
  Download, Edit3, FileText, Flame, Globe2, HelpCircle, KeyRound,
  Layers, LogOut, Mail, Moon, Phone, Settings, Shield, Sparkles,
  Sun, Target, Trash2, Trophy, UserRound, Users, X, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';

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
      setProfileFeedback(err.message || 'Failed to update profile.');
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
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] pb-28 md:pb-12">
      {/* Top App Bar & Mountain Sunset Panorama */}
      <div className="relative">
        <MountainSunsetAura height={220} showSun={true} />

        {/* Top Navbar */}
        <div className="absolute top-0 inset-x-0 z-20 px-4 sm:px-6 pt-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-emerald-950/70 border border-emerald-500/20 flex items-center justify-center text-white hover:bg-emerald-900/80 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-xl leading-none">⚡</span>
              <div>
                <span className="text-white font-black tracking-wider text-base">Zyvra</span>
                <span className="text-emerald-400/80 text-[10px] block -mt-0.5 font-bold uppercase tracking-widest">
                  My Profile
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full bg-emerald-950/70 border border-emerald-500/20 flex items-center justify-center text-white hover:bg-emerald-900/80 relative transition-colors"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </Link>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="w-9 h-9 rounded-full bg-emerald-950/70 border border-emerald-500/20 flex items-center justify-center text-white hover:bg-emerald-900/80 transition-colors"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* User Identity Header Card */}
        <div className="relative z-10 px-4 sm:px-6 pt-16 pb-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Profile Avatar with Edit Badge */}
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-600 via-teal-500 to-amber-500 p-[2px] shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <div className="w-full h-full rounded-full bg-[#07261b] flex items-center justify-center font-black text-2xl text-amber-300 overflow-hidden">
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
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-black/80 border border-emerald-400 text-emerald-300 flex items-center justify-center shadow-md hover:bg-emerald-900 transition-colors"
                  aria-label="Edit Profile Picture"
                >
                  <Edit3 size={11} />
                </button>
              </div>

              {/* Name & Contact Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                    {displayName}
                  </h2>
                  {isPro ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-sm">
                      <span>👑</span>
                      <span>Pro</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                      Free Member
                    </span>
                  )}
                </div>

                {displayEmail && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300/80 font-medium">
                    <Mail size={12} className="text-emerald-400" />
                    <span className="truncate max-w-[180px] sm:max-w-xs">{displayEmail}</span>
                  </div>
                )}

                {displayPhone !== 'Not provided' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300/80 font-medium">
                    <Phone size={12} className="text-emerald-400" />
                    <span>{displayPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 hover:border-emerald-400 text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1.5 shrink-0 transition-all shadow-sm hover:scale-105 active:scale-95"
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 max-w-2xl mx-auto space-y-4 -mt-2 relative z-10">
        {/* Pro Membership / Upgrade Card */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1c1808] via-[#0f2118] to-[#071811] border border-amber-500/35 p-4 sm:p-5 shadow-[0_4px_25px_rgba(245,197,66,0.15)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-xl shadow-[0_0_15px_rgba(245,197,66,0.4)] shrink-0">
              👑
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>{isPro ? 'Zyvra Pro Active' : 'Upgrade to Zyvra Pro'}</span>
              </h3>
              <p className="text-xs text-amber-200/80 font-medium">
                {isPro ? 'Full access to premium tests & notes' : 'Unlock full mock tests, notes & premium tools'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            {isPro ? (
              <>
                <div className="text-[10px] uppercase font-bold text-amber-400/80">Status</div>
                <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1">
                  <span>{validTill}</span>
                </div>
              </>
            ) : (
              <Link
                to="/purchases"
                className="px-3.5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-glowGold inline-flex items-center gap-1"
              >
                <span>Explore Plans</span>
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </section>

        {/* 4 Stats Cards Grid (Real Aggregates) */}
        <section className="grid grid-cols-4 gap-2 sm:gap-3">
          {/* Card 1: Tests Attempted */}
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-md">
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center mb-1">
              <Target size={15} />
            </div>
            <div className="text-base sm:text-lg font-black text-white tracking-tight">
              {testsAttemptedCount}
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-400/70 font-semibold leading-tight mt-0.5">
              Tests Attempted
            </div>
          </div>

          {/* Card 2: Questions Solved */}
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-md">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-1">
              <BarChart3 size={15} />
            </div>
            <div className="text-base sm:text-lg font-black text-white tracking-tight">
              {questionsSolvedCount.toLocaleString()}
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-400/70 font-semibold leading-tight mt-0.5">
              Questions Solved
            </div>
          </div>

          {/* Card 3: Accuracy */}
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-md">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center mb-1">
              <CheckCircle2 size={15} />
            </div>
            <div className="text-base sm:text-lg font-black text-white tracking-tight">
              {accuracyPercent}%
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-400/70 font-semibold leading-tight mt-0.5">
              Accuracy
            </div>
          </div>

          {/* Card 4: Study Streak */}
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-md">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
              <Flame size={15} className={streakDays > 0 ? 'fill-amber-400' : 'text-neutral-500'} />
            </div>
            <div className="text-base sm:text-lg font-black text-white tracking-tight">
              {streakDays} Days
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-400/70 font-semibold leading-tight mt-0.5">
              Study Streak
            </div>
          </div>
        </section>

        {/* Zyvra Coins Banner (Real Balance) */}
        <section>
          <Link
            to="/wallet"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 hover:border-amber-400/40 transition-all shadow-md group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 text-lg shrink-0">
                🪙
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>Zyvra Coins</span>
                  <span className="text-[10px] text-emerald-400/80">ⓘ</span>
                </h4>
                <p className="text-xs text-emerald-400/70 font-medium">
                  Earn & redeem for tests
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-600/30 border border-amber-400/50 text-amber-300 font-black text-xs shadow-sm group-hover:scale-105 transition-transform">
              <span>🪙</span>
              <span>{Number(coinBalance || 0).toLocaleString()}</span>
              <ChevronRight size={14} className="text-amber-400" />
            </div>
          </Link>
        </section>

        {/* 4 Quick Tiles Grid */}
        <section className="grid grid-cols-4 gap-2 sm:gap-3">
          <Link
            to="/bookmarks"
            className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group shadow-sm"
          >
            <Bookmark size={18} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Bookmarks</span>
            <span className="text-[11px] font-black text-emerald-300 mt-0.5">{bookmarksCount}</span>
          </Link>

          <Link
            to="/toolbox"
            className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group shadow-sm"
          >
            <FileText size={18} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">My Notes</span>
            <span className="text-[11px] font-black text-emerald-300 mt-0.5">{notesCount}</span>
          </Link>

          <Link
            to="/purchases"
            className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group shadow-sm"
          >
            <Download size={18} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Purchases</span>
            <span className="text-[11px] font-black text-emerald-300 mt-0.5">{isPro ? 'Pro' : '0'}</span>
          </Link>

          <Link
            to="/analytics"
            className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group shadow-sm"
          >
            <Clock size={18} className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Test History</span>
            <span className="text-[11px] font-black text-emerald-300 mt-0.5">{testsAttemptedCount}</span>
          </Link>
        </section>

        {/* Action Menu List */}
        <section className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl divide-y divide-emerald-800/40 overflow-hidden shadow-md">
          <Link
            to="/purchases"
            className="flex items-center justify-between p-3.5 hover:bg-emerald-950/60 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-emerald-400" />
              <div>
                <span className="text-xs sm:text-sm font-bold text-white block">My Purchases</span>
                <span className="text-[10px] text-emerald-400/70">View active packages & unlocks</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-400/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </Link>

          <button
            type="button"
            onClick={() => setGoalsModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-emerald-950/60 transition-colors group text-left"
          >
            <div className="flex items-center gap-3">
              <Target size={18} className="text-emerald-400" />
              <div>
                <span className="text-xs sm:text-sm font-bold text-white block">My Goals & Plan</span>
                <span className="text-[10px] text-emerald-400/70">Set target: {dailyTarget} questions/day</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-400/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </button>

          <Link
            to="/analytics"
            className="flex items-center justify-between p-3.5 hover:bg-emerald-950/60 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-emerald-400" />
              <div>
                <span className="text-xs sm:text-sm font-bold text-white block">Performance Report</span>
                <span className="text-[10px] text-emerald-400/70">Detailed analysis & weak area detection</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-400/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </Link>

          {referralCode && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-emerald-950/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-amber-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">Invite & Earn</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Earn Coins
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400/70">Invite friends & get bonus coins</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-emerald-400/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-emerald-950/60 transition-colors group text-left"
          >
            <div className="flex items-center gap-3">
              <HelpCircle size={18} className="text-emerald-400" />
              <div>
                <span className="text-xs sm:text-sm font-bold text-white block">Help & Support</span>
                <span className="text-[10px] text-emerald-400/70">FAQ, contact details & inquiries</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-emerald-400/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </button>
        </section>

        {/* Sign Out Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-black flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#04140e] border border-emerald-500/30 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Edit3 size={18} className="text-amber-400" />
                <span>Edit Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {profileFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                {profileFeedback}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/20 text-xs font-bold text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold"
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
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#04140e] border border-emerald-500/30 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <Target size={18} className="text-amber-400" />
                <span>Daily Practice Goal</span>
              </h3>
              <button
                type="button"
                onClick={() => setGoalsModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGoals} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">
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
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/20 text-xs font-bold text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGoals}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold"
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
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#04140e] border border-emerald-500/30 text-white space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mx-auto text-2xl">
              🎁
            </div>
            <div>
              <h3 className="text-base font-black">Invite Friends & Earn Coins</h3>
              <p className="text-xs text-emerald-300/80 mt-1">
                Share your referral code. When your friend joins, both of you get bonus Zyvra Coins!
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-black/60 border border-emerald-500/30 flex items-center justify-between">
              <span className="font-mono text-sm font-black text-amber-300">{referralCode}</span>
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
              className="w-full py-2 rounded-xl bg-emerald-950 border border-emerald-500/20 text-xs font-bold text-neutral-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#04140e] border border-emerald-500/30 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <HelpCircle size={18} className="text-amber-400" />
                <span>Help & Support</span>
              </h3>
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs text-emerald-300/90">
              <p>For inquiries, test issues, or billing assistance:</p>
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/30 space-y-1">
                <div>📧 Email: <span className="text-white font-bold">support@zyvra.in</span></div>
                <div>💬 WhatsApp: <span className="text-white font-bold">+91 98765 43210</span></div>
                <div>⏰ Support Hours: <span className="text-white font-bold">10 AM – 7 PM IST</span></div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSupportModalOpen(false)}
              className="w-full py-2 rounded-xl bg-emerald-950 border border-emerald-500/20 text-xs font-bold text-neutral-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BarChart3, Bell, Bookmark, Check, CheckCircle2, ChevronRight,
  Clock, Copy, Download, Edit3, FileText, Flame, HelpCircle, KeyRound, Layers,
  LogOut, Mail, MessageCircle, Phone, Send, Settings, Share2, ShieldCheck, Target, Upload, Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';
import UploadGuide from '../../components/common/UploadGuide';
import { uploadAsset } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { ensureReferralCode } from '../../lib/referrals';

export default function StudentProfile() {
  const { user, profile, guest, coinBalance, supabase, signOut, refreshAccount } = useAuth();
  const navigate = useNavigate();

  // Modals state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Edit profile form state
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [targets, setTargets] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');

  // Goals form state
  const [dailyTarget, setDailyTarget] = useState(50);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsFeedback, setGoalsFeedback] = useState('');
  const [signOutError, setSignOutError] = useState('');
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState('closed');
  const [passwordOtp, setPasswordOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deviceActionBusy, setDeviceActionBusy] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState('');
  const [deviceError, setDeviceError] = useState('');

  // Referral copy feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [currentReferralCode, setCurrentReferralCode] = useState(profile?.referral_code || '');

  const requestPasswordOtp = async () => {
    setPasswordError('');
    setPasswordFeedback('');
    if (!supabase || !user?.email) {
      setPasswordError('We could not find the email address for this account.');
      return;
    }
    setPasswordBusy(true);
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(user.email);
      if (recoveryError) throw recoveryError;
      setPasswordOtp('');
      setPasswordStep('verify');
      setPasswordFeedback(`Password recovery email requested for ${user.email}. Check your inbox and spam folder for the code.`);
    } catch (recoveryError) {
      setPasswordError(recoveryError.message || 'Could not send the password recovery email. Please try again later.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const saveNewPassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordFeedback('');
    if (passwordOtp.length !== 6 || !/^[0-9]{6}$/.test(passwordOtp)) { setPasswordError('Enter the six-digit code from your email.'); return; }
    if (newPassword.length < 8) { setPasswordError('Use at least 8 characters for your password.'); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError('The passwords do not match.'); return; }
    setPasswordBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: user.email, token: passwordOtp, type: 'recovery' });
      if (verifyError) throw verifyError;
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setPasswordFeedback('Password saved. You can now sign in with your email and password.');
      setPasswordStep('done');
      setPasswordOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (saveError) {
      setPasswordError(/expired/i.test(saveError.message || '') ? 'That code has expired. Request a new one.' : saveError.message || 'Could not update your password. Please try again.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const signOutOtherDevices = async () => {
    if (!supabase || deviceActionBusy) return;
    const confirmed = window.confirm('This will sign out this account on every other device. This device will stay signed in. Continue?');
    if (!confirmed) return;
    setDeviceActionBusy(true);
    setDeviceFeedback('');
    setDeviceError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      setDeviceFeedback('You have been signed out on other devices. You can use this account on up to two devices.');
    } catch (error) {
      setDeviceError(error.message || 'Could not sign out the other devices. Please try again.');
    } finally {
      setDeviceActionBusy(false);
    }
  };

  // User Stats & Access State
  const [attempts, setAttempts] = useState([]);
  const [isPro, setIsPro] = useState(false);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [validTill, setValidTill] = useState('Free plan');

  // Local storage counts
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);

  // Initialize fields from real profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || profile.name || '');
      setAvatarUrl(profile.avatar_url || '');
      setTargets(Array.isArray(profile.target_exams) ? profile.target_exams : []);
      setDailyTarget(Number(profile.daily_goal_target || 50));
      if (profile.referral_code) {
        setCurrentReferralCode(profile.referral_code);
      }
    }
  }, [profile]);

  // Ensure referral code exists when invite modal is opened
  useEffect(() => {
    if (inviteModalOpen && !currentReferralCode && user && supabase) {
      ensureReferralCode(supabase, user.id)
        .then((code) => {
          if (code) {
            setCurrentReferralCode(code);
            if (refreshAccount) refreshAccount();
          }
        })
        .catch((err) => console.warn('Could not generate referral code:', err));
    }
  }, [inviteModalOpen, currentReferralCode, user, supabase, refreshAccount]);

  // Load real bookmarks / notes counts from storage or DB
  useEffect(() => {
    try {
      const resultBookmarks = JSON.parse(localStorage.getItem('zyvra_bookmarks') || '[]');
      const questionBookmarks = JSON.parse(localStorage.getItem('zyvra_saved_question_bookmarks') || '[]');
      const belongsToUser = (bookmark) => !bookmark.user_id || bookmark.user_id === user?.id;
      const resultCount = Array.isArray(resultBookmarks) ? resultBookmarks.filter(belongsToUser).length : 0;
      const questionCount = Array.isArray(questionBookmarks) ? questionBookmarks.filter(belongsToUser).length : 0;
      setBookmarksCount(resultCount + questionCount);
    } catch {
      setBookmarksCount(0);
    }
    try {
      const nt = JSON.parse(localStorage.getItem('zyvra_study_notes') || '[]');
      setNotesCount(Array.isArray(nt) ? nt.length : 0);
    } catch {
      setNotesCount(0);
    }
  }, [user?.id]);

  // Load User Stats & Access strictly from Supabase
  useEffect(() => {
    let active = true;
    const fetchUserData = async () => {
      if (!supabase || !user) {
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

        const hasActiveGrant = activeGrants.length > 0 || ['admin', 'super_admin'].includes(profile?.role);
        setIsPro(hasActiveGrant);
        setUnlockedCount(activeGrants.length);

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
            setValidTill('Lifetime Access');
          }
        } else {
          setValidTill('Free plan');
        }
      } catch (err) {
        console.warn('Unable to load user profile stats:', err);
      }
    };

    fetchUserData();
    return () => { active = false; };
  }, [supabase, user, profile?.role]);

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
  const displayPhone = profile?.mobile || 'Not provided';
  const referralCode = currentReferralCode || profile?.referral_code || '';
  const inviteUrl = referralCode ? `${window.location.origin}/auth?ref=${referralCode}` : `${window.location.origin}/auth`;
  const inviteMessage = `Zyvra par mere saath exams ki taiyari karein! 🚀\nUse my referral code ${referralCode} to get free bonus coins on signup:\n${inviteUrl}`;

  // Avatar upload handler
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileFeedback('');
    try {
      const url = await uploadAsset(file, {
        folder: 'avatars',
        allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
        maxSizeBytes: 2 * 1024 * 1024
      });
      setAvatarUrl(url);
      setProfileFeedback('Avatar image uploaded! Click "Save Profile" to apply changes.');
    } catch (err) {
      setProfileFeedback(err.message || 'Avatar upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

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
            target_exams: targets,
            avatar_url: avatarUrl || profile?.avatar_url || null
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
      setProfileFeedback(getFriendlyErrorMessage(err, 'Profile update nahi ho paya. Dobara koshish karein.'));
    } finally {
      setSavingProfile(false);
    }
  };

  // Save study goals to Supabase
  const handleSaveGoals = async (e) => {
    e.preventDefault();
    setSavingGoals(true);
    setGoalsFeedback('');
    try {
      if (supabase && user) {
        const { error } = await supabase
          .from('profiles')
          .update({ daily_goal_target: Number(dailyTarget) })
          .eq('id', user.id);
        if (error) throw error;
        if (refreshAccount) await refreshAccount();
        setGoalsFeedback('Goal saved successfully!');
        setTimeout(() => {
          setGoalsFeedback('');
          setGoalsModalOpen(false);
        }, 1000);
      }
    } catch (err) {
      console.error('Goal update failed:', err);
      setGoalsFeedback(getFriendlyErrorMessage(err, 'Goal update nahi ho paya. Dobara koshish karein.'));
    } finally {
      setSavingGoals(false);
    }
  };

  // Copy referral code
  const handleCopyReferral = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setShareFeedback('Referral code copy nahi ho paya.');
      setTimeout(() => setShareFeedback(''), 2500);
    }
  };

  // Copy full invite link
  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setShareFeedback('Invite link copy nahi ho paya.');
      setTimeout(() => setShareFeedback(''), 2500);
    }
  };

  // Mobile Native Share with fallback
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Zyvra & Earn Coins',
          text: inviteMessage,
          url: inviteUrl
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share error:', err);
        }
      }
    }
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setShareFeedback('Invite message clipboard me copy ho gaya!');
      setTimeout(() => setShareFeedback(''), 2500);
    } catch {
      setShareFeedback('Share message copy nahi ho paya.');
      setTimeout(() => setShareFeedback(''), 2500);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await signOut();
      navigate('/auth');
    } catch (err) {
      console.error('Sign out error:', err);
      setSignOutError(getFriendlyErrorMessage(err, 'Sign out nahi ho paya. Dobara koshish karein.'));
    }
  };

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      {/* Top App Bar & Tech Data Banner */}
      <div className="relative">
        <MountainSunsetAura height={220} mobileHeight={112} showSun={true} />

        {/* Top Navbar */}
        <div className="absolute top-0 inset-x-0 z-20 px-3 sm:px-6 pt-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full dark:bg-slate-800 bg-white/90 border dark:border-slate-700/60 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-xl leading-none">⚡</span>
              <div>
                <span className="dark:text-white text-slate-900 font-black tracking-wider text-base">Zyvra</span>
                <span className="dark:text-indigo-400/80 text-indigo-700 text-[10px] block -mt-0.5 font-bold uppercase tracking-widest">
                  My Profile
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full dark:bg-slate-800 bg-white/90 border dark:border-slate-700/60 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 relative transition-colors shadow-sm"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </Link>
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="w-9 h-9 rounded-full dark:bg-slate-800 bg-white/90 border dark:border-slate-700/60 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
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
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-amber-500 p-[2px] shadow-[0_0_20px_rgba(79,70,229,0.25)]">
                  <div className="w-full h-full rounded-full dark:bg-[#0B1120] bg-white flex items-center justify-center font-black text-xl sm:text-2xl text-amber-500 overflow-hidden">
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
                  className="absolute bottom-0 right-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full dark:bg-black/80 bg-white border dark:border-indigo-400 border-slate-300 dark:text-indigo-300 text-slate-700 flex items-center justify-center shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                      <span>Premium</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold dark:bg-emerald-500/20 bg-emerald-100 border dark:border-emerald-500/30 border-emerald-300 dark:text-emerald-400 text-emerald-600">
                      Free plan
                    </span>
                  )}
                </div>

                {displayEmail && (
                  <div className="flex items-center gap-1.5 text-xs dark:text-slate-400 text-slate-600 font-medium truncate">
                    <Mail size={12} className="text-indigo-500 shrink-0" />
                    <span className="truncate max-w-[170px] sm:max-w-xs">{displayEmail}</span>
                  </div>
                )}

                {displayPhone !== 'Not provided' && (
                  <div className="flex items-center gap-1.5 text-xs dark:text-slate-400 text-slate-600 font-medium">
                    <Phone size={12} className="text-indigo-500 shrink-0" />
                    <span>{displayPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="px-3 sm:px-3.5 py-1.5 rounded-full dark:bg-slate-800/80 bg-white border dark:border-slate-700/60 border-slate-300 hover:border-indigo-400 text-xs font-bold dark:text-slate-200 text-slate-700 hover:text-black dark:hover:text-white flex items-center gap-1.5 shrink-0 transition-all shadow-sm hover:scale-105 active:scale-95"
            >
              <Edit3 size={13} />
              <span className="hidden xs:inline">Edit</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 max-w-2xl mx-auto space-y-3.5 sm:space-y-4 -mt-2 relative z-10">
        {/* Pro Membership / Upgrade Card */}
        <section className="relative overflow-hidden rounded-2xl dark:bg-gradient-to-r dark:from-[#1c1808] dark:via-slate-900 dark:to-slate-900 bg-gradient-to-r from-amber-50 via-indigo-50/40 to-white border dark:border-amber-500/35 border-amber-300/80 p-3.5 sm:p-5 shadow-[0_4px_25px_rgba(245,197,66,0.12)] flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-lg sm:text-xl shadow-[0_0_15px_rgba(245,197,66,0.35)] shrink-0">
              👑
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2 truncate">
                <span>{isPro ? 'Premium access active' : 'Free plan'}</span>
              </h3>
              <p className="text-[11px] sm:text-xs dark:text-amber-200/80 text-amber-900/90 font-medium truncate">
                {isPro
                  ? `${unlockedCount} ${unlockedCount === 1 ? 'item' : 'items'} unlocked`
                  : 'Unlock full mock tests, notes & tools'}
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

        {!guest && <section className="password-setting-card">
          <div className="password-setting-heading">
            <div className="password-setting-icon"><KeyRound size={18} /></div>
            <div><h3>Password sign-in</h3><p>Add a password, or reset it after verifying your email.</p></div>
            {!passwordPanelOpen && <button type="button" className="button button-outline password-toggle-button" onClick={() => { setPasswordPanelOpen(true); setPasswordStep('start'); setPasswordError(''); setPasswordFeedback(''); }}>Set or reset</button>}
          </div>
          {passwordPanelOpen && <div className="password-setting-form">
            {passwordStep === 'start' && <>
              <p className="password-setting-help">We will send a one-time code to <strong>{user?.email}</strong>. Verify it to create or replace your password.</p>
              <div className="password-setting-actions"><button type="button" className="button button-gold" onClick={requestPasswordOtp} disabled={passwordBusy}>{passwordBusy ? 'Sending code…' : 'Send verification code'}</button><button type="button" className="text-button" onClick={() => setPasswordPanelOpen(false)}>Cancel</button></div>
            </>}
            {passwordStep === 'verify' && <form onSubmit={saveNewPassword}>
              <label className="field-label">Email verification code<div className="input-with-icon"><Mail size={16} /><input className="text-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={passwordOtp} onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="6-digit code" /></div></label>
              <label className="field-label">New password<div className="input-with-icon"><KeyRound size={16} /><input className="text-input" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required placeholder="At least 8 characters" /></div></label>
              <label className="field-label">Confirm new password<div className="input-with-icon"><KeyRound size={16} /><input className="text-input" type="password" autoComplete="new-password" minLength={8} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} required placeholder="Enter it again" /></div></label>
              <div className="password-setting-actions"><button type="submit" className="button button-gold" disabled={passwordBusy}>{passwordBusy ? 'Saving…' : 'Verify code and save password'}</button><button type="button" className="text-button" onClick={requestPasswordOtp} disabled={passwordBusy}>Resend code</button></div>
            </form>}
            {passwordStep === 'done' && <button type="button" className="button button-outline" onClick={() => { setPasswordPanelOpen(false); setPasswordStep('closed'); }}>Done</button>}
            {passwordFeedback && <div className="feedback success-feedback">{passwordFeedback}</div>}
            {passwordError && <div className="feedback error-feedback">{passwordError}</div>}
          </div>}
        </section>}

        {!guest && <section className="password-setting-card">
          <div className="password-setting-heading">
            <div className="password-setting-icon"><ShieldCheck size={18} /></div>
            <div><h3>Signed-in devices</h3><p>Use your account on up to two devices at a time.</p></div>
            <button type="button" className="button button-outline password-toggle-button" onClick={signOutOtherDevices} disabled={deviceActionBusy}>
              {deviceActionBusy ? 'Signing out…' : 'Sign out other devices'}
            </button>
          </div>
          {deviceFeedback && <div className="feedback success-feedback">{deviceFeedback}</div>}
          {deviceError && <div className="feedback error-feedback">{deviceError}</div>}
        </section>}

        {/* 4 Stats Cards Grid (Real Aggregates - 360px optimized) */}
        <section className="grid grid-cols-4 gap-1.5 sm:gap-3">
          {/* Card 1: Tests Attempted */}
          <div className="dark:bg-[#1E293B] bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-400 text-indigo-800 flex items-center justify-center mb-1">
              <Target size={14} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {testsAttemptedCount}
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-slate-400 text-slate-500 font-semibold leading-tight mt-0.5">
              Tests
            </div>
          </div>

          {/* Card 2: Questions Solved */}
          <div className="dark:bg-[#1E293B] bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-300 text-indigo-800 flex items-center justify-center mb-1">
              <BarChart3 size={14} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {questionsSolvedCount.toLocaleString()}
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-slate-400 text-slate-500 font-semibold leading-tight mt-0.5">
              Questions
            </div>
          </div>

          {/* Card 3: Accuracy */}
          <div className="dark:bg-[#1E293B] bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-400 text-emerald-600 flex items-center justify-center mb-1">
              <CheckCircle2 size={14} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
              {accuracyPercent}%
            </div>
            <div className="text-[8px] sm:text-[10px] dark:text-slate-400 text-slate-500 font-semibold leading-tight mt-0.5">
              Accuracy
            </div>
          </div>

          {/* Card 4: Study Streak - Vibrant Orange Dopamine Trigger */}
          <div className="dark:bg-[#1E293B] bg-white shadow-sm backdrop-blur-md border dark:border-orange-500/35 border-orange-200 rounded-2xl p-2 sm:p-3 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-orange-500/20 text-orange-500 flex items-center justify-center mb-1 shadow-[0_0_10px_rgba(249,115,22,0.25)]">
              <Flame size={14} className={streakDays > 0 ? 'fill-orange-500 text-orange-500 animate-pulse' : 'text-neutral-400'} />
            </div>
            <div className="text-sm sm:text-lg font-black dark:text-orange-400 text-orange-600 tracking-tight">
              {streakDays}d
            </div>
            <div className="text-[8px] sm:text-[10px] text-orange-500 dark:text-orange-400 font-bold leading-tight mt-0.5 uppercase tracking-wider">
              Streak
            </div>
          </div>
        </section>

        {/* Zyvra Coins Banner (Real Balance) - Bright Amber Dopamine Trigger */}
        <section>
          <Link
            to="/wallet"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B] bg-white shadow-sm backdrop-blur-md border dark:border-amber-500/35 border-amber-200 hover:border-amber-400/60 transition-all group min-h-[52px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-500 text-lg shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                🪙
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Zyvra Coins</span>
                  <span className="text-[10px] text-amber-500">ⓘ</span>
                </h4>
                <p className="text-[11px] sm:text-xs dark:text-slate-400 text-slate-500 font-medium">
                  Earn & redeem for tests
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-700 dark:text-amber-300 font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:scale-105 transition-transform">
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
            className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <Bookmark size={16} className="text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">Bookmarks</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-indigo-400 text-indigo-700 mt-0.5">{bookmarksCount}</span>
          </Link>

          <Link
            to="/toolbox"
            className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <FileText size={16} className="text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">My Notes</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-indigo-400 text-indigo-700 mt-0.5">{notesCount}</span>
          </Link>

          <Link
            to="/purchases"
            className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <Download size={16} className="text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">Purchases</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-indigo-400 text-indigo-700 mt-0.5">{isPro ? (unlockedCount > 0 ? `${unlockedCount} unlocked` : 'Active') : '0'}</span>
          </Link>

          <Link
            to="/analytics"
            className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 hover:border-indigo-500/40 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group min-h-[64px]"
          >
            <Clock size={16} className="text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] sm:text-xs font-bold dark:text-white text-slate-900">History</span>
            <span className="text-[10px] sm:text-[11px] font-black dark:text-indigo-400 text-indigo-700 mt-0.5">{testsAttemptedCount}</span>
          </Link>
        </section>

        {/* Action Menu List */}
        <section className="dark:bg-[#1E293B]/85 bg-white shadow-sm backdrop-blur-md border dark:border-slate-700/60 border-slate-200 rounded-2xl divide-y dark:divide-slate-700/40 divide-slate-100 overflow-hidden">
          <Link
            to="/purchases"
            className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-indigo-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">My Purchases</span>
                <span className="text-[10px] dark:text-slate-400 text-slate-500">View active packages & unlocks</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-slate-500 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </Link>

          <button
            type="button"
            onClick={() => setGoalsModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <Target size={18} className="text-indigo-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">My Goals & Plan</span>
                <span className="text-[10px] dark:text-slate-400 text-slate-500">Set target: {dailyTarget} questions/day</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-slate-500 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </button>

          <Link
            to="/analytics"
            className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-indigo-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">Performance Report</span>
                <span className="text-[10px] dark:text-slate-400 text-slate-500">Detailed analysis & weak area detection</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-slate-500 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </Link>

          {referralCode && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left min-h-[48px]"
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
                  <span className="text-[10px] dark:text-slate-400 text-slate-500">Invite friends & get bonus coins</span>
                </div>
              </div>
              <ChevronRight size={16} className="dark:text-slate-500 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <HelpCircle size={18} className="text-indigo-500" />
              <div>
                <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">Help & Support</span>
                <span className="text-[10px] dark:text-slate-400 text-slate-500">FAQ, contact details & inquiries</span>
              </div>
            </div>
            <ChevronRight size={16} className="dark:text-slate-500 text-slate-400 group-hover:dark:text-white group-hover:text-black group-hover:translate-x-0.5 transition-all" />
          </button>
        </section>

        {/* Sign Out Button */}
        <div className="pt-2 space-y-2">
          {signOutError && (
            <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold text-center">
              {signOutError}
            </div>
          )}
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
          <div className="w-full max-w-md p-6 rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
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
              <div className="p-2.5 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold">
                {profileFeedback}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                  Profile Picture
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors">
                      <Upload size={14} />
                      <span>{uploadingAvatar ? 'Uploading…' : 'Choose Photo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                      />
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="block text-[11px] text-rose-400 hover:underline"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <UploadGuide
                  formats=".png, .webp, .jpg"
                  dimensions="300×300 px (1:1 Square)"
                  maxSize="Max 2 MB"
                />
              </div>

              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                  Mobile Number <span className="text-[10px] font-normal text-slate-400 dark:text-neutral-500">(Read-only)</span>
                </label>
                <input
                  type="tel"
                  value={profile?.mobile || 'Not provided'}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 rounded-xl dark:bg-slate-900/50 bg-slate-100 border dark:border-slate-700/40 border-slate-300 dark:text-neutral-400 text-slate-500 text-xs font-medium cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700 min-h-[44px]"
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
          <div className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
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

            {goalsFeedback && (
              <div className={`p-2.5 rounded-xl text-xs font-bold ${goalsFeedback.includes('successfully') ? 'dark:bg-emerald-500/20 bg-emerald-50 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30' : 'dark:bg-rose-950/40 bg-rose-50 text-rose-600 dark:text-rose-300 border border-rose-500/30'}`}>
                {goalsFeedback}
              </div>
            )}

            <form onSubmit={handleSaveGoals} className="space-y-4">
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
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
                  className="px-3.5 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700 min-h-[44px]"
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
          <div className="w-full max-w-md p-6 rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl dark:bg-amber-400/20 bg-amber-100 border dark:border-amber-400/30 border-amber-300 flex items-center justify-center mx-auto text-2xl">
              🎁
            </div>
            <div className="text-center">
              <h3 className="text-base font-black">Invite Friends & Earn Coins</h3>
              <p className="text-xs dark:text-slate-400 text-slate-600 mt-1">
                Share your referral link. When your friend joins Zyvra, both of you earn bonus coins!
              </p>
            </div>

            {/* Referral Code Box */}
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500">
                Referral Code
              </label>
              <div className="p-3 rounded-2xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-black dark:text-amber-300 text-amber-700 tracking-wider">
                  {referralCode || 'Generating code...'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  disabled={!referralCode}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {copiedCode ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
                </button>
              </div>
            </div>

            {/* Direct Invite Link Box */}
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500">
                Direct Invite Link
              </label>
              <div className="p-3 rounded-2xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-between gap-2">
                <span className="font-mono text-xs dark:text-slate-300 text-slate-700 truncate max-w-[200px] sm:max-w-[250px]">
                  {inviteUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!referralCode}
                  className="px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                >
                  {copiedLink ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                </button>
              </div>
            </div>

            {/* Direct Share Shortcuts */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500 text-left">
                Direct Share
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  disabled={!referralCode}
                  className="py-2.5 px-2 rounded-2xl dark:bg-slate-800/70 bg-slate-100 border dark:border-slate-700 border-slate-300 hover:border-indigo-500 dark:text-slate-200 text-slate-700 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all disabled:opacity-50"
                  aria-label="Native Share"
                >
                  <Share2 size={18} className="text-indigo-400" />
                  <span>Share</span>
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-2 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 hover:border-[#25D366] text-[#25D366] flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all"
                  aria-label="Share on WhatsApp"
                >
                  <MessageCircle size={18} />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Zyvra par exam preparation ke liye judein! Use referral code: ${referralCode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-2 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/30 hover:border-[#229ED9] text-[#229ED9] flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all"
                  aria-label="Share on Telegram"
                >
                  <Send size={18} />
                  <span>Telegram</span>
                </a>
              </div>
              {shareFeedback && (
                <p className="text-xs text-amber-400 text-center font-semibold pt-1">
                  {shareFeedback}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="w-full py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700 min-h-[44px] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-xl">
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
            <div className="space-y-2 text-xs dark:text-slate-400 text-slate-600">
              <p>For inquiries, test issues, or billing assistance:</p>
              <div className="p-3 rounded-xl dark:bg-slate-900/80 bg-slate-50 border dark:border-slate-700 border-slate-300 space-y-1">
                <div>📧 Email: <span className="dark:text-white text-slate-900 font-bold">support@zyvra.in</span></div>
                <div>💬 WhatsApp: <span className="dark:text-white text-slate-900 font-bold">+91 98765 43210</span></div>
                <div>⏰ Support Hours: <span className="dark:text-white text-slate-900 font-bold">10 AM – 7 PM IST</span></div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSupportModalOpen(false)}
              className="w-full py-2 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700 min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

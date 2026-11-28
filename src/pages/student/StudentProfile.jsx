import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Award, BarChart3, Bell, Bookmark, Check, CheckCircle2, ChevronRight,
  Clock, Coins, Compass, Copy, Crown, Download, Edit3, ExternalLink, FileText, Flame,
  HelpCircle, KeyRound, Layers, LogOut, Mail, MessageCircle, Phone, RefreshCw,
  Send, Settings, Share2, ShieldCheck, Smartphone, Sparkles, Target, Upload, Users,
  X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';
import UploadGuide from '../../components/common/UploadGuide';
import DailyStreakModal from '../../components/student/DailyStreakModal';
import useModalBack from '../../hooks/useModalBack';
import { uploadAsset } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { useStudentStats } from '../../context/StudentStatsContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { ensureReferralCode, getReferralSettings } from '../../lib/referrals';
import { formatCoins, formatDays, formatTests } from '../../lib/formatters';

const POPULAR_EXAMS = [
  'SSC CGL / CHSL',
  'Railway RRB (NTPC/Group D)',
  'BPSC & State PSC',
  'Banking (IBPS / SBI)',
  'State Police & SI',
  'CTET & Teaching Exams',
  'Defence (NDA / CDS)',
  'NCERT Foundation'
];

export default function StudentProfile() {
  const { user, profile, guest, coinBalance, walletLoaded, accountAccess, supabase, signOut, refreshAccount } = useAuth();
  const { language } = useThemeLanguage();
  const isHindi = language === 'hi';
  const {
    completedAttempts: attempts,
    testsAttempted: testsAttemptedCount,
    accuracy: rawAccuracy,
    streakData,
    currentStreak: streakDays,
    loading: statsLoading
  } = useStudentStats();
  const navigate = useNavigate();

  // Modals state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);

  // Edit profile form state
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
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

  // Password & Device security state
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState('closed'); // 'closed' | 'start' | 'verify' | 'done'

  // Hardware Back Button Handlers for Profile Overlays & Modals
  useModalBack(editProfileOpen, () => setEditProfileOpen(false), 'profile-edit');
  useModalBack(goalsModalOpen, () => setGoalsModalOpen(false), 'profile-goals');
  useModalBack(inviteModalOpen, () => setInviteModalOpen(false), 'profile-invite');
  useModalBack(supportModalOpen, () => setSupportModalOpen(false), 'profile-support');
  useModalBack(passwordPanelOpen, () => setPasswordPanelOpen(false), 'profile-password');
  const [passwordOtp, setPasswordOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deviceActionBusy, setDeviceActionBusy] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState('');
  const [deviceError, setDeviceError] = useState('');

  // Referral copy feedback & live reward settings
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [currentReferralCode, setCurrentReferralCode] = useState(profile?.referral_code || '');
  const [referralSettings, setReferralSettings] = useState(null);
  const [referralSettingsLoading, setReferralSettingsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setReferralSettingsLoading(false);
      return;
    }
    getReferralSettings(supabase)
      .then((cfg) => {
        if (active && cfg) setReferralSettings(cfg);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReferralSettingsLoading(false);
      });
    return () => { active = false; };
  }, [supabase]);

  // Password OTP request
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

  // Password save
  const saveNewPassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordFeedback('');
    if (passwordOtp.length !== 6 || !/^[0-9]{6}$/.test(passwordOtp)) {
      setPasswordError('Enter the six-digit code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for your password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('The passwords do not match.');
      return;
    }
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

  // Sign out other devices
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

  // Access State
  const accessStatus = accountAccess?.userId === user?.id
    ? accountAccess.ready ? 'ready' : accountAccess.loading ? 'loading' : 'error'
    : 'loading';
  const isPro = accessStatus === 'ready' && accountAccess.isPremium;
  const unlockedCount = accessStatus === 'ready' ? accountAccess.unlockedCount : 0;
  const validTill = accessStatus === 'ready' ? accountAccess.validTill : 'Checking…';

  // Local storage counts
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);

  // Initialize fields from real profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || profile.name || '');
      setAvatarUrl(profile.avatar_url || '');
      setMobile(profile.mobile || '');
      setTargets(Array.isArray(profile.target_exams) ? profile.target_exams : []);
      setDailyTarget(Number(profile.daily_goal_target || 50));
      if (profile.referral_code) {
        setCurrentReferralCode(profile.referral_code);
      } else if (user && supabase) {
        ensureReferralCode(supabase, user.id)
          .then((code) => {
            if (code) {
              setCurrentReferralCode(code);
              if (refreshAccount) refreshAccount();
            }
          })
          .catch((err) => console.warn('Could not auto-generate referral code on profile:', err));
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

  // Unified Accuracy %
  const accuracyPercent = Number(Number(rawAccuracy || 0).toFixed(1));

  const displayName = fullName || profile?.full_name || profile?.name || user?.user_metadata?.full_name || (guest ? 'Guest Student' : 'Student');
  const displayEmail = user?.email || (guest ? 'guest@zyvra.in' : '');
  const referralCode = currentReferralCode || profile?.referral_code || '';
  const inviteUrl = referralCode ? `${window.location.origin}/auth?ref=${referralCode}` : `${window.location.origin}/auth`;
  const inviteMessage = `Zyvra par mere saath exams ki taiyari karein! 🚀\nUse my referral code ${referralCode} to get free bonus coins on signup:\n${inviteUrl}`;

  // Student Roll / ID
  const studentRollId = useMemo(() => {
    if (!user?.id) return 'ZYV-STUDENT';
    return `ZYV-${user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }, [user?.id]);

  // Target exam display string
  const targetExamsList = useMemo(() => {
    if (targets && targets.length > 0) return targets;
    if (profile?.target_exams && Array.isArray(profile.target_exams) && profile.target_exams.length > 0) {
      return profile.target_exams;
    }
    return [];
  }, [targets, profile?.target_exams]);

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

  // Toggle target exam in form
  const toggleTargetExam = (exam) => {
    setTargets((prev) =>
      prev.includes(exam) ? prev.filter((item) => item !== exam) : [...prev, exam]
    );
  };

  // Save profile updates to Supabase
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback('');
    try {
      const cleanMobile = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : '';
      if (cleanMobile && !/^[6-9]\d{9}$/.test(cleanMobile)) {
        throw new Error('Kripya 10 ankon ka valid Indian mobile number darj karein.');
      }
      const trimmedName = String(fullName || '').trim();
      if (trimmedName.length < 2) {
        throw new Error('Kripya apna poora naam kam se kam 2 aksharon ka darj karein.');
      }

      if (supabase && user) {
        let savedViaApi = false;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            const res = await fetch('/api/update-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                full_name: trimmedName,
                mobile: cleanMobile || null,
                avatar_url: avatarUrl || null,
                target_exams: targets
              })
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
              savedViaApi = true;
            } else if (data?.error) {
              console.warn('API profile update returned error:', data.error);
            }
          }
        } catch (apiErr) {
          console.warn('Profile update endpoint unreachable, falling back to direct update:', apiErr);
        }

        if (!savedViaApi) {
          const { error } = await supabase
            .from('profiles')
            .update({
              full_name: trimmedName,
              mobile: cleanMobile || null,
              target_exams: targets,
              avatar_url: avatarUrl || profile?.avatar_url || null
            })
            .eq('id', user.id);
          if (error) throw error;
        }

        setProfileFeedback('Profile successfully updated!');
        if (refreshAccount) await refreshAccount();
        setTimeout(() => {
          setProfileFeedback('');
          setEditProfileOpen(false);
        }, 1000);
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
          .update({
            daily_goal_target: Number(dailyTarget),
            target_exams: targets
          })
          .eq('id', user.id);
        if (error) throw error;
        if (refreshAccount) await refreshAccount();
        setGoalsFeedback('Goal & Target Exams saved successfully!');
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
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-900 transition-colors pb-24">
      {/* Top App Bar & Atmospheric Aura */}
      <div className="relative">
        <MountainSunsetAura height={190} mobileHeight={80} showSun={true} />

        {/* Top Floating Navigation */}
        <div className="absolute top-0 inset-x-0 z-20 px-2 sm:px-4 pt-3.5 flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/', { replace: true });
                }
              }}
              className="w-9 h-9 rounded-full dark:bg-slate-900/90 bg-white/95 border dark:border-slate-700/80 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
              aria-label="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-xl leading-none">⚡</span>
              <div>
                <span className="dark:text-white text-slate-900 font-black tracking-wider text-base">Zyvra</span>
                <span className="dark:text-indigo-400 text-indigo-600 text-[10px] block -mt-0.5 font-bold uppercase tracking-wider">
                  {isHindi ? 'छात्र प्रोफ़ाइल' : 'Student Profile'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full dark:bg-slate-900/90 bg-white/95 border dark:border-slate-700/80 border-slate-300 flex items-center justify-center dark:text-white text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-all shadow-sm active:scale-95"
              aria-label={isHindi ? 'सूचनाएँ' : 'Notifications'}
            >
              <Bell size={17} />
            </Link>
          </div>
        </div>

        {/* Unique Feature: Zyvra Student Digital ID Card (विद्यार्थी पहचान पत्र) */}
        <div className="relative z-10 pt-12 sm:pt-16 pb-3 w-full max-w-4xl min-w-0 mx-auto">
          <div className="relative overflow-hidden rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200/90 p-4 sm:p-5 shadow-lg transition-all">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                {/* Avatar with Ring & Edit Overlay */}
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-[2px] shadow-sm">
                    <div className="w-full h-full rounded-[14px] dark:bg-[#0B1120] bg-white flex items-center justify-center font-black text-2xl sm:text-3xl text-indigo-500 overflow-hidden">
                      {avatarUrl || profile?.avatar_url ? (
                        <img
                          src={avatarUrl || profile.avatar_url}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(profile?.full_name || profile?.name || user?.user_metadata?.full_name || '');
                      setMobile(profile?.mobile || '');
                      setAvatarUrl(profile?.avatar_url || '');
                      setTargets(Array.isArray(profile?.target_exams) ? profile.target_exams : []);
                      setEditProfileOpen(true);
                    }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full dark:bg-slate-900 bg-white border dark:border-slate-600 border-slate-300 dark:text-amber-400 text-amber-600 flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
                    aria-label="Change Avatar"
                    title="Change Photo"
                  >
                    <Edit3 size={11} />
                  </button>
                </div>

                {/* Name, Student ID, Contact */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight truncate">
                      {displayName}
                    </h1>
                    {/* Membership Badge */}
                    {accessStatus === 'loading' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold dark:bg-slate-800 bg-slate-200 text-slate-500">
                        {isHindi ? 'जाँच हो रही है...' : 'Verifying...'}
                      </span>
                    ) : isPro ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-xs">
                        <Crown size={11} className="fill-current" />
                        <span>PRO SCHOLAR</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 dark:text-slate-300 text-slate-700">
                        <span>{isHindi ? 'निःशुल्क सदस्य' : 'Free Aspirant'}</span>
                      </span>
                    )}
                  </div>

                  {/* Student ID Code */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md dark:bg-slate-800/80 bg-slate-200/80 text-[10px] font-mono font-bold dark:text-slate-300 text-slate-700">
                      ID: {studentRollId}
                    </span>
                    {displayEmail && (
                      <span className="flex items-center gap-1 text-[11px] dark:text-slate-400 text-slate-600 font-medium truncate max-w-[190px] sm:max-w-xs">
                        <Mail size={11} className="text-indigo-500 shrink-0" />
                        <span className="truncate">
                          {(() => {
                            const [local, domain] = String(displayEmail).split('@');
                            if (!domain) return displayEmail;
                            return `${local.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(5, local.length - 2)))}@${domain}`;
                          })()}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Masked Mobile or Add Mobile Button */}
                  <div className="pt-0.5">
                    {profile?.mobile ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        <Phone size={12} className="shrink-0" />
                        <span>
                          +91{' '}
                          {(() => {
                            const digits = String(profile.mobile).replace(/\D/g, '');
                            if (digits.length < 6) return digits;
                            return `${digits.slice(0, 2)}${'•'.repeat(Math.max(4, digits.length - 5))}${digits.slice(-3)}`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setFullName(profile?.full_name || profile?.name || '');
                          setMobile('');
                          setAvatarUrl(profile?.avatar_url || '');
                          setTargets(Array.isArray(profile?.target_exams) ? profile.target_exams : []);
                          setEditProfileOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-400 font-bold underline underline-offset-2"
                      >
                        <Phone size={11} />
                        <span>{isHindi ? '+ व्हाट्सऐप / मोबाइल जोड़ें' : '+ Add WhatsApp / Mobile'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Profile Button */}
              <div className="flex items-center gap-2 sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setFullName(profile?.full_name || profile?.name || user?.user_metadata?.full_name || '');
                    setMobile(profile?.mobile || '');
                    setAvatarUrl(profile?.avatar_url || '');
                    setTargets(Array.isArray(profile?.target_exams) ? profile.target_exams : []);
                    setEditProfileOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 hover:border-amber-400 dark:hover:border-amber-400 text-xs font-bold dark:text-white text-slate-800 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Edit3 size={13} className="text-amber-500" />
                  <span>{isHindi ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile'}</span>
                </button>
              </div>
            </div>

            {/* Target Exam Banner */}
            <div className="mt-4 pt-3.5 border-t dark:border-slate-800 border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xs shrink-0">
                  🎯
                </span>
                <span className="text-xs font-bold dark:text-slate-300 text-slate-600 shrink-0">
                  {isHindi ? 'लक्ष्य परीक्षा:' : 'Target Exam:'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {targetExamsList.length > 0 ? (
                    targetExamsList.slice(0, 3).map((exam) => (
                      <span
                        key={exam}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-bold dark:bg-indigo-950/60 bg-indigo-50 border dark:border-indigo-800/60 border-indigo-200 text-indigo-600 dark:text-indigo-300 truncate max-w-[140px]"
                      >
                        {exam}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-amber-500 font-semibold italic">
                      {isHindi ? 'अभी कोई परीक्षा नहीं चुनी गई' : 'No target exam selected yet'}
                    </span>
                  )}
                  {targetExamsList.length > 3 && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      +{targetExamsList.length - 3} {isHindi ? 'अन्य' : 'more'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTargets(Array.isArray(profile?.target_exams) ? profile.target_exams : []);
                  setDailyTarget(Number(profile?.daily_goal_target || 50));
                  setGoalsModalOpen(true);
                }}
                className="text-[11px] text-amber-500 hover:text-amber-400 font-black flex items-center gap-1 shrink-0 ml-auto min-h-[36px]"
              >
                <span>{isHindi ? 'परीक्षा बदलें' : 'Change Exam'}</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 relative z-10">
        {/* Pass / Pro Subscription Card */}
        <section className="relative overflow-hidden rounded-2xl dark:bg-gradient-to-r dark:from-[#1b1706] dark:via-slate-900 dark:to-slate-900 bg-gradient-to-r from-amber-50 via-amber-100/30 to-white border dark:border-amber-500/40 border-amber-300 p-4 sm:p-4.5 shadow-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-md shrink-0">
              👑
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight truncate">
                  {isPro ? (isHindi ? 'ज़ीव्रा पास सक्रिय' : 'Zyvra Pass Active') : (isHindi ? 'ज़ीव्रा पास सदस्यता' : 'Zyvra Pass Membership')}
                </h2>
                {isPro && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white uppercase tracking-wider">
                    PRO
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs dark:text-amber-200/90 text-amber-900/90 font-medium truncate mt-0.5">
                {accessStatus === 'loading'
                  ? (isHindi ? 'पास स्थिति जाँची जा रही है...' : 'Checking your pass status...')
                  : accessStatus === 'error'
                  ? (isHindi ? 'संपर्क नहीं हो सका। पुनः प्रयास करें।' : 'Could not connect. Tap to retry.')
                  : isPro
                  ? `${unlockedCount > 0 ? (isHindi ? `${unlockedCount} कोर्स व टेस्ट अनलॉक` : `${unlockedCount} courses & test packages unlocked`) : (isHindi ? 'पूर्ण प्लेटफ़ॉर्म पहुँच सक्रिय' : 'Full platform access active')}`
                  : (isHindi ? 'असीमित टेस्ट, व्याख्या व स्टडी टूल्स अनलॉक करें' : 'Unlock unlimited mock tests, solutions & revision notes')}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            {accessStatus === 'loading' ? (
              <span className="inline-block w-16 h-8 rounded-full dark:bg-slate-700 bg-slate-200 animate-pulse" />
            ) : accessStatus === 'error' ? (
              <button
                type="button"
                onClick={() => refreshAccount?.().catch(() => {})}
                className="px-3 py-1.5 rounded-xl border border-rose-300 text-xs font-bold text-rose-600 dark:border-rose-500/40 dark:text-rose-300"
              >
                {isHindi ? 'पुनः प्रयास' : 'Retry'}
              </button>
            ) : isPro ? (
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-amber-500 block">{isHindi ? 'वैधता' : 'Valid Till'}</span>
                <span className="text-xs font-black dark:text-white text-slate-900 block">{validTill}</span>
                <Link
                  to="/purchases"
                  className="text-[10px] text-amber-500 hover:underline font-bold inline-block"
                >
                  {isHindi ? 'विवरण देखें →' : 'View Details →'}
                </Link>
              </div>
            ) : (
              <Link
                to="/purchases"
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md inline-flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>{isHindi ? 'पास लें' : 'Get Pass'}</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </section>

        {/* 4 Gamified Prep Metrics (Student Matrix) */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-indigo-500" />
              <span>{isHindi ? 'प्रगति ट्रैकर' : 'Progress Tracker'}</span>
            </h3>
            <Link to="/analytics" className="text-[11px] text-indigo-500 hover:text-indigo-400 font-bold flex items-center gap-0.5">
              <span>{isHindi ? 'पूरा विश्लेषण' : 'Full Analytics'}</span>
              <ChevronRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* 1. Daily Study Streak */}
            <button
              type="button"
              onClick={() => setStreakModalOpen(true)}
              className="dark:bg-[#1E293B] bg-white border dark:border-orange-500/30 border-orange-200 hover:border-orange-400 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-sm relative overflow-hidden group active:scale-95 transition-all cursor-pointer"
              aria-label={isHindi ? 'अध्ययन स्ट्रीक विवरण देखें' : 'View daily study streak details'}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Flame size={16} className={streakDays > 0 ? 'fill-orange-500 animate-pulse' : 'text-slate-400'} />
              </div>
              <div className="text-base sm:text-xl font-black dark:text-orange-400 text-orange-600 tracking-tight">
                {statsLoading ? (
                  <span className="inline-block h-5 w-12 rounded bg-orange-500/20 animate-pulse" aria-hidden="true" />
                ) : (
                  <span>{formatDays(streakDays, language)}</span>
                )}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                <span>{isHindi ? 'स्ट्रीक' : 'Streak'}</span>
                {streakData?.isActiveToday ? (
                  <span className="text-emerald-500 font-black">✓</span>
                ) : streakData?.streakAtRisk ? (
                  <span className="text-amber-500 font-black">⚡</span>
                ) : null}
              </div>
            </button>

            {/* 2. Daily Goal Target */}
            <button
              type="button"
              onClick={() => {
                setDailyTarget(Number(profile?.daily_goal_target || 50));
                setGoalsModalOpen(true);
              }}
              className="dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 hover:border-amber-400/50 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-sm group active:scale-95 transition-all text-left"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Target size={16} />
              </div>
              <div className="text-base sm:text-xl font-black dark:text-white text-slate-900 tracking-tight">
                {dailyTarget}{' '}
                <span className="text-[10px] font-bold">{isHindi ? 'प्रश्न/दिन' : 'Qs/day'}</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 flex items-center gap-0.5">
                <span>{isHindi ? 'दैनिक लक्ष्य' : 'Daily Goal'}</span>
                <Edit3 size={9} className="text-amber-500" />
              </div>
            </button>

            {/* 3. Tests Completed */}
            <Link
              to="/analytics"
              className="dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 hover:border-indigo-400/50 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-sm group active:scale-95 transition-all"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <FileText size={16} />
              </div>
              <div className="text-base sm:text-xl font-black dark:text-white text-slate-900 tracking-tight">
                {statsLoading ? (
                  <span className="inline-block h-5 w-8 rounded bg-slate-300 dark:bg-slate-700 animate-pulse" aria-hidden="true" />
                ) : (
                  testsAttemptedCount
                )}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {isHindi ? 'दिए गए टेस्ट' : 'Tests Given'}
              </div>
            </Link>

            {/* 4. Accuracy % */}
            <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-1.5">
                <CheckCircle2 size={16} />
              </div>
              <div className="text-base sm:text-xl font-black dark:text-emerald-400 text-emerald-600 tracking-tight">
                {statsLoading ? (
                  <span className="inline-block h-5 w-10 rounded bg-emerald-500/20 animate-pulse" aria-hidden="true" />
                ) : (
                  `${accuracyPercent}%`
                )}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {isHindi ? 'सटीकता' : 'Accuracy'}
              </div>
            </div>
          </div>
        </section>

        {/* Zyvra Coins & Rewards Banner */}
        <section>
          <Link
            to="/wallet"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-amber-500/30 border-amber-200 hover:border-amber-400 shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                <Coins size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900">
                    {isHindi ? 'ज़ीव्रा रिवार्ड कॉइन्स' : 'Zyvra Reward Coins'}
                  </h4>
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {isHindi ? 'रिवार्ड्स' : 'Rewards'}
                  </span>
                </div>
                <p className="text-[11px] dark:text-slate-400 text-slate-500 font-medium">
                  {isHindi ? 'टेस्ट सीरीज़ व छूट के लिए कॉइन्स रिडीम करें' : 'Redeem coins for test series & discounts'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-700 dark:text-amber-300 font-black text-xs group-hover:scale-105 transition-transform">
                <span>🪙</span>
                {!walletLoaded ? (
                  <span className="inline-block h-3.5 w-8 rounded bg-amber-500/25 animate-pulse" aria-hidden="true" />
                ) : (
                  <span>{formatCoins(coinBalance || 0, language)}</span>
                )}
              </div>
              <ChevronRight size={16} className="text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </section>

        {/* SECTION 1: Study & Practice */}
        <section className="space-y-2">
          <div className="px-1 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
              <span>{isHindi ? 'अध्ययन व अभ्यास' : 'Study & Practice'}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">{isHindi ? 'आपकी अध्ययन सामग्री' : 'Your Study Content'}</span>
          </div>

          <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl divide-y dark:divide-slate-800/80 divide-slate-100 shadow-sm overflow-hidden">
            {/* Bookmarked Questions */}
            <Link
              to="/bookmarks"
              className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Bookmark size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'सहेजे गए प्रश्न व बुकमार्क्स' : 'Saved Questions & Bookmarks'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    रिवीजन के लिए सुरक्षित किए गए महत्वपूर्ण प्रश्न
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-black dark:bg-amber-950/60 bg-amber-50 dark:text-amber-300 text-amber-700 border dark:border-amber-800/50 border-amber-200">
                  {bookmarksCount}
                </span>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Study Notes & Formula Sheets */}
            <Link
              to="/toolbox"
              className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'मेरे स्टडी नोट्स व टूलबॉक्स' : 'My Study Notes & Toolbox'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    आपके बनाए हुए शॉर्ट नोट्स, फॉर्मूला और टूल्स
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-black dark:bg-indigo-950/60 bg-indigo-50 dark:text-indigo-300 text-indigo-700 border dark:border-indigo-800/50 border-indigo-200">
                  {notesCount}
                </span>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Test History & Analytics */}
            <Link
              to="/analytics"
              className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <BarChart3 size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'टेस्ट इतिहास व स्कोर विश्लेषण' : 'Test History & Score Analysis'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    सभी टेस्ट्स का परिणाम, एक्यूरेसी और कमजोर विषय
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] dark:text-slate-400 text-slate-500 font-bold">
                  {statsLoading ? '…' : formatTests(testsAttemptedCount, language)}
                </span>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Goal Setting & Target Exams */}
            <button
              type="button"
              onClick={() => {
                setDailyTarget(Number(profile?.daily_goal_target || 50));
                setTargets(Array.isArray(profile?.target_exams) ? profile.target_exams : []);
                setGoalsModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <Target size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'दैनिक लक्ष्य व लक्ष्य परीक्षा' : 'Daily Goal & Target Exam'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    रोजाना सवाल हल करने का लक्ष्य और अपनी परीक्षा चुनें
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold dark:bg-purple-950/60 bg-purple-50 dark:text-purple-300 text-purple-700 border dark:border-purple-800/50 border-purple-200">
                  {dailyTarget} {isHindi ? 'प्रश्न/दिन' : 'Qs/day'}
                </span>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          </div>
        </section>

        {/* SECTION 2: PASS, WALLET & REWARDS */}
        <section className="space-y-2">
          <div className="px-1 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
              <span>{isHindi ? 'पास और इनाम' : 'Pass & Rewards'}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">{isHindi ? 'खरीदारी व रिवार्ड्स' : 'Purchases & Rewards'}</span>
          </div>

          <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl divide-y dark:divide-slate-800/80 divide-slate-100 shadow-sm overflow-hidden">
            {/* My Purchases & Active Pass */}
            <Link
              to="/purchases"
              className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Crown size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'मेरी खरीदारी और ज़ीव्रा पास' : 'My Purchases & Zyvra Pass'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    {isHindi ? 'सक्रिय पैकेज, टेस्ट सीरीज और इनवॉइस देखें' : 'View active passes, test series, and invoices'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-amber-500">
                  {isPro ? (isHindi ? 'सक्रिय पास' : 'Active Pass') : (isHindi ? 'प्लान देखें' : 'View Plans')}
                </span>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Refer & Earn Friends (Unified live platform_settings rate) */}
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">
                      {isHindi ? 'दोस्तों को जोड़ें और कॉइन्स कमाएँ' : 'Invite Friends & Earn Coins'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {isHindi ? 'मुफ़्त कॉइन्स' : 'Free Coins'}
                    </span>
                  </div>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    {referralSettingsLoading ? (
                      <span className="inline-block h-3 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse align-middle" aria-hidden="true" />
                    ) : isHindi ? (
                      `दोस्तों को जोड़ें और हर सफल रेफरल पर ${formatCoins(referralSettings?.referrerCoins ?? 0, 'hi')} पाएं`
                    ) : (
                      `Share your invite code to earn ${formatCoins(referralSettings?.referrerCoins ?? 0, 'en')} per referral`
                    )}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </section>

        {/* SECTION 3: ACCOUNT & SECURITY */}
        <section className="space-y-2">
          <div className="px-1 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
              <span>{isHindi ? 'खाता और सुरक्षा' : 'Account & Security'}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">{isHindi ? 'सुरक्षा व सहायता' : 'Security & Help'}</span>
          </div>

          <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl divide-y dark:divide-slate-800/80 divide-slate-100 shadow-sm overflow-hidden">
            {/* Edit Personal Details */}
            <button
              type="button"
              onClick={() => {
                setFullName(profile?.full_name || profile?.name || user?.user_metadata?.full_name || '');
                setMobile(profile?.mobile || '');
                setAvatarUrl(profile?.avatar_url || '');
                setTargets(Array.isArray(profile?.target_exams) ? profile.target_exams : []);
                setProfileFeedback('');
                setEditProfileOpen(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                  <Edit3 size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'व्यक्तिगत प्रोफ़ाइल विवरण' : 'Personal Profile Details'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    अपना नाम, फोटो और WhatsApp मोबाइल नंबर अपडेट करें
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:dark:text-white group-hover:text-slate-800 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Password Management */}
            {!guest && (
              <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <KeyRound size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                        {isHindi ? 'पासवर्ड और साइन-इन' : 'Password & Sign-in'}
                      </span>
                      <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                        ईमेल ओटीपी से नया पासवर्ड सेट या रीसेट करें
                      </span>
                    </div>
                  </div>
                  {!passwordPanelOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordPanelOpen(true);
                        setPasswordStep('start');
                        setPasswordError('');
                        setPasswordFeedback('');
                      }}
                      className="px-3 py-1.5 rounded-xl border dark:border-slate-700 border-slate-300 hover:border-indigo-400 text-xs font-bold dark:text-slate-300 text-slate-700 shrink-0 transition-colors active:scale-95"
                    >
                      {isHindi ? 'सेट / रीसेट' : 'Set / Reset'}
                    </button>
                  )}
                </div>

                {passwordPanelOpen && (
                  <div className="mt-3 pt-3 border-t dark:border-slate-800 border-slate-100 space-y-3">
                    {passwordStep === 'start' && (
                      <div className="space-y-3">
                        <p className="text-xs dark:text-slate-300 text-slate-600">
                          We will send a 6-digit verification code to <strong>{user?.email}</strong> to set your password.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={requestPasswordOtp}
                            disabled={passwordBusy}
                            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors disabled:opacity-50"
                          >
                            {passwordBusy ? 'Sending code...' : 'Send Verification Code'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPasswordPanelOpen(false)}
                            className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {passwordStep === 'verify' && (
                      <form onSubmit={saveNewPassword} className="space-y-3 max-w-sm">
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">
                            Email Verification Code
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={passwordOtp}
                            onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            placeholder="6-digit code"
                            className="w-full px-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold tracking-widest text-center focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">
                            New Password (min 8 characters)
                          </label>
                          <input
                            type="password"
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            placeholder="New password"
                            className="w-full px-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            minLength={8}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            required
                            placeholder="Confirm password"
                            className="w-full px-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-bold focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={passwordBusy}
                            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors disabled:opacity-50"
                          >
                            {passwordBusy ? 'Saving...' : 'Verify Code & Save Password'}
                          </button>
                          <button
                            type="button"
                            onClick={requestPasswordOtp}
                            disabled={passwordBusy}
                            className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200"
                          >
                            Resend Code
                          </button>
                        </div>
                      </form>
                    )}

                    {passwordStep === 'done' && (
                      <div className="space-y-2">
                        <p className="text-xs text-emerald-400 font-bold">Password successfully updated!</p>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordPanelOpen(false);
                            setPasswordStep('closed');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold"
                        >
                          Close
                        </button>
                      </div>
                    )}

                    {passwordFeedback && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        {passwordFeedback}
                      </div>
                    )}
                    {passwordError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
                        {passwordError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Signed-in Devices (Limit 2 devices) */}
            {!guest && (
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Smartphone size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                      {isHindi ? 'सुरक्षित डिवाइसेस' : 'Signed-in Devices'}
                    </span>
                    <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                      आप अधिकतम 2 डिवाइस पर एक साथ पढ़ाई कर सकते हैं
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={signOutOtherDevices}
                  disabled={deviceActionBusy}
                  className="px-3 py-1.5 rounded-xl border dark:border-slate-700 border-slate-300 hover:border-rose-400 text-xs font-bold dark:text-slate-300 text-slate-700 hover:text-rose-500 shrink-0 transition-colors active:scale-95 disabled:opacity-50"
                >
                  {deviceActionBusy ? (isHindi ? 'हटा रहे हैं...' : 'Signing out...') : (isHindi ? 'अन्य डिवाइस हटाएँ' : 'Sign out others')}
                </button>
              </div>
            )}

            {/* Device Feedback notifications */}
            {deviceFeedback && (
              <div className="p-3 text-xs font-bold text-emerald-500 dark:bg-emerald-950/40 bg-emerald-50 border-t border-emerald-500/20">
                {deviceFeedback}
              </div>
            )}
            {deviceError && (
              <div className="p-3 text-xs font-bold text-rose-500 dark:bg-rose-950/40 bg-rose-50 border-t border-rose-500/20">
                {deviceError}
              </div>
            )}

            {/* 1. Direct Live AI & Admin Support Chat */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
                  window.dispatchEvent(new window.CustomEvent('zyvra:open-support-chat'));
                }
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left border-b dark:border-slate-800/60 border-slate-100"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0 shadow-xs">
                  <MessageCircle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                      {isHindi ? 'सहायता डेस्क और AI चैट' : 'Help Desk & AI Support Chat'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0">
                      ⚡ {isHindi ? '24×7 सक्रिय' : '24×7 Active'}
                    </span>
                  </div>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    कोर्स, टेस्ट अनलॉक, पेमेंट या कॉइन सहायता के लिए तुरंत चैट करें
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* 2. Official Contact & Support Info Modal */}
            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                  <HelpCircle size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                    {isHindi ? 'आधिकारिक सहायता एवं ईमेल' : 'Official Support & Email Desk'}
                  </span>
                  <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate">
                    zyvra.education@gmail.com एवं सहायता केंद्र
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </section>

        {/* Sign Out Button */}
        <section className="pt-2">
          {signOutError && (
            <div className="mb-2 p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold text-center">
              {signOutError}
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-3.5 rounded-2xl dark:bg-rose-950/30 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border dark:border-rose-800/40 border-rose-200 dark:text-rose-300 text-rose-700 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <LogOut size={16} />
            <span>{isHindi ? 'खाते से लॉग आउट करें' : 'Sign Out of Account'}</span>
          </button>
        </section>
      </div>

      {/* MODAL 1: Edit Profile Modal (Name, Phone, Photo & Target Exams) */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl dark:bg-[#0f172a] bg-white border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-2 border-b dark:border-slate-800 border-slate-200">
              <h3 className="text-base font-black flex items-center gap-2">
                <Edit3 size={18} className="text-amber-500" />
                <span>Edit Student Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {profileFeedback && (
              <div className="p-3 rounded-xl dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-200 text-xs font-bold dark:text-amber-300 text-amber-700">
                {profileFeedback}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo Upload */}
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1.5">
                  Profile Photo (प्रोफ़ाइल फोटो)
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
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm">
                      <Upload size={14} />
                      <span>{uploadingAvatar ? 'Uploading...' : 'Choose Photo'}</span>
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
                        className="block text-[11px] text-rose-400 hover:underline pt-0.5"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <UploadGuide formats=".png, .webp, .jpg" dimensions="300×300 px (Square)" maxSize="Max 2 MB" />
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1">
                  Full Name (पूरा नाम)
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="अपना पूरा नाम दर्ज करें"
                  className="w-full px-3.5 py-2.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* WhatsApp Mobile */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700">
                    WhatsApp / Mobile Number
                  </label>
                  <span className="text-[10px] text-emerald-500 font-bold">
                    Important for Test Alerts
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-400 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="w-full pl-11 pr-3.5 py-2.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-400 tracking-wider"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  टेस्ट रिजल्ट, नए मॉक टेस्ट और जरूरी अपडेट्स के लिए WhatsApp नंबर दर्ज करें।
                </p>
              </div>

              {/* Target Exams Selection (Now integrated in Edit Profile!) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700">
                    Target Exams (तैयारी की परीक्षाएं)
                  </label>
                  <span className="text-[10px] text-indigo-400 font-semibold">Select 1 or more</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200">
                  {POPULAR_EXAMS.map((exam) => {
                    const isSelected = targets.includes(exam);
                    return (
                      <button
                        type="button"
                        key={exam}
                        onClick={() => toggleTargetExam(exam)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'dark:bg-slate-800 bg-white dark:text-slate-300 text-slate-700 border dark:border-slate-700 border-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{exam}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t dark:border-slate-800 border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Goals & Target Exam Modal */}
      {goalsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl dark:bg-[#0f172a] bg-white border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-2 border-b dark:border-slate-800 border-slate-200">
              <h3 className="text-base font-black flex items-center gap-2">
                <Target size={18} className="text-amber-500" />
                <span>My Exam Goals & Daily Target</span>
              </h3>
              <button
                type="button"
                onClick={() => setGoalsModalOpen(false)}
                className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {goalsFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  goalsFeedback.includes('successfully')
                    ? 'dark:bg-emerald-500/20 bg-emerald-50 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                    : 'dark:bg-rose-950/40 bg-rose-50 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                {goalsFeedback}
              </div>
            )}

            <form onSubmit={handleSaveGoals} className="space-y-4">
              {/* Daily Question Slider */}
              <div className="p-3.5 rounded-2xl dark:bg-slate-900/80 bg-slate-50 border dark:border-slate-800 border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
                    Daily Questions Target (रोज का लक्ष्य):
                  </span>
                  <span className="text-sm font-black text-amber-500">
                    {dailyTarget} Questions
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>20 (Beginner)</span>
                  <span>50 (Recommended)</span>
                  <span>100+ (Intensive)</span>
                </div>
              </div>

              {/* Target Exam Selection */}
              <div>
                <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block mb-1.5">
                  Select Target Exams (लक्ष्य परीक्षाएं):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200">
                  {POPULAR_EXAMS.map((exam) => {
                    const isSelected = targets.includes(exam);
                    return (
                      <button
                        type="button"
                        key={exam}
                        onClick={() => toggleTargetExam(exam)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'dark:bg-slate-800 bg-white dark:text-slate-300 text-slate-700 border dark:border-slate-700 border-slate-200 hover:border-amber-400'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{exam}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800 border-slate-200">
                <button
                  type="button"
                  onClick={() => setGoalsModalOpen(false)}
                  className="px-4 py-2 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGoals}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingGoals ? 'Saving...' : 'Save Goals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Invite Friends Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl dark:bg-[#0f172a] bg-white border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-500 border border-amber-400/30 flex items-center justify-center text-xl">
                🎁
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black">
                {isHindi ? 'दोस्तों को आमंत्रित करें और कॉइन्स कमाएँ' : 'Invite Friends & Earn Free Coins'}
              </h3>
              {referralSettingsLoading ? (
                <div className="mt-1.5 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
              ) : (
                <p className="text-xs dark:text-slate-400 text-slate-600 mt-1">
                  {isHindi
                    ? `साझा लिंक से मित्र जुड़ें: आपके मित्र को +${referralSettings?.referredCoins ?? 0} कॉइन्स और आपको +${referralSettings?.referrerCoins ?? 0} कॉइन्स मिलेंगे!`
                    : `Share your invite link with friends: they get +${referralSettings?.referredCoins ?? 0} coins and you earn +${referralSettings?.referrerCoins ?? 0} coins per join!`}
                </p>
              )}
            </div>

            {/* Referral Code Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500">
                Aapka Referral Code
              </label>
              <div className="p-3 rounded-2xl dark:bg-slate-900 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-between gap-2">
                <span className="font-mono text-base font-black dark:text-amber-300 text-amber-700 tracking-wider">
                  {referralCode || 'Generating code...'}
                </span>
                {referralCode ? (
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    {copiedCode ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (user && supabase) {
                        const code = await ensureReferralCode(supabase, user.id);
                        if (code) {
                          setCurrentReferralCode(code);
                          if (refreshAccount) refreshAccount();
                        }
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    Get Code
                  </button>
                )}
              </div>
            </div>

            {/* Direct Share Options */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500">
                Direct WhatsApp / Share
              </label>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-2 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 hover:border-[#25D366] text-[#25D366] flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all"
                >
                  <MessageCircle size={20} />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Zyvra par exam preparation ke liye judein! Code: ${referralCode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-2 rounded-2xl bg-[#229ED9]/15 border border-[#229ED9]/30 hover:border-[#229ED9] text-[#229ED9] flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all"
                >
                  <Send size={20} />
                  <span>Telegram</span>
                </a>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  disabled={!referralCode}
                  className="py-3 px-2 rounded-2xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 hover:border-indigo-500 text-indigo-400 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all disabled:opacity-50"
                >
                  <Share2 size={20} />
                  <span>More Apps</span>
                </button>
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
              className="w-full py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: 24x7 Help & Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl dark:bg-[#0f172a] bg-white border dark:border-slate-700 border-slate-300 dark:text-white text-slate-900 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <HelpCircle size={18} className="text-amber-500" />
                <span>24×7 Student Help & Support</span>
              </h3>
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="w-8 h-8 rounded-full dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs dark:text-slate-300 text-slate-600">
              <p>
                Reach out to our student support team anytime for help with questions, tests, pass activation, or billing:
              </p>

              {/* Start In-App Live Chat Button */}
              <button
                type="button"
                onClick={() => {
                  setSupportModalOpen(false);
                  if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
                    window.dispatchEvent(new window.CustomEvent('zyvra:open-support-chat'));
                  }
                }}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <MessageCircle size={17} />
                <span>Start Live Chat</span>
              </button>

              <div className="p-3.5 rounded-2xl dark:bg-slate-900/90 bg-slate-50 border dark:border-slate-800 border-slate-200 space-y-2.5">
                <a
                  href="mailto:zyvra.education@gmail.com"
                  className="flex items-center gap-2.5 text-indigo-400 font-bold hover:underline"
                >
                  <Mail size={18} className="shrink-0" />
                  <span>Email: zyvra.education@gmail.com</span>
                </a>

                <div className="flex items-center gap-2.5 text-slate-400 text-[11px] pt-1 border-t dark:border-slate-800 border-slate-200">
                  <Clock size={15} className="shrink-0" />
                  <span>Support Timing: 9:00 AM – 9:00 PM (All 7 Days)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSupportModalOpen(false)}
              className="w-full py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 text-xs font-bold dark:text-slate-300 text-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Daily Study Streak Detail Modal */}
      <DailyStreakModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streakData={streakData}
      />
    </div>
  );
}

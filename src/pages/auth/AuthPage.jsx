import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  LogIn,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import LanguageToggle from '../../components/common/LanguageToggle';
import { ensureReferralCode, processReferralAward } from '../../lib/referrals';

const RESEND_SECONDS = 45;

function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).trim());
}

function formatAuthError(authError, language) {
  const detail = authError?.message || (typeof authError === 'string' ? authError : '');
  const isHi = language === 'hi';

  if (!detail) {
    return isHi ? 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।' : 'Something went wrong. Please try again.';
  }
  if (/two devices/i.test(detail)) {
    return isHi
      ? 'यह खाता पहले से ही दो डिवाइस पर लॉगिन है। किसी अन्य डिवाइस से लॉगआउट करें, फिर प्रयास करें।'
      : 'This account is already active on two devices. Sign out from another device, then try again.';
  }
  if (/invalid login credentials|invalid_credentials/i.test(detail)) {
    return isHi
      ? 'गलत ईमेल या पासवर्ड। कृपया जाँच कर पुनः प्रयास करें या पासवर्ड रीसेट करें।'
      : 'Invalid email or password. Please check your credentials or reset your password.';
  }
  if (/user already registered|already registered/i.test(detail)) {
    return isHi
      ? 'यह ईमेल पहले से पंजीकृत है। कृपया साइन इन करें।'
      : 'An account with this email already exists. Please sign in instead.';
  }
  if (/rate limit|over_email_send_rate_limit/i.test(detail)) {
    return isHi
      ? 'बहुत अधिक अनुरोध। कृपया 1 मिनट बाद पुनः प्रयास करें।'
      : 'Email rate limit reached. Please wait a minute before requesting another code.';
  }
  if (/expired/i.test(detail)) {
    return isHi
      ? 'सत्यापन कोड समाप्त (expired) हो गया है। कृपया नया कोड मंगाएं।'
      : 'This verification code has expired. Please request a new one.';
  }
  if (/invalid.*token|token.*invalid|otp.*invalid|invalid.*code/i.test(detail)) {
    return isHi
      ? 'गलत 6-अंकीय कोड। कृपया सही कोड दर्ज करें।'
      : 'Invalid 6-digit code. Please check and try again.';
  }
  if (/password.*least 6|password.*least 8/i.test(detail)) {
    return isHi
      ? 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।'
      : 'Password must be at least 8 characters long.';
  }
  if (/network|failed to fetch/i.test(detail)) {
    return isHi
      ? 'इंटरनेट कनेक्शन में समस्या है। कृपया नेटवर्क जाँचें।'
      : 'Network connection issue. Please check your internet connection.';
  }

  return detail;
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  // 'signin' | 'signup' | 'otp' | 'recovery'
  const [mode, setMode] = useState(() => {
    const requested = searchParams.get('mode');
    const hasRef = Boolean(searchParams.get('ref'));
    if (requested === 'signup' || hasRef) return 'signup';
    return 'signin';
  });
  // 'form' | 'verify' | 'mfa'
  const [step, setStep] = useState('form');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deviceConflictModal, setDeviceConflictModal] = useState(false);
  const [takeoverBusy, setTakeoverBusy] = useState(false);
  const [takeoverError, setTakeoverError] = useState('');

  const [refCode, setRefCode] = useState(() => {
    try {
      const code = searchParams.get('ref') ||
        sessionStorage.getItem('zyvra_ref_code') ||
        localStorage.getItem('zyvra_ref_code') ||
        '';
      if (code) {
        sessionStorage.setItem('zyvra_ref_code', code);
        localStorage.setItem('zyvra_ref_code', code);
      }
      return code.trim().toUpperCase();
    } catch {
      return '';
    }
  });
  const [showReferralInput, setShowReferralInput] = useState(() => Boolean(refCode));

  const emailInputRef = useRef(null);
  const inputRefs = useRef([]);
  const { user, loading, supabase, enterGuestMode, guestDemoEnabled, configurationError } = useAuth();
  const { theme, setTheme, language } = useThemeLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname || '/';

  // Listen to ref param changes
  useEffect(() => {
    const urlRef = searchParams.get('ref');
    if (urlRef) {
      const cleaned = urlRef.trim().toUpperCase();
      setRefCode(cleaned);
      setShowReferralInput(true);
      setMode('signup');
      try {
        sessionStorage.setItem('zyvra_ref_code', cleaned);
        localStorage.setItem('zyvra_ref_code', cleaned);
      } catch {
        // ignore
      }
    }
  }, [searchParams]);

  // Redirect if already authenticated and MFA is complete (skips when user is actively in 'verify' or 'mfa' flow)
  useEffect(() => {
    let active = true;
    if (!loading && user && step !== 'mfa' && step !== 'verify') {
      if (supabase?.auth?.mfa) {
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: aal, error: aalErr }) => {
          if (!active) return;
          if (!aalErr && aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
            // User has 2FA enabled! Prompt for 2FA code
            supabase.auth.mfa.listFactors().then(({ data: factors }) => {
              if (!active) return;
              const totp = factors?.totp?.find((f) => f.status === 'verified')
                || factors?.all?.find((f) => f.status === 'verified')
                || factors?.totp?.[0];
              if (totp) {
                setMfaFactorId(totp.id);
                setStep('mfa');
                setOtp(Array(6).fill(''));
                return;
              }
              navigate(destination, { replace: true });
            }).catch(() => navigate(destination, { replace: true }));
          } else {
            navigate(destination, { replace: true });
          }
        }).catch(() => navigate(destination, { replace: true }));
      } else {
        navigate(destination, { replace: true });
      }
    }
    return () => { active = false; };
  }, [loading, user, destination, navigate, step, supabase]);

  // Cooldown countdown timer
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  // Focus on OTP input when verify or mfa step opens
  useEffect(() => {
    if (step === 'verify' || step === 'mfa') {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  // Smooth mode switcher
  const switchMode = (newMode) => {
    setMode(newMode);
    setStep('form');
    setPassword('');
    setPasswordConfirm('');
    setError('');
    setMessage('');
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 60);
  };

  const handleSendOtp = async (event, currentMode = mode) => {
    event?.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(language === 'hi' ? 'कृपया अपना ईमेल पता दर्ज करें।' : 'Enter your email address first.');
      emailInputRef.current?.focus();
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setError(language === 'hi' ? 'कृपया एक मान्य ईमेल पता दर्ज करें (उदा. student@gmail.com)।' : 'Please enter a valid email address (e.g. student@gmail.com).');
      emailInputRef.current?.focus();
      return;
    }
    if (currentMode === 'signup' && password && password.length < 8) {
      setError(language === 'hi' ? 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।' : 'Password must be at least 8 characters.');
      return;
    }
    if (currentMode === 'signup' && password && password !== passwordConfirm) {
      setError(language === 'hi' ? 'पासवर्ड मेल नहीं खा रहे हैं।' : 'Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = currentMode === 'recovery'
        ? await supabase.auth.resetPasswordForEmail(cleanEmail)
        : await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: true }
        });
      if (authError) throw authError;

      setStep('verify');
      setOtp(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
      setMessage(currentMode === 'recovery'
        ? (language === 'hi'
            ? `${cleanEmail} पर पासवर्ड रीसेट कोड भेजा गया है। इनबॉक्स/स्पैम चेक करें।`
            : `A password reset code was sent to ${cleanEmail}. Check your inbox/spam.`)
        : (language === 'hi'
            ? `${cleanEmail} पर 6-अंकों का वेरिफिकेशन कोड भेज दिया गया है।`
            : `A 6-digit verification code was sent to ${cleanEmail}.`));
    } catch (authError) {
      setError(formatAuthError(authError, language));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = useCallback(async (event) => {
    event?.preventDefault?.();
    setError('');
    if (!supabase) { setError(configurationError); return; }

    const token = otp.join('');
    if (!/^\d{6}$/.test(token)) {
      setError(language === 'hi' ? 'जारी रखने के लिए सभी 6 अंक दर्ज करें।' : 'Enter all six digits to continue.');
      return;
    }
    if (mode === 'recovery' && password.length < 8) {
      setError(language === 'hi' ? 'कम से कम 8 अक्षरों का पासवर्ड चुनें।' : 'Choose a password with at least 8 characters.');
      return;
    }
    if (mode === 'recovery' && password !== passwordConfirm) {
      setError(language === 'hi' ? 'पासवर्ड मेल नहीं खा रहे हैं।' : 'Passwords do not match.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      let authRes = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: mode === 'recovery' ? 'recovery' : 'email'
      });

      // Fallback: If verifying as 'email' fails on signup, retry as 'signup' type
      if (authRes.error && mode === 'signup') {
        const retry = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: 'signup'
        });
        if (!retry.error) authRes = retry;
      }

      if (authRes.error) throw authRes.error;
      const authData = authRes.data;

      if (authData?.user) {
        if (mode === 'recovery') {
          const { error: passwordError } = await supabase.auth.updateUser({ password });
          if (passwordError) throw passwordError;
          setMessage(language === 'hi' ? 'आपका पासवर्ड रीसेट हो गया है। आप लॉगिन हो चुके हैं।' : 'Your password has been reset. You are now signed in.');
          setTimeout(() => navigate(destination, { replace: true }), 1200);
          return;
        }
        if (mode === 'signup' && password) {
          const { error: passwordError } = await supabase.auth.updateUser({ password });
          if (passwordError) {
            console.warn('Password save warning on signup:', passwordError);
          }
        }
        if (mode === 'signup' || mode === 'otp') {
          await ensureReferralCode(supabase, authData.user.id);
        }
        if ((mode === 'signup' || mode === 'otp') && refCode) {
          const referralResult = await processReferralAward(supabase, authData.user.id, refCode);
          if (referralResult && !referralResult.retryable) {
            sessionStorage.removeItem('zyvra_ref_code');
            localStorage.removeItem('zyvra_ref_code');
          }
        }
        navigate(destination, { replace: true });
      }
    } catch (authError) {
      setError(formatAuthError(authError, language));
    } finally {
      setBusy(false);
    }
  }, [supabase, configurationError, otp, mode, password, passwordConfirm, email, language, refCode, destination, navigate]);

  // 2FA TOTP verification
  const handleVerifyMfa = useCallback(async (event) => {
    event?.preventDefault?.();
    setError('');
    if (!supabase) { setError(configurationError); return; }

    const token = otp.join('');
    if (!/^\d{6}$/.test(token)) {
      setError(language === 'hi' ? 'कृपया सभी 6 अंक दर्ज करें।' : 'Enter all six digits.');
      return;
    }
    if (!mfaFactorId) {
      setError(language === 'hi' ? '2FA सत्र अमान्य है। कृपया पुनः लॉगिन करें।' : 'Invalid 2FA session. Please sign in again.');
      return;
    }

    setBusy(true);
    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: token
      });
      if (verifyErr) throw verifyErr;

      navigate(destination, { replace: true });
    } catch (err) {
      console.warn('MFA challenge failed:', err);
      setError(language === 'hi'
        ? 'गलत 2FA कोड। कृपया Google Authenticator ऐप में दिख रहा ताज़ा कोड दर्ज करें।'
        : 'Invalid 2FA code. Please check your Google Authenticator app and try again.');
    } finally {
      setBusy(false);
    }
  }, [supabase, configurationError, otp, mfaFactorId, destination, navigate, language]);

  // Auto-verify when 6 digits are typed or pasted
  useEffect(() => {
    const token = otp.join('');
    if (token.length === 6 && /^\d{6}$/.test(token) && !busy) {
      if (step === 'verify') {
        if (mode === 'recovery' && (!password || password.length < 8 || password !== passwordConfirm)) {
          return;
        }
        handleVerifyOtp();
      } else if (step === 'mfa') {
        handleVerifyMfa();
      }
    }
  }, [otp, step, busy, mode, password, passwordConfirm, handleVerifyOtp, handleVerifyMfa]);

  const handlePasswordSignIn = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(language === 'hi' ? 'कृपया अपना ईमेल दर्ज करें।' : 'Please enter your email.');
      emailInputRef.current?.focus();
      return;
    }
    if (!password) {
      setError(language === 'hi' ? 'कृपया पासवर्ड दर्ज करें।' : 'Please enter your password.');
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });
      if (authError) throw authError;

      // Check if user has 2FA (MFA) enabled
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === 'verified')
          || factors?.all?.find((f) => f.status === 'verified')
          || factors?.totp?.[0];
        if (totp) {
          setMfaFactorId(totp.id);
          setStep('mfa');
          setOtp(Array(6).fill(''));
          setMessage(language === 'hi'
            ? 'Google Authenticator ऐप में दिख रहा 6-अंकों का कोड दर्ज करें।'
            : 'Enter the 6-digit code from your Google Authenticator app.');
          return;
        }
      }
    } catch (authError) {
      console.log('[AuthPage Catch]', authError?.message, authError);
      const detail = authError?.message || (typeof authError === 'object' ? JSON.stringify(authError) : String(authError));
      if (/two devices|already signed in|already active/i.test(detail)) {
        console.log('[AuthPage] Setting deviceConflictModal to true!');
        setDeviceConflictModal(true);
        setError('');
        return;
      }
      setError(formatAuthError(authError, language));
    } finally {
      setBusy(false);
    }
  };

  const handleForceTakeoverLogin = async (mode = 'oldest') => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password || !supabase) return;

    setTakeoverBusy(true);
    setTakeoverError('');

    try {
      // 1. Evict oldest session via RPC so a slot is freed
      const { data: rpcData, error: rpcError } = await supabase.rpc('evict_oldest_device_session', {
        p_email: cleanEmail,
        p_password: password
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Unable to sign out prior device.');
      }
      if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || 'Unable to sign out prior device.');
      }

      // 2. Sign in on this device now that slot is open
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (signInError) throw signInError;

      // If user chose Manage Devices, also sign out all other active sessions cleanly and open Profile Device Security
      if (mode === 'manage') {
        try {
          await supabase.auth.signOut({ scope: 'others' });
        } catch {}
        setDeviceConflictModal(false);
        navigate('/profile', { replace: true });
        return;
      }

      // Close modal on success & proceed to app
      setDeviceConflictModal(false);
      navigate(destination, { replace: true });
    } catch (err) {
      setTakeoverError(formatAuthError(err, language));
    } finally {
      setTakeoverBusy(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    if (!supabase) { setError(configurationError); return; }
    setBusy(true);
    try {
      const redirectPath = destination && destination !== '/auth' ? destination : '/';
      const redirectUrl = `${window.location.origin}${redirectPath}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(formatAuthError(authError, language));
      setBusy(false);
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    pasted.split('').forEach((digit, i) => { next[i] = digit; });
    setOtp(next);
    const targetIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetIndex]?.focus();
  };

  const updateOtpDigit = (index, value) => {
    if (!/^\d{0,6}$/.test(value)) return;
    const next = [...otp];
    if (value.length > 1) {
      value.slice(0, 6 - index).split('').forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      setOtp(next);
      inputRefs.current[Math.min(index + value.length, 5)]?.focus();
      return;
    }
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKey = (index, event) => {
    if (event.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const next = [...otp];
        next[index - 1] = '';
        setOtp(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const guestEntry = () => {
    try {
      enterGuestMode();
      navigate(destination, { replace: true });
    } catch (guestError) {
      setError(guestError.message);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-topbar">
        <a href="/" className="sidebar-brand auth-brand">
          <img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" />
          <div>ZYVRA<span>LEARN WITH INTENT</span></div>
        </a>
        <div className="auth-topbar-actions">
          <LanguageToggle compact={true} />
          <button className="auth-theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? '☼ Light' : '◐ Dark'}
          </button>
        </div>
      </div>

      <div className="auth-layout">
        <section className="auth-story">
          <div className="eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>Make every<br /><em>study hour</em> count.</h1>
          <p>A calmer, more focused way to prepare for BPSC, SSC, CTET and beyond.</p>
          <div className="auth-points">
            <span><CheckCircle2 size={16} /> One place for your learning journey</span>
            <span><CheckCircle2 size={16} /> Progress that feels rewarding</span>
            <span><CheckCircle2 size={16} /> Built for focused exam prep</span>
          </div>
          <div className="auth-quote">
            <div className="quote-stars">✦ ✦ ✦ ✦ ✦</div>
            <p>“A little progress each day adds up to big results.”</p>
            <span>YOUR ZYVRA STUDY SPACE</span>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-heading">
            <div className="auth-icon">
              {step === 'mfa' ? (
                <ShieldCheck size={20} className="text-emerald-400" />
              ) : mode === 'signup' ? (
                <UserPlus size={20} />
              ) : (
                <ShieldCheck size={20} />
              )}
            </div>
            <div>
              <h2>
                {step === 'mfa'
                  ? (language === 'hi' ? 'टू-फैक्टर ऑथेंटिकेशन (2FA)' : 'Two-Factor Authentication')
                  : step === 'verify'
                  ? (mode === 'recovery'
                      ? (language === 'hi' ? 'पासवर्ड रीसेट करें' : 'Reset your password')
                      : (language === 'hi' ? 'ईमेल कोड सत्यापित करें' : 'Verify your email'))
                  : mode === 'signup'
                  ? (language === 'hi' ? 'नया खाता बनाएं' : 'Create Free Account')
                  : mode === 'recovery'
                  ? (language === 'hi' ? 'पासवर्ड रीसेट' : 'Password Recovery')
                  : mode === 'otp'
                  ? (language === 'hi' ? 'OTP से लॉगिन' : 'Sign in with OTP')
                  : (language === 'hi' ? 'साइन इन करें' : 'Sign In')}
              </h2>
              <p>
                {step === 'mfa'
                  ? (language === 'hi' ? 'Google Authenticator ऐप में दिख रहा 6-अंकों का कोड दर्ज करें।' : 'Enter the 6-digit code from your Google Authenticator app.')
                  : step === 'verify'
                  ? (mode === 'recovery'
                      ? (language === 'hi' ? 'ईमेल से 6-अंकों का कोड दर्ज करें और नया पासवर्ड चुनें।' : 'Enter the code from your email and set a new password.')
                      : (language === 'hi' ? `${email.trim().toLowerCase()} पर भेजा गया 6-अंकों का कोड दर्ज करें।` : `Enter the six-digit code sent to ${email.trim().toLowerCase()}.`))
                  : mode === 'signup'
                  ? (language === 'hi' ? 'तैयारी शुरू करने के लिए 1 मिनट में मुफ़्त खाता बनाएं।' : 'Join thousands of aspirants preparing on Zyvra.')
                  : mode === 'recovery'
                  ? (language === 'hi' ? 'अपना ईमेल दर्ज करें, हम पासवर्ड रीसेट कोड भेजेंगे।' : 'Enter your email to receive a password reset code.')
                  : mode === 'otp'
                  ? (language === 'hi' ? 'बिना पासवर्ड के अपने ईमेल पर 6-अंकों का OTP पाएँ।' : 'Get a 6-digit code sent to your email to sign in directly.')
                  : (language === 'hi' ? 'अपनी पढ़ाई जारी रखने के लिए लॉगिन करें।' : 'Sign in to continue your learning journey.')}
              </p>
            </div>
          </div>

          {/* Active Referral code banner on signup */}
          {refCode && mode === 'signup' && step === 'form' && (
            <div className="referral-auth-banner">
              <Gift size={16} className="text-amber-400" />
              <div>
                <strong>{language === 'hi' ? 'रेफरल कोड सक्रिय:' : 'Invite code active:'} <span>{refCode}</span></strong>
                <small>{language === 'hi' ? 'ज्वाइन करने पर वॉलेट में बोनस कॉइन्स जुड़ेंगे!' : 'Bonus coins will be credited to your wallet upon joining!'}</small>
              </div>
            </div>
          )}

          {/* STEP: MFA / 2FA CHALLENGE */}
          {step === 'mfa' ? (
            <>
              <button
                className="back-link"
                type="button"
                onClick={async () => {
                  await supabase?.auth?.signOut?.().catch(() => {});
                  setStep('form');
                  setError('');
                  setMessage('');
                }}
              >
                <ArrowLeft size={14} /> {language === 'hi' ? 'लॉगिन रद्द करें' : 'Cancel & sign out'}
              </button>

              <form onSubmit={handleVerifyMfa}>
                <div
                  className="otp-inputs"
                  aria-label="Six-digit 2FA code"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { inputRefs.current[index] = element; }}
                      aria-label={`2FA Digit ${index + 1}`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(event) => updateOtpDigit(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKey(index, event)}
                    />
                  ))}
                </div>

                <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      {language === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying…'}
                    </span>
                  ) : (
                    language === 'hi' ? <>2FA कोड सत्यापित करें <ArrowRight size={16} /></> : <>Verify 2FA Code <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </>
          ) : step === 'verify' ? (
            <>
              <button
                className="back-link"
                type="button"
                onClick={() => { setStep('form'); setError(''); setMessage(''); }}
              >
                <ArrowLeft size={14} /> {language === 'hi' ? 'ईमेल बदलें / वापस जाएं' : 'Change email / Go back'}
              </button>

              <form onSubmit={handleVerifyOtp}>
                <div
                  className="otp-inputs"
                  aria-label="Six-digit verification code"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { inputRefs.current[index] = element; }}
                      aria-label={`Digit ${index + 1}`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(event) => updateOtpDigit(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKey(index, event)}
                    />
                  ))}
                </div>

                {mode === 'recovery' && (
                  <>
                    <label className="field-label">
                      {language === 'hi' ? 'नया पासवर्ड' : 'New password'}
                      <div className="input-with-icon">
                        <KeyRound size={17} />
                        <input
                          className="text-input"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder={language === 'hi' ? 'कम से कम 8 अक्षर' : 'At least 8 characters'}
                        />
                      </div>
                    </label>

                    <label className="field-label">
                      {language === 'hi' ? 'पासवर्ड की पुष्टि करें' : 'Confirm new password'}
                      <div className="input-with-icon">
                        <KeyRound size={17} />
                        <input
                          className="text-input"
                          type="password"
                          value={passwordConfirm}
                          onChange={(event) => setPasswordConfirm(event.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder={language === 'hi' ? 'पासवर्ड दोबारा लिखें' : 'Enter it again'}
                        />
                      </div>
                    </label>
                  </>
                )}

                <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      {mode === 'recovery'
                        ? (language === 'hi' ? 'पासवर्ड रीसेट हो रहा है…' : 'Resetting password…')
                        : (language === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying…')}
                    </span>
                  ) : mode === 'recovery' ? (
                    language === 'hi' ? <>पासवर्ड बदलें और लॉगिन करें <ArrowRight size={16} /></> : <>Reset password & sign in <ArrowRight size={16} /></>
                  ) : (
                    language === 'hi' ? <>सत्यापित करें और आगे बढ़ें <ArrowRight size={16} /></> : <>Verify & Continue <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <div className="resend-row">
                {cooldown ? (
                  <span>{language === 'hi' ? 'दोबारा कोड भेजें ' : 'Resend code in '}<strong>00:{String(cooldown).padStart(2, '0')}</strong></span>
                ) : (
                  <button className="text-button" type="button" disabled={busy} onClick={handleSendOtp}>
                    {language === 'hi' ? 'कोड दोबारा भेजें' : 'Resend code'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* TOP SEGMENTED CONTROL: SIGN IN vs CREATE ACCOUNT */}
              {(mode === 'signin' || mode === 'signup') && (
                <div className="auth-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signin'}
                    className={mode === 'signin' ? 'selected' : ''}
                    onClick={() => switchMode('signin')}
                  >
                    <LogIn size={14} />
                    {language === 'hi' ? 'साइन इन (Sign In)' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signup'}
                    className={mode === 'signup' ? 'selected' : ''}
                    onClick={() => switchMode('signup')}
                  >
                    <UserPlus size={14} />
                    {language === 'hi' ? 'नया खाता (Sign Up)' : 'Create Account'}
                  </button>
                </div>
              )}

              {/* 1. SIGN IN FORM (DEFAULT VIEW) */}
              {mode === 'signin' && (
                <form onSubmit={handlePasswordSignIn}>
                  <label className="field-label">
                    {language === 'hi' ? 'ईमेल पता' : 'Email address'}
                    <div className="input-with-icon">
                      <Mail size={17} />
                      <input
                        ref={emailInputRef}
                        className="text-input"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </label>

                  <label className="field-label">
                    <div className="flex justify-between items-center">
                      <span>{language === 'hi' ? 'पासवर्ड' : 'Password'}</span>
                      <button
                        type="button"
                        className="text-xs text-muted hover:underline"
                        onClick={() => switchMode('recovery')}
                      >
                        {language === 'hi' ? 'पासवर्ड भूल गए?' : 'Forgot password?'}
                      </button>
                    </div>
                    <div className="input-with-icon">
                      <KeyRound size={17} />
                      <input
                        className="text-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        placeholder={language === 'hi' ? 'अपना पासवर्ड दर्ज करें' : 'Your password'}
                        autoComplete="current-password"
                      />
                      <button
                        className="password-eye"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Show or hide password"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>

                  <button type="submit" className="button button-primary button-full mt-2 min-h-[44px]" disabled={busy}>
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {language === 'hi' ? 'लॉगिन हो रहा है…' : 'Signing in…'}
                      </span>
                    ) : (
                      language === 'hi' ? <>साइन इन करें <LogIn size={16} /></> : <>Sign in <LogIn size={16} /></>
                    )}
                  </button>

                  <div className="mt-2.5">
                    <button
                      type="button"
                      className="button button-outline button-full min-h-[44px] text-xs font-bold"
                      onClick={() => switchMode('otp')}
                    >
                      {language === 'hi' ? 'ईमेल OTP से लॉगिन करें' : 'Sign in with 1-time email OTP'}
                    </button>
                  </div>
                </form>
              )}

              {/* 2. CREATE ACCOUNT / SIGN UP FORM */}
              {mode === 'signup' && (
                <form onSubmit={handleSendOtp}>
                  <label className="field-label">
                    {language === 'hi' ? 'ईमेल पता' : 'Email address'}
                    <div className="input-with-icon">
                      <Mail size={17} />
                      <input
                        ref={emailInputRef}
                        className="text-input"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </label>

                  <label className="field-label">
                    <div className="flex justify-between items-center">
                      <span>{language === 'hi' ? 'पासवर्ड बनाएं' : 'Create a password'}</span>
                      <span className="optional-label">
                        {password.length >= 8
                          ? (language === 'hi' ? '✓ 8+ अक्षर' : '✓ 8+ chars')
                          : (language === 'hi' ? 'कम से कम 8 अक्षर' : 'Min 8 chars')}
                      </span>
                    </div>
                    <div className="input-with-icon">
                      <KeyRound size={17} />
                      <input
                        className="text-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={8}
                        placeholder={language === 'hi' ? 'कम से कम 8 अक्षर (वैकल्पिक)' : 'At least 8 characters (optional)'}
                        autoComplete="new-password"
                      />
                      <button
                        className="password-eye"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Show or hide password"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>

                  {password && (
                    <label className="field-label">
                      <div className="flex justify-between items-center">
                        <span>{language === 'hi' ? 'पासवर्ड की पुष्टि करें' : 'Confirm password'}</span>
                        {passwordConfirm && (
                          <span style={{ fontSize: '10px', color: password === passwordConfirm ? 'var(--accent)' : '#fca5a5' }}>
                            {password === passwordConfirm
                              ? (language === 'hi' ? '✓ मेल खा गया' : '✓ Match')
                              : (language === 'hi' ? 'मेल नहीं खा रहा' : 'Mismatch')}
                          </span>
                        )}
                      </div>
                      <div className="input-with-icon">
                        <KeyRound size={17} />
                        <input
                          className="text-input"
                          type="password"
                          value={passwordConfirm}
                          onChange={(event) => setPasswordConfirm(event.target.value)}
                          minLength={8}
                          placeholder={language === 'hi' ? 'पासवर्ड दोबारा लिखें' : 'Enter it again'}
                          autoComplete="new-password"
                        />
                      </div>
                    </label>
                  )}

                  {refCode ? (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-base shrink-0">
                          🎁
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate">
                            {language === 'hi' ? `रेफरल कोड लागू: ${refCode}` : `Referral Code: ${refCode}`}
                          </div>
                          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium truncate">
                            {language === 'hi' ? '✓ साइन-अप पर आपको फ्री बोनस सिक्के मिलेंगे!' : '✓ Free bonus coins will be credited on sign-up!'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-rose-500 font-bold px-2 py-1 shrink-0"
                        title={language === 'hi' ? 'हटाएं' : 'Remove'}
                        onClick={() => {
                          setRefCode('');
                          setShowReferralInput(false);
                          try {
                            sessionStorage.removeItem('zyvra_ref_code');
                            localStorage.removeItem('zyvra_ref_code');
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : showReferralInput ? (
                    <label className="field-label">
                      <div className="flex justify-between items-center">
                        <span>{language === 'hi' ? 'रेफरल कोड (वैकल्पिक)' : 'Referral code (Optional)'}</span>
                        <button
                          type="button"
                          className="text-xs text-muted hover:underline"
                          onClick={() => { setShowReferralInput(false); setRefCode(''); }}
                        >
                          {language === 'hi' ? 'हटाएं' : 'Cancel'}
                        </button>
                      </div>
                      <div className="input-with-icon">
                        <Gift size={17} />
                        <input
                          className="text-input uppercase font-mono tracking-wider"
                          value={refCode}
                          onChange={(event) => setRefCode(event.target.value.trim().toUpperCase())}
                          placeholder="e.g. ZYVABC"
                          autoComplete="off"
                        />
                      </div>
                    </label>
                  ) : (
                    <button
                      type="button"
                      className="referral-toggle-btn"
                      onClick={() => setShowReferralInput(true)}
                    >
                      <Gift size={13} /> {language === 'hi' ? '+ रेफरल कोड है?' : '+ Have a referral code?'}
                    </button>
                  )}

                  <p className="field-hint">
                    {language === 'hi'
                      ? 'हम आपके ईमेल पर 6-अंकों का वेरिफिकेशन कोड भेजेंगे। कोड डालते ही खाता सक्रिय हो जाएगा।'
                      : 'We’ll email you a 6-digit verification code to activate your account.'}
                  </p>

                  <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {language === 'hi' ? 'कृपया प्रतीक्षा करें…' : 'Please wait…'}
                      </span>
                    ) : (
                      language === 'hi' ? <>खाता बनाएं और कोड पाएँ <ArrowRight size={16} /></> : <>Create Account & Get Code <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>
              )}

              {/* 3. PASSWORD RECOVERY FORM */}
              {mode === 'recovery' && (
                <form onSubmit={handleSendOtp}>
                  <label className="field-label">
                    {language === 'hi' ? 'पंजीकृत ईमेल' : 'Registered email'}
                    <div className="input-with-icon">
                      <Mail size={17} />
                      <input
                        ref={emailInputRef}
                        className="text-input"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </label>
                  <p className="field-hint">
                    {language === 'hi'
                      ? 'हम आपके ईमेल पर पासवर्ड रीसेट कोड भेजेंगे जिससे आप नया पासवर्ड बना सकेंगे।'
                      : 'We’ll email a password reset code to help you set a new password.'}
                  </p>
                  <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {language === 'hi' ? 'भेजा जा रहा है…' : 'Sending…'}
                      </span>
                    ) : (
                      language === 'hi' ? <>रीसेट कोड भेजें <ArrowRight size={16} /></> : <>Send reset code <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>
              )}

              {/* 4. PASSWORDLESS OTP LOGIN FORM */}
              {mode === 'otp' && (
                <form onSubmit={handleSendOtp}>
                  <label className="field-label">
                    {language === 'hi' ? 'ईमेल पता' : 'Email address'}
                    <div className="input-with-icon">
                      <Mail size={17} />
                      <input
                        ref={emailInputRef}
                        className="text-input"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </label>
                  <p className="field-hint">
                    {language === 'hi'
                      ? 'हम आपके ईमेल पर 6-अंकों का लॉगिन कोड भेजेंगे (पासवर्ड की आवश्यकता नहीं है)।'
                      : 'We’ll email you a 6-digit login code. No password needed.'}
                  </p>
                  <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {language === 'hi' ? 'भेजा जा रहा है…' : 'Sending…'}
                      </span>
                    ) : (
                      language === 'hi' ? <>6-अंकों का OTP कोड भेजें <ArrowRight size={16} /></> : <>Send 6-Digit OTP <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {message && <div className="feedback success-feedback"><CheckCircle2 size={16} />{message}</div>}
          {error && <div className="feedback error-feedback">{error}</div>}

          {step === 'form' && (
            <>
              <div className="auth-divider">
                <span>{language === 'hi' ? 'या इनसे जारी रखें' : 'OR CONTINUE WITH'}</span>
              </div>

              <button className="button google-button button-full" onClick={handleGoogleAuth} disabled={busy}>
                <span className="google-g">G</span> {language === 'hi' ? 'Google से जारी रखें' : 'Continue with Google'}
              </button>

              {/* HIGH CONTRAST FOOTER SWITCH BOX (Testbook / PW Style) */}
              <div className="auth-switch-box">
                {mode === 'signin' ? (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {language === 'hi' ? 'नए छात्र हैं? ' : 'New to Zyvra? '}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 700 }}
                      onClick={() => switchMode('signup')}
                    >
                      {language === 'hi' ? 'नया खाता बनाएं (Sign up) →' : 'Create an account (Sign up) →'}
                    </button>
                  </div>
                ) : mode === 'signup' ? (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {language === 'hi' ? 'पहले से खाता है? ' : 'Already have an account? '}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 700 }}
                      onClick={() => switchMode('signin')}
                    >
                      {language === 'hi' ? 'साइन इन करें (Sign in) →' : 'Sign in to existing account →'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 700 }}
                    onClick={() => switchMode('signin')}
                  >
                    {language === 'hi' ? '← मुख्य साइन इन पेज पर वापस जाएं' : '← Back to main sign in'}
                  </button>
                )}
              </div>
            </>
          )}

          {guestDemoEnabled && step === 'form' && (
            <button className="guest-button mt-3" onClick={guestEntry}>
              {language === 'hi' ? 'अतिथि (Guest) के रूप में देखें' : 'Continue as guest'} <ArrowRight size={15} />
            </button>
          )}

          <p className="auth-legal mt-3">
            {language === 'hi' ? 'जारी रखकर, आप Zyvra की ' : 'By continuing, you agree to Zyvra’s '}
            <Link to="/terms" className="underline hover:text-white">
              {language === 'hi' ? 'सेवा की शर्तें' : 'Terms of Service'}
            </Link>
            {language === 'hi' ? ' और ' : ' and '}
            <Link to="/privacy" className="underline hover:text-white">
              {language === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy'}
            </Link>
            {language === 'hi' ? ' स्वीकार करते हैं।' : '.'}
          </p>
          <div className="secure-note">
            <ShieldCheck size={14} /> {language === 'hi' ? 'आपका खाता और प्रगति हमेशा सुरक्षित रहेगी।' : 'Your account and progress stay yours.'}
          </div>
        </section>
      </div>

      <footer className="auth-footer">
        © 2026 ZYVRA <span>·</span> Learn with intent.
      </footer>

      {/* Device Conflict / 2-Device Limit Warning Modal */}
      {deviceConflictModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl border border-amber-500/30">
              📱
            </div>
            <div className="space-y-1">
              <div role="heading" aria-level="3" className="text-white font-black text-base" style={{ color: '#ffffff' }}>
                {language === 'hi' ? '2-डिवाइस सीमा पूर्ण हुई' : '2-Device Limit Reached'}
              </div>
              <p className="text-slate-300 text-xs leading-relaxed" style={{ color: '#cbd5e1' }}>
                {language === 'hi'
                  ? 'आपका Zyvra खाता पहले से 2 डिवाइस पर सक्रिय है। आप अपने डिवाइस मैनेज कर सकते हैं (सभी अन्य डिवाइस से लॉगआउट) या केवल सबसे पुराने डिवाइस को बदल सकते हैं।'
                  : 'Your Zyvra account is already active on 2 devices. Choose whether to manage devices (sign out all other devices) or replace only your oldest session.'}
              </p>
            </div>

            {takeoverError && (
              <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-bold text-left">
                {takeoverError}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleForceTakeoverLogin('manage')}
                disabled={takeoverBusy}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                {takeoverBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span>{language === 'hi' ? 'प्रोसेस हो रहा है...' : 'Updating devices...'}</span>
                  </span>
                ) : (
                  <span>
                    {language === 'hi'
                      ? 'डिवाइस मैनेज करें (सभी अन्य से लॉगआउट)'
                      : 'Manage Devices (Sign Out All Other Devices)'}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleForceTakeoverLogin('oldest')}
                disabled={takeoverBusy}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                <span>
                  {language === 'hi'
                    ? 'केवल सबसे पुराना डिवाइस बदलें'
                    : 'Replace Oldest Device Only'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeviceConflictModal(false);
                  setTakeoverError('');
                }}
                disabled={takeoverBusy}
                className="w-full py-2.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all min-h-[44px] cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

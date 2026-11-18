import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Gift, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import LanguageToggle from '../../components/common/LanguageToggle';
import { ensureReferralCode, processReferralAward } from '../../lib/referrals';

const RESEND_SECONDS = 45;

function authErrorMessage(authError, fallback) {
  const detail = authError?.message || '';
  if (/two devices/i.test(detail)) {
    return 'This account is already signed in on two devices. Sign out from another device, then try again.';
  }
  return detail || fallback;
}

export default function AuthPage() {
  const [method, setMethod] = useState('phone');
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const recaptchaVerifierRef = useRef(null);
  const [refCode, setRefCode] = useState(() => {
    try {
      const code = searchParams.get('ref') || sessionStorage.getItem('zyvra_ref_code') || '';
      if (code) sessionStorage.setItem('zyvra_ref_code', code);
      return code;
    } catch {
      return '';
    }
  });
  const [showReferralInput, setShowReferralInput] = useState(() => Boolean(refCode));

  useEffect(() => {
    const urlRef = searchParams.get('ref');
    if (urlRef) {
      setRefCode(urlRef);
      setShowReferralInput(true);
      try {
        sessionStorage.setItem('zyvra_ref_code', urlRef);
      } catch {
        // ignore
      }
    }
  }, [searchParams]);
  const inputRefs = useRef([]);
  const { user, loading, supabase, enterGuestMode, guestDemoEnabled, configurationError } = useAuth();
  const { theme, setTheme, language } = useThemeLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (!loading && user) {
      navigate(destination, { replace: true });
    }
  }, [loading, user, destination, navigate]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendPhoneOtp = async (event) => {
    event?.preventDefault();
    setError('');
    setMessage('');
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setError(language === 'hi'
        ? 'कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर दर्ज करें।'
        : 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaVerifierRef.current = null;
      }
      recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible'
      });
      const fullPhone = `+91${clean}`;
      const confirmation = await signInWithPhoneNumber(firebaseAuth, fullPhone, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setStep('verify-phone');
      setOtp(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
      setMessage(language === 'hi'
        ? `+91 ${clean} पर 6-अंकों का SMS वेरिफिकेशन कोड भेज दिया गया है।`
        : `A 6-digit SMS verification code was sent to +91 ${clean}.`);
    } catch (err) {
      console.error('Phone auth error:', err);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
      const msg = err.message || '';
      const code = err.code || '';
      console.warn('Firebase error code:', code, 'message:', msg);
      setError(/invalid-phone/i.test(msg) || /invalid-phone/i.test(code)
        ? (language === 'hi' ? 'अमान्य मोबाइल नंबर। कृपया 10 अंकों का नंबर जांचें।' : 'Invalid mobile number. Check your 10-digit number.')
        : /too-many-requests/i.test(msg) || /too-many-requests/i.test(code)
        ? (language === 'hi' ? 'बहुत सारे SMS अनुरोध हो गए हैं। कृपया कुछ मिनट रुकें या Google Login का उपयोग करें।' : 'Too many SMS requests. Please wait a few minutes or use Google Login.')
        : /unauthorized-domain/i.test(msg) || /unauthorized-domain/i.test(code)
        ? (language === 'hi' ? 'डोमेन ऑथराइजेशन अपडेट हो रहा है। कृपया पेज रीफ्रेश करके पुनः प्रयास करें।' : 'Domain authorization updating. Please refresh and try again.')
        : /quota-exceeded/i.test(msg) || /quota-exceeded/i.test(code)
        ? (language === 'hi' ? 'आज का SMS कोटा पूरा हो गया है। कृपया Google से लॉगिन करें।' : 'SMS quota exceeded for today. Please sign in with Google.')
        : /operation-not-allowed/i.test(msg) || /operation-not-allowed/i.test(code)
        ? (language === 'hi' ? 'Phone Auth सक्रिय किया जा रहा है। कृपया 1 मिनट बाद पुनः प्रयास करें।' : 'Phone sign-in is currently being enabled. Please retry in 1 minute.')
        : /captcha/i.test(msg) || /captcha/i.test(code)
        ? (language === 'hi' ? 'reCAPTCHA वेरिफिकेशन पूरा नहीं हुआ। कृपया पेज रीफ्रेश करें।' : 'reCAPTCHA verification incomplete. Please refresh and retry.')
        : (language === 'hi' ? `SMS कोड नहीं भेजा जा सका (${code || 'error'})। कृपया दोबारा प्रयास करें।` : `Could not send SMS code (${code || 'error'}). Check your mobile number and try again.`));
    } finally {
      setBusy(false);
    }
  };

  const verifyPhoneOtp = async (event) => {
    event.preventDefault();
    setError('');
    const token = otp.join('');
    if (!/^\d{6}$/.test(token)) {
      setError('Enter all six digits sent to your phone.');
      return;
    }
    if (!confirmationResult) {
      setError('Verification session expired. Please request a new code.');
      return;
    }
    setBusy(true);
    try {
      const userCredential = await confirmationResult.confirm(token);
      const fbUser = userCredential.user;
      const idToken = await fbUser.getIdToken();

      const clean = phone.replace(/\D/g, '').slice(-10);
      const res = await fetch('/api/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          mobile: clean,
          refCode
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.session) {
        throw new Error(data?.error || 'Unable to establish student account.');
      }

      const { error: sessionErr } = await supabase.auth.setSession(data.session);
      if (sessionErr) throw sessionErr;

      if (data.isNewUser) {
        await ensureReferralCode(supabase, data.session.user.id);
        if (refCode) {
          const referralResult = await processReferralAward(supabase, data.session.user.id, refCode);
          if (referralResult && !referralResult.retryable) sessionStorage.removeItem('zyvra_ref_code');
        }
      }

      setMessage(language === 'hi' ? 'फोन सत्यापित हो गया! लॉगिन हो रहा है…' : 'Phone verified! Signing in…');
      navigate(destination, { replace: true });
    } catch (err) {
      console.error('Phone verification error:', err);
      const isIncorrect = /invalid-verification-code|invalid-code/i.test(err.message || '') || /invalid-verification-code/i.test(err.code || '');
      setError(isIncorrect
        ? (language === 'hi' ? 'गलत OTP कोड। कृपया SMS से प्राप्त 6 अंकों का कोड दर्ज करें।' : 'Incorrect OTP code. Please enter the 6 digits from the SMS.')
        : (language === 'hi' ? 'सत्यापन विफल रहा। कृपया दोबारा प्रयास करें।' : (err.message || 'Phone verification failed. Please try again.')));
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (event, authMode = method) => {
    event?.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    if (authMode === 'otp' && password && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (authMode === 'otp' && password && password !== passwordConfirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error: authError } = authMode === 'recovery'
        ? await supabase.auth.resetPasswordForEmail(email.trim())
        : await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true }
        });
      if (authError) throw authError;
      setStep('verify');
      setOtp(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
      setMessage(authMode === 'recovery'
        ? `A password reset code was requested for ${email.trim()}. Check your inbox and spam folder.`
        : `A six-digit verification code was sent to ${email.trim()}.`);
    } catch (authError) {
      setError(authError.message || 'We could not send the code. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    if (!supabase) { setError(configurationError); return; }
    const token = otp.join('');
    if (!/^\d{6}$/.test(token)) { setError('Enter all six digits to continue.'); return; }
    if (method === 'recovery' && password.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
    if (method === 'recovery' && password !== passwordConfirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: method === 'recovery' ? 'recovery' : 'email'
      });
      if (authError) throw authError;
      if (authData?.user) {
        if (method === 'recovery') {
          const { error: passwordError } = await supabase.auth.updateUser({ password });
          if (passwordError) throw passwordError;
          setMessage('Your password has been reset. You are now signed in.');
          return;
        }
        if (method === 'otp' && password) {
          const { error: passwordError } = await supabase.auth.updateUser({ password });
          if (passwordError) throw new Error(`Your email is verified, but the password could not be saved. Sign in with OTP and set it from Profile. ${passwordError.message}`);
        }
        if (method === 'otp') {
          await ensureReferralCode(supabase, authData.user.id);
        }
        if (method === 'otp' && refCode) {
          const referralResult = await processReferralAward(supabase, authData.user.id, refCode);
          if (referralResult && !referralResult.retryable) sessionStorage.removeItem('zyvra_ref_code');
        }
      }
    } catch (authError) {
      const detail = authError.message || '';
      if (/two devices/i.test(detail)) {
        setError('This account is already signed in on two devices. Sign out from another device, then try again.');
        return;
      }
      setError(/expired/i.test(detail) ? 'This code has expired. Request a new code and try again.' : /invalid|token/i.test(detail) ? 'That code is not valid. Check the digits or request a new code.' : detail || 'Verification failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const updateOtpDigit = (index, value) => {
    if (!/^\d{0,6}$/.test(value)) return;
    const next = [...otp];
    if (value.length > 1) {
      value.slice(0, 6 - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
      setOtp(next);
      inputRefs.current[Math.min(index + value.length, 5)]?.focus();
      return;
    }
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKey = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const passwordAuth = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      // Referral codes apply only during account creation, never during sign-in.
    } catch (authError) {
      setError(authErrorMessage(authError, 'Authentication failed. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const googleAuth = async () => {
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
      setError(authErrorMessage(authError, 'Google sign-in failed. Check your connection and try again.'));
      setBusy(false);
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

  return <main className="auth-page">
    <div className="auth-topbar">
      <a href="/" className="sidebar-brand auth-brand">
        <img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" />
        <div>ZYVRA<span>LEARN WITH INTENT</span></div>
      </a>
      <div className="auth-topbar-actions">
        <LanguageToggle compact={true} />
        <button className="auth-theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
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
          <div className="auth-icon"><ShieldCheck size={20} /></div>
          <div>
            <h2>
              {step === 'verify-phone'
                ? (language === 'hi' ? 'फोन पर OTP भेजा गया' : 'Verify Mobile OTP')
                : step === 'verify'
                ? (method === 'recovery' ? (language === 'hi' ? 'पासवर्ड रीसेट करें' : 'Reset your password') : (language === 'hi' ? 'ईमेल कोड सत्यापित करें' : 'Verify your email'))
                : method === 'phone'
                ? (language === 'hi' ? 'लॉगिन या साइन-अप' : 'Login or Sign Up')
                : method === 'password'
                ? (language === 'hi' ? 'स्वागत है' : 'Welcome back')
                : method === 'recovery'
                ? (language === 'hi' ? 'पासवर्ड रीसेट' : 'Password Recovery')
                : (language === 'hi' ? 'ईमेल से साइन-इन' : 'Email Sign-In')}
            </h2>
            <p>
              {step === 'verify-phone'
                ? (language === 'hi' ? `+91 ${phone.slice(-10)} पर भेजा गया 6-अंकों का SMS कोड दर्ज करें।` : `Enter the 6-digit SMS code sent to +91 ${phone.slice(-10)}.`)
                : step === 'verify'
                ? (method === 'recovery'
                    ? (language === 'hi' ? 'ईमेल से रीसेट कोड दर्ज करें और नया पासवर्ड चुनें।' : 'Enter the reset code from your email and choose a new password.')
                    : (language === 'hi' ? 'अपना ईमेल सत्यापित करने के लिए 6-अंकों का कोड दर्ज करें।' : 'Enter the six-digit code to verify your email.'))
                : method === 'phone'
                ? (language === 'hi' ? 'मोबाइल नंबर से तुरंत OTP पाएँ (कोई पासवर्ड नहीं)' : 'Enter your mobile number to get a free 6-digit SMS OTP.')
                : method === 'password'
                ? (language === 'hi' ? 'अपनी पढ़ाई जारी रखने के लिए लॉगिन करें।' : 'Sign in to continue your learning.')
                : method === 'recovery'
                ? (language === 'hi' ? 'ईमेल कोड से अपना पासवर्ड रीसेट करें।' : 'Reset your password securely with an email code.')
                : (language === 'hi' ? 'मुफ्त शुरुआत के लिए ईमेल सत्यापित करें।' : 'Verify your email to get started. No payment needed.')}
            </p>
          </div>
        </div>

        {refCode && (method === 'phone' || method === 'otp') && (
          <div className="referral-auth-banner">
            <Gift size={16} className="text-amber-400" />
            <div>
              <strong>{language === 'hi' ? 'रेफरल कोड सक्रिय:' : 'Invite code active:'} <span>{refCode}</span></strong>
              <small>{language === 'hi' ? 'ज्वाइन करने पर वॉलेट में बोनस कॉइन्स जुड़ेंगे!' : 'Bonus coins will be credited to your wallet upon joining!'}</small>
            </div>
          </div>
        )}

        {step === 'verify-phone' ? (
          <>
            <button className="back-link" onClick={() => { setStep('phone'); setError(''); setMessage(''); }}>
              <ArrowLeft size={15} /> {language === 'hi' ? 'मोबाइल नंबर बदलें' : 'Change mobile number'}
            </button>
            <form onSubmit={verifyPhoneOtp}>
              <div className="otp-inputs" aria-label="Six-digit SMS verification code">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { inputRefs.current[index] = element; }}
                    aria-label={`Digit ${index + 1}`}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(event) => updateOtpDigit(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKey(index, event)}
                  />
                ))}
              </div>
              <button type="submit" className="button button-gold button-full" disabled={busy}>
                {busy ? (language === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying OTP…') : (language === 'hi' ? <>सत्यापित करें और लॉगिन करें <ArrowRight size={16} /></> : <>Verify & Sign in <ArrowRight size={16} /></>)}
              </button>
            </form>
            <div className="resend-row">
              {cooldown ? (
                <span>{language === 'hi' ? 'दोबारा OTP भेजें ' : 'Resend code in '}<strong>00:{String(cooldown).padStart(2, '0')}</strong></span>
              ) : (
                <button className="text-button" disabled={busy} onClick={sendPhoneOtp}>
                  {language === 'hi' ? 'SMS कोड दोबारा भेजें' : 'Resend SMS code'}
                </button>
              )}
            </div>
          </>
        ) : step === 'verify' ? (
          <>
            <button className="back-link" onClick={() => { setStep('email'); setError(''); setMessage(''); }}>
              <ArrowLeft size={15} /> {language === 'hi' ? 'ईमेल बदलें' : 'Change email'}
            </button>
            <form onSubmit={verifyOtp}>
              <div className="otp-inputs" aria-label="Six-digit verification code">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { inputRefs.current[index] = element; }}
                    aria-label={`Digit ${index + 1}`}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(event) => updateOtpDigit(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKey(index, event)}
                  />
                ))}
              </div>
              {method === 'recovery' && (
                <>
                  <label className="field-label">New password<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></div></label>
                  <label className="field-label">Confirm new password<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Enter it again" /></div></label>
                </>
              )}
              <button type="submit" className="button button-gold button-full" disabled={busy}>
                {busy ? (method === 'recovery' ? 'Resetting password…' : 'Verifying…') : method === 'recovery' ? <>Verify code & reset password <ArrowRight size={16} /></> : <>Verify email <ArrowRight size={16} /></>}
              </button>
            </form>
            <div className="resend-row">
              {cooldown ? (
                <span>Resend code in <strong>00:{String(cooldown).padStart(2, '0')}</strong></span>
              ) : (
                <button className="text-button" disabled={busy} onClick={sendOtp}>Resend code</button>
              )}
            </div>
          </>
        ) : (
          <>
            {method === 'phone' ? (
              <form onSubmit={sendPhoneOtp}>
                <label className="field-label">
                  {language === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}
                  <div className="phone-input-wrap">
                    <span className="phone-prefix-badge">🇮🇳 +91</span>
                    <input
                      className="phone-number-input"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      placeholder={language === 'hi' ? '10 अंकों का मोबाइल नंबर' : '10-digit mobile number'}
                      autoComplete="tel-national"
                      maxLength={10}
                      autoFocus
                    />
                  </div>
                </label>

                {!refCode && (
                  showReferralInput ? (
                    <label className="field-label">
                      <div className="flex justify-between items-center">
                        <span>{language === 'hi' ? 'रेफरल कोड (वैकल्पिक)' : 'Referral code (Optional)'}</span>
                        <button type="button" className="text-xs text-muted hover:underline" onClick={() => { setShowReferralInput(false); setRefCode(''); }}>
                          {language === 'hi' ? 'हटाएं' : 'Cancel'}
                        </button>
                      </div>
                      <div className="input-with-icon">
                        <Gift size={17} />
                        <input
                          className="text-input uppercase"
                          value={refCode}
                          onChange={(event) => setRefCode(event.target.value.trim().toUpperCase())}
                          placeholder="e.g. ZYVRA100"
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
                  )
                )}

                <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                  {busy
                    ? (language === 'hi' ? 'SMS OTP भेजा जा रहा है…' : 'Sending SMS OTP…')
                    : (language === 'hi' ? <>6-अंकों का SMS OTP भेजें <ArrowRight size={16} /></> : <>Send 6-Digit SMS OTP <ArrowRight size={16} /></>)}
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="back-link mb-3"
                  onClick={() => { setMethod('phone'); setStep('phone'); setError(''); setMessage(''); }}
                >
                  <ArrowLeft size={15} /> {language === 'hi' ? '← मोबाइल OTP पर वापस जाएं' : '← Back to Mobile OTP'}
                </button>
                <div className="auth-tabs">
                  <button
                    type="button"
                    aria-pressed={method === 'otp'}
                    className={method === 'otp' ? 'selected' : ''}
                    onClick={() => { setMethod('otp'); setStep('email'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); }}
                  >
                    ✉️ {language === 'hi' ? 'ईमेल OTP' : 'Email OTP'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={method === 'password' || method === 'recovery'}
                    className={method === 'password' || method === 'recovery' ? 'selected' : ''}
                    onClick={() => { setMethod('password'); setStep('email'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); }}
                  >
                    🔑 {language === 'hi' ? 'पासवर्ड' : 'Password'}
                  </button>
                </div>

                <form onSubmit={method === 'otp' || method === 'recovery' ? sendOtp : passwordAuth}>
                  <label className="field-label">Email address<div className="input-with-icon"><Mail size={17} /><input className="text-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" autoComplete="email" /></div></label>
                  {method === 'password' && <label className="field-label">Password<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="Your password" autoComplete="current-password" /><button className="password-eye" type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
                  {method === 'otp' && (
                    <label className="field-label">Referral code (Optional)<div className="input-with-icon"><Gift size={17} /><input className="text-input uppercase" value={refCode} onChange={(event) => setRefCode(event.target.value.trim().toUpperCase())} placeholder="e.g. ZYVRA100" autoComplete="off" /></div></label>
                  )}
                  {method === 'otp' && (
                    <>
                      <label className="field-label">Create a password <span className="optional-label">OPTIONAL</span><div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="At least 8 characters" autoComplete="new-password" /></div></label>
                      {password && <label className="field-label">Confirm password<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} minLength={8} placeholder="Enter it again" autoComplete="new-password" /></div></label>}
                      <p className="field-hint">Set it now to sign in with your email and password later. You can also add one from Profile after OTP sign-in.</p>
                    </>
                  )}
                  {method === 'otp' && <p className="field-hint">We’ll email you a 6-digit code. You can set a password now, or create one later from your profile.</p>}
                  {method === 'recovery' && <p className="field-hint">We’ll email a password reset code to your existing account. New accounts cannot be created in this flow.</p>}
                  <button type="submit" className="button button-gold button-full" disabled={busy}>{busy ? 'Please wait…' : method === 'otp' ? <>Send 6-Digit OTP <ArrowRight size={16} /></> : method === 'recovery' ? <>Send password reset code <ArrowRight size={16} /></> : <>Sign in <ArrowRight size={16} /></>}</button>
                </form>
                {method === 'password' && <button type="button" className="text-button auth-switch" onClick={() => { setMethod('recovery'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); setStep('email'); if (email.trim()) sendOtp(undefined, 'recovery'); }}>Forgot password? Get a reset code by email.</button>}
              </>
            )}
          </>
        )}

        {/* Recaptcha container for invisible phone verification */}
        <div id="recaptcha-container"></div>
        {message && <div className="feedback success-feedback"><CheckCircle2 size={16} />{message}</div>}
        {error && <div className="feedback error-feedback">{error}</div>}
        <div className="auth-divider"><span>{language === 'hi' ? 'या इनसे जारी रखें' : 'OR CONTINUE WITH'}</span></div>
        <button className="button google-button button-full" onClick={googleAuth} disabled={busy}><span className="google-g">G</span> {language === 'hi' ? 'Google से जारी रखें' : 'Continue with Google'}</button>
        {method === 'phone' && (
          <button
            type="button"
            className="auth-secondary-btn"
            onClick={() => { setMethod('otp'); setStep('email'); setError(''); setMessage(''); }}
          >
            <span>✉️</span> {language === 'hi' ? 'ईमेल या पासवर्ड से लॉगिन करें' : 'Or sign in with Email / Password'}
          </button>
        )}
        {guestDemoEnabled && <button className="guest-button" onClick={guestEntry}>Continue as guest <ArrowRight size={15} /></button>}
        <p className="auth-legal">By continuing, you agree to Zyvra’s <Link to="/terms" className="underline hover:text-white">Terms of Service</Link> and <Link to="/privacy" className="underline hover:text-white">Privacy Policy</Link>.</p>
        <div className="secure-note"><ShieldCheck size={14} /> Your account and progress stay yours.</div>
      </section>
    </div>
    <footer className="auth-footer">© 2026 ZYVRA <span>·</span> Learn with intent.</footer>
  </main>;
}

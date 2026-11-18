import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Gift, KeyRound, Mail, ShieldCheck, Sparkles, UserPlus, LogIn } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  // 'signin' | 'signup' | 'otp' | 'recovery'
  const [mode, setMode] = useState(() => {
    const requested = searchParams.get('mode');
    const hasRef = Boolean(searchParams.get('ref'));
    if (requested === 'signup' || hasRef) return 'signup';
    return 'signin';
  });
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      setMode('signup');
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

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep('form');
    setPassword('');
    setPasswordConfirm('');
    setError('');
    setMessage('');
  };

  const handleSendOtp = async (event, currentMode = mode) => {
    event?.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }
    if (!email.trim()) {
      setError(language === 'hi' ? 'कृपया अपना ईमेल पता दर्ज करें।' : 'Enter your email address first.');
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
        ? await supabase.auth.resetPasswordForEmail(email.trim())
        : await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true }
        });
      if (authError) throw authError;
      setStep('verify');
      setOtp(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
      setMessage(currentMode === 'recovery'
        ? (language === 'hi'
            ? `${email.trim()} पर पासवर्ड रीसेट कोड भेजा गया है। इनबॉक्स/स्पैम चेक करें।`
            : `A password reset code was sent to ${email.trim()}. Check your inbox/spam.`)
        : (language === 'hi'
            ? `${email.trim()} पर 6-अंकों का वेरिफिकेशन कोड भेज दिया गया है।`
            : `A 6-digit verification code was sent to ${email.trim()}.`));
    } catch (authError) {
      setError(authError.message || (language === 'hi' ? 'कोड नहीं भेजा जा सका। कृपया दोबारा प्रयास करें।' : 'Could not send code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
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
    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: mode === 'recovery' ? 'recovery' : 'email'
      });
      if (authError) throw authError;
      if (authData?.user) {
        if (mode === 'recovery') {
          const { error: passwordError } = await supabase.auth.updateUser({ password });
          if (passwordError) throw passwordError;
          setMessage(language === 'hi' ? 'आपका पासवर्ड रीसेट हो गया है। आप लॉगिन हो चुके हैं।' : 'Your password has been reset. You are now signed in.');
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
          if (referralResult && !referralResult.retryable) sessionStorage.removeItem('zyvra_ref_code');
        }
      }
    } catch (authError) {
      const detail = authError.message || '';
      if (/two devices/i.test(detail)) {
        setError(language === 'hi' ? 'यह खाता पहले से ही दो डिवाइस पर लॉगिन है।' : 'This account is already signed in on two devices.');
        return;
      }
      setError(/expired/i.test(detail)
        ? (language === 'hi' ? 'कोड समाप्त (expired) हो गया है। नया कोड मँगवाएँ।' : 'This code has expired. Request a new code.')
        : /invalid|token/i.test(detail)
        ? (language === 'hi' ? 'गलत कोड। अंक जाँचें या नया कोड मँगवाएँ।' : 'Invalid code. Check digits or request a new one.')
        : detail || (language === 'hi' ? 'सत्यापन विफल रहा। पुनः प्रयास करें।' : 'Verification failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSignIn = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
    } catch (authError) {
      setError(authErrorMessage(authError, language === 'hi' ? 'गलत ईमेल या पासवर्ड। कृपया पुनः जाँचें।' : 'Invalid email or password. Please check your credentials.'));
    } finally {
      setBusy(false);
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
      setError(authErrorMessage(authError, language === 'hi' ? 'Google लॉगिन विफल रहा।' : 'Google sign-in failed. Check connection.'));
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
          <div className="auth-icon">
            {mode === 'signup' ? <UserPlus size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <h2>
              {step === 'verify'
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
              {step === 'verify'
                ? (mode === 'recovery'
                    ? (language === 'hi' ? 'ईमेल से 6-अंकों का कोड दर्ज करें और नया पासवर्ड चुनें।' : 'Enter the code from your email and set a new password.')
                    : (language === 'hi' ? `${email.trim()} पर भेजा गया 6-अंकों का कोड दर्ज करें।` : `Enter the six-digit code sent to ${email.trim()}.`))
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

        {refCode && mode === 'signup' && (
          <div className="referral-auth-banner">
            <Gift size={16} className="text-amber-400" />
            <div>
              <strong>{language === 'hi' ? 'रेफरल कोड सक्रिय:' : 'Invite code active:'} <span>{refCode}</span></strong>
              <small>{language === 'hi' ? 'ज्वाइन करने पर वॉलेट में बोनस कॉइन्स जुड़ेंगे!' : 'Bonus coins will be credited to your wallet upon joining!'}</small>
            </div>
          </div>
        )}

        {step === 'verify' ? (
          <>
            <button className="back-link" onClick={() => { setStep('form'); setError(''); setMessage(''); }}>
              <ArrowLeft size={15} /> {language === 'hi' ? 'ईमेल बदलें' : 'Change email'}
            </button>
            <form onSubmit={handleVerifyOtp}>
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
              {mode === 'recovery' && (
                <>
                  <label className="field-label">
                    {language === 'hi' ? 'नया पासवर्ड' : 'New password'}
                    <div className="input-with-icon">
                      <KeyRound size={17} />
                      <input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
                    </div>
                  </label>
                  <label className="field-label">
                    {language === 'hi' ? 'पासवर्ड की पुष्टि करें' : 'Confirm new password'}
                    <div className="input-with-icon">
                      <KeyRound size={17} />
                      <input className="text-input" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Enter it again" />
                    </div>
                  </label>
                </>
              )}
              <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                {busy
                  ? (mode === 'recovery' ? (language === 'hi' ? 'पासवर्ड रीसेट हो रहा है…' : 'Resetting password…') : (language === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying…'))
                  : mode === 'recovery'
                  ? (language === 'hi' ? <>पासवर्ड बदलें और लॉगिन करें <ArrowRight size={16} /></> : <>Reset password & sign in <ArrowRight size={16} /></>)
                  : (language === 'hi' ? <>सत्यापित करें और आगे बढ़ें <ArrowRight size={16} /></> : <>Verify & Continue <ArrowRight size={16} /></>)}
              </button>
            </form>
            <div className="resend-row">
              {cooldown ? (
                <span>{language === 'hi' ? 'दोबारा कोड भेजें ' : 'Resend code in '}<strong>00:{String(cooldown).padStart(2, '0')}</strong></span>
              ) : (
                <button className="text-button" disabled={busy} onClick={handleSendOtp}>
                  {language === 'hi' ? 'कोड दोबारा भेजें' : 'Resend code'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* SIGN IN FORM (DEFAULT) */}
            {mode === 'signin' && (
              <form onSubmit={handlePasswordSignIn}>
                <label className="field-label">
                  {language === 'hi' ? 'ईमेल पता' : 'Email address'}
                  <div className="input-with-icon">
                    <Mail size={17} />
                    <input
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

                <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                  {busy ? (language === 'hi' ? 'लॉगिन हो रहा है…' : 'Signing in…') : (language === 'hi' ? <>साइन इन करें <LogIn size={16} /></> : <>Sign in <LogIn size={16} /></>)}
                </button>

                <div className="text-center mt-2">
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-white underline"
                    onClick={() => switchMode('otp')}
                  >
                    {language === 'hi' ? 'या बिना पासवर्ड ईमेल OTP से लॉगिन करें' : 'Or sign in with 1-time email OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* CREATE ACCOUNT / SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSendOtp}>
                <label className="field-label">
                  {language === 'hi' ? 'ईमेल पता' : 'Email address'}
                  <div className="input-with-icon">
                    <Mail size={17} />
                    <input
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
                    <span className="optional-label">{language === 'hi' ? 'कम से कम 8 अक्षर' : 'Min 8 chars'}</span>
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
                    {language === 'hi' ? 'पासवर्ड की पुष्टि करें' : 'Confirm password'}
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

                <p className="field-hint">
                  {language === 'hi'
                    ? 'हम आपके ईमेल पर 6-अंकों का वेरिफिकेशन कोड भेजेंगे। खाता तुरंत सक्रिय हो जाएगा।'
                    : 'We’ll email you a 6-digit verification code to activate your account.'}
                </p>

                <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                  {busy ? (language === 'hi' ? 'कृपया प्रतीक्षा करें…' : 'Please wait…') : (language === 'hi' ? <>खाता बनाएं और कोड पाएँ <ArrowRight size={16} /></> : <>Create Account & Get Code <ArrowRight size={16} /></>)}
                </button>
              </form>
            )}

            {/* PASSWORD RECOVERY FORM */}
            {mode === 'recovery' && (
              <form onSubmit={handleSendOtp}>
                <label className="field-label">
                  {language === 'hi' ? 'पंजीकृत ईमेल' : 'Registered email'}
                  <div className="input-with-icon">
                    <Mail size={17} />
                    <input
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
                  {busy ? (language === 'hi' ? 'भेजा जा रहा है…' : 'Sending…') : (language === 'hi' ? <>रीसेट कोड भेजें <ArrowRight size={16} /></> : <>Send reset code <ArrowRight size={16} /></>)}
                </button>
              </form>
            )}

            {/* PASSWORDLESS OTP LOGIN FORM */}
            {mode === 'otp' && (
              <form onSubmit={handleSendOtp}>
                <label className="field-label">
                  {language === 'hi' ? 'ईमेल पता' : 'Email address'}
                  <div className="input-with-icon">
                    <Mail size={17} />
                    <input
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
                  {busy ? (language === 'hi' ? 'भेजा जा रहा है…' : 'Sending…') : (language === 'hi' ? <>6-अंकों का OTP कोड भेजें <ArrowRight size={16} /></> : <>Send 6-Digit OTP <ArrowRight size={16} /></>)}
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

            {/* THE INDUSTRY-STANDARD FOOTER SWITCH (Sign in <-> Create Account) */}
            <div className="auth-switch-box" style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', textAlign: 'center' }}>
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
                  {language === 'hi' ? '← मुख्य लॉगिन पेज पर वापस जाएं' : '← Back to main sign in'}
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
  </main>;
}

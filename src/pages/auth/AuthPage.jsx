import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Gift, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
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
  const [method, setMethod] = useState('otp'); // 'otp' | 'password' | 'recovery'
  const [step, setStep] = useState('email'); // 'email' | 'verify'
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

  const sendOtp = async (event, authMode = method) => {
    event?.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }
    if (!email.trim()) {
      setError(language === 'hi' ? 'कृपया अपना ईमेल पता दर्ज करें।' : 'Enter your email address first.');
      return;
    }
    if (authMode === 'otp' && password && password.length < 8) {
      setError(language === 'hi' ? 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।' : 'Password must be at least 8 characters.');
      return;
    }
    if (authMode === 'otp' && password && password !== passwordConfirm) {
      setError(language === 'hi' ? 'पासवर्ड मेल नहीं खा रहे हैं।' : 'Passwords do not match.');
      return;
    }
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
        ? (language === 'hi'
            ? `${email.trim()} पर पासवर्ड रीसेट कोड भेज दिया गया है। अपना इनबॉक्स और स्पैम फ़ोल्डर देखें।`
            : `A password reset code was requested for ${email.trim()}. Check your inbox and spam folder.`)
        : (language === 'hi'
            ? `${email.trim()} पर 6-अंकों का वेरिफिकेशन कोड भेज दिया गया है।`
            : `A six-digit verification code was sent to ${email.trim()}.`));
    } catch (authError) {
      setError(authError.message || (language === 'hi' ? 'कोड नहीं भेजा जा सका। कृपया पुनः प्रयास करें।' : 'We could not send the code. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    if (!supabase) { setError(configurationError); return; }
    const token = otp.join('');
    if (!/^\d{6}$/.test(token)) {
      setError(language === 'hi' ? 'जारी रखने के लिए सभी 6 अंक दर्ज करें।' : 'Enter all six digits to continue.');
      return;
    }
    if (method === 'recovery' && password.length < 8) {
      setError(language === 'hi' ? 'कम से कम 8 अक्षरों का पासवर्ड चुनें।' : 'Choose a password with at least 8 characters.');
      return;
    }
    if (method === 'recovery' && password !== passwordConfirm) {
      setError(language === 'hi' ? 'पासवर्ड मेल नहीं खा रहे हैं।' : 'Passwords do not match.');
      return;
    }
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
          setMessage(language === 'hi' ? 'आपका पासवर्ड रीसेट हो गया है। आप लॉगिन हो चुके हैं।' : 'Your password has been reset. You are now signed in.');
          return;
        }
        if (method === 'otp' && password) {
          const { error: passwordError } = await supabase.auth.updateUser({ password });
          if (passwordError) throw new Error(language === 'hi' ? `ईमेल सत्यापित हो गया, लेकिन पासवर्ड सेव नहीं हो सका। प्रोफ़ाइल से पासवर्ड सेट करें। ${passwordError.message}` : `Your email is verified, but the password could not be saved. Sign in with OTP and set it from Profile. ${passwordError.message}`);
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
        setError(language === 'hi' ? 'यह खाता पहले से ही दो डिवाइस पर लॉगिन है।' : 'This account is already signed in on two devices. Sign out from another device, then try again.');
        return;
      }
      setError(/expired/i.test(detail)
        ? (language === 'hi' ? 'कोड समाप्त (expired) हो गया है। नया कोड मँगवाएँ।' : 'This code has expired. Request a new code and try again.')
        : /invalid|token/i.test(detail)
        ? (language === 'hi' ? 'गलत कोड। अंक जाँचें या नया कोड मँगवाएँ।' : 'That code is not valid. Check the digits or request a new code.')
        : detail || (language === 'hi' ? 'सत्यापन विफल रहा। पुनः प्रयास करें।' : 'Verification failed. Check your connection and try again.'));
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
    } catch (authError) {
      setError(authErrorMessage(authError, language === 'hi' ? 'लॉगिन विफल रहा। कृपया विवरण जाँचें।' : 'Authentication failed. Check your connection and try again.'));
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
      setError(authErrorMessage(authError, language === 'hi' ? 'Google लॉगिन विफल रहा।' : 'Google sign-in failed. Check your connection and try again.'));
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
              {step === 'verify'
                ? (method === 'recovery'
                    ? (language === 'hi' ? 'पासवर्ड रीसेट करें' : 'Reset your password')
                    : (language === 'hi' ? 'ईमेल कोड सत्यापित करें' : 'Verify your email'))
                : method === 'password'
                ? (language === 'hi' ? 'स्वागत है' : 'Welcome back')
                : method === 'recovery'
                ? (language === 'hi' ? 'पासवर्ड रीसेट' : 'Password Recovery')
                : (language === 'hi' ? 'लॉगिन या साइन-अप' : 'Login or Sign Up')}
            </h2>
            <p>
              {step === 'verify'
                ? (method === 'recovery'
                    ? (language === 'hi' ? 'ईमेल से रीसेट कोड दर्ज करें और नया पासवर्ड चुनें।' : 'Enter the reset code from your email and choose a new password.')
                    : (language === 'hi' ? `${email.trim()} पर भेजा गया 6-अंकों का कोड दर्ज करें।` : `Enter the six-digit code sent to ${email.trim()}.`))
                : method === 'password'
                ? (language === 'hi' ? 'अपनी पढ़ाई जारी रखने के लिए लॉगिन करें।' : 'Sign in to continue your learning.')
                : method === 'recovery'
                ? (language === 'hi' ? 'ईमेल कोड से अपना पासवर्ड रीसेट करें।' : 'Reset your password securely with an email code.')
                : (language === 'hi' ? 'नया खाता बनाएं या बिना पासवर्ड के तुरंत लॉगिन करें' : 'Create an account or sign in with Email OTP.')}
            </p>
          </div>
        </div>

        {refCode && method === 'otp' && (
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
                  <label className="field-label">{language === 'hi' ? 'नया पासवर्ड' : 'New password'}<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></div></label>
                  <label className="field-label">{language === 'hi' ? 'पासवर्ड की पुष्टि करें' : 'Confirm new password'}<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Enter it again" /></div></label>
                </>
              )}
              <button type="submit" className="button button-gold button-full" disabled={busy}>
                {busy
                  ? (method === 'recovery' ? (language === 'hi' ? 'पासवर्ड रीसेट हो रहा है…' : 'Resetting password…') : (language === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying…'))
                  : method === 'recovery'
                  ? (language === 'hi' ? <>कोड सत्यापित करें और पासवर्ड बदलें <ArrowRight size={16} /></> : <>Verify code & reset password <ArrowRight size={16} /></>)
                  : (language === 'hi' ? <>ईमेल सत्यापित करें <ArrowRight size={16} /></> : <>Verify email <ArrowRight size={16} /></>)}
              </button>
            </form>
            <div className="resend-row">
              {cooldown ? (
                <span>{language === 'hi' ? 'दोबारा कोड भेजें ' : 'Resend code in '}<strong>00:{String(cooldown).padStart(2, '0')}</strong></span>
              ) : (
                <button className="text-button" disabled={busy} onClick={sendOtp}>
                  {language === 'hi' ? 'कोड दोबारा भेजें' : 'Resend code'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                type="button"
                aria-pressed={method === 'otp'}
                className={method === 'otp' ? 'selected' : ''}
                onClick={() => { setMethod('otp'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); }}
              >
                ✉️ {language === 'hi' ? 'ईमेल OTP' : 'Email OTP'}
              </button>
              <button
                type="button"
                aria-pressed={method === 'password' || method === 'recovery'}
                className={method === 'password' || method === 'recovery' ? 'selected' : ''}
                onClick={() => { setMethod('password'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); }}
              >
                🔑 {language === 'hi' ? 'पासवर्ड' : 'Password'}
              </button>
            </div>

            <form onSubmit={method === 'otp' || method === 'recovery' ? sendOtp : passwordAuth}>
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

              {method === 'password' && (
                <label className="field-label">
                  {language === 'hi' ? 'पासवर्ड' : 'Password'}
                  <div className="input-with-icon">
                    <KeyRound size={17} />
                    <input
                      className="text-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
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
              )}

              {method === 'otp' && !refCode && (
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

              {method === 'otp' && (
                <>
                  <label className="field-label">
                    <div className="flex justify-between items-center">
                      <span>{language === 'hi' ? 'पासवर्ड बनाएं' : 'Create a password'}</span>
                      <span className="optional-label">{language === 'hi' ? 'ऐच्छिक' : 'OPTIONAL'}</span>
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
                  <p className="field-hint">
                    {language === 'hi'
                      ? '💡 अभी पासवर्ड सेट कर सकते हैं ताकि अगली बार बिना OTP के लॉगिन कर सकें, या इसे खाली छोड़कर सिर्फ OTP से लॉगिन करें।'
                      : '💡 Set a password now to sign in directly without OTP next time, or leave blank to always use OTP.'}
                  </p>
                </>
              )}

              {method === 'recovery' && (
                <p className="field-hint">
                  {language === 'hi'
                    ? 'हम आपके खाते पर पासवर्ड रीसेट कोड भेजेंगे।'
                    : 'We’ll email a password reset code to your existing account.'}
                </p>
              )}

              <button type="submit" className="button button-gold button-full mt-2" disabled={busy}>
                {busy
                  ? (language === 'hi' ? 'कृपया प्रतीक्षा करें…' : 'Please wait…')
                  : method === 'otp'
                  ? (language === 'hi' ? <>6-अंकों का ईमेल OTP भेजें <ArrowRight size={16} /></> : <>Send 6-Digit Email OTP <ArrowRight size={16} /></>)
                  : method === 'recovery'
                  ? (language === 'hi' ? <>पासवर्ड रीसेट कोड भेजें <ArrowRight size={16} /></> : <>Send password reset code <ArrowRight size={16} /></>)
                  : (language === 'hi' ? <>लॉगिन करें <ArrowRight size={16} /></> : <>Sign in <ArrowRight size={16} /></>)}
              </button>
            </form>

            {method === 'password' && (
              <>
                <button
                  type="button"
                  className="text-button auth-switch"
                  onClick={() => {
                    setMethod('recovery');
                    setPassword('');
                    setPasswordConfirm('');
                    setError('');
                    setMessage('');
                    if (email.trim()) sendOtp(undefined, 'recovery');
                  }}
                >
                  {language === 'hi' ? 'पासवर्ड भूल गए? ईमेल से रीसेट करें।' : 'Forgot password? Get a reset code by email.'}
                </button>
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}
                    onClick={() => {
                      setMethod('otp');
                      setPassword('');
                      setPasswordConfirm('');
                      setError('');
                      setMessage('');
                    }}
                  >
                    {language === 'hi' ? '✨ नए छात्र हैं? ईमेल OTP से खाता बनाएं →' : '✨ New student? Register with Email OTP →'}
                  </button>
                </div>
              </>
            )}

            {method === 'recovery' && (
              <button
                type="button"
                className="text-button auth-switch"
                onClick={() => {
                  setMethod('password');
                  setPassword('');
                  setPasswordConfirm('');
                  setError('');
                  setMessage('');
                }}
              >
                {language === 'hi' ? '← लॉगिन पर वापस जाएं' : '← Back to Sign in'}
              </button>
            )}
          </>
        )}

        {message && <div className="feedback success-feedback"><CheckCircle2 size={16} />{message}</div>}
        {error && <div className="feedback error-feedback">{error}</div>}

        <div className="auth-divider">
          <span>{language === 'hi' ? 'या इनसे जारी रखें' : 'OR CONTINUE WITH'}</span>
        </div>

        <button className="button google-button button-full" onClick={googleAuth} disabled={busy}>
          <span className="google-g">G</span> {language === 'hi' ? 'Google से जारी रखें' : 'Continue with Google'}
        </button>
        <p style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginTop: '6px', marginBottom: '2px' }}>
          {language === 'hi'
            ? '⚡ Google से 1-क्लिक में तुरंत लॉगिन या नया खाता बन जाता है (पासवर्ड की ज़रूरत नहीं)।'
            : '⚡ Register or sign in instantly with 1-click Google account (no password needed).'}
        </p>

        {guestDemoEnabled && (
          <button className="guest-button" onClick={guestEntry}>
            {language === 'hi' ? 'अतिथि (Guest) के रूप में देखें' : 'Continue as guest'} <ArrowRight size={15} />
          </button>
        )}

        <p className="auth-legal">
          {language === 'hi' ? 'आगे बढ़कर, आप Zyvra की ' : 'By continuing, you agree to Zyvra’s '}
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

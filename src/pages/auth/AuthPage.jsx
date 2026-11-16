import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Gift, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
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
  const [method, setMethod] = useState('otp');
  const [step, setStep] = useState('email');
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

  useEffect(() => {
    const urlRef = searchParams.get('ref');
    if (urlRef) {
      setRefCode(urlRef);
      try {
        sessionStorage.setItem('zyvra_ref_code', urlRef);
      } catch {
        // ignore
      }
    }
  }, [searchParams]);
  const inputRefs = useRef([]);
  const { user, loading, supabase, enterGuestMode, guestDemoEnabled, configurationError } = useAuth();
  const { theme, setTheme } = useThemeLanguage();
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

  const sendOtp = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) { setError(configurationError); return; }
    if (method === 'otp' && password && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (method === 'otp' && password && password !== passwordConfirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: method === 'otp'
        }
      });
      if (authError) throw authError;
      setStep('verify');
      setOtp(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
      setMessage(`A six-digit verification code was sent to ${email.trim()}.`);
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
    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
      if (authError) throw authError;
      if (authData?.user) {
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
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${destination}` }
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
    <div className="auth-topbar"><a href="/" className="sidebar-brand auth-brand"><img src="/logo-192.png" alt="Zyvra" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-sm" /><div>ZYVRA<span>LEARN WITH INTENT</span></div></a><button className="auth-theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☼ Light mode' : '◐ Dark mode'}</button></div>
    <div className="auth-layout">
      <section className="auth-story"><div className="eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</div><h1>Make every<br /><em>study hour</em> count.</h1><p>A calmer, more focused way to prepare for BPSC, SSC, CTET and beyond.</p><div className="auth-points"><span><CheckCircle2 size={16} /> One place for your learning journey</span><span><CheckCircle2 size={16} /> Progress that feels rewarding</span><span><CheckCircle2 size={16} /> Built for focused exam prep</span></div><div className="auth-quote"><div className="quote-stars">✦ ✦ ✦ ✦ ✦</div><p>“A little progress each day adds up to big results.”</p><span>YOUR ZYVRA STUDY SPACE</span></div></section>
      <section className="auth-card">
        <div className="auth-card-heading"><div className="auth-icon"><ShieldCheck size={20} /></div><div><h2>{step === 'verify' ? 'Check your email' : method === 'password' || method === 'recovery' ? 'Welcome back' : 'Create your free account'}</h2><p>{step === 'verify' ? 'Enter the six-digit code to verify your email.' : method === 'password' ? 'Sign in to continue your learning.' : method === 'recovery' ? 'Sign in with a code, then reset your password from Profile.' : 'Verify your email to get started. No payment needed.'}</p></div></div>
        {method === 'otp' && refCode && (
          <div className="referral-auth-banner">
            <Gift size={16} className="text-amber-400" />
            <div>
              <strong>Invite code active: <span>{refCode}</span></strong>
              <small>Bonus coins will be credited to your wallet upon joining!</small>
            </div>
          </div>
        )}
        {step === 'verify' ? <>
          <button className="back-link" onClick={() => { setStep('email'); setError(''); setMessage(''); }}><ArrowLeft size={15} /> Change email</button>
          <form onSubmit={verifyOtp}>
            <div className="otp-inputs" aria-label="Six-digit verification code">{otp.map((digit, index) => <input key={index} ref={(element) => { inputRefs.current[index] = element; }} aria-label={`Digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} value={digit} onChange={(event) => updateOtpDigit(index, event.target.value)} onKeyDown={(event) => handleOtpKey(index, event)} />)}</div>
            <button type="submit" className="button button-gold button-full" disabled={busy}>{busy ? 'Verifying…' : <>Verify email <ArrowRight size={16} /></>}</button>
          </form>
          <div className="resend-row">{cooldown ? <span>Resend code in <strong>00:{String(cooldown).padStart(2, '0')}</strong></span> : <button className="text-button" disabled={busy} onClick={sendOtp}>Resend code</button>}</div>
        </> : <>
          <div className="auth-tabs">
            <button type="button" aria-pressed={method === 'password' || method === 'recovery'} className={method === 'password' || method === 'recovery' ? 'selected' : ''} onClick={() => { setMethod('password'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); }}>Sign in</button>
            <button type="button" aria-pressed={method === 'otp'} className={method === 'otp' ? 'selected' : ''} onClick={() => { setMethod('otp'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); }}>Create account</button>
          </div>
          <form onSubmit={method === 'otp' || method === 'recovery' ? sendOtp : passwordAuth}>
            <label className="field-label">Email address<div className="input-with-icon"><Mail size={17} /><input className="text-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" autoComplete="email" /></div></label>
            {method === 'password' && <label className="field-label">Password<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="Your password" autoComplete="current-password" /><button className="password-eye" type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
            {method === 'otp' && (
              <label className="field-label">Referral code (Optional)<div className="input-with-icon"><Gift size={17} /><input className="text-input uppercase" value={refCode} onChange={(event) => setRefCode(event.target.value.trim().toUpperCase())} placeholder="e.g. ZYVRA100" autoComplete="off" /></div></label>
            )}
            {method === 'otp' && <>
              <label className="field-label">Create a password <span className="optional-label">OPTIONAL</span><div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="At least 8 characters" autoComplete="new-password" /></div></label>
              {password && <label className="field-label">Confirm password<div className="input-with-icon"><KeyRound size={17} /><input className="text-input" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} minLength={8} placeholder="Enter it again" autoComplete="new-password" /></div></label>}
              <p className="field-hint">Set it now to sign in with your email and password later. You can also add one from Profile after OTP sign-in.</p>
            </>}
            {method === 'otp' && <p className="field-hint">We’ll email you a 6-digit code. You can set a password now, or create one later from your profile.</p>}
            {method === 'recovery' && <p className="field-hint">We’ll email a sign-in code to your existing account. New accounts cannot be created in this flow.</p>}
            <button type="submit" className="button button-gold button-full" disabled={busy}>{busy ? 'Please wait…' : method === 'otp' ? <>Send 6-Digit OTP <ArrowRight size={16} /></> : method === 'recovery' ? <>Send sign-in code <ArrowRight size={16} /></> : <>Sign in <ArrowRight size={16} /></>}</button>
          </form>
          {method === 'password' && <button type="button" className="text-button auth-switch" onClick={() => { setMethod('recovery'); setPassword(''); setPasswordConfirm(''); setError(''); setMessage(''); setStep('email'); }}>Forgot password? Sign in with OTP, then reset it from Profile.</button>}
        </>}
        {message && <div className="feedback success-feedback"><CheckCircle2 size={16} />{message}</div>}
        {error && <div className="feedback error-feedback">{error}</div>}
        <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
        <button className="button google-button button-full" onClick={googleAuth} disabled={busy}><span className="google-g">G</span> Continue with Google</button>
        {guestDemoEnabled && <button className="guest-button" onClick={guestEntry}>Continue as guest <ArrowRight size={15} /></button>}
        <p className="auth-legal">By continuing, you agree to Zyvra’s Terms of Service and Privacy Policy.</p>
        <div className="secure-note"><ShieldCheck size={14} /> Your account and progress stay yours.</div>
      </section>
    </div>
    <footer className="auth-footer">© 2026 ZYVRA <span>·</span> Learn with intent.</footer>
  </main>;
}

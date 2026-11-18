import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, X, Loader2, Smartphone, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function Admin2FAModal({ isOpen, onClose }) {
  const { supabase } = useAuth();
  const { language } = useThemeLanguage();
  const isHi = language === 'hi';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeFactor, setActiveFactor] = useState(null);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState(null);
  const [verifyCode, setVerifyCode] = useState(Array(6).fill(''));
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Unenroll state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const inputRefs = useRef([]);

  const checkFactors = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: factorsErr } = await supabase.auth.mfa.listFactors();
      if (factorsErr) throw factorsErr;
      const allFactors = data?.all || [];
      const verified = allFactors.find((f) => f.status === 'verified') || (data?.totp || []).find((f) => f.status === 'verified');
      setActiveFactor(verified || null);
    } catch (err) {
      console.error('MFA factor listing error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isOpen) {
      checkFactors();
      setEnrolling(false);
      setEnrollData(null);
      setError('');
      setSuccess('');
      setShowDisableConfirm(false);
    }
  }, [isOpen, checkFactors]);

  const handleStartEnrollment = async () => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      // 1. Clean up ALL unverified factors across data.all to prevent limit & name collision errors
      const { data: currentFactors } = await supabase.auth.mfa.listFactors();
      const unverified = (currentFactors?.all || []).filter((f) => f.status !== 'verified');
      for (const factor of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
      }

      // 2. Enroll TOTP factor with a descriptive friendly name
      const friendlyName = `ZYVRA Authenticator (${new Date().toLocaleDateString('en-GB')})`;
      let enrollRes = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'ZYVRA',
        friendlyName
      });

      // 3. Fallback: if duplicate name conflict or limit error occurs, force clean and retry once
      if (enrollRes.error) {
        const errMsg = enrollRes.error.message?.toLowerCase() || '';
        if (errMsg.includes('already exists') || enrollRes.error.code === 'mfa_factor_name_conflict') {
          const { data: retryFactors } = await supabase.auth.mfa.listFactors();
          for (const factor of (retryFactors?.all || [])) {
            if (factor.status !== 'verified') {
              await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
            }
          }
          enrollRes = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'ZYVRA',
            friendlyName: `ZYVRA-${Date.now()}`
          });
        }
      }

      if (enrollRes.error) throw enrollRes.error;

      setEnrollData(enrollRes.data);
      setEnrolling(true);
      setVerifyCode(Array(6).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error('Failed to initialize 2FA enrollment:', err);
      setError(err.message || 'Failed to initialize 2FA enrollment.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEnrollment = async (event) => {
    event?.preventDefault?.();
    setError('');
    const code = verifyCode.join('');
    if (!/^\d{6}$/.test(code)) {
      setError(isHi ? 'कृपया सभी 6 अंक दर्ज करें।' : 'Enter all 6 digits.');
      return;
    }
    if (!enrollData?.id) return;

    setBusy(true);
    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.id,
        code
      });
      if (verifyErr) throw verifyErr;

      setSuccess(isHi ? '🎉 2FA सफलतापूर्वक चालू हो गया है! अब आपका खाता 100% सुरक्षित है।' : '🎉 Two-Factor Authentication is now active! Your account is protected.');
      setEnrolling(false);
      setEnrollData(null);
      await checkFactors();
    } catch (err) {
      console.warn('Enrollment verification failed:', err);
      setError(isHi ? 'गलत 2FA कोड। कृपया Google Authenticator में दिख रहा ताज़ा कोड दर्ज करें।' : 'Invalid code. Enter the latest 6-digit code shown in Google Authenticator.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable2FA = async (event) => {
    event?.preventDefault?.();
    if (!activeFactor?.id) return;
    setError('');
    setBusy(true);
    try {
      // Verify current code before unenrolling
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: activeFactor.id,
        code: disableCode.trim()
      });
      if (verifyErr) throw verifyErr;

      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: activeFactor.id });
      if (unenrollErr) throw unenrollErr;

      setSuccess(isHi ? '2FA सुरक्षा हटा दी गई है।' : 'Two-Factor Authentication has been disabled.');
      setShowDisableConfirm(false);
      setDisableCode('');
      await checkFactors();
    } catch (err) {
      console.warn('MFA unenroll verification failed:', err);
      setError(isHi ? 'अमान्य कोड। पुष्टि करने के लिए सही 6-अंकीय कोड डालें।' : 'Invalid code. Enter current 6-digit code to confirm removal.');
    } finally {
      setBusy(false);
    }
  };

  const updateDigit = (index, val) => {
    if (!/^\d{0,6}$/.test(val)) return;
    const next = [...verifyCode];
    if (val.length > 1) {
      val.slice(0, 6 - index).split('').forEach((d, i) => { next[index + i] = d; });
      setVerifyCode(next);
      inputRefs.current[Math.min(index + val.length, 5)]?.focus();
      return;
    }
    next[index] = val;
    setVerifyCode(next);
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setVerifyCode(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const copySecret = () => {
    if (!enrollData?.totp?.secret) return;
    navigator.clipboard.writeText(enrollData.totp.secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {isHi ? 'टू-फैक्टर ऑथेंटिकेशन (2FA) सुरक्षा' : 'Two-Factor Authentication (2FA)'}
            </h2>
            <p className="text-xs text-slate-400">
              {isHi ? 'Google Authenticator से एडमिन अकाउंट को 100% सुरक्षित करें' : 'Fortify your admin account with Google Authenticator'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
            <span>{isHi ? 'सुरक्षा स्थिति जाँची जा रही है…' : 'Checking security status…'}</span>
          </div>
        ) : activeFactor ? (
          /* ACTIVE 2FA STATUS */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={18} />
              </div>
              <div>
                <strong className="text-sm text-emerald-300 block">
                  {isHi ? '2FA सक्रिय और सुरक्षित है' : '2FA is Active and Protecting Your Account'}
                </strong>
                <p className="text-xs text-slate-300 mt-1">
                  {isHi
                    ? 'हर बार लॉगिन करते समय आपके Google Authenticator ऐप का 6-अंकीय कोड आवश्यक होगा। आपका एडमिन पैनल पूरी तरह सुरक्षित है।'
                    : 'Every sign-in requires the 6-digit rotating code from your Google Authenticator app. Unauthorized access is blocked.'}
                </p>
              </div>
            </div>

            {showDisableConfirm ? (
              <form onSubmit={handleDisable2FA} className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                <strong className="text-xs text-rose-300 block">
                  {isHi ? '2FA बंद करने के लिए वर्तमान कोड दर्ज करें:' : 'Enter current 2FA code to disable:'}
                </strong>
                <input
                  type="text"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-xl tracking-widest py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowDisableConfirm(false); setDisableCode(''); }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    {isHi ? 'रद्द करें' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={disableCode.length !== 6 || busy}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {busy ? 'Verifying…' : (isHi ? '2FA हटाएं' : 'Disable 2FA')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowDisableConfirm(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 underline"
                >
                  {isHi ? '2FA बंद करें (Disable 2FA)' : 'Disable Two-Factor Authentication'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  {isHi ? 'बंद करें' : 'Close'}
                </button>
              </div>
            )}
          </div>
        ) : enrolling && enrollData ? (
          /* ENROLLMENT STEP (QR CODE + VERIFY) */
          <div className="space-y-4">
            <div className="text-xs text-slate-300 space-y-1">
              <p>
                <strong>{isHi ? 'स्टेप 1:' : 'Step 1:'}</strong> {isHi ? 'अपने फोन में Google Authenticator खोलें और नीचे "+" दबाकर "Scan a QR code" चुनें।' : 'Open Google Authenticator on your phone and tap "+" → "Scan a QR code".'}
              </p>
            </div>

            {/* Crisp White QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-xl mx-auto w-fit">
              {enrollData.totp?.qr_code ? (
                enrollData.totp.qr_code.startsWith('data:') || enrollData.totp.qr_code.startsWith('http') ? (
                  <img
                    src={enrollData.totp.qr_code}
                    alt="ZYVRA 2FA QR Code"
                    className="w-52 h-52 object-contain select-none"
                  />
                ) : (
                  <div
                    className="w-52 h-52 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: enrollData.totp.qr_code }}
                  />
                )
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-400">
                  <Loader2 className="animate-spin text-emerald-600" size={32} />
                </div>
              )}
            </div>

            {/* Mobile quick link to open Google Authenticator directly if on mobile */}
            {enrollData.totp?.uri && (
              <div className="text-center sm:hidden">
                <a
                  href={enrollData.totp.uri}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
                >
                  <Smartphone size={14} />
                  <span>{isHi ? 'सीधे Authenticator ऐप में जोड़ें' : 'Open in Authenticator app'}</span>
                </a>
              </div>
            )}

            {/* Secret Backup Key */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 text-[11px] truncate mr-2">
                Key: <strong className="text-amber-400">{enrollData.totp?.secret}</strong>
              </span>
              <button
                type="button"
                onClick={copySecret}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px] shrink-0"
              >
                {copiedKey ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Verify Code Form */}
            <form onSubmit={handleVerifyEnrollment} className="space-y-3 pt-1">
              <p className="text-xs text-slate-300">
                <strong>{isHi ? 'स्टेप 2:' : 'Step 2:'}</strong> {isHi ? 'Google Authenticator में दिख रहा 6-अंकों का कोड दर्ज करें:' : 'Enter the 6-digit code shown in Google Authenticator:'}
              </p>

              <div className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
                {verifyCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => updateDigit(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-full h-12 text-center text-xl font-bold rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-emerald-400 focus:outline-none"
                  />
                ))}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setEnrolling(false); setEnrollData(null); }}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs"
                >
                  {isHi ? 'पीछे जाएं' : 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={verifyCode.join('').length !== 6 || busy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50 transition-all shadow-lg"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{isHi ? 'सत्यापित करें और 2FA चालू करें' : 'Verify & Activate 2FA'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* NOT ENROLLED - INITIAL EXPLANATION & CALL TO ACTION */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <Smartphone size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">{isHi ? 'Google Authenticator कैसे काम करता है?' : 'How Google Authenticator Works'}</strong>
                  <span>{isHi ? 'यह आपके फोन पर एक 6-अंकीय कोड जनरेट करता है जो हर 30 सेकंड में अपने आप बदलता रहता है।' : 'It generates a rolling 6-digit security code on your mobile device every 30 seconds.'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <KeyRound size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">{isHi ? 'पासवर्ड लीक होने पर भी सुरक्षा' : 'Bulletproof Login Protection'}</strong>
                  <span>{isHi ? 'अगर किसी को आपका ईमेल और पासवर्ड पता भी चल जाए, तब भी वे आपके फोन के बिना लॉगिन नहीं कर पाएंगे।' : 'Even if an attacker discovers your admin email and password, they are completely locked out without your phone.'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs"
              >
                {isHi ? 'बाद में करें' : 'Later'}
              </button>
              <button
                type="button"
                onClick={handleStartEnrollment}
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                <span>{isHi ? '2FA सेटअप शुरू करें (1 मिनट)' : 'Setup 2FA Now (1 min)'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

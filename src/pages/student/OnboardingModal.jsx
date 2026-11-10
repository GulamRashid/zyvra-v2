import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Languages, Moon, Sun, Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const exams = ['BPSC', 'SSC', 'CTET', 'NCERT'];

export default function OnboardingModal() {
  const { user, profile, supabase, refreshAccount } = useAuth();
  const { theme, setTheme, language, setLanguage } = useThemeLanguage();
  const [open, setOpen] = useState(false);
  const [selectedExams, setSelectedExams] = useState([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const storageKey = `zyvra-onboarded-${user.id}`;
    if (!localStorage.getItem(storageKey) && profile) {
      setSelectedExams(profile.target_exams || []);
      setOpen(true);
    }
  }, [user, profile]);

  if (!open) return null;
  const toggleExam = (exam) => setSelectedExams((current) => current.includes(exam) ? current.filter((value) => value !== exam) : [...current, exam]);
  const finish = async () => {
    setError('');
    if (password && password.length < 6) {
      setError('Choose a password with at least 6 characters, or leave it blank to skip.');
      return;
    }
    setSaving(true);
    try {
      if (user && supabase) {
        if (password) {
          try {
            const { error: passwordError } = await supabase.auth.updateUser({ password });
            if (passwordError) throw passwordError;
          } catch (passwordError) {
            window.alert(`Your preferences will still be saved, but we couldn't set your password: ${passwordError.message || 'Please try again later.'}`);
          }
        }
        const { error: saveError } = await supabase.from('profiles').update({
          preferred_language: language,
          theme,
          target_exams: selectedExams
        }).eq('id', user.id);
        if (saveError) throw saveError;
        await refreshAccount();
        localStorage.setItem(`zyvra-onboarded-${user.id}`, 'true');
      }
      setOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'We could not save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const themeOptions = [{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }, { value: 'system', label: 'System', Icon: Monitor }];
  return <div className="modal-backdrop" role="presentation"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div className="modal-step">A BETTER WAY TO BEGIN <span>01 / 01</span></div>
    <div className="onboarding-mark"><span className="brand-mark">Z</span></div>
    <h2 id="onboarding-title">Make Zyvra yours.</h2><p>Set a few preferences to make your study space feel right.</p>
    <div className="onboarding-group"><div className="onboarding-label"><Languages size={16} /> Interface language</div><div className="preference-options">{[['en', 'English'], ['hi', 'हिन्दी']].map(([value, label]) => <button key={value} className={`preference-choice ${language === value ? 'chosen' : ''}`} onClick={() => setLanguage(value)}>{label}{language === value && <Check size={15} />}</button>)}</div></div>
    <div className="onboarding-group"><div className="onboarding-label"><Sun size={16} /> Appearance</div><div className="preference-options">{themeOptions.map(({ value, label, Icon }) => <button key={value} className={`preference-choice ${theme === value ? 'chosen' : ''}`} onClick={() => setTheme(value)}><Icon size={15} /> {label}{theme === value && <Check size={15} />}</button>)}</div></div>
    <div className="onboarding-group"><div className="onboarding-label">What are you preparing for? <span>OPTIONAL</span></div><div className="exam-chips">{exams.map((exam) => <button key={exam} className={`exam-chip ${selectedExams.includes(exam) ? 'selected' : ''}`} onClick={() => toggleExam(exam)}>{exam}{selectedExams.includes(exam) && <Check size={14} />}</button>)}</div></div>
    <div className="onboarding-password-card">
      <div className="onboarding-password-heading"><KeyRound size={16} /><div><strong>Set Password for Faster 1-Click Login</strong><p>Skip waiting for OTP codes on your next visit by saving a quick password.</p></div></div>
      <label className="field-label">Password <span className="optional-label">OPTIONAL</span><div className="input-with-icon"><KeyRound size={16} /><input className="text-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete="new-password" placeholder="At least 6 characters" /><button className="password-eye" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
    </div>
    {error && <div className="feedback error-feedback">{error}</div>}
    <button className="button button-gold button-full" onClick={finish} disabled={saving}>{saving ? 'Saving preferences…' : 'Start exploring'}</button>
    <button className="skip-onboarding" onClick={() => setOpen(false)}>I’ll do this later</button>
  </section></div>;
}

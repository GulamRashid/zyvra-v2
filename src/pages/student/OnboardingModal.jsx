import { useEffect, useRef, useState } from 'react';
import { Check, Languages, Moon, Sun, Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { getFriendlyErrorMessage } from '../../lib/errors';

const exams = ['BPSC', 'SSC', 'CTET', 'NCERT'];

export default function OnboardingModal() {
  const { user, profile, guest, supabase, refreshAccount } = useAuth();
  const { theme, setTheme, language, setLanguage } = useThemeLanguage();
  const [open, setOpen] = useState(false);
  const [selectedExams, setSelectedExams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const silentSyncRef = useRef(false);

  useEffect(() => {
    if (!user || guest) {
      setOpen(false);
      return;
    }

    const dbDone = profile?.onboarding_completed === true;
    const localDone = localStorage.getItem('zyvra_onboarding_completed') === 'true';

    // DB value takes precedence
    if (dbDone) {
      localStorage.setItem('zyvra_onboarding_completed', 'true');
      setOpen(false);
      return;
    }

    // If done in localStorage but not in DB, attempt a silent sync once
    if (localDone) {
      if (profile && (profile.onboarding_completed === false || profile.onboarding_completed === null) && user && supabase && !silentSyncRef.current) {
        silentSyncRef.current = true;
        supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
          .then(({ error: syncErr }) => {
            if (syncErr) console.warn('Silent onboarding DB sync failed:', syncErr.message);
            else if (refreshAccount) refreshAccount();
          })
          .catch((err) => console.warn('Silent onboarding DB sync error:', err.message || err));
      }
      setOpen(false);
      return;
    }

    // Modal only opens when neither DB nor localStorage marks it done
    if (profile && (profile.onboarding_completed === false || profile.onboarding_completed === null)) {
      setSelectedExams(profile.target_exams || []);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user, guest, profile, refreshAccount]);

  if (!open) return null;

  const toggleExam = (exam) => {
    setSelectedExams((current) =>
      current.includes(exam) ? current.filter((value) => value !== exam) : [...current, exam]
    );
  };

  const handleComplete = async () => {
    setError('');
    setSaving(true);
    try {
      localStorage.setItem('zyvra_onboarding_completed', 'true');
      localStorage.setItem('zyvra-language', language);
      if (setLanguage) {
        setLanguage(language);
      }
      if (user && supabase) {
        const { error: saveError } = await supabase.from('profiles').update({
          onboarding_completed: true,
          preferred_language: language,
          theme,
          target_exams: selectedExams
        }).eq('id', user.id);

        if (saveError) {
          console.warn('Profile onboarding update failed, fallback to localStorage:', saveError.message);
        } else if (refreshAccount) {
          await refreshAccount();
        }
      }
      setOpen(false);
    } catch (saveError) {
      console.warn('Profile onboarding save error, fallback to localStorage:', saveError.message || saveError);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const themeOptions = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor }
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="modal-step">A BETTER WAY TO BEGIN <span>01 / 01</span></div>
        <div className="onboarding-mark"><img src="/logo.png" alt="Zyvra" className="w-12 h-12 rounded-xl object-contain shadow-sm" /></div>
        <h2 id="onboarding-title">Make Zyvra yours.</h2>
        <p>Set a few preferences to make your study space feel right.</p>

        <div className="onboarding-group">
          <div className="onboarding-label"><Languages size={16} /> Interface language</div>
          <div className="preference-options">
            {[['en', 'English'], ['hi', 'हिन्दी']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`preference-choice ${language === value ? 'chosen' : ''}`}
                onClick={() => setLanguage(value)}
              >
                {label}
                {language === value && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-group">
          <div className="onboarding-label"><Sun size={16} /> Appearance</div>
          <div className="preference-options">
            {themeOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={`preference-choice ${theme === value ? 'chosen' : ''}`}
                onClick={() => setTheme(value, user?.id)}
              >
                <Icon size={15} /> {label}
                {theme === value && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-group">
          <div className="onboarding-label">What are you preparing for? <span>OPTIONAL</span></div>
          <div className="exam-chips">
            {exams.map((exam) => (
              <button
                key={exam}
                type="button"
                className={`exam-chip ${selectedExams.includes(exam) ? 'selected' : ''}`}
                onClick={() => toggleExam(exam)}
              >
                {exam}
                {selectedExams.includes(exam) && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="feedback error-feedback flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              className="button button-outline min-h-[44px] shrink-0 text-xs px-3"
              onClick={handleComplete}
              disabled={saving}
            >
              Try again
            </button>
          </div>
        )}

        <button
          type="button"
          className="button button-gold button-full"
          onClick={handleComplete}
          disabled={saving}
        >
          {saving ? 'Saving preferences…' : 'Start exploring'}
        </button>

        <button
          type="button"
          className="skip-onboarding"
          onClick={handleComplete}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'I’ll do this later'}
        </button>
      </section>
    </div>
  );
}

import { Languages } from 'lucide-react';
import { useState } from 'react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage, languageError, t } = useThemeLanguage();
  const [syncError, setSyncError] = useState('');
  const toggle = async () => {
    setSyncError('');
    try {
      await setLanguage(language === 'en' ? 'hi' : 'en');
    } catch (error) {
      setSyncError(error.message || languageError || 'Language preference could not be synced.');
    }
  };
  const error = syncError || languageError;
  return <span className={`language-toggle-wrap ${compact ? 'compact' : ''}`}>
    <button className="button button-quiet language-switch" type="button" onClick={toggle}
      aria-label={language === 'en' ? 'Switch language to Hindi' : 'Switch language to English'}
      aria-pressed={language === 'hi'} title={error || (language === 'en' ? 'Switch to Hindi' : 'Switch to English')}>
      {!compact && <Languages size={15} />}<span>{language === 'en' ? 'EN' : 'HI'}</span>
    </button>
    {error && <span className="language-sync-error" role="status">{error}</span>}
  </span>;
}

import { Languages } from 'lucide-react';
import { useState } from 'react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage, languageError } = useThemeLanguage();
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
    <button
      className="h-11 min-h-[44px] min-w-[44px] px-2.5 rounded-xl dark:bg-slate-800/80 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 border dark:border-slate-700/60 border-slate-300 dark:text-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1 transition-all active:scale-95 shrink-0"
      type="button"
      onClick={toggle}
      aria-label={language === 'en' ? 'Switch language to Hindi' : 'Switch language to English'}
      aria-pressed={language === 'hi'}
      title={error || (language === 'en' ? 'Switch to Hindi' : 'Switch to English')}
    >
      {!compact && <Languages size={15} className="hidden sm:inline shrink-0" />}
      <span>{language === 'en' ? 'EN' : 'HI'}</span>
    </button>
    {error && <span className="language-sync-error" role="status">{error}</span>}
  </span>;
}

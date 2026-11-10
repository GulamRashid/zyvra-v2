import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const DISMISS_KEY = 'zyvra-install-dismissed-until';
const DISMISS_DAYS = 7;

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function canShowAfterDismissal() {
  try {
    return Date.now() >= Number(localStorage.getItem(DISMISS_KEY) || 0);
  } catch (error) {
    console.error('Unable to read PWA install dismissal:', error);
    return true;
  }
}

export default function PwaInstallBanner() {
  const { t } = useThemeLanguage();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [visible, setVisible] = useState(() => !isInstalled() && canShowAfterDismissal());
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setVisible(!isInstalled() && canShowAfterDismissal());
    };
    const onInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
      setVisible(false);
    } catch (dismissError) {
      setError(dismissError.message || 'This reminder could not be dismissed.');
    }
  };

  const install = async () => {
    setError('');
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') setVisible(false);
      setInstallPrompt(null);
    } catch (installError) {
      setError(installError.message || 'The browser could not start app installation.');
    }
  };

  if (!visible || isInstalled()) return null;
  return <aside className="pwa-install-banner" aria-label="Install Zyvra">
    <div className="pwa-install-mark"><Download size={18} /></div>
    <div className="pwa-install-copy">
      <strong>{t('installMessage')}</strong>
      {showHelp && <span>{t('installHelp')}</span>}
      {error && <span className="pwa-install-error" role="status">{error}</span>}
    </div>
    <button type="button" className="button button-gold pwa-install-action" onClick={install}>{t('installNow')}</button>
    <button type="button" className="button button-quiet pwa-install-later" onClick={dismiss}>{t('later')}</button>
    <button type="button" className="icon-button pwa-install-close" onClick={dismiss} aria-label={t('later')}><X size={16} /></button>
  </aside>;
}

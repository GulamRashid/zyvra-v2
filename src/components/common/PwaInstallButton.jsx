import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const { t } = useThemeLanguage();

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!installPrompt || installed) return null;
  const install = async () => {
    setInstalling(true);
    setError('');
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (installError) {
      setError(installError.message || 'App installation could not be started.');
    } finally {
      setInstalling(false);
    }
  };
  return <button className="button button-gold install-button" title={error || t('install')} aria-label={error || t('install')} disabled={installing} onClick={install}>
    <Download size={15} /> {t('install')}
  </button>;
}

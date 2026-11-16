import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function PwaUpdatePrompt() {
  const { language } = useThemeLanguage();
  const [error, setError] = useState('');
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!needRefresh) return null;

  const hindi = language === 'hi';
  const applyUpdate = async () => {
    setError('');
    try {
      await updateServiceWorker(true);
    } catch {
      setError(hindi ? 'अपडेट अभी लागू नहीं हुआ। दोबारा कोशिश करें।' : 'The update could not be applied. Please try again.');
    }
  };

  return (
    <aside className="pwa-update-prompt" role="status" aria-live="polite">
      <div className="pwa-update-copy">
        <strong>{hindi ? 'Zyvra का नया वर्ज़न तैयार है' : 'A new Zyvra version is ready'}</strong>
        <span>{hindi ? 'नई सुविधाओं और सुधारों के लिए अभी अपडेट करें।' : 'Update now to get the latest fixes and improvements.'}</span>
        {error && <span className="pwa-install-error">{error}</span>}
      </div>
      <button type="button" className="button button-primary pwa-update-action" onClick={applyUpdate}>
        <RefreshCw size={15} /> {hindi ? 'अभी अपडेट करें' : 'Update now'}
      </button>
      <button
        type="button"
        className="icon-button pwa-update-dismiss"
        onClick={() => setNeedRefresh(false)}
        aria-label={hindi ? 'बाद में अपडेट करें' : 'Update later'}
      >
        <X size={16} />
      </button>
    </aside>
  );
}

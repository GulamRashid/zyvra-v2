import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

const choices = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor }
];

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeLanguage();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const current = choices.find((choice) => choice.value === theme) || choices[0];
  const selectTheme = async (event) => {
    setError('');
    try {
      await setTheme(event.target.value, user?.id);
    } catch (error) {
      setError(error.message || 'Theme preference could not be synced.');
    }
  };
  return <span className="theme-control">
    <label className="icon-select" title={error || 'Appearance'}>
      <current.Icon size={16} />
      <select aria-label="Appearance" value={theme} onChange={selectTheme}>
        {choices.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {error && <span className="theme-error" role="alert">{error}</span>}
  </span>;
}

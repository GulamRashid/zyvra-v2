import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeLanguage();
  const { user } = useAuth();

  // If theme is explicitly light, active mode is light; otherwise dark
  const isLight = theme === 'light';

  const handleToggle = async () => {
    const nextTheme = isLight ? 'dark' : 'light';
    try {
      await setTheme(nextTheme, user?.id);
    } catch (err) {
      console.error('Theme sync error:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 dark:bg-slate-800/80 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 border dark:border-slate-700/60 border-slate-300 shrink-0"
      aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {isLight ? (
        <Moon size={16} className="text-indigo-600 transition-transform hover:-rotate-12" />
      ) : (
        <Sun size={16} className="text-amber-400 transition-transform hover:rotate-45" />
      )}
    </button>
  );
}

import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function PomodoroTimer({
  mode,
  remaining,
  running,
  completed,
  focusMinutes,
  breakMinutes,
  onToggle,
  onReset,
  onSelectMode,
  onApplyTimes
}) {
  const { t } = useThemeLanguage();
  const [focusDraft, setFocusDraft] = useState(String(focusMinutes));
  const [breakDraft, setBreakDraft] = useState(String(breakMinutes));
  useEffect(() => {
    setFocusDraft(String(focusMinutes));
    setBreakDraft(String(breakMinutes));
  }, [breakMinutes, focusMinutes]);

  const applyTimes = (event) => {
    event.preventDefault();
    const parseDuration = (draft, current, maximum) => {
      if (draft.trim() === '' || !Number.isFinite(Number(draft))) return current;
      return Math.min(maximum, Math.max(1, Math.floor(Number(draft))));
    };
    const focus = parseDuration(focusDraft, focusMinutes, 180);
    const rest = parseDuration(breakDraft, breakMinutes, 60);
    onApplyTimes(focus, rest);
    setFocusDraft(String(focus));
    setBreakDraft(String(rest));
  };
  const focusMode = mode === 'focus';

  return <section className={`pomodoro-card ${focusMode ? '' : 'break-mode'}`}>
    <div className="pomodoro-copy"><span className="toolbox-icon">{String(focusMode ? focusMinutes : breakMinutes).padStart(2, '0')}</span><div>
      <div className="eyebrow">{t(focusMode ? 'tbFocusMode' : 'tbBreakMode')}</div>
      <h2>{t(focusMode ? 'tbFocusTitle' : 'tbBreakTitle')}</h2>
      <p>{t(focusMode ? 'tbFocusDescription' : 'tbBreakDescription')}</p>
    </div></div>
    <div className="pomodoro-clock" aria-live="polite" aria-label={`${formatTime(remaining)} ${t('tbTimeRemaining')}`}>{formatTime(remaining)}</div>
    <div className="pomodoro-actions">
      <button type="button" className="button button-gold" onClick={onToggle}>{running ? <><Pause size={15} /> {t('tbPause')}</> : <><Play size={15} /> {t('tbStart')}</>}</button>
      <button type="button" className="button button-outline" onClick={onReset}><RotateCcw size={15} /> {t('tbReset')}</button>
      <button type="button" className={`pomodoro-mode ${focusMode ? 'active' : ''}`} onClick={() => onSelectMode('focus')}>{focusMinutes} {t('tbMinutes')}</button>
      <button type="button" className={`pomodoro-mode ${!focusMode ? 'active' : ''}`} onClick={() => onSelectMode('break')}>{breakMinutes} {t('tbMinutes')}</button>
    </div>
    <form className="pomodoro-duration-form" onSubmit={applyTimes}>
      <label className="field-label">{t('tbFocusLength')}<input className="text-input" type="number" min="1" max="180" value={focusDraft} onChange={(event) => setFocusDraft(event.target.value)} /></label>
      <label className="field-label">{t('tbBreakLength')}<input className="text-input" type="number" min="1" max="60" value={breakDraft} onChange={(event) => setBreakDraft(event.target.value)} /></label>
      <button type="submit" className="button button-outline">{t('tbApplyTimes')}</button>
    </form>
    <div className="pomodoro-completed">{completed} {t('tbCompletedSessions')}</div>
  </section>;
}

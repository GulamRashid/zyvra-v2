import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function PomodoroTimer() {
  const [mode, setMode] = useState('focus');
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || remaining !== 0 || announced.current) return;
    announced.current = true;
    setRunning(false);
    if (mode === 'focus') setCompleted((count) => count + 1);
    const nextMode = mode === 'focus' ? 'break' : 'focus';
    setMode(nextMode);
    setRemaining(nextMode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS);
  }, [mode, remaining, running]);

  const reset = () => {
    setRunning(false);
    announced.current = false;
    setRemaining(mode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS);
  };
  const chooseMode = (nextMode) => {
    setRunning(false);
    announced.current = false;
    setMode(nextMode);
    setRemaining(nextMode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  return <section className={`pomodoro-card ${mode === 'break' ? 'break-mode' : ''}`}>
    <div className="pomodoro-copy"><span className="toolbox-icon">{mode === 'focus' ? '25' : '05'}</span><div><div className="eyebrow">{mode === 'focus' ? 'FOCUS SESSION' : 'REST INTERVAL'}</div><h2>{mode === 'focus' ? 'One thing at a time' : 'Take a mindful break'}</h2><p>{mode === 'focus' ? 'A focused 25-minute sprint, then a short reset.' : 'Recharge for five minutes before your next sprint.'}</p></div></div>
    <div className="pomodoro-clock" aria-live="polite" aria-label={`${formatTime(remaining)} remaining`}>{formatTime(remaining)}</div>
    <div className="pomodoro-actions">
      <button type="button" className="button button-gold" onClick={() => { announced.current = false; setRunning((value) => !value); }}>{running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start</>}</button>
      <button type="button" className="button button-outline" onClick={reset}><RotateCcw size={15} /> Reset</button>
      <button type="button" className={`pomodoro-mode ${mode === 'focus' ? 'active' : ''}`} onClick={() => chooseMode('focus')}>25 min focus</button>
      <button type="button" className={`pomodoro-mode ${mode === 'break' ? 'active' : ''}`} onClick={() => chooseMode('break')}>5 min break</button>
    </div>
    <div className="pomodoro-completed">{completed} focus sessions completed</div>
  </section>;
}

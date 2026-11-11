import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'zyvra-toolbox-daily-targets';
const defaults = [
  { id: 'target-revision', text: 'Revise one topic', done: false },
  { id: 'target-practice', text: 'Solve 20 practice questions', done: false },
  { id: 'target-review', text: 'Review mistakes from today', done: false }
];

function loadTargets() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(stored)
      ? stored.filter((target) => target && typeof target.id === 'string' && typeof target.text === 'string')
        .map((target) => ({ id: target.id, text: target.text, done: target.done === true }))
      : defaults;
  } catch (error) {
    console.error('Unable to read daily targets:', error);
    return defaults;
  }
}

export default function DailyTargets() {
  const [targets, setTargets] = useState(loadTargets);
  const [newTarget, setNewTarget] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
      setSaveError('');
    } catch (error) {
      console.error('Unable to save daily targets:', error);
      setSaveError('Targets could not be saved in this browser.');
    }
  }, [targets]);

  const addTarget = (event) => {
    event.preventDefault();
    const text = newTarget.trim();
    if (!text) return;
    setTargets((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false }]);
    setNewTarget('');
  };

  return <section className="toolbox-section mini-tool daily-targets-tool">
    <div className="section-heading"><div><div className="eyebrow">SMALL STEPS, STRONG RESULTS</div><h3>Today’s study targets</h3></div><span className="chapter-item-count">{targets.filter((target) => target.done).length}/{targets.length} done</span></div>
    <form className="daily-target-add" onSubmit={addTarget}><input className="text-input" value={newTarget} onChange={(event) => setNewTarget(event.target.value)} placeholder="Add a study target…" aria-label="New study target" /><button className="button button-gold" type="submit" disabled={!newTarget.trim()}><Plus size={16} /> Add</button></form>
    <ul className="daily-target-list">{targets.map((target) => <li className={target.done ? 'completed' : ''} key={target.id}>
      <button type="button" className="target-check" aria-label={`${target.done ? 'Mark incomplete' : 'Complete'}: ${target.text}`} aria-pressed={target.done} onClick={() => setTargets((current) => current.map((item) => item.id === target.id ? { ...item, done: !item.done } : item))}>{target.done && <Check size={15} />}</button>
      <span>{target.text}</span>
      <button type="button" className="icon-button target-delete" aria-label={`Remove ${target.text}`} onClick={() => setTargets((current) => current.filter((item) => item.id !== target.id))}><Trash2 size={15} /></button>
    </li>)}</ul>
    {saveError && <p className="field-hint">{saveError}</p>}
  </section>;
}

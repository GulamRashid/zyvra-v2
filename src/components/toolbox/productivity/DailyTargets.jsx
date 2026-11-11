import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const STORAGE_KEY = 'zyvra-toolbox-daily-targets';
const defaults = [
  { id: 'target-revision', text: '', defaultKey: 'tbDefaultRevision', done: false },
  { id: 'target-practice', text: '', defaultKey: 'tbDefaultPractice', done: false },
  { id: 'target-review', text: '', defaultKey: 'tbDefaultReview', done: false }
];
const defaultKeys = Object.fromEntries(defaults.map((target) => [target.id, target.defaultKey]));

function loadTargets() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { targets: defaults, error: false };
    const stored = JSON.parse(saved);
    return Array.isArray(stored)
      ? {
        targets: stored.filter((target) => target && typeof target.id === 'string' && typeof target.text === 'string')
        .map((target) => {
          const defaultKey = target.defaultKey || defaultKeys[target.id];
          return { id: target.id, text: defaultKey ? '' : target.text, defaultKey, done: target.done === true };
        }),
        error: false
      }
      : { targets: defaults, error: true };
  } catch (error) {
    console.error('Unable to read daily targets:', error);
    return { targets: defaults, error: true };
  }
}

export default function DailyTargets() {
  const { t } = useThemeLanguage();
  const [initial] = useState(loadTargets);
  const [targets, setTargets] = useState(initial.targets);
  const [dirty, setDirty] = useState(false);
  const [newTarget, setNewTarget] = useState('');
  const [saveError, setSaveError] = useState(initial.error ? 'tbTargetsSaveError' : '');

  useEffect(() => {
    if (!dirty) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
      setSaveError('');
    } catch (error) {
      console.error('Unable to save daily targets:', error);
      setSaveError('tbTargetsSaveError');
    }
  }, [dirty, targets, t]);

  const updateTargets = (updater) => {
    setDirty(true);
    setTargets(updater);
  };

  const addTarget = (event) => {
    event.preventDefault();
    const text = newTarget.trim();
    if (!text) return;
    updateTargets((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false }]);
    setNewTarget('');
  };

  return <section className="toolbox-section mini-tool daily-targets-tool">
    <div className="section-heading"><div><div className="eyebrow">{t('tbDailyEyebrow')}</div><h3>{t('tbTodayTargets')}</h3></div><span className="chapter-item-count">{targets.filter((target) => target.done).length}/{targets.length} {t('tbDone')}</span></div>
    <form className="daily-target-add" onSubmit={addTarget}><input className="text-input" value={newTarget} onChange={(event) => setNewTarget(event.target.value)} placeholder={t('tbAddTargetPlaceholder')} aria-label={t('tbNewTarget')} /><button className="button button-gold" type="submit" disabled={!newTarget.trim()}><Plus size={16} /> {t('tbAdd')}</button></form>
    <ul className="daily-target-list">{targets.map((target) => <li className={target.done ? 'completed' : ''} key={target.id}>
      <button type="button" className="target-check" aria-label={`${target.done ? t('tbMarkIncomplete') : t('tbComplete')}: ${target.defaultKey ? t(target.defaultKey) : target.text}`} aria-pressed={target.done} onClick={() => updateTargets((current) => current.map((item) => item.id === target.id ? { ...item, done: !item.done } : item))}>{target.done && <Check size={15} />}</button>
      <span>{target.defaultKey ? t(target.defaultKey) : target.text}</span>
      <button type="button" className="icon-button target-delete" aria-label={`${t('tbRemove')} ${target.defaultKey ? t(target.defaultKey) : target.text}`} onClick={() => updateTargets((current) => current.filter((item) => item.id !== target.id))}><Trash2 size={15} /></button>
    </li>)}</ul>
    {saveError && <p className="field-hint">{t(saveError)}</p>}
  </section>;
}

import { useState } from 'react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const directions = [
  ['N', 'tbNorth', 0], ['NE', 'tbNorthEast', 45], ['E', 'tbEast', 90], ['SE', 'tbSouthEast', 135],
  ['S', 'tbSouth', 180], ['SW', 'tbSouthWest', 225], ['W', 'tbWest', 270], ['NW', 'tbNorthWest', 315]
];

export default function DirectionCompass() {
  const { t } = useThemeLanguage();
  const [selected, setSelected] = useState(directions[0]);
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbDirectionEyebrow')}</div><h3>{t('tbCompassTitle')}</h3></div>
    <div className="compass-layout">
      <div className="direction-compass" role="group" aria-label={t('tbCompassAria')}>
        {directions.map((direction) => {
          const [short, label, angle] = direction;
          return <button type="button" className={`compass-point ${short.toLowerCase()} ${selected[0] === short ? 'selected' : ''}`} key={short} title={`${t(label)}, ${angle}°`} aria-pressed={selected[0] === short} onClick={() => setSelected(direction)}>
            <strong>{short}</strong><small>{angle}°</small>
          </button>;
        })}
        <span className="compass-center"><i className="compass-needle" style={{ transform: `rotate(${selected[2]}deg)` }} /><strong>{selected[0]}</strong></span>
      </div>
      <div className="direction-selection" aria-live="polite">
        <span>{t(selected[1])}</span><strong>{selected[2]}°</strong>
        <p>{t('tbCompassRule')}</p>
      </div>
      <div className="direction-list">{directions.map(([short, label, angle]) => <button type="button" key={short} aria-pressed={selected[0] === short} onClick={() => setSelected([short, label, angle])}><strong>{short}</strong><span>{t(label)}</span><small>{angle}°</small></button>)}</div>
    </div>
  </section>;
}

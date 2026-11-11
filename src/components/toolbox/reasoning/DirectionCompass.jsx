const directions = [
  ['N', 'North', '0°'], ['NE', 'North-east', '45°'], ['E', 'East', '90°'], ['SE', 'South-east', '135°'],
  ['S', 'South', '180°'], ['SW', 'South-west', '225°'], ['W', 'West', '270°'], ['NW', 'North-west', '315°']
];

export default function DirectionCompass() {
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">DIRECTION SENSE</div><h3>Compass & angles</h3></div>
    <div className="compass-layout">
      <div className="direction-compass" role="img" aria-label="Compass showing eight directions and angles">
        {directions.map(([short, name, angle]) => <span className={`compass-point ${short.toLowerCase()}`} key={short} title={`${name}, ${angle}`}><strong>{short}</strong><small>{angle}</small></span>)}
        <span className="compass-center">N</span>
      </div>
      <div className="direction-list">{directions.map(([short, name, angle]) => <div key={short}><strong>{short}</strong><span>{name}</span><small>{angle}</small></div>)}</div>
    </div>
    <p className="field-hint">Angles are measured clockwise from North. Each neighbouring principal/inter-cardinal direction differs by 45°.</p>
  </section>;
}

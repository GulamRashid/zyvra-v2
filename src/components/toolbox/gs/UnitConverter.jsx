import { useMemo, useState } from 'react';

const conversionOptions = {
  length: [
    { id: 'km-mi', from: 'Kilometres (km)', to: 'Miles (mi)', convert: (value) => value * 0.621371 },
    { id: 'mi-km', from: 'Miles (mi)', to: 'Kilometres (km)', convert: (value) => value / 0.621371 }
  ],
  temperature: [
    { id: 'c-f', from: 'Celsius (°C)', to: 'Fahrenheit (°F)', convert: (value) => value * 9 / 5 + 32 },
    { id: 'f-c', from: 'Fahrenheit (°F)', to: 'Celsius (°C)', convert: (value) => (value - 32) * 5 / 9 }
  ],
  land: [
    { id: 'ha-ac', from: 'Hectares (ha)', to: 'Acres (ac)', convert: (value) => value * 2.4710538147 },
    { id: 'ac-ha', from: 'Acres (ac)', to: 'Hectares (ha)', convert: (value) => value / 2.4710538147 }
  ]
};

export default function UnitConverter() {
  const [category, setCategory] = useState('length');
  const [conversionId, setConversionId] = useState('km-mi');
  const [input, setInput] = useState('1');
  const options = conversionOptions[category] || [];
  const selected = options.find((option) => option.id === conversionId) || options[0];
  const output = useMemo(() => {
    const value = Number(input);
    if (!selected || input.trim() === '' || !Number.isFinite(value)) return '';
    return Number(selected.convert(value).toFixed(6)).toString();
  }, [input, selected]);

  const changeCategory = (event) => {
    const nextCategory = event.target.value;
    setCategory(nextCategory);
    setConversionId(conversionOptions[nextCategory]?.[0]?.id || '');
  };

  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">QUICK CONVERSIONS</div><h3>Exam unit converter</h3></div>
    <div className="unit-converter-controls">
      <label className="field-label">Measurement
        <select className="text-input" value={category} onChange={changeCategory}>
          <option value="length">Length</option><option value="temperature">Temperature</option><option value="land">Land area</option>
        </select>
      </label>
      <label className="field-label">Direction
        <select className="text-input" value={selected?.id || ''} onChange={(event) => setConversionId(event.target.value)}>
          {options.map((option) => <option value={option.id} key={option.id}>{option.from} → {option.to}</option>)}
        </select>
      </label>
      <label className="field-label">Value ({selected?.from || ''})
        <input className="text-input" type="number" step="any" inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} />
      </label>
    </div>
    <div className="unit-converter-result" aria-live="polite"><strong>{output || '—'}</strong><span>{selected?.to || ''}</span></div>
    {category === 'land' && <p className="field-hint">Reference: 1 hectare ≈ 2.47105 acres. Local land-unit definitions may vary.</p>}
  </section>;
}

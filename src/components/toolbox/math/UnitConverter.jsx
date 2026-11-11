import { useMemo, useState } from 'react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const units = {
  length: { km: 1000, m: 1, cm: 0.01, mm: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048 },
  mass: { tonne: 1000, kg: 1, gram: 0.001, mg: 0.000001, pound: 0.45359237 },
  area: { km2: 1_000_000, hectare: 10_000, acre: 4046.8564224, m2: 1, ft2: 0.09290304 },
  volume: { m3: 1000, litre: 1, ml: 0.001, gallon: 3.785411784, cm3: 0.001 },
  time: { day: 86400, hour: 3600, minute: 60, second: 1 },
  speed: { kmh: 1, ms: 3.6, mph: 1.609344 }
};

const unitNames = {
  length: { km: ['tbKilometres', 'km'], m: ['tbMetres', 'm'], cm: ['tbCentimetres', 'cm'], mm: ['tbMillimetres', 'mm'], mile: ['tbMiles', 'mi'], yard: ['tbYards', 'yd'], foot: ['tbFeet', 'ft'] },
  mass: { tonne: ['tbTonnes', 't'], kg: ['tbKilograms', 'kg'], gram: ['tbGrams', 'g'], mg: ['tbMilligrams', 'mg'], pound: ['tbPounds', 'lb'] },
  area: { km2: ['tbSquareKilometres', 'km²'], hectare: ['tbHectares', 'ha'], acre: ['tbAcres', 'ac'], m2: ['tbSquareMetres', 'm²'], ft2: ['tbSquareFeet', 'ft²'] },
  volume: { m3: ['tbCubicMetres', 'm³'], litre: ['tbLitres', 'L'], ml: ['tbMillilitres', 'mL'], gallon: ['tbGallons', 'gal'], cm3: ['tbCubicCentimetres', 'cm³'] },
  time: { day: ['tbDaysUnit', ''], hour: ['tbHours', ''], minute: ['tbMinutesUnit', ''], second: ['tbSeconds', ''] },
  speed: { kmh: ['tbKilometresPerHour', 'km/h'], ms: ['tbMetresPerSecond', 'm/s'], mph: ['tbMilesPerHour', 'mph'] },
  temperature: { c: ['tbCelsius', '°C'], f: ['tbFahrenheit', '°F'], k: ['tbKelvin', 'K'] }
};

function convertTemperature(value, from, to) {
  const celsius = from === 'c' ? value : from === 'f' ? (value - 32) * 5 / 9 : value - 273.15;
  return to === 'c' ? celsius : to === 'f' ? celsius * 9 / 5 + 32 : celsius + 273.15;
}

export default function UnitConverter() {
  const { t } = useThemeLanguage();
  const [category, setCategory] = useState('length');
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('mile');
  const [input, setInput] = useState('1');
  const categoryUnits = Object.fromEntries(Object.entries(unitNames[category]).map(([id, [nameKey, symbol]]) => [
    id,
    `${t(nameKey)}${symbol ? ` (${symbol})` : ''}`
  ]));
  const output = useMemo(() => {
    const value = Number(input);
    if (input.trim() === '' || !Number.isFinite(value)) return '';
    const result = category === 'temperature'
      ? convertTemperature(value, from, to)
      : (value * units[category][from]) / units[category][to];
    return Number.isFinite(result) ? Number(result.toPrecision(10)).toString() : '';
  }, [category, from, input, to]);

  const changeCategory = (event) => {
    const next = event.target.value;
    setCategory(next);
    if (next === 'temperature') {
      setFrom('c');
      setTo('f');
    } else {
      const keys = Object.keys(units[next]);
      setFrom(keys[0]);
      setTo(keys[1] || keys[0]);
    }
  };

  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbUnitEyebrow')}</div><h3>{t('tbUnitTitle')}</h3></div>
    <div className="unit-converter-controls">
      <label className="field-label">{t('tbMeasurement')}
        <select className="text-input" value={category} onChange={changeCategory}>
          {['length', 'mass', 'area', 'volume', 'time', 'speed', 'temperature'].map((name) => <option value={name} key={name}>{t(`tb${name[0].toUpperCase()}${name.slice(1)}`)}</option>)}
        </select>
      </label>
      <label className="field-label">{t('tbConversion')}
        <select className="text-input" value={from} onChange={(event) => setFrom(event.target.value)}>
          {Object.entries(categoryUnits).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select>
      </label>
      <label className="field-label">{t('tbValue')}
        <input className="text-input" type="number" step="any" inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} />
      </label>
      <label className="field-label">{t('tbResult')}
        <select className="text-input" value={to} onChange={(event) => setTo(event.target.value)}>
          {Object.entries(categoryUnits).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className="unit-converter-result" aria-live="polite"><strong>{output || '—'}</strong><span>{categoryUnits?.[to] || ''}</span></div>
    {category === 'area' && <p className="field-hint">{t('tbHectareNote')}</p>}
  </section>;
}

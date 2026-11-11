import { useMemo, useState } from 'react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const standardOpposites = [['1', '6'], ['2', '5'], ['3', '4']];
const viewSlots = ['tbFaceTop', 'tbFaceFront', 'tbFaceRight'];

function getOppositePair(first, second) {
  const a = first.map((face) => face.trim()).filter(Boolean);
  const b = second.map((face) => face.trim()).filter(Boolean);
  if ([...a, ...b].some((face) => face.length > 12) || new Set(a).size !== 3 || new Set(b).size !== 3) return null;
  const sharedA = a.filter((face) => b.includes(face));
  const sharedB = b.filter((face) => a.includes(face));
  if (sharedA.length !== 2 || sharedB.length !== 2) return null;
  if (sharedA[0] === sharedB[0]) return { sameOrder: true };
  return { pair: [a.find((face) => !b.includes(face)), b.find((face) => !a.includes(face))] };
}

export default function DiceRules() {
  const { t } = useThemeLanguage();
  const [first, setFirst] = useState(['', '', '']);
  const [second, setSecond] = useState(['', '', '']);
  const result = useMemo(() => getOppositePair(first, second), [first, second]);
  const updateFace = (setFaces, index, value) => setFaces((faces) => faces.map((face, position) => position === index ? value : face));
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbDiceEyebrow')}</div><h3>{t('tbDiceTitle')}</h3></div>
    <div className="dice-rules-grid">
      <article className="toolbox-formula-card"><strong>{t('tbStandardDie')}</strong><p>{t('tbStandardDiceRule')}</p><div className="dice-opposites">{standardOpposites.map(([a, b]) => <span key={a}>{a}<b>↔</b>{b}</span>)}</div></article>
      <article className="toolbox-formula-card"><strong>{t('tbGeneralDice')}</strong><ul><li>{t('tbGeneralRule1')}</li><li>{t('tbGeneralRule2')}</li><li>{t('tbGeneralRule3')}</li></ul></article>
      <article className="toolbox-formula-card"><strong>{t('tbNoFixedDie')}</strong><p>{t('tbNoFixedDieDesc')}</p></article>
    </div>
    <div className="dice-view-comparison">
      {[first, second].map((faces, viewIndex) => <fieldset className="dice-view-card" key={viewIndex}>
        <legend>{t(viewIndex === 0 ? 'tbViewOne' : 'tbViewTwo')}</legend>
        <div className="dice-view-inputs">{faces.map((face, index) => <label className="field-label" key={viewSlots[index]}>{t(viewSlots[index])}
          <input className="text-input" maxLength={12} value={face} onChange={(event) => updateFace(viewIndex === 0 ? setFirst : setSecond, index, event.target.value)} />
        </label>)}</div>
      </fieldset>)}
      <div className="dice-opposite-output" aria-live="polite">
        <strong>{result?.pair ? t('tbOppositeResult') : result?.sameOrder ? t('tbSharedOrderNotReversed') : t('tbNeedSharedFaces')}</strong>
        {result?.pair && <span>{result.pair[0]} <b>↔</b> {result.pair[1]}</span>}
        <small>{t('tbOppositeCaveat')}</small>
      </div>
    </div>
  </section>;
}

import { useEffect, useState } from 'react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import { loadKatex } from '../../../lib/loadKatex';

const groups = [
  {
    key: 'tbAlgebra',
    formulas: [
      ['tbSquareSum', '(a+b)^2 = a^2 + 2ab + b^2'],
      ['tbSquareDifference', '(a-b)^2 = a^2 - 2ab + b^2'],
      ['tbDifferenceSquares', 'a^2-b^2 = (a-b)(a+b)'],
      ['tbSumCubes', 'a^3+b^3 = (a+b)(a^2-ab+b^2)'],
      ['tbDifferenceCubes', 'a^3-b^3 = (a-b)(a^2+ab+b^2)'],
      ['tbCubeSum', '(a+b)^3 = a^3+3a^2b+3ab^2+b^3']
    ]
  },
  {
    key: 'tbMensuration2D',
    formulas: [
      ['tbCircleArea', 'A = \\pi r^2'],
      ['tbCircleCircumference', 'C = 2\\pi r'],
      ['tbTriangleArea', 'A = \\frac{1}{2}bh'],
      ['tbRectangleArea', 'A = lw'],
      ['tbParallelogramArea', 'A = bh'],
      ['tbTrapeziumArea', 'A = \\frac{1}{2}(a+b)h']
    ]
  },
  {
    key: 'tbMensuration3D',
    formulas: [
      ['tbCuboidVolume', 'V = lwh'],
      ['tbCuboidSurface', 'TSA = 2(lw+wh+hl)'],
      ['tbCubeVolume', 'V = a^3'],
      ['tbSphereVolume', 'V = \\frac{4}{3}\\pi r^3'],
      ['tbSphereSurface', 'SA = 4\\pi r^2'],
      ['tbCylinderVolume', 'V = \\pi r^2h'],
      ['tbCylinderCurved', 'CSA = 2\\pi rh'],
      ['tbConeVolume', 'V = \\frac{1}{3}\\pi r^2h'],
      ['tbConeSlant', 'l = \\sqrt{r^2+h^2}']
    ]
  },
  {
    key: 'tbTrigonometry',
    formulas: [
      ['tbPythagorean', '\\sin^2\\theta + \\cos^2\\theta = 1'],
      ['tbTangentIdentity', '1 + \\tan^2\\theta = \\sec^2\\theta'],
      ['tbCotangentIdentity', '1 + \\cot^2\\theta = \\csc^2\\theta'],
      ['tbComplementary', '\\sin(90^\\circ-\\theta) = \\cos\\theta']
    ]
  }
];

const trigValues = [
  ['0°', '0', '1', '0'],
  ['30°', '\\frac{1}{2}', '\\frac{\\sqrt{3}}{2}', '\\frac{1}{\\sqrt{3}}'],
  ['45°', '\\frac{1}{\\sqrt{2}}', '\\frac{1}{\\sqrt{2}}', '1'],
  ['60°', '\\frac{\\sqrt{3}}{2}', '\\frac{1}{2}', '\\sqrt{3}'],
  ['90°', '1', '0', null]
];

function MathMarkup({ formula, katex }) {
  if (!katex) return <span className="formula-hub-math">{formula}</span>;
  let html;
  try {
    html = katex.renderToString(formula, { throwOnError: false });
  } catch {
    html = null;
  }
  return html
    ? <span className="formula-hub-math" dangerouslySetInnerHTML={{ __html: html }} />
    : <span className="formula-hub-math">{formula}</span>;
}

export default function MathFormulaHub() {
  const { t } = useThemeLanguage();
  const [katex, setKatex] = useState(null);

  useEffect(() => {
    let active = true;
    loadKatex()
      .then((loadedKatex) => {
        if (active) setKatex(() => loadedKatex);
      })
      .catch((error) => {
        console.error('[MathFormulaHub] Unable to load KaTeX:', error);
      });
    return () => { active = false; };
  }, []);

  return <div className="formula-hub">
    {groups.map((group) => <details className="toolbox-section mini-tool formula-hub-group" key={group.key}>
      <summary><h3>{t(group.key)}</h3></summary>
      <div className="toolbox-formula-grid">
        {group.formulas.map(([name, formula]) => <article className="toolbox-formula-card" key={name}>
          <strong>{t(name)}</strong><MathMarkup formula={formula} katex={katex} />
        </article>)}
      </div>
    </details>)}
    <section className="toolbox-section mini-tool">
      <h3>{t('tbStandardAngleTable')}</h3>
      <div className="trig-table-scroll">
        <table className="square-reference-table trig-table">
          <thead><tr><th>{t('tbAngle')}</th><th>{t('tbSine')}</th><th>{t('tbCosine')}</th><th>{t('tbTangent')}</th></tr></thead>
          <tbody>{trigValues.map(([angle, sin, cos, tan]) => <tr key={angle}>
            <th>{angle}</th><td><MathMarkup formula={sin} katex={katex} /></td><td><MathMarkup formula={cos} katex={katex} /></td><td>{tan ? <MathMarkup formula={tan} katex={katex} /> : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

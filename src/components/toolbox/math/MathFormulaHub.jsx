import katex from 'katex';
import 'katex/dist/katex.min.css';

const groups = [
  {
    title: 'Algebraic identities',
    formulas: [
      ['Square of a sum', '(a+b)^2 = a^2 + 2ab + b^2'],
      ['Square of a difference', '(a-b)^2 = a^2 - 2ab + b^2'],
      ['Difference of squares', 'a^2-b^2 = (a-b)(a+b)'],
      ['Sum of cubes', 'a^3+b^3 = (a+b)(a^2-ab+b^2)'],
      ['Difference of cubes', 'a^3-b^3 = (a-b)(a^2+ab+b^2)'],
      ['Cube of a sum', '(a+b)^3 = a^3+3a^2b+3ab^2+b^3']
    ]
  },
  {
    title: 'Mensuration',
    formulas: [
      ['Circle area', 'A = \\pi r^2'],
      ['Circle circumference', 'C = 2\\pi r'],
      ['Sphere volume', 'V = \\frac{4}{3}\\pi r^3'],
      ['Sphere surface area', 'SA = 4\\pi r^2'],
      ['Cylinder volume', 'V = \\pi r^2h'],
      ['Cylinder curved surface area', 'CSA = 2\\pi rh'],
      ['Cone volume', 'V = \\frac{1}{3}\\pi r^2h'],
      ['Cone slant height', 'l = \\sqrt{r^2+h^2}'],
      ['Cuboid volume', 'V = lwh'],
      ['Cuboid total surface area', 'TSA = 2(lw+wh+hl)'],
      ['Rectangle area', 'A = l \\times w'],
      ['Triangle area', 'A = \\frac{1}{2}bh']
    ]
  },
  {
    title: 'Trigonometric identities',
    formulas: [
      ['Pythagorean identity', '\\sin^2\\theta + \\cos^2\\theta = 1'],
      ['Tangent identity', '1 + \\tan^2\\theta = \\sec^2\\theta'],
      ['Cotangent identity', '1 + \\cot^2\\theta = \\csc^2\\theta'],
      ['Complementary angles', '\\sin(90^\\circ-\\theta) = \\cos\\theta']
    ]
  }
];

const trigValues = [
  ['0°', '0', '1', '0'],
  ['30°', '\\frac{1}{2}', '\\frac{\\sqrt{3}}{2}', '\\frac{1}{\\sqrt{3}}'],
  ['45°', '\\frac{1}{\\sqrt{2}}', '\\frac{1}{\\sqrt{2}}', '1'],
  ['60°', '\\frac{\\sqrt{3}}{2}', '\\frac{1}{2}', '\\sqrt{3}'],
  ['90°', '1', '0', 'Undefined']
];

function MathMarkup({ formula }) {
  const html = katex.renderToString(formula, { throwOnError: false });
  return <span className="formula-hub-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function MathFormulaHub() {
  return <div className="formula-hub">
    {groups.map((group) => <section className="toolbox-section mini-tool" key={group.title}>
      <h3>{group.title}</h3>
      <div className="toolbox-formula-grid">
        {group.formulas.map(([name, formula]) => <article className="toolbox-formula-card" key={name}>
          <strong>{name}</strong><MathMarkup formula={formula} />
        </article>)}
      </div>
    </section>)}
    <section className="toolbox-section mini-tool">
      <h3>Standard angle table</h3>
      <div className="trig-table-scroll">
        <table className="square-reference-table trig-table">
          <thead><tr><th>Angle</th><th>sin θ</th><th>cos θ</th><th>tan θ</th></tr></thead>
          <tbody>{trigValues.map(([angle, sin, cos, tan]) => <tr key={angle}>
            <th>{angle}</th><td><MathMarkup formula={sin} /></td><td><MathMarkup formula={cos} /></td><td>{tan === 'Undefined' ? tan : <MathMarkup formula={tan} />}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

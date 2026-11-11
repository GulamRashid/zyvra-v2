import katex from 'katex';
import 'katex/dist/katex.min.css';

const formulaGroups = [
  {
    title: 'Areas & Perimeters',
    formulas: [
      ['Rectangle area', 'A = l \\times w'],
      ['Rectangle perimeter', 'P = 2(l + w)'],
      ['Triangle area', 'A = \\frac{1}{2}bh'],
      ['Circle area', 'A = \\pi r^2'],
      ['Circle circumference', 'C = 2\\pi r']
    ]
  },
  {
    title: 'Surface Areas & Volumes',
    formulas: [
      ['Cuboid volume', 'V = lwh'],
      ['Cuboid surface area', 'SA = 2(lw + wh + hl)'],
      ['Cube volume', 'V = a^3'],
      ['Sphere volume', 'V = \\frac{4}{3}\\pi r^3'],
      ['Sphere surface area', 'SA = 4\\pi r^2'],
      ['Cylinder volume', 'V = \\pi r^2h'],
      ['Cone volume', 'V = \\frac{1}{3}\\pi r^2h']
    ]
  }
];

function Formula({ formula }) {
  const html = katex.renderToString(formula, { throwOnError: false });
  return <span className="formula-hub-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function FormulaHub() {
  return <div className="formula-hub">
    {formulaGroups.map((group) => <section className="toolbox-section mini-tool" key={group.title}>
      <h3>{group.title}</h3>
      <div className="toolbox-formula-grid">
        {group.formulas.map(([name, formula]) => <article className="toolbox-formula-card" key={name}>
          <strong>{name}</strong><Formula formula={formula} />
        </article>)}
      </div>
    </section>)}
  </div>;
}

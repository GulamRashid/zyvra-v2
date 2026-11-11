function PersonSymbol({ shape, label, description }) {
  return <article className="blood-relation-symbol">
    <span className={`kinship-shape ${shape}`} aria-hidden="true" />
    <strong>{label}</strong><small>{description}</small>
  </article>;
}

export default function BloodRelations() {
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">FAMILY TREE NOTATION</div><h3>Blood relation symbols</h3></div>
    <div className="blood-relations-grid">
      <PersonSymbol shape="male" label="Male" description="Square represents a male person." />
      <PersonSymbol shape="female" label="Female" description="Circle represents a female person." />
      <article className="blood-relation-symbol"><span className="kinship-link sibling" aria-hidden="true"><i /><i /></span><strong>Sibling</strong><small>Horizontal connector joins people of the same generation.</small></article>
      <article className="blood-relation-symbol"><span className="kinship-link generation" aria-hidden="true"><i /><i /></span><strong>Parent / child</strong><small>Vertical connector shows a generation gap.</small></article>
    </div>
    <div className="blood-relation-example" aria-label="Example family tree">
      <div className="family-row"><span className="kinship-shape male" /><span className="kinship-shape female" /></div>
      <span className="family-vertical" />
      <span className="family-horizontal" />
      <div className="family-row children"><span className="kinship-shape male" /><span className="kinship-shape female" /></div>
      <p>Two parents and their children (same generation).</p>
    </div>
  </section>;
}

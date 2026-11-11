const standardOpposites = [['1', '6'], ['2', '5'], ['3', '4']];

export default function DiceRules() {
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">NON-VERBAL REASONING</div><h3>Dice rules & opposite faces</h3></div>
    <div className="dice-rules-grid">
      <article className="toolbox-formula-card"><strong>Standard die</strong><p>A standard die has opposite pairs 1–6, 2–5 and 3–4. Opposite faces add up to 7.</p><div className="dice-opposites">{standardOpposites.map(([a, b]) => <span key={a}>{a}<b>↔</b>{b}</span>)}</div></article>
      <article className="toolbox-formula-card"><strong>General dice questions</strong><ul><li>When two views show a common face in the same position, the other visible faces can be compared.</li><li>If two views share two faces, keep their relative order; the remaining faces are opposite.</li><li>A face opposite another face never appears adjacent to it in a valid view.</li></ul></article>
      <article className="toolbox-formula-card"><strong>Do not assume standard numbering</strong><p>In a general die, use only the orientations provided in the question. Opposite faces are deduced from common-face positions, not from a fixed sum.</p></article>
    </div>
  </section>;
}

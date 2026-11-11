const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function AlphabetPositions() {
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">CODING & DECODING</div><h3>Alphabet positions & reverse pairs</h3></div>
    <div className="alphabet-grid">
      {alphabet.map((letter, index) => <article className="alphabet-cell" key={letter}>
        <strong>{letter}</strong><span>Position {index + 1}</span><small>Reverse pair: {alphabet[25 - index]} ({26 - index})</small>
      </article>)}
    </div>
    <p className="field-hint">Forward positions count from A = 1 to Z = 26. Reverse pairs always add to 27 (A–Z, B–Y, C–X …).</p>
  </section>;
}

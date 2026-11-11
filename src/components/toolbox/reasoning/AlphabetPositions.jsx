import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function AlphabetPositions() {
  const { t } = useThemeLanguage();
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbAlphabetEyebrow')}</div><h3>{t('tbAlphabetTitle')}</h3></div>
    <div className="alphabet-grid">
      {alphabet.map((letter, index) => <article className="alphabet-cell" key={letter}>
        <strong>{letter}</strong><span>{t('tbPosition')} {index + 1}</span><small>{t('tbReversePair')}: {alphabet[25 - index]} ({26 - index})</small>
      </article>)}
    </div>
    <p className="field-hint">{t('tbAlphabetRule')}</p>
  </section>;
}

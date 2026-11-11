import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const articles = [
  ['14', 'tbArticle14Title', 'tbArticle14Detail', 'tbPartIII'],
  ['15', 'tbArticle15Title', 'tbArticle15Detail', 'tbPartIII'],
  ['16', 'tbArticle16Title', 'tbArticle16Detail', 'tbPartIII'],
  ['17', 'tbArticle17Title', 'tbArticle17Detail', 'tbPartIII'],
  ['19', 'tbArticle19Title', 'tbArticle19Detail', 'tbPartIII'],
  ['21', 'tbArticle21Title', 'tbArticle21Detail', 'tbPartIII'],
  ['21A', 'tbArticle21ATitle', 'tbArticle21ADetail', 'tbPartIII'],
  ['32', 'tbArticle32Title', 'tbArticle32Detail', 'tbPartIII'],
  ['40', 'tbArticle40Title', 'tbArticle40Detail', 'tbPartIV'],
  ['44', 'tbArticle44Title', 'tbArticle44Detail', 'tbPartIV'],
  ['51A', 'tbArticle51ATitle', 'tbArticle51ADetail', 'tbPartIVA'],
  ['72', 'tbArticle72Title', 'tbArticle72Detail', 'tbPartV'],
  ['110', 'tbArticle110Title', 'tbArticle110Detail', 'tbPartV'],
  ['123', 'tbArticle123Title', 'tbArticle123Detail', 'tbPartV'],
  ['148', 'tbArticle148Title', 'tbArticle148Detail', 'tbPartV'],
  ['280', 'tbArticle280Title', 'tbArticle280Detail', 'tbPartXII'],
  ['324', 'tbArticle324Title', 'tbArticle324Detail', 'tbPartXV'],
  ['352', 'tbArticle352Title', 'tbArticle352Detail', 'tbPartXVIII'],
  ['356', 'tbArticle356Title', 'tbArticle356Detail', 'tbPartXVIII'],
  ['360', 'tbArticle360Title', 'tbArticle360Detail', 'tbPartXVIII']
];

const schedules = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  return [number, `tbSchedule${number}Title`];
});

export default function ConstitutionArticles() {
  const { t } = useThemeLanguage();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return articles.filter(([number, title, detail, part]) =>
      !term || `${number} ${t(title)} ${t(detail)} ${t(part)}`.toLocaleLowerCase().includes(term));
  }, [query, t]);

  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbIndianPolity')}</div><h3>{t('tbFrequentlyAsked')}</h3></div>
    <label className="constitution-search"><Search size={17} /><input className="text-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('tbSearchArticles')} /></label>
    <div className="constitution-article-list" aria-live="polite">
      {results.map(([number, title, detail, part]) => <details className="constitution-article" key={number}>
        <summary><span>{t('tbArticle')} {number}</span><strong>{t(title)}</strong></summary>
        <p>{t(detail)}</p><small>{t('tbPart')} · {t(part)}</small>
      </details>)}
      {!results.length && <div className="empty-content"><strong>{t('tbNoArticles')}</strong><span>{t('tbTryKeyword')}</span></div>}
    </div>
    <details className="constitution-schedules">
      <summary>{t('tbSchedulesOverview')}</summary>
      <div className="constitution-schedule-grid">{schedules.map(([number, title]) => <article key={number}>
        <strong>{t('tbSchedule')} {number}</strong><span>{t(title)}</span>
      </article>)}</div>
    </details>
    <p className="field-hint">{t('tbArticlesDisclaimer')}</p>
  </section>;
}

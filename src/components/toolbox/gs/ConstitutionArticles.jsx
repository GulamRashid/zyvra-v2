import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

const articles = [
  { number: '14', title: 'Equality before law', detail: 'Equality before the law and equal protection of the laws.' },
  { number: '15', title: 'Prohibition of discrimination', detail: 'Prohibits discrimination on specified grounds; permits special provisions for specified groups.' },
  { number: '16', title: 'Equality in public employment', detail: 'Equal opportunity in matters of public employment, subject to constitutional provisions.' },
  { number: '17', title: 'Abolition of untouchability', detail: 'Untouchability is abolished and its practice is forbidden.' },
  { number: '19', title: 'Six freedoms', detail: 'Protects specified freedoms, including speech and expression, subject to reasonable restrictions.' },
  { number: '21', title: 'Life and personal liberty', detail: 'No person shall be deprived of life or personal liberty except according to procedure established by law.' },
  { number: '21A', title: 'Right to education', detail: 'Free and compulsory education for children aged six to fourteen years.' },
  { number: '32', title: 'Constitutional remedies', detail: 'Right to move the Supreme Court for enforcement of Fundamental Rights.' },
  { number: '40', title: 'Organisation of village panchayats', detail: 'Directive Principle encouraging village panchayats as units of self-government.' },
  { number: '44', title: 'Uniform civil code', detail: 'Directive Principle concerning a uniform civil code for citizens.' },
  { number: '51A', title: 'Fundamental duties', detail: 'Lists the fundamental duties of citizens.' },
  { number: '72', title: 'President’s pardoning power', detail: 'Power of the President to grant pardons and related forms of clemency in specified cases.' },
  { number: '110', title: 'Money Bills', detail: 'Defines a Money Bill and its constitutional scope.' },
  { number: '123', title: 'President’s ordinance power', detail: 'Power to promulgate ordinances when Parliament is not in session, subject to constitutional limits.' },
  { number: '148', title: 'Comptroller and Auditor-General', detail: 'Provides for the Comptroller and Auditor-General of India.' },
  { number: '280', title: 'Finance Commission', detail: 'Provides for the Finance Commission and its constitution.' },
  { number: '324', title: 'Election Commission', detail: 'Vests superintendence, direction and control of elections in the Election Commission.' },
  { number: '352', title: 'National Emergency', detail: 'Proclamation of Emergency on grounds specified in the Constitution.' },
  { number: '356', title: 'President’s Rule in States', detail: 'Provisions for failure of constitutional machinery in a State.' },
  { number: '360', title: 'Financial Emergency', detail: 'Provisions for a Financial Emergency.' }
];

export default function ConstitutionArticles() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? articles.filter((article) => `${article.number} ${article.title} ${article.detail}`.toLowerCase().includes(term)) : articles;
  }, [query]);

  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">INDIAN POLITY</div><h3>Frequently asked Constitution articles</h3></div>
    <label className="constitution-search"><Search size={17} /><input className="text-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search article number or topic" /></label>
    <div className="constitution-article-list" aria-live="polite">
      {results.map((article) => <article className="constitution-article" key={article.number}>
        <span>Article {article.number}</span><div><strong>{article.title}</strong><p>{article.detail}</p></div>
      </article>)}
      {!results.length && <div className="empty-content"><strong>No matching articles</strong><span>Try a different number or keyword.</span></div>}
    </div>
    <p className="field-hint">Exam revision notes; refer to the Constitution of India for authoritative wording and amendments.</p>
  </section>;
}

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

function PersonSymbol({ shape, label, description }) {
  return <article className="blood-relation-symbol">
    <span className={`kinship-shape ${shape}`} aria-hidden="true" />
    <strong>{label}</strong><small>{description}</small>
  </article>;
}

export default function BloodRelations() {
  const { t } = useThemeLanguage();
  const [parents, setParents] = useState([{ name: '', gender: 'male' }, { name: '', gender: 'female' }]);
  const [children, setChildren] = useState([{ id: 1, name: '', gender: 'female' }, { id: 2, name: '', gender: 'male' }]);
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState('female');

  const addChild = (event) => {
    event.preventDefault();
    const name = childName.trim();
    if (!name) return;
    setChildren((items) => [...items, { id: `${Date.now()}-${items.length}`, name, gender: childGender }]);
    setChildName('');
  };
  return <section className="toolbox-section mini-tool">
    <div><div className="eyebrow">{t('tbBloodEyebrow')}</div><h3>{t('tbBloodTitle')}</h3></div>
    <div className="blood-relations-grid">
      <PersonSymbol shape="male" label={t('tbMale')} description={t('tbMaleDesc')} />
      <PersonSymbol shape="female" label={t('tbFemale')} description={t('tbFemaleDesc')} />
      <article className="blood-relation-symbol"><span className="kinship-link sibling" aria-hidden="true"><i /><i /></span><strong>{t('tbSibling')}</strong><small>{t('tbSiblingDesc')}</small></article>
      <article className="blood-relation-symbol"><span className="kinship-link generation" aria-hidden="true"><i /><i /></span><strong>{t('tbParentChild')}</strong><small>{t('tbGenerationDesc')}</small></article>
    </div>
    <section className="family-tree-builder">
      <h4>{t('tbFamilyBuilder')}</h4>
      <div className="family-tree-parents">{parents.map((parent, index) => <label className="family-tree-person" key={parent.gender}>
        <span className={`kinship-shape ${parent.gender}`} aria-hidden="true" />
        <span>{t(index === 0 ? 'tbParentOne' : 'tbParentTwo')}</span>
        <input className="text-input" value={parent.name} placeholder={t(index === 0 ? 'tbParentOne' : 'tbParentTwo')} onChange={(event) => setParents((items) => items.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} aria-label={`${t('tbPersonName')} ${index + 1}`} />
      </label>)}</div>
      <span className="family-tree-connector" aria-hidden="true" />
      <div className="family-tree-children">{children.map((child, index) => <article className="family-tree-person" key={child.id}>
        <span className={`kinship-shape ${child.gender}`} aria-hidden="true" />
        <input className="text-input" value={child.name} placeholder={`${t('tbChild')} ${index + 1}`} onChange={(event) => setChildren((items) => items.map((item) => item.id === child.id ? { ...item, name: event.target.value } : item))} aria-label={t('tbPersonName')} />
        <button className="icon-button" type="button" aria-label={`${t('tbRemovePerson')}: ${child.name}`} onClick={() => setChildren((items) => items.filter((item) => item.id !== child.id))}><Trash2 size={15} /></button>
      </article>)}</div>
      <form className="family-tree-add" onSubmit={addChild}>
        <label className="field-label">{t('tbPersonName')}<input className="text-input" value={childName} onChange={(event) => setChildName(event.target.value)} /></label>
        <label className="field-label">{t('tbGender')}<select className="text-input" value={childGender} onChange={(event) => setChildGender(event.target.value)}><option value="female">{t('tbFemale')}</option><option value="male">{t('tbMale')}</option></select></label>
        <button type="submit" className="button button-outline" disabled={!childName.trim()}><Plus size={15} /> {t('tbAddChild')}</button>
      </form>
    </section>
    <section className="blood-relation-explanations">
      <h4>{t('tbRelationExplanations')}</h4>
      {[t('tbMaternalUncle'), t('tbPaternalAunt'), t('tbNieceNephew'), t('tbGrandparent')].map((explanation) => <p key={explanation}>{explanation}</p>)}
    </section>
  </section>;
}

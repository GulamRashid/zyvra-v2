import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';

const STORAGE_KEY = 'zyvra-toolbox-sticky-notes';

function readNotes() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { notes: [], error: '', needsSave: false };
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return { notes: [{ id: `${Date.now()}`, title: '', content: stored, date: new Date().toISOString() }], error: '', needsSave: true };
    }
    if (Array.isArray(parsed)) {
      return {
        notes: parsed.filter((note) => note && typeof note.id === 'string')
          .map((note) => ({ id: note.id, title: String(note.title || ''), content: String(note.content || ''), date: String(note.date || '') })),
        error: '',
        needsSave: false
      };
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return { notes: [{ id: `${Date.now()}`, title: '', content: parsed, date: new Date().toISOString() }], error: '', needsSave: true };
    }
    return { notes: [], error: '', needsSave: false };
  } catch (error) {
    console.error('Unable to read saved Toolbox notes:', error);
    return { notes: [], error: 'read', needsSave: false };
  }
}

export default function StickyNotes() {
  const { t, language } = useThemeLanguage();
  const [initial] = useState(readNotes);
  const [notes, setNotes] = useState(initial.notes);
  const [dirty, setDirty] = useState(initial.needsSave);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saveError, setSaveError] = useState(initial.error ? 'tbNotesSaveError' : '');

  useEffect(() => {
    if (!dirty) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      setSaveError('');
    } catch (error) {
      console.error('Unable to save Toolbox notes:', error);
      setSaveError('tbNotesSaveError');
    }
  }, [dirty, notes, t]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setEditingId(null);
  };
  const saveNote = (event) => {
    event.preventDefault();
    if (!title.trim() && !content.trim()) return;
    const note = { id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: title.trim(), content: content.trim(), date: new Date().toISOString() };
    setDirty(true);
    setNotes((current) => editingId ? current.map((item) => item.id === editingId ? note : item) : [note, ...current]);
    resetForm();
  };
  const editNote = (note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  return <section className="toolbox-section mini-tool sticky-notes-tool">
    <div className="section-heading"><div><div className="eyebrow">{t('tbProductivityEyebrow')}</div><h3><StickyNote size={18} /> {t('tbNotesTitle')}</h3></div><span className="notes-saved"><Check size={14} /> {t('tbNotesLocalOnly')}</span></div>
    <form className="sticky-note-form" onSubmit={saveNote}>
      <label className="field-label">{t('tbNoteTitle')}<input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('tbNotesTitlePlaceholder')} /></label>
      <label className="field-label">{t('tbNoteContent')}<textarea className="sticky-notes-textarea" value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('tbNotesContentPlaceholder')} /></label>
      <div className="sticky-note-actions">
        <button className="button button-gold" type="submit" disabled={!title.trim() && !content.trim()}>{editingId ? t('tbUpdateNote') : <><Plus size={15} /> {t('tbSaveNote')}</>}</button>
        {editingId && <button className="button button-outline" type="button" onClick={resetForm}>{t('tbCancelEdit')}</button>}
      </div>
    </form>
    {saveError && <p className="field-hint" role="alert">{t(saveError)}</p>}
    {notes.length ? <div className="sticky-notes-grid">{notes.map((note) => <article className="sticky-note-card" key={note.id}>
      <div className="sticky-note-card-heading"><strong>{note.title || t('tbNotesTitle')}</strong><time dateTime={note.date}>{note.date ? new Date(note.date).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN') : ''}</time></div>
      <p>{note.content}</p>
      <div className="sticky-note-actions">
        <button className="icon-button" type="button" onClick={() => editNote(note)} aria-label={`${t('tbEditNote')}: ${note.title}`}><Pencil size={15} /></button>
        <button className="icon-button" type="button" onClick={() => { setDirty(true); setNotes((current) => current.filter((item) => item.id !== note.id)); }} aria-label={`${t('tbDeleteNote')}: ${note.title}`}><Trash2 size={15} /></button>
      </div>
    </article>)}</div> : <div className="empty-content">{t('tbNotesEmpty')}</div>}
  </section>;
}

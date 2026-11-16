import { useState } from 'react';
import { Check, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useThemeLanguage } from '../../../context/ThemeLanguageContext';
import useStudentToolboxData from '../../../hooks/useStudentToolboxData';

export default function StickyNotes() {
  const { t, language } = useThemeLanguage();
  const [notes, setNotes, syncState] = useStudentToolboxData('sticky-notes', []);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const saveError = syncState === 'offline' ? 'tbNotesOffline' : '';

  const resetForm = () => {
    setTitle('');
    setContent('');
    setEditingId(null);
  };
  const saveNote = (event) => {
    event.preventDefault();
    if ((!title.trim() && !content.trim()) || (!editingId && notes.length >= 100)) return;
    const note = { id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: title.trim(), content: content.trim(), date: new Date().toISOString() };
    setNotes((current) => editingId ? current.map((item) => item.id === editingId ? note : item) : [note, ...current]);
    resetForm();
  };
  const editNote = (note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  return <section className="toolbox-section mini-tool sticky-notes-tool">
    <div className="section-heading"><div><div className="eyebrow">{t('tbProductivityEyebrow')}</div><h3><StickyNote size={18} /> {t('tbNotesTitle')}</h3></div><span className="notes-saved"><Check size={14} /> {t(syncState === 'syncing' ? 'tbSyncing' : syncState === 'synced' ? 'tbSynced' : 'tbNotesLocalOnly')}</span></div>
    <form className="sticky-note-form" onSubmit={saveNote}>
      <label className="field-label">{t('tbNoteTitle')}<input className="text-input" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('tbNotesTitlePlaceholder')} /></label>
      <label className="field-label">{t('tbNoteContent')}<textarea className="sticky-notes-textarea" maxLength={2000} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('tbNotesContentPlaceholder')} /></label>
      <div className="sticky-note-actions">
        <button className="button button-gold" type="submit" disabled={(!title.trim() && !content.trim()) || (!editingId && notes.length >= 100)}>{editingId ? t('tbUpdateNote') : <><Plus size={15} /> {t('tbSaveNote')}</>}</button>
        {editingId && <button className="button button-outline" type="button" onClick={resetForm}>{t('tbCancelEdit')}</button>}
      </div>
      {!editingId && notes.length >= 100 && <p className="field-hint" role="status">{t('tbNotesLimit')}</p>}
    </form>
    {saveError && <p className="field-hint" role="status">{t(saveError)}</p>}
    {notes.length ? <div className="sticky-notes-grid">{notes.map((note) => <article className="sticky-note-card" key={note.id}>
      <div className="sticky-note-card-heading"><strong>{note.title || t('tbNotesTitle')}</strong><time dateTime={note.date}>{note.date ? new Date(note.date).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN') : ''}</time></div>
      <p>{note.content}</p>
      <div className="sticky-note-actions">
        <button className="icon-button" type="button" onClick={() => editNote(note)} aria-label={`${t('tbEditNote')}: ${note.title}`}><Pencil size={15} /></button>
        <button className="icon-button" type="button" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))} aria-label={`${t('tbDeleteNote')}: ${note.title}`}><Trash2 size={15} /></button>
      </div>
    </article>)}</div> : <div className="empty-content">{t('tbNotesEmpty')}</div>}
  </section>;
}

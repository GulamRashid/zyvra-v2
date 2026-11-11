import { useEffect, useState } from 'react';
import { Check, StickyNote } from 'lucide-react';

const STORAGE_KEY = 'zyvra-toolbox-sticky-notes';

function readNotes() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch (error) {
    console.error('Unable to read saved Toolbox notes:', error);
    return '';
  }
}

export default function StickyNotes() {
  const [notes, setNotes] = useState(readNotes);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, notes);
      setSaveError('');
    } catch (error) {
      console.error('Unable to save Toolbox notes:', error);
      setSaveError('Notes could not be saved in this browser.');
    }
  }, [notes]);

  return <section className="toolbox-section mini-tool sticky-notes-tool">
    <div className="section-heading"><div><div className="eyebrow">YOUR PRIVATE STUDY SPACE</div><h3><StickyNote size={18} /> Digital rough pad</h3></div><span className="notes-saved"><Check size={14} /> {saveError ? 'Not saved' : 'Auto-saved'}</span></div>
    <textarea className="sticky-notes-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Work through a calculation, jot down a reminder, or plan your next revision session…" aria-label="Personal study notes" />
    <p className="field-hint">{saveError || 'Saved on this device only. Notes remain available after you reload this page.'}</p>
  </section>;
}

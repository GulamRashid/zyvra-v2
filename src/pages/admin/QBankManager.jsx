import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, BookOpen, Check, ChevronDown, ChevronUp, FileQuestion, Filter, Plus, Search, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getOptionEntries, validateImportQuestion } from '../../lib/tests';
import useContentCatalog from '../../hooks/useContentCatalog';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const emptyQuestion = {
  question_text: '', question_text_hi: '', options: [{ en: '', hi: '' }, { en: '', hi: '' }, { en: '', hi: '' }, { en: '', hi: '' }],
  correct_answer: 'A', explanation: '', distractor_notes: {}, subject: '', difficulty: 'medium', chapter_id: '', status: 'draft', tags: ''
};
const TEMPLATE = JSON.stringify([{
  question_text: 'Which article guarantees equality before law?',
  question_text_hi: 'कानून के समक्ष समानता किस अनुच्छेद में दी गई है?',
  options: [{ en: 'Article 12', hi: 'अनुच्छेद 12' }, { en: 'Article 14', hi: 'अनुच्छेद 14' }, { en: 'Article 19', hi: 'अनुच्छेद 19' }, { en: 'Article 21', hi: 'अनुच्छेद 21' }],
  correct_answer: 'B',
  explanation: 'Article 14 guarantees equality before law and equal protection of the laws.',
  distractor_notes: { A: 'Defines the State.', C: 'Lists freedoms.', D: 'Protects life and personal liberty.' },
  subject: 'Polity',
  difficulty: 'easy',
  chapter_id: 'replace-with-chapter-uuid',
  tags: ['constitution', 'fundamental-rights']
}], null, 2);

function normalizeQuestion(row) {
  const entries = getOptionEntries(row.options);
  return {
    ...row,
    question_text: typeof row.question_text === 'string' ? row.question_text : row.question_text?.en || '',
    question_text_hi: row.question_text_hi || row.question_text?.hi || '',
    options: entries.length ? entries.map(([, option]) => typeof option === 'string' ? { en: option, hi: '' } : { en: option?.en || option?.text || '', hi: option?.hi || '' }) : emptyQuestion.options,
    correct_answer: String(Array.isArray(row.correct_answer) ? row.correct_answer[0] : row.correct_answer || 'A').toUpperCase(),
    distractor_notes: row.distractor_notes || {},
    tags: Array.isArray(row.tags) ? row.tags.join(', ') : row.tags || ''
  };
}

function QuestionDialog({ question, chapters, onClose, onSaved }) {
  const [values, setValues] = useState(() => question ? normalizeQuestion(question) : { ...emptyQuestion, options: emptyQuestion.options.map((option) => ({ ...option })) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const setField = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const setOption = (index, key, value) => setValues((current) => ({ ...current, options: current.options.map((option, item) => item === index ? { ...option, [key]: value } : option) }));
  const setOptionCount = (count) => setValues((current) => ({
    ...current,
    options: Array.from({ length: count }, (_, index) => current.options[index] || { en: '', hi: '' }),
    correct_answer: ['A', 'B', 'C', 'D', 'E'].slice(0, count).includes(current.correct_answer) ? current.correct_answer : 'A'
  }));
  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!values.question_text.trim()) { setError('Question text in English is required.'); return; }
    if (values.options.some((option) => !option.en.trim())) { setError('Add English text for every answer option.'); return; }
    if (!values.options.some((_, index) => String.fromCharCode(65 + index) === values.correct_answer)) { setError('Choose a correct answer that exists in the options.'); return; }
    if (!values.subject.trim()) { setError('Subject is required.'); return; }
    if (!values.chapter_id || !chapters.some((chapter) => chapter.id === values.chapter_id)) { setError('Choose a valid chapter mapping.'); return; }
    if (!supabase) { setError('Supabase is not configured.'); return; }
    const optionKeys = values.options.map((_, index) => String.fromCharCode(65 + index));
    const payload = {
      question_text: values.question_text.trim(),
      question_text_hi: values.question_text_hi.trim() || null,
      options: values.options.map((option) => ({ en: option.en.trim(), hi: option.hi.trim() })),
      correct_answer: values.correct_answer,
      explanation: values.explanation.trim() || null,
      distractor_notes: Object.fromEntries(optionKeys.filter((key) => key !== values.correct_answer && values.distractor_notes[key]?.trim()).map((key) => [key, values.distractor_notes[key].trim()])),
      subject: values.subject.trim(),
      difficulty: values.difficulty,
      chapter_id: values.chapter_id,
      status: values.status,
      tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    };
    setSaving(true);
    try {
      const request = question
        ? supabase.from('questions').update(payload).eq('id', question.id)
        : supabase.from('questions').insert(payload);
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save question.');
    } finally { setSaving(false); }
  };

  return <div className="modal-backdrop"><form className="content-dialog qbank-dialog" role="dialog" aria-modal="true" aria-labelledby="question-dialog-title" onSubmit={save}>
    <button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
    <div className="eyebrow">{question ? 'QUESTION AUTHORING' : 'ADD TO QUESTION BANK'}</div><h2 id="question-dialog-title">{question ? 'Edit question' : 'Author a question'}</h2>
    <div className="qbank-form-grid"><label className="field-label">Question (English) *<textarea className="text-input content-textarea" rows="2" value={values.question_text} onChange={(event) => setField('question_text', event.target.value)} required /></label><label className="field-label">Question (Hindi)<textarea className="text-input content-textarea" rows="2" value={values.question_text_hi} onChange={(event) => setField('question_text_hi', event.target.value)} /></label></div>
    <div className="options-editor-heading"><strong>Answer options</strong><div><span>Option count</span><button type="button" className={values.options.length === 4 ? 'active' : ''} onClick={() => setOptionCount(4)}>4</button><button type="button" className={values.options.length === 5 ? 'active' : ''} onClick={() => setOptionCount(5)}>5</button></div></div>
    <div className="qbank-option-editor">{values.options.map((option, index) => {
      const key = String.fromCharCode(65 + index);
      return <div className={`qbank-option-row ${values.correct_answer === key ? 'correct-option' : ''}`} key={key}><span className="option-key">{key}</span><div className="qbank-option-fields"><input className="text-input" value={option.en} onChange={(event) => setOption(index, 'en', event.target.value)} placeholder={`Option ${key} (English) *`} required /><input className="text-input" value={option.hi} onChange={(event) => setOption(index, 'hi', event.target.value)} placeholder={`Option ${key} (Hindi)`} /></div><label className="correct-radio" title={`Set ${key} as the answer`}><input type="radio" name="correct-answer" value={key} checked={values.correct_answer === key} onChange={() => setField('correct_answer', key)} /><Check size={14} /></label></div>;
    })}</div>
    <div className="qbank-form-grid"><label className="field-label">Subject *<input className="text-input" value={values.subject} onChange={(event) => setField('subject', event.target.value)} required placeholder="e.g. Polity" /></label><label className="field-label">Difficulty<select className="text-input" value={values.difficulty} onChange={(event) => setField('difficulty', event.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label className="field-label">Chapter mapping *<select className="text-input" value={values.chapter_id} onChange={(event) => setField('chapter_id', event.target.value)} required><option value="">Select a chapter</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</select></label><label className="field-label">Status<select className="text-input" value={values.status} onChange={(event) => setField('status', event.target.value)}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="unpublished">Unpublished</option></select></label></div>
    <label className="field-label">Explanation<textarea className="text-input content-textarea" rows="3" value={values.explanation || ''} onChange={(event) => setField('explanation', event.target.value)} placeholder="Explain why the selected answer is correct." /></label>
    <details className="distractor-details"><summary>Distractor notes <ChevronDown size={15} /></summary><div className="distractor-grid">{values.options.map((_, index) => { const key = String.fromCharCode(65 + index); return key !== values.correct_answer && <label className="field-label" key={key}>Option {key}<textarea className="text-input" rows="2" value={values.distractor_notes[key] || ''} onChange={(event) => setValues((current) => ({ ...current, distractor_notes: { ...current.distractor_notes, [key]: event.target.value } }))} placeholder="Why this option is incorrect." /></label>; })}</div></details>
    <label className="field-label">Tags<input className="text-input" value={values.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="constitution, fundamental-rights (comma separated)" /></label>
    {error && <div className="feedback error-feedback">{error}</div>}
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-gold" disabled={saving}>{saving ? 'Saving…' : question ? 'Save question' : 'Add question'}</button></div>
  </form></div>;
}

function ImportDialog({ chapters, onClose, onImported }) {
  const { user } = useAuth();
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const validate = () => {
    setError('');
    setPreview(null);
    try {
      const parsed = JSON.parse(json);
      const rows = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(rows) || !rows.length) throw new Error('Provide a JSON array containing at least one question.');
      const seen = new Set();
      const checked = rows.map((row, index) => {
        const result = validateImportQuestion(row, index, seen);
        const chapterValid = chapters.some((chapter) => chapter.id === row?.chapter_id);
        if (!chapterValid) result.errors.push(`Row ${index + 1}: chapter_id must match a chapter in this catalogue.`);
        result.valid = result.valid && chapterValid;
        return { row, ...result };
      });
      setPreview(checked);
    } catch (parseError) {
      setError(parseError.message || 'The import JSON is not valid.');
    }
  };
  const handleImportDrafts = async () => {
    const validRows = (preview || []).filter((item) => item.valid).map(({ row }) => ({
      question_text: row.question_text,
      question_text_hi: row.question_text_hi || null,
      options: row.options.map((option, index) => ({
        id: String.fromCharCode(65 + index),
        text: typeof option === 'string' ? option.trim() : String(option.en || option.text || option.hi || option.text_hi || '').trim()
      })),
      correct_answers: [String(Array.isArray(row.correct_answer) ? row.correct_answer[0] : row.correct_answer || 'A').trim().toUpperCase()],
      explanation: row.explanation || null,
      distractor_notes: row.distractor_notes || {},
      subject: row.subject,
      difficulty: row.difficulty || 'medium',
      chapter_id: row.chapter_id,
      tags: Array.isArray(row.tags) ? row.tags : [],
      status: 'draft'
    }));
    console.log('--> Import button clicked, rows:', validRows);
    if (!validRows.length) {
      window.alert('No valid rows to import');
      setError('There are no valid rows to import.');
      return;
    }
    if (!user) {
      window.alert('Authentication required. Please sign in as admin first.');
      setError('Authentication required. Please sign in as admin first.');
      return;
    }
    if (!supabase) {
      window.alert('Database connection is unavailable. Please try again later.');
      setError('Supabase is not configured.');
      return;
    }
    setIsImporting(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase.from('questions').insert(validRows);
      if (insertError) {
        console.error('DB Insert Failed:', insertError);
        window.alert(`Database error: ${insertError.message}`);
        setError(insertError.message || 'Unable to import the valid questions.');
        return;
      }
    } catch (insertError) {
      console.error('DB Insert Failed:', insertError);
      window.alert(`Database error: ${insertError.message || 'Unable to import questions.'}`);
      setError(insertError.message || 'Unable to import the valid questions.');
      return;
    } finally {
      setIsImporting(false);
    }
    window.alert(`Success! ${validRows.length} question(s) imported.`);
    onClose();
    if (onImported) onImported();
  };
  const validCount = preview?.filter((item) => item.valid).length || 0;
  return <div className="modal-backdrop import-modal-backdrop"><section className="content-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <header className="import-modal-header"><div><div className="eyebrow">SAFE BULK AUTHORING</div><h2 id="import-title">Import questions from JSON</h2></div><button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
    <p className="dialog-intro">Review all rows before saving. Imported questions are always kept in Draft.</p>
    <div className="import-template-row"><span>Expected fields: question_text, options (4–5), correct_answer (A–E), subject, chapter_id</span><button className="text-button" onClick={() => setJson(TEMPLATE)}><ArrowDownToLine size={14} /> Load template</button></div>
    <textarea className="text-input import-json-input" value={json} onChange={(event) => { setJson(event.target.value); setPreview(null); }} rows="11" spellCheck="false" placeholder="Paste an array of question objects…" />
    <button className="button button-outline" onClick={validate}><Filter size={15} /> Validate & preview</button>
    {error && <div className="feedback error-feedback">{error}</div>}
    {preview && <div className="import-preview"><div className="import-preview-heading"><strong>Import preview</strong><span>{validCount} valid · {preview.length - validCount} rejected</span></div>{preview.map((item, index) => <div className={`import-preview-row ${item.valid ? 'valid' : 'invalid'}`} key={item.row?.id || index}><span>{item.valid ? <Check size={14} /> : <X size={14} />}</span><div><strong>{item.row?.question_text || `Row ${index + 1}`}</strong>{item.errors.map((message) => <small key={message}>{message}</small>)}</div></div>)}</div>}
    <footer className="import-modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="button" className="button button-gold" onClick={handleImportDrafts} disabled={isImporting}>{isImporting ? 'Importing...' : `Import ${validCount} draft${validCount === 1 ? '' : 's'}`}</button></footer>
  </section></div>;
}

export default function QBankManager() {
  const { chapters, loading: chaptersLoading } = useContentCatalog();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const refresh = async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setError('');
    const { data, error: loadError } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (loadError) { setError(loadError.message || 'Unable to load the question bank.'); setLoading(false); return; }
    setQuestions(data || []);
    setLoading(false);
  };
  useEffect(() => { refresh().catch((loadError) => { setError(loadError.message); setLoading(false); }); }, []);
  const subjects = [...new Set(questions.map((question) => question.subject).filter(Boolean))].sort();
  const filteredQuestions = useMemo(() => questions.filter((question) => {
    if (subject !== 'all' && question.subject !== subject) return false;
    if (difficulty !== 'all' && String(question.difficulty).toLowerCase() !== difficulty) return false;
    const query = search.trim().toLowerCase();
    return !query || `${question.question_text?.en || question.question_text || ''} ${question.question_text_hi || ''} ${question.subject || ''} ${question.tags || ''}`.toLowerCase().includes(query);
  }), [questions, subject, difficulty, search]);
  const chapterTitle = (chapterId) => chapters.find((chapter) => chapter.id === chapterId)?.title || 'Unmapped chapter';

  return <div className="qbank-page">
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION / QUESTION OPERATIONS</div><h1>Question bank</h1><p>Author, review and organise reusable questions for tests and practice.</p></div><div className="qbank-heading-actions"><button className="button button-outline" onClick={() => setImportOpen(true)}><Upload size={15} /> Bulk import</button><button className="button button-gold" onClick={() => setDialog({ question: null })}><Plus size={15} /> Author question</button></div></div>
    {error && <div className="feedback error-feedback">{error}</div>}
    <div className="qbank-toolbar panel-card"><label className="content-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question text, tags or topics…" /></label><label className="filter-select"><span>Subject</span><select className="text-input" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-select"><span>Difficulty</span><select className="text-input" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><span className="qbank-result-count">{filteredQuestions.length} questions</span></div>
    {loading || chaptersLoading ? <LoadingSkeleton rows={4} /> : !filteredQuestions.length ? <div className="empty-content qbank-empty"><FileQuestion size={25} /><strong>{questions.length ? 'No questions match those filters.' : 'Your question bank starts here.'}</strong><span>{questions.length ? 'Change your filters or search.' : 'Author a question or import a validated JSON batch.'}</span></div> : <div className="qbank-list">{filteredQuestions.map((question) => {
      const options = getOptionEntries(question.options);
      const text = typeof question.question_text === 'string' ? question.question_text : question.question_text?.en;
      return <article className="qbank-item panel-card" key={question.id}><div className="qbank-item-header"><div className="qbank-item-tags"><span className="subject-pill">{question.subject || 'General'}</span><span className={`difficulty-pill difficulty-${String(question.difficulty || 'medium').toLowerCase()}`}>{question.difficulty || 'medium'}</span><span className={`content-status status-${question.status || 'draft'}`}>{question.status || 'draft'}</span></div><button className="button button-outline" onClick={() => setDialog({ question })}>Edit</button></div><h2>{text || 'Untitled question'}</h2>{question.question_text_hi && <p className="qbank-hindi">{question.question_text_hi}</p>}<div className="qbank-item-meta"><span><BookOpen size={13} /> {chapterTitle(question.chapter_id)}</span><span>{options.length} options</span></div><div className="qbank-options-preview">{options.map(([key, option]) => <span className={key === question.correct_answer ? 'is-answer' : ''} key={key}><b>{key}</b> {typeof option === 'string' ? option : option?.en || option?.text || ''}</span>)}</div><details className="admin-answer-preview"><summary>Answer & explanation <ChevronDown size={14} /></summary><p><strong>Correct answer: {Array.isArray(question.correct_answer) ? question.correct_answer.join(', ') : question.correct_answer}</strong></p><p>{question.explanation || 'No explanation has been added.'}</p>{question.distractor_notes && Object.entries(question.distractor_notes).map(([key, note]) => <small key={key}>Option {key}: {note}</small>)}</details></article>;
    })}</div>}
    {dialog && <QuestionDialog question={dialog.question} chapters={chapters} onClose={() => setDialog(null)} onSaved={refresh} />}
    {importOpen && <ImportDialog chapters={chapters} onClose={() => setImportOpen(false)} onImported={refresh} />}
  </div>;
}

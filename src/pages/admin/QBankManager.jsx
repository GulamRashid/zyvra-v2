import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, FileQuestion, Filter, Layers, LayoutGrid, List, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getOptionEntries, hasDevanagari, hasLatin, normalizeImportQuestionText, parseImportCsv, validateImportQuestion } from '../../lib/tests';
import { getContentErrorMessage, getFolderPath } from '../../lib/content';
import useContentCatalog from '../../hooks/useContentCatalog';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import QuestionFormatter from '../../components/common/QuestionFormatter';

export function getChapterHierarchyPath(chapterId, chaptersMap, foldersMap, examsMap) {
  if (!chapterId) {
    return {
      examId: null,
      folderIds: [],
      chapterId: null,
      breadcrumb: 'Unassigned Chapter',
      parts: [],
      isUnassigned: true
    };
  }

  const getFromMap = (map, id) => {
    if (!map || !id) return null;
    return map instanceof Map ? map.get(id) : Array.isArray(map) ? map.find((item) => item.id === id) : map[id];
  };

  const chapter = getFromMap(chaptersMap, chapterId);
  if (!chapter) {
    return {
      examId: null,
      folderIds: [],
      chapterId: null,
      breadcrumb: 'Unassigned Chapter',
      parts: [],
      isUnassigned: true
    };
  }

  const folderChain = [];
  const folderIds = [];
  let currentFolderId = chapter.folder_id;
  const visited = new Set();

  while (currentFolderId && !visited.has(currentFolderId)) {
    visited.add(currentFolderId);
    const folder = getFromMap(foldersMap, currentFolderId);
    if (!folder) break;
    folderChain.unshift(folder);
    folderIds.unshift(folder.id);
    currentFolderId = folder.parent_folder_id || folder.parent_id || null;
  }

  const rootFolder = folderChain[0];
  const examId = rootFolder?.exam_id || null;
  const exam = examId ? getFromMap(examsMap, examId) : null;

  const parts = [];
  if (exam) parts.push({ type: 'exam', id: exam.id, title: exam.title });
  folderChain.forEach((f) => parts.push({ type: 'folder', id: f.id, title: f.title }));
  parts.push({ type: 'chapter', id: chapter.id, title: chapter.title });

  const breadcrumb = parts.map((p) => p.title).join(' › ');

  return {
    examId,
    examTitle: exam?.title || null,
    folderIds,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    parts,
    breadcrumb: breadcrumb || 'Unassigned Chapter',
    isUnassigned: false
  };
}

const emptyQuestion = {
  question_text: '', question_text_hi: '', options: [{ en: '', hi: '' }, { en: '', hi: '' }, { en: '', hi: '' }, { en: '', hi: '' }],
  correct_answer: 'A', explanation: '', distractor_notes: {}, subject: '', difficulty: 'medium', chapter_id: '', status: 'draft', usage_scope: 'both', tags: ''
};
const usageScopes = ['both', 'practice_only', 'test_only'];
const usageScopeLabel = (scope) => ({
  both: 'Both',
  practice_only: 'Practice Only',
  test_only: 'Test Only'
}[usageScopes.includes(String(scope || '').toLowerCase()) ? String(scope || '').toLowerCase() : 'both']);
const normalizeUsageScope = (scope) => usageScopes.includes(String(scope || '').toLowerCase())
  ? String(scope).toLowerCase()
  : 'both';
const TEMPLATE = JSON.stringify([{
  question_text: 'Which article guarantees equality before law?',
  question_text_hi: 'कानून के समक्ष समानता किस अनुच्छेद में दी गई है?',
  options: [{ en: 'Article 12', hi: 'अनुच्छेद 12' }, { en: 'Article 14', hi: 'अनुच्छेद 14' }, { en: 'Article 19', hi: 'अनुच्छेद 19' }, { en: 'Article 21', hi: 'अनुच्छेद 21' }],
  correct_answer: 'B',
  explanation: 'Article 14 guarantees equality before law and equal protection of the laws.',
  distractor_notes: { A: 'Defines the State.', C: 'Lists freedoms.', D: 'Protects life and personal liberty.' },
  subject: 'Polity',
  difficulty: 'easy',
  usage_scope: 'both',
  chapter_id: 'replace-with-chapter-uuid',
  tags: ['constitution', 'fundamental-rights']
}], null, 2);

const CSV_TEMPLATE = `question_text,option_a,option_b,option_c,option_d,correct_answer,subject,difficulty,usage_scope,chapter_id,explanation,tags
"Which article guarantees equality before law?","Article 12","Article 14","Article 19","Article 21","B","Polity","easy","both","replace-with-chapter-uuid","Article 14 guarantees equality before law.","constitution,fundamental-rights"`;

function normalizeQuestion(row) {
  const entries = getOptionEntries(row.options);
  const qEn = row.question_en || row.question_text_en || (typeof row.question_text === 'string' && (hasLatin(row.question_text) || !hasDevanagari(row.question_text)) ? row.question_text : row.question_text?.en || '');
  const qHi = row.question_hi || row.question_text_hi || (typeof row.question_text === 'string' && hasDevanagari(row.question_text) ? row.question_text : row.question_text?.hi || '');
  return {
    ...row,
    question_text: qEn || (typeof row.question_text === 'string' ? row.question_text : ''),
    question_text_hi: qHi || '',
    options: entries.length ? entries.map(([, option]) => typeof option === 'string' ? { en: option, hi: '' } : { en: option?.en || option?.text || '', hi: option?.hi || '' }) : emptyQuestion.options,
    correct_answer: String(Array.isArray(row.correct_answer) ? row.correct_answer[0] : row.correct_answer || 'A').toUpperCase(),
    distractor_notes: row.distractor_notes || {},
    usage_scope: normalizeUsageScope(row.usage_scope),
    tags: Array.isArray(row.tags) ? row.tags.join(', ') : row.tags || ''
  };
}

function QuestionDialog({ question, chapters, onClose, onSaved, onDelete }) {
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
      question_text: String(values.question_text || '').trim(),
      question_text_hi: String(values.question_text_hi || '').trim() || null,
      options: values.options.map((option) => ({ en: String(option.en || '').trim(), hi: String(option.hi || '').trim() })),
      correct_answer: String(values.correct_answer || 'A').trim().toUpperCase(),
      explanation: String(values.explanation || '').trim() || null,
      distractor_notes: Object.fromEntries(optionKeys.filter((key) => key !== values.correct_answer && values.distractor_notes[key]?.trim()).map((key) => [key, values.distractor_notes[key].trim()])),
      subject: String(values.subject || '').trim(),
      difficulty: String(values.difficulty || 'medium').toLowerCase(),
      chapter_id: values.chapter_id,
      status: values.status,
      usage_scope: normalizeUsageScope(values.usage_scope),
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
      setError(getContentErrorMessage(saveError, 'Unable to save question.'));
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
    <div className="qbank-form-grid"><label className="field-label">Subject *<input className="text-input" value={values.subject} onChange={(event) => setField('subject', event.target.value)} required placeholder="e.g. Polity" /></label><label className="field-label">Difficulty<select className="text-input" value={values.difficulty} onChange={(event) => setField('difficulty', event.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label className="field-label">Chapter mapping *<select className="text-input" value={values.chapter_id} onChange={(event) => setField('chapter_id', event.target.value)} required><option value="">Select a chapter</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</select></label><label className="field-label">Status<select className="text-input" value={values.status} onChange={(event) => setField('status', event.target.value)}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="unpublished">Unpublished</option></select></label><label className="field-label">Usage scope<select className="text-input" value={values.usage_scope} onChange={(event) => setField('usage_scope', event.target.value)}><option value="both">Both</option><option value="practice_only">Practice Only</option><option value="test_only">Test Only</option></select></label></div>
    <label className="field-label">Explanation<textarea className="text-input content-textarea" rows="3" value={values.explanation || ''} onChange={(event) => setField('explanation', event.target.value)} placeholder="Explain why the selected answer is correct." /></label>
    <details className="distractor-details"><summary>Distractor notes <ChevronDown size={15} /></summary><div className="distractor-grid">{values.options.map((_, index) => { const key = String.fromCharCode(65 + index); return key !== values.correct_answer && <label className="field-label" key={key}>Option {key}<textarea className="text-input" rows="2" value={values.distractor_notes[key] || ''} onChange={(event) => setValues((current) => ({ ...current, distractor_notes: { ...current.distractor_notes, [key]: event.target.value } }))} placeholder="Why this option is incorrect." /></label>; })}</div></details>
    <label className="field-label">Tags<input className="text-input" value={values.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="constitution, fundamental-rights (comma separated)" /></label>
    {error && <div className="feedback error-feedback">{error}</div>}
    <div className="modal-actions">
      {question && (
        <button
          type="button"
          className="button button-danger"
          disabled={saving}
          onClick={async () => {
            if (!onDelete) return;
            setSaving(true);
            try {
              const deleted = await onDelete([question.id]);
              if (deleted) onClose();
            } finally {
              setSaving(false);
            }
          }}
          style={{ marginRight: 'auto' }}
        >
          <Trash2 size={14} /> Delete question
        </button>
      )}
      <button type="button" className="button button-outline" onClick={onClose} disabled={saving}>Cancel</button>
      <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : question ? 'Save question' : 'Add question'}</button>
    </div>
  </form></div>;
}

function ImportDialog({ chapters, onClose, onImported }) {
  const { user } = useAuth();
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState(null);
  const [importStatus, setImportStatus] = useState('published');
  const [importUsageScope, setImportUsageScope] = useState('both');
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [error, setError] = useState('');

  const validate = async () => {
    setError('');
    setPreview(null);
    setIsValidating(true);
    try {
      const trimmed = json.trim();
      if (!trimmed) throw new Error('Please paste CSV or JSON data to import.');
      let rows = [];
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          rows = Array.isArray(parsed) ? parsed : parsed.questions;
        } catch {
          rows = parseImportCsv(trimmed);
        }
      } else {
        rows = parseImportCsv(trimmed);
      }
      if (!Array.isArray(rows) || !rows.length) {
        throw new Error('Provide at least one question in valid CSV or JSON format.');
      }
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data: existingQuestions, error: existingError } = await supabase
        .from('questions')
        .select('question_text, question_text_hi');
      if (existingError) throw existingError;

      const seen = new Set();
      const seenQuestionTexts = new Set((existingQuestions || [])
        .map((question) => normalizeImportQuestionText(question))
        .filter(Boolean));
      const checked = rows.map((row, index) => {
        const result = validateImportQuestion(row, index, seen, seenQuestionTexts);
        const usageScope = String(row?.usage_scope || importUsageScope).trim().toLowerCase();
        const usageScopeValid = usageScopes.includes(usageScope);
        if (!usageScopeValid) {
          result.errors.push(`Row ${index + 1}: usage_scope must be both, practice_only, or test_only.`);
        }
        const chapterValid = chapters.some((chapter) => chapter.id === row?.chapter_id);
        if (!chapterValid) result.errors.push(`Row ${index + 1}: chapter_id must match a chapter in this catalogue.`);
        result.valid = result.valid && chapterValid && usageScopeValid;
        return { row: { ...row, usage_scope: usageScope }, ...result };
      });
      setPreview(checked);
    } catch (parseError) {
      setError(parseError.message || 'The import data is not valid.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImportQuestions = async () => {
    const validItems = (preview || []).filter((item) => item.valid && !item.imported);
    const validRows = validItems.map(({ row }) => {
      let qEn = String(row.question_en || row.question_text_en || row.question_text || '').trim();
      let qHi = String(row.question_hi || row.question_text_hi || '').trim() || null;

      // Script integrity: ensure English column does not have pure Hindi
      if (hasDevanagari(qEn) && !hasLatin(qEn)) {
        if (!qHi) qHi = qEn;
        const altEn = row.question_en || row.question_text_en;
        qEn = (typeof altEn === 'string' && hasLatin(altEn)) ? altEn.trim() : '';
      }

      return {
        question_text: qEn || String(row.question_text || '').trim(),
        question_text_hi: qHi,
        options: (row.options || []).map((option) => {
          let optEn = typeof option === 'string' ? option.trim() : String(option.en || option.text || '').trim();
          let optHi = typeof option === 'object' && option ? String(option.hi || option.text_hi || '').trim() : '';

          if (hasDevanagari(optEn) && !hasLatin(optEn)) {
            if (!optHi) optHi = optEn;
            optEn = '';
          }

          return { en: optEn, hi: optHi };
        }),
        correct_answer: String(Array.isArray(row.correct_answer) ? row.correct_answer[0] : row.correct_answer || 'A').trim().toUpperCase(),
        explanation: String(row.explanation || '').trim() || null,
        distractor_notes: row.distractor_notes && typeof row.distractor_notes === 'object' && !Array.isArray(row.distractor_notes) ? row.distractor_notes : {},
        subject: String(row.subject || '').trim(),
        difficulty: String(row.difficulty || 'medium').toLowerCase(),
        chapter_id: row.chapter_id,
        usage_scope: normalizeUsageScope(row.usage_scope || importUsageScope),
        tags: (Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? row.tags.split(',') : [])).map((tag) => String(tag).trim()).filter(Boolean),
        status: importStatus
      };
    });
    if (!validRows.length) {
      setError('There are no valid rows to import.');
      return;
    }
    if (!user) {
      setError('Authentication required. Please sign in as admin first.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    setIsImporting(true);
    setImportProgress({ saved: 0, total: validRows.length });
    setError('');
    let savedCount = 0;
    try {
      const batchSize = 50;
      for (let start = 0; start < validRows.length; start += batchSize) {
        const batch = validRows.slice(start, start + batchSize);
        const { error: insertError } = await supabase.from('questions').insert(batch);
        if (insertError) {
          throw new Error(`Import stopped after ${start} of ${validRows.length} rows: ${insertError.message}`);
        }
        const savedItems = validItems.slice(start, start + batch.length);
        setPreview((current) => current
          ? current.map((item) => savedItems.includes(item) ? { ...item, imported: true } : item)
          : current);
        savedCount = Math.min(start + batch.length, validRows.length);
        setImportProgress({ saved: savedCount, total: validRows.length });
      }
    } catch (insertError) {
      console.error('DB Insert Failed:', insertError);
      const message = getContentErrorMessage(insertError, 'Unable to import questions.');
      setError(`${message} ${savedCount} rows were saved in this run. Retry to continue with the remaining rows.`);
      return;
    } finally {
      setIsImporting(false);
    }
    setImportProgress(null);
    setError('');
    onClose();
    if (onImported) onImported();
  };

  const validCount = preview?.filter((item) => item.valid && !item.imported).length || 0;
  const importedCount = preview?.filter((item) => item.imported).length || 0;
  const previewItems = preview?.slice(0, 50) || [];
  return <div className="modal-backdrop import-modal-backdrop"><section className="content-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <header className="import-modal-header"><div><div className="eyebrow">SAFE BULK AUTHORING</div><h2 id="import-title">Import questions from CSV or JSON</h2></div><button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
    <p className="dialog-intro">Review all rows before saving. Questions will be imported with status: <strong>{importStatus}</strong> and usage scope from each row or the default below.</p>
    <div className="import-template-row">
      <span>Optional usage_scope: both, practice_only, or test_only (defaults to both).</span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="text-button" onClick={() => setJson(CSV_TEMPLATE)}><ArrowDownToLine size={14} /> CSV template</button>
        <button type="button" className="text-button" onClick={() => setJson(TEMPLATE)}><ArrowDownToLine size={14} /> JSON template</button>
      </div>
    </div>
    <div className="qbank-form-grid">
      <label className="field-label">Default import status
        <select className="text-input" value={importStatus} onChange={(event) => setImportStatus(event.target.value)}>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </label>
      <label className="field-label">Default usage scope
        <select className="text-input" value={importUsageScope} onChange={(event) => setImportUsageScope(event.target.value)}>
          <option value="both">Both</option>
          <option value="practice_only">Practice Only</option>
          <option value="test_only">Test Only</option>
        </select>
      </label>
    </div>
    <textarea className="text-input import-json-input" value={json} onChange={(event) => { setJson(event.target.value); setPreview(null); }} rows="10" spellCheck="false" placeholder="Paste CSV (with headers) or a JSON array of question objects…" />
    <button className="button button-outline" onClick={validate} disabled={isValidating || isImporting}><Filter size={15} /> {isValidating ? 'Validating…' : 'Validate & preview'}</button>
    {error && <div className="feedback error-feedback">{error}</div>}
    {preview && <div className="import-preview"><div className="import-preview-heading"><strong>Import preview</strong><span>{validCount} pending · {importedCount} saved · {preview.filter((item) => !item.valid).length} rejected</span></div>{preview.length > previewItems.length && <small className="field-hint">Showing first 50 of {preview.length} rows.</small>}{previewItems.map((item, index) => <div className={`import-preview-row ${item.valid ? 'valid' : 'invalid'}`} key={item.row?.id || index}><span>{item.valid ? <Check size={14} /> : <X size={14} />}</span><div><strong>{item.row?.question_text || `Row ${index + 1}`}</strong><small>{item.imported ? 'Saved in this import' : `Usage: ${usageScopeLabel(item.row?.usage_scope)}`}</small>{item.errors.map((message) => <small key={message}>{message}</small>)}</div></div>)}</div>}
    <footer className="import-modal-actions"><button type="button" className="button button-outline" onClick={onClose} disabled={isImporting}>Cancel</button>{importProgress && <span className="field-hint">Saved {importProgress.saved} of {importProgress.total} questions…</span>}<button type="button" className="button button-primary" onClick={handleImportQuestions} disabled={isImporting || isValidating || !validCount}>{isImporting ? `Saving ${importProgress?.saved || 0} of ${importProgress?.total || validCount}…` : validCount ? `Import ${validCount} remaining question${validCount === 1 ? '' : 's'} (${importStatus})` : 'All valid rows saved'}</button></footer>
  </section></div>;
}

export default function QBankManager() {
  const { exams, folders, chapters, loading: chaptersLoading } = useContentCatalog();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Attribute Filters
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [optionCountFilter, setOptionCountFilter] = useState('all');
  const [usageScopeFilter, setUsageScopeFilter] = useState('all');

  // Cascading Hierarchy Filters
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [selectedFolderId, setSelectedFolderId] = useState('all');
  const [selectedChapterId, setSelectedChapterId] = useState('all');

  // View Mode & Collapse State
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
  const [collapsedChapters, setCollapsedChapters] = useState(new Set());

  // Dialogs & Actions
  const [dialog, setDialog] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setError('');
    const { data, error: loadError } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (loadError) { setError(getContentErrorMessage(loadError, 'Unable to load the question bank.')); setLoading(false); return; }
    setQuestions(data || []);
    setLoading(false);
  };
  useEffect(() => { refresh().catch((loadError) => { setError(getContentErrorMessage(loadError, 'Unable to load the question bank.')); setLoading(false); }); }, []);

  // Maps for O(1) Hierarchy Lookups
  const examsMap = useMemo(() => new Map((exams || []).map((e) => [e.id, e])), [exams]);
  const foldersMap = useMemo(() => new Map((folders || []).map((f) => [f.id, f])), [folders]);
  const chaptersMap = useMemo(() => new Map((chapters || []).map((c) => [c.id, c])), [chapters]);

  // Precompute hierarchy lineage for every question
  const questionHierarchyMap = useMemo(() => {
    const map = new Map();
    (questions || []).forEach((q) => {
      map.set(q.id, getChapterHierarchyPath(q.chapter_id, chaptersMap, foldersMap, examsMap));
    });
    return map;
  }, [questions, chaptersMap, foldersMap, examsMap]);

  // Cascading Available Folders
  const availableFolders = useMemo(() => {
    let list = folders || [];
    if (selectedExamId !== 'all') {
      list = list.filter((f) => f.exam_id === selectedExamId);
    }
    return list.map((folder) => {
      const pathParts = getFolderPath(folder, folders);
      const examTitle = examsMap.get(folder.exam_id)?.title || '';
      const fullPath = pathParts.map((p) => p.title).join(' / ');
      return {
        ...folder,
        fullPath: selectedExamId === 'all' && examTitle ? `${examTitle} › ${fullPath}` : fullPath
      };
    }).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }, [folders, selectedExamId, examsMap]);

  // Cascading Available Chapters
  const availableChapters = useMemo(() => {
    let list = chapters || [];
    if (selectedFolderId !== 'all') {
      const subFolderIds = new Set([selectedFolderId]);
      let added = true;
      while (added) {
        added = false;
        (folders || []).forEach((f) => {
          const parentId = f.parent_folder_id || f.parent_id;
          if (parentId && subFolderIds.has(parentId) && !subFolderIds.has(f.id)) {
            subFolderIds.add(f.id);
            added = true;
          }
        });
      }
      list = list.filter((c) => subFolderIds.has(c.folder_id));
    } else if (selectedExamId !== 'all') {
      const examFolderIds = new Set((folders || []).filter((f) => f.exam_id === selectedExamId).map((f) => f.id));
      list = list.filter((c) => examFolderIds.has(c.folder_id));
    }
    return [...list].sort((a, b) => a.title.localeCompare(b.title));
  }, [chapters, folders, selectedFolderId, selectedExamId]);

  const subjects = useMemo(() => [...new Set(questions.map((question) => question.subject).filter(Boolean))].sort(), [questions]);

  // Filtered Questions with full cascading logic
  const filteredQuestions = useMemo(() => questions.filter((question) => {
    const hierarchy = questionHierarchyMap.get(question.id);

    // Cascading hierarchy filters
    if (selectedExamId !== 'all' && hierarchy?.examId !== selectedExamId) return false;
    if (selectedFolderId !== 'all' && !hierarchy?.folderIds?.includes(selectedFolderId)) return false;
    if (selectedChapterId !== 'all' && question.chapter_id !== selectedChapterId) return false;

    // Status filter
    if (statusFilter !== 'all' && (question.status || 'draft') !== statusFilter) return false;

    // Option count filter
    const optionCount = getOptionEntries(question.options).length;
    if (optionCountFilter !== 'all' && optionCount !== Number(optionCountFilter)) return false;
    if (usageScopeFilter !== 'all' && normalizeUsageScope(question.usage_scope) !== usageScopeFilter) return false;

    // Subject & difficulty
    if (subject !== 'all' && question.subject !== subject) return false;
    if (difficulty !== 'all' && String(question.difficulty).toLowerCase() !== difficulty) return false;

    // Search query matching question text, tags, subject, or breadcrumb path
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const searchableText = `${question.question_text?.en || question.question_text || ''} ${question.question_text_hi || ''} ${question.subject || ''} ${question.tags || ''} ${hierarchy?.breadcrumb || ''}`.toLowerCase();
    return searchableText.includes(query);
  }), [questions, questionHierarchyMap, selectedExamId, selectedFolderId, selectedChapterId, statusFilter, optionCountFilter, usageScopeFilter, subject, difficulty, search]);

  // Chapter-Grouped questions mapping
  const chapterGroups = useMemo(() => {
    const groups = new Map();
    filteredQuestions.forEach((question) => {
      const h = questionHierarchyMap.get(question.id);
      const groupKey = h?.chapterId || 'unassigned';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          chapterId: h?.chapterId || null,
          chapterTitle: h?.chapterTitle || 'Unassigned Questions',
          breadcrumb: h?.breadcrumb || 'Unassigned Chapter',
          isUnassigned: Boolean(h?.isUnassigned),
          questions: []
        });
      }
      groups.get(groupKey).questions.push(question);
    });
    return Array.from(groups.values());
  }, [filteredQuestions, questionHierarchyMap]);

  const allFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedQuestionIds.includes(q.id));
  const someFilteredSelected = filteredQuestions.some((q) => selectedQuestionIds.includes(q.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredQuestions.map((q) => q.id));
      setSelectedQuestionIds((current) => current.filter((id) => !filteredIdSet.has(id)));
    } else {
      const filteredIds = filteredQuestions.map((q) => q.id);
      setSelectedQuestionIds((current) => Array.from(new Set([...current, ...filteredIds])));
    }
  };

  const handleBulkStatus = async (newStatus) => {
    if (!selectedQuestionIds.length || !supabase) return;
    setBulkBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ status: newStatus })
        .in('id', selectedQuestionIds);
      if (updateError) throw updateError;
      await refresh();
      setSelectedQuestionIds([]);
    } catch (err) {
      setError(getContentErrorMessage(err, `Unable to update questions to ${newStatus}.`));
    } finally {
      setBulkBusy(false);
    }
  };

  const checkLinkedTests = async (questionIds) => {
    if (!questionIds.length || !supabase) return [];
    const { data: links, error: linksError } = await supabase
      .from('test_questions')
      .select('test_id, question_id')
      .in('question_id', questionIds);
    if (linksError) throw linksError;
    if (!links || !links.length) return [];

    const testIds = [...new Set(links.map((link) => link.test_id))];
    const { data: testsData, error: testsError } = await supabase
      .from('tests')
      .select('id, title, status')
      .in('id', testIds);
    if (testsError) throw testsError;

    return (testsData || []).map((test) => {
      const linkedQuestionsCount = links.filter((link) => link.test_id === test.id).length;
      return { ...test, linkedQuestionsCount };
    });
  };

  const handleDeleteQuestions = async (targetIds) => {
    if (!targetIds || !targetIds.length || !supabase) return false;
    setBulkBusy(true);
    setError('');

    try {
      const linkedTests = await checkLinkedTests(targetIds);
      const activeStatuses = ['published', 'scheduled', 'live', 'available'];
      const activeTests = linkedTests.filter((test) =>
        activeStatuses.includes(String(test.status || '').toLowerCase())
      );

      const count = targetIds.length;
      let confirmMessage = '';

      if (linkedTests.length > 0) {
        const testList = linkedTests
          .map((t) => `• "${t.title}" (${t.status || 'draft'}${activeStatuses.includes(String(t.status || '').toLowerCase()) ? ' - ACTIVE' : ''})`)
          .slice(0, 6)
          .join('\n');
        const moreSuffix = linkedTests.length > 6 ? `\n...and ${linkedTests.length - 6} more test(s)` : '';

        confirmMessage =
          `⚠️ WARNING: ${count === 1 ? 'This question is' : `${count} questions are`} currently linked to ${linkedTests.length} test(s)` +
          (activeTests.length > 0 ? ` (${activeTests.length} active test${activeTests.length === 1 ? '' : 's'} affected):` : ':') +
          `\n\n${testList}${moreSuffix}\n\n` +
          `Deleting ${count === 1 ? 'this question' : 'these questions'} will permanently delete ${count === 1 ? 'it' : 'them'} from the Question Bank and automatically remove ${count === 1 ? 'it' : 'them'} from all linked tests.\n\n` +
          `Are you sure you want to proceed with deletion?`;
      } else {
        confirmMessage = `Are you sure you want to permanently delete ${count} question${count === 1 ? '' : 's'}? This action cannot be undone.`;
      }

      if (!window.confirm(confirmMessage)) {
        return false;
      }

      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .in('id', targetIds);
      if (deleteError) throw deleteError;

      const deletedSet = new Set(targetIds);
      setSelectedQuestionIds((current) => current.filter((id) => !deletedSet.has(id)));
      await refresh();
      return true;
    } catch (err) {
      setError(getContentErrorMessage(err, 'Unable to delete question(s).'));
      return false;
    } finally {
      setBulkBusy(false);
    }
  };

  const renderQuestionCard = (question) => {
    const options = getOptionEntries(question.options);
    const text = typeof question.question_text === 'string' ? question.question_text : question.question_text?.en;
    const hierarchy = questionHierarchyMap.get(question.id) || { isUnassigned: true, breadcrumb: 'Unassigned Chapter', parts: [] };

    return (
      <article className={`qbank-item panel-card ${selectedQuestionIds.includes(question.id) ? 'is-selected' : ''}`} key={question.id}>
        {/* Full Syllabus Lineage Breadcrumb at top of card */}
        <div className="qbank-card-lineage">
          {hierarchy.isUnassigned ? (
            <span className="lineage-pill unassigned-pill" title="This question has no valid chapter assignment">
              <AlertTriangle size={12} /> Unassigned Chapter
            </span>
          ) : (
            <span className="lineage-pill" title={hierarchy.breadcrumb}>
              <Layers size={12} className="lineage-icon" />
              {hierarchy.parts.map((part, pIdx) => (
                <span key={part.id || pIdx} className="lineage-crumb">
                  {pIdx > 0 && <span className="lineage-separator">›</span>}
                  <span className={`lineage-part lineage-${part.type}`}>{part.title}</span>
                </span>
              ))}
            </span>
          )}
        </div>

        <div className="qbank-item-header">
          <div className="qbank-item-header-left">
            <label className="qbank-item-checkbox-label" title="Select question">
              <input
                type="checkbox"
                className="qbank-item-checkbox"
                checked={selectedQuestionIds.includes(question.id)}
                onChange={(event) => {
                  setSelectedQuestionIds((current) =>
                    event.target.checked
                      ? [...current, question.id]
                      : current.filter((id) => id !== question.id)
                  );
                }}
                aria-label={`Select question: ${text || 'Untitled'}`}
              />
            </label>
            <div className="qbank-item-tags">
              <span className="subject-pill">{question.subject || 'General'}</span>
              <span className={`difficulty-pill difficulty-${String(question.difficulty || 'medium').toLowerCase()}`}>{question.difficulty || 'medium'}</span>
              <span className={`content-status status-${question.status || 'draft'}`}>{question.status || 'draft'}</span>
              <span className="content-status">{usageScopeLabel(question.usage_scope)}</span>
              <span className="options-count-pill">{options.length}-option</span>
            </div>
          </div>
          <div className="qbank-item-actions">
            <button className="button button-outline" onClick={() => setDialog({ question })}>Edit</button>
            <button
              type="button"
              className="button button-quiet qbank-delete-single-btn"
              title="Delete question"
              onClick={() => handleDeleteQuestions([question.id])}
              disabled={bulkBusy}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="qbank-question-heading">
          <QuestionFormatter text={text || 'Untitled question'} />
        </div>
        {question.question_text_hi && (
          <div className="qbank-hindi mt-2">
            <QuestionFormatter text={question.question_text_hi} />
          </div>
        )}

        <div className="qbank-item-meta">
          <span><BookOpen size={13} /> {hierarchy.isUnassigned ? 'Unassigned chapter' : hierarchy.chapterTitle}</span>
          <span>{options.length} options</span>
          {question.tags && <span className="meta-tags">Tags: {Array.isArray(question.tags) ? question.tags.join(', ') : question.tags}</span>}
        </div>

        <div className="qbank-options-preview">
          {options.map(([key, option]) => (
            <span className={key === question.correct_answer ? 'is-answer' : ''} key={key}>
              <b>{key}</b> {typeof option === 'string' ? option : option?.en || option?.text || ''}
            </span>
          ))}
        </div>

        <details className="admin-answer-preview">
          <summary>Answer & explanation <ChevronDown size={14} /></summary>
          <p><strong>Correct answer: {Array.isArray(question.correct_answer) ? question.correct_answer.join(', ') : question.correct_answer}</strong></p>
          <p>{question.explanation || 'No explanation has been added.'}</p>
          {question.distractor_notes && Object.entries(question.distractor_notes).map(([key, note]) => (
            <small key={key}>Option {key}: {note}</small>
          ))}
        </details>
      </article>
    );
  };

  return <div className="qbank-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow">ADMINISTRATION / QUESTION OPERATIONS</div>
        <h1>Question bank</h1>
        <p>Author, review and organise reusable questions for tests and practice.</p>
      </div>
      <div className="qbank-heading-actions">
        <button className="button button-outline" onClick={() => setImportOpen(true)}><Upload size={15} /> Bulk import</button>
        <button className="button button-primary" onClick={() => setDialog({ question: null })}><Plus size={15} /> Author question</button>
      </div>
    </div>

    {error && <div className="feedback error-feedback">{error}</div>}

    <div className="qbank-toolbar panel-card">
      <div className="qbank-toolbar-primary">
        <label className="qbank-select-all-label">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected;
            }}
            onChange={toggleSelectAllFiltered}
            disabled={!filteredQuestions.length}
          />
          <span>Select all ({filteredQuestions.length})</span>
        </label>
        <label className="content-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, breadcrumbs, tags…" />
        </label>
        <div className="view-mode-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={13} /> <span>List</span>
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Group by Chapter"
          >
            <LayoutGrid size={13} /> <span>Group by Chapter</span>
          </button>
        </div>
        <span className="qbank-result-count">{filteredQuestions.length} questions</span>
      </div>

      <div className="qbank-toolbar-cascade">
        {/* Exam */}
        <label className="filter-select">
          <span>Exam</span>
          <select
            className="text-input"
            value={selectedExamId}
            onChange={(event) => {
              setSelectedExamId(event.target.value);
              setSelectedFolderId('all');
              setSelectedChapterId('all');
            }}
          >
            <option value="all">All exams</option>
            {exams.map((exam) => (
              <option value={exam.id} key={exam.id}>{exam.title}</option>
            ))}
          </select>
        </label>

        {/* Folder / Sub-folder */}
        <label className="filter-select">
          <span>Folder</span>
          <select
            className="text-input"
            value={selectedFolderId}
            onChange={(event) => {
              setSelectedFolderId(event.target.value);
              setSelectedChapterId('all');
            }}
          >
            <option value="all">All folders</option>
            {availableFolders.map((folder) => (
              <option value={folder.id} key={folder.id}>{folder.fullPath}</option>
            ))}
          </select>
        </label>

        {/* Chapter */}
        <label className="filter-select">
          <span>Chapter</span>
          <select
            className="text-input"
            value={selectedChapterId}
            onChange={(event) => setSelectedChapterId(event.target.value)}
          >
            <option value="all">All chapters</option>
            {availableChapters.map((chapter) => (
              <option value={chapter.id} key={chapter.id}>{chapter.title}</option>
            ))}
          </select>
        </label>

        {/* Status */}
        <label className="filter-select">
          <span>Status</span>
          <select className="text-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
          </select>
        </label>

        <label className="filter-select">
          <span>Usage scope</span>
          <select className="text-input" value={usageScopeFilter} onChange={(event) => setUsageScopeFilter(event.target.value)}>
            <option value="all">All scopes</option>
            <option value="both">Both</option>
            <option value="practice_only">Practice Only</option>
            <option value="test_only">Test Only</option>
          </select>
        </label>

        {/* Options pattern */}
        <label className="filter-select">
          <span>Options</span>
          <select className="text-input" value={optionCountFilter} onChange={(event) => setOptionCountFilter(event.target.value)}>
            <option value="all">All options</option>
            <option value="4">4-option</option>
            <option value="5">5-option</option>
          </select>
        </label>

        {/* Subject */}
        <label className="filter-select">
          <span>Subject</span>
          <select className="text-input" value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="all">All subjects</option>
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        {/* Difficulty */}
        <label className="filter-select">
          <span>Difficulty</span>
          <select className="text-input" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="all">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>
    </div>

    {loading || chaptersLoading ? (
      <LoadingSkeleton rows={4} />
    ) : !filteredQuestions.length ? (
      <div className="empty-content qbank-empty">
        <FileQuestion size={25} />
        <strong>{questions.length ? 'No questions match those filters.' : 'Your question bank starts here.'}</strong>
        <span>{questions.length ? 'Change your filters or search.' : 'Author a question or import a validated JSON or CSV batch.'}</span>
      </div>
    ) : viewMode === 'grouped' ? (
      <div className="qbank-grouped-container">
        {chapterGroups.map((group) => {
          const isCollapsed = collapsedChapters.has(group.chapterId || 'unassigned');
          const groupQuestionIds = group.questions.map((q) => q.id);
          const allInGroupSelected = groupQuestionIds.length > 0 && groupQuestionIds.every((id) => selectedQuestionIds.includes(id));
          const someInGroupSelected = groupQuestionIds.some((id) => selectedQuestionIds.includes(id));

          const toggleSelectAllInGroup = () => {
            if (allInGroupSelected) {
              const idSet = new Set(groupQuestionIds);
              setSelectedQuestionIds((curr) => curr.filter((id) => !idSet.has(id)));
            } else {
              setSelectedQuestionIds((curr) => Array.from(new Set([...curr, ...groupQuestionIds])));
            }
          };

          const toggleCollapse = () => {
            setCollapsedChapters((curr) => {
              const next = new Set(curr);
              const key = group.chapterId || 'unassigned';
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          };

          return (
            <section className="qbank-chapter-group panel-card" key={group.chapterId || 'unassigned'}>
              <div className="chapter-group-header">
                <button
                  type="button"
                  className="chapter-group-collapse-btn"
                  onClick={toggleCollapse}
                  aria-label={isCollapsed ? 'Expand chapter group' : 'Collapse chapter group'}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <label className="chapter-group-select-label" title="Select all in chapter">
                  <input
                    type="checkbox"
                    className="qbank-item-checkbox"
                    checked={allInGroupSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allInGroupSelected && someInGroupSelected;
                    }}
                    onChange={toggleSelectAllInGroup}
                  />
                  <span className="sr-only">Select all in chapter</span>
                </label>
                <div className="chapter-group-info" onClick={toggleCollapse} style={{ cursor: 'pointer' }}>
                  <span className="chapter-group-breadcrumb">
                    {group.isUnassigned ? (
                      <span className="lineage-pill unassigned-pill"><AlertTriangle size={12} /> Unassigned Questions</span>
                    ) : (
                      <span className="lineage-pill"><BookOpen size={12} /> {group.breadcrumb}</span>
                    )}
                  </span>
                </div>
                <span className="chapter-group-count">{group.questions.length} question{group.questions.length === 1 ? '' : 's'}</span>
              </div>

              {!isCollapsed && (
                <div className="chapter-group-questions">
                  {group.questions.map((question) => renderQuestionCard(question))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    ) : (
      <div className="qbank-list">
        {filteredQuestions.map((question) => renderQuestionCard(question))}
      </div>
    )}

    {dialog && (
      <QuestionDialog
        question={dialog.question}
        chapters={chapters}
        onClose={() => setDialog(null)}
        onSaved={refresh}
        onDelete={handleDeleteQuestions}
      />
    )}

    {importOpen && (
      <ImportDialog
        chapters={chapters}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />
    )}

    {selectedQuestionIds.length > 0 && (
      <div className="qbank-bulk-bar" role="toolbar" aria-label="Bulk actions">
        <div className="bulk-bar-info">
          <span className="bulk-count-badge">{selectedQuestionIds.length}</span>
          <span>question{selectedQuestionIds.length === 1 ? '' : 's'} selected</span>
          <button type="button" className="bulk-clear-btn" onClick={() => setSelectedQuestionIds([])}>
            Clear
          </button>
        </div>
        <div className="bulk-bar-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={bulkBusy}
            onClick={() => handleBulkStatus('published')}
          >
            <Check size={14} /> Publish Selected
          </button>
          <button
            type="button"
            className="button button-outline"
            disabled={bulkBusy}
            onClick={() => handleBulkStatus('draft')}
          >
            Move to Draft
          </button>
          <button
            type="button"
            className="button button-danger"
            disabled={bulkBusy}
            onClick={() => handleDeleteQuestions(selectedQuestionIds)}
          >
            <Trash2 size={14} /> Delete Selected
          </button>
        </div>
      </div>
    )}
  </div>;
}

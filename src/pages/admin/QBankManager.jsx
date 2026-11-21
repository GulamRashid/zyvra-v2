import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, Download, FileQuestion, Filter, HelpCircle, Layers, LayoutGrid, List, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getOptionEntries, hasDevanagari, hasLatin, normalizeImportQuestionText, parseImportCsv, validateImportQuestion } from '../../lib/tests';
import { AI_CSV_GENERATION_PROMPT, CSV_TEMPLATE, JSON_TEMPLATE } from '../../lib/question-templates';
import { getContentErrorMessage, getFolderPath } from '../../lib/content';
import useContentCatalog from '../../hooks/useContentCatalog';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import QuestionFormatter from '../../components/common/QuestionFormatter';
import UploadGuide from '../../components/common/UploadGuide';
import PcsQuestionGeneratorModal from '../../components/admin/PcsQuestionGeneratorModal';
import HierarchicalChapterSelect from '../../components/admin/HierarchicalChapterSelect';
import HierarchicalFolderSelect from '../../components/admin/HierarchicalFolderSelect';

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

function QuestionDialog({ question, chapters, folders, exams, onClose, onSaved, onDelete }) {
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
    if (!values.question_text.trim() && !values.question_text_hi.trim()) { setError('Question text is required (in English or Hindi).'); return; }
    if (values.options.some((option) => !option.en.trim() && !option.hi.trim())) { setError('Every answer option must have text (in English or Hindi).'); return; }
    if (!values.options.some((_, index) => String.fromCharCode(65 + index) === values.correct_answer)) { setError('Choose a correct answer that exists in the options.'); return; }
    if (!values.subject.trim()) { setError('Subject is required.'); return; }
    if (!values.chapter_id || !chapters.some((chapter) => chapter.id === values.chapter_id)) { setError('Choose a valid chapter mapping.'); return; }
    if (!supabase) { setError('Supabase is not configured.'); return; }
    const optionKeys = values.options.map((_, index) => String.fromCharCode(65 + index));
    const qEn = String(values.question_text || '').trim();
    const qHi = String(values.question_text_hi || '').trim();
    const payload = {
      question_text: qEn || qHi,
      question_text_hi: qHi || null,
      options: values.options.map((option) => {
        const optEn = String(option.en || '').trim();
        const optHi = String(option.hi || '').trim();
        return { en: optEn || optHi, hi: optHi || optEn };
      }),
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

  return <div className="modal-backdrop"><form className="content-dialog qbank-dialog" role="dialog" aria-modal="true" aria-labelledby="question-dialog-title" onSubmit={save} noValidate>
    <button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
    <div className="eyebrow">{question ? 'QUESTION AUTHORING' : 'ADD TO QUESTION BANK'}</div><h2 id="question-dialog-title">{question ? 'Edit question' : 'Author a question'}</h2>
    <div className="qbank-form-grid"><label className="field-label">Question (English)<textarea className="text-input content-textarea" rows="2" value={values.question_text} onChange={(event) => setField('question_text', event.target.value)} placeholder="Question text in English..." /></label><label className="field-label">Question (Hindi)<textarea className="text-input content-textarea" rows="2" value={values.question_text_hi} onChange={(event) => setField('question_text_hi', event.target.value)} placeholder="हिंदी में प्रश्न..." /></label></div>
    <div className="options-editor-heading"><strong>Answer options</strong><div><span>Option count</span><button type="button" className={values.options.length === 4 ? 'active' : ''} onClick={() => setOptionCount(4)}>4</button><button type="button" className={values.options.length === 5 ? 'active' : ''} onClick={() => setOptionCount(5)}>5</button></div></div>
    <div className="qbank-option-editor">{values.options.map((option, index) => {
      const key = String.fromCharCode(65 + index);
      return <div className={`qbank-option-row ${values.correct_answer === key ? 'correct-option' : ''}`} key={key}><span className="option-key">{key}</span><div className="qbank-option-fields"><input className="text-input" value={option.en} onChange={(event) => setOption(index, 'en', event.target.value)} placeholder={`Option ${key} (English)`} /><input className="text-input" value={option.hi} onChange={(event) => setOption(index, 'hi', event.target.value)} placeholder={`Option ${key} (Hindi)`} /></div><label className="correct-radio" title={`Set ${key} as the answer`}><input type="radio" name="correct-answer" value={key} checked={values.correct_answer === key} onChange={() => setField('correct_answer', key)} /><Check size={14} /></label></div>;
    })}</div>
    <div className="qbank-form-grid">
      <label className="field-label">Subject *<input className="text-input" value={values.subject} onChange={(event) => setField('subject', event.target.value)} required placeholder="e.g. Polity" /></label>
      <label className="field-label">Difficulty<select className="text-input" value={values.difficulty} onChange={(event) => setField('difficulty', event.target.value)}><option value="easy">Easy (सरल)</option><option value="medium">Medium (मध्यम)</option><option value="hard">Hard (कठिन)</option></select></label>
      <div className="field-label">
        <span>Chapter mapping *</span>
        <HierarchicalChapterSelect
          chapters={chapters}
          folders={folders}
          exams={exams}
          value={values.chapter_id}
          onChange={(chId) => setField('chapter_id', chId)}
          required
          showFilters={false}
        />
      </div>
      <label className="field-label">Status<select className="text-input" value={values.status} onChange={(event) => setField('status', event.target.value)}><option value="published">Published (लाइव — प्रकाशित)</option><option value="draft">Draft (ड्राफ्ट — अप्रकाशित)</option><option value="review">Review (समीक्षाधीन)</option><option value="unpublished">Unpublished (छिपाया गया)</option></select></label>
      <label className="field-label">Usage scope<select className="text-input" value={values.usage_scope} onChange={(event) => setField('usage_scope', event.target.value)}><option value="both">Both (मॉक टेस्ट + प्रैक्टिस दोनों में)</option><option value="practice_only">Practice Only (केवल अध्याय अभ्यास)</option><option value="test_only">Test Only (केवल मॉक टेस्ट)</option></select></label>
    </div>
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

function ImportDialog({ chapters, folders, exams, onClose, onImported }) {
  const { user } = useAuth();
  const [json, setJson] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [importStatus, setImportStatus] = useState('published');
  const [importUsageScope, setImportUsageScope] = useState('both');
  const [tests, setTests] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState('mcq');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'ready' | 'errors' | 'saved'
  const [previewSearch, setPreviewSearch] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  useEffect(() => {
    let active = true;
    const loadTests = async () => {
      if (!supabase) return;
      try {
        const { data, error: testsErr } = await supabase
          .from('tests')
          .select('id, title, chapter_id, status, pattern')
          .order('title', { ascending: true });
        if (!testsErr && data && active) {
          setTests(data);
        }
      } catch (err) {
        console.error('Failed to load tests for import dialog:', err);
      }
    };
    loadTests();
    return () => { active = false; };
  }, []);

  const chapterById = useMemo(() => new Map((chapters || []).map((c) => [c.id, c])), [chapters]);
  const availableTests = useMemo(() => {
    if (!selectedChapterId) return tests;
    return tests.filter((t) => t.chapter_id === selectedChapterId);
  }, [tests, selectedChapterId]);

  const handleCopyAiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_CSV_GENERATION_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // fallback
    }
  };

  const getPreparedCsvTemplate = () => {
    const chapterId = selectedChapterId || (selectedTestId ? tests.find((t) => t.id === selectedTestId)?.chapter_id : null) || chapters?.[0]?.id || 'replace-with-chapter-uuid';
    return CSV_TEMPLATE.replace(/replace-with-chapter-uuid/g, chapterId);
  };

  const getPreparedJsonTemplate = () => {
    const chapterId = selectedChapterId || (selectedTestId ? tests.find((t) => t.id === selectedTestId)?.chapter_id : null) || chapters?.[0]?.id || 'replace-with-chapter-uuid';
    return JSON_TEMPLATE.replace(/replace-with-chapter-uuid/g, chapterId);
  };

  const downloadSampleCsv = () => {
    const content = getPreparedCsvTemplate();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zyvra-bilingual-question-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJson = () => {
    const content = getPreparedJsonTemplate();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zyvra-bilingual-question-template.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds the 5 MB limit. Please split into smaller batches.');
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json'].includes(ext)) {
      setError('Only .csv and .json files are supported.');
      return;
    }
    setError('');
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setJson(content);
        setPreview(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

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
        let targetChapterId = row?.chapter_id;
        if (!targetChapterId || targetChapterId === 'replace-with-chapter-uuid') {
          targetChapterId = selectedChapterId
            || (selectedTestId ? tests.find((t) => t.id === selectedTestId)?.chapter_id : null)
            || (chapters.length > 0 ? chapters[0].id : null);
          row.chapter_id = targetChapterId;
        }
        const result = validateImportQuestion(row, index, seen, seenQuestionTexts);
        const usageScope = String(row?.usage_scope || importUsageScope).trim().toLowerCase();
        const usageScopeValid = usageScopes.includes(usageScope);
        if (!usageScopeValid) {
          result.errors.push(`Row ${index + 1}: usage_scope must be both, practice_only, or test_only.`);
        }
        const chapterValid = chapters.some((chapter) => chapter.id === targetChapterId);
        if (!chapterValid) result.errors.push(`Row ${index + 1}: chapter_id must match a chapter in this catalogue.`);
        result.valid = result.valid && chapterValid && usageScopeValid;
        return {
          row: { ...row, usage_scope: usageScope },
          duplicate: result.errors.some((message) => message.toLowerCase().includes('duplicate')),
          originalRowNumber: index + 1,
          ...result
        };
      });
      setPreview(checked);
      setPreviewFilter('all');
      setPreviewSearch('');
      setImportSummary(null);
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
        question_type: row.question_type || 'mcq',
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
        explanation: String(row.explanation || row.explanation_en || '').trim() || null,
        explanation_hi: String(row.explanation_hi || '').trim() || null,
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
    if (!window.confirm(`Import ${validRows.length} validated question${validRows.length === 1 ? '' : 's'} now? Rejected and duplicate rows will be skipped.`)) {
      return;
    }
    setIsImporting(true);
    setImportProgress({ saved: 0, total: validRows.length });
    setError('');
    setImportSummary(null);
    let savedCount = 0;
    let failedCount = 0;
    const allInsertedIds = [];
    try {
      const batchSize = 50;
      for (let start = 0; start < validRows.length; start += batchSize) {
        const batch = validRows.slice(start, start + batchSize);
        const chunkItems = validItems.slice(start, start + batch.length);

        const { data: insertedData, error: insertError } = await supabase
          .from('questions')
          .insert(batch)
          .select('id');

        if (insertError) {
          console.warn(`Batch insert failed for rows ${start + 1}-${start + batch.length}. Falling back to row-by-row insert:`, insertError);
          // Fallback to inserting row-by-row so only genuine offending rows fail
          for (let bIdx = 0; bIdx < batch.length; bIdx += 1) {
            const singleRow = batch[bIdx];
            const matchingItem = chunkItems[bIdx];
            const { data: singleData, error: singleError } = await supabase
              .from('questions')
              .insert(singleRow)
              .select('id');

            if (singleError) {
              failedCount += 1;
              const errMsg = singleError.message || 'Database insert failed';
              setPreview((current) => (current
                ? current.map((item) => (item === matchingItem ? {
                    ...item,
                    valid: false,
                    imported: false,
                    errors: [...(item.errors || []), `Database error: ${errMsg}`]
                  } : item))
                : current));
            } else if (singleData && singleData.length > 0) {
              allInsertedIds.push(singleData[0].id);
              savedCount += 1;
              setPreview((current) => (current
                ? current.map((item) => (item === matchingItem ? { ...item, imported: true } : item))
                : current));
            }
            setImportProgress({ saved: savedCount, total: validRows.length });
          }
        } else {
          if (insertedData) {
            allInsertedIds.push(...insertedData.map((item) => item.id));
          }
          setPreview((current) => (current
            ? current.map((item) => (chunkItems.includes(item) ? { ...item, imported: true } : item))
            : current));
          savedCount += batch.length;
          setImportProgress({ saved: savedCount, total: validRows.length });
        }
      }

      // If a target test is selected, automatically link all newly imported questions in exact sequence
      if (selectedTestId && allInsertedIds.length > 0) {
        const { data: maxOrderData } = await supabase
          .from('test_questions')
          .select('display_order')
          .eq('test_id', selectedTestId)
          .order('display_order', { ascending: false })
          .limit(1);

        const currentMax = (maxOrderData && maxOrderData.length > 0 && Number.isInteger(maxOrderData[0].display_order))
          ? maxOrderData[0].display_order
          : -1;

        const testQuestionsPayload = allInsertedIds.map((questionId, index) => ({
          test_id: selectedTestId,
          question_id: questionId,
          display_order: currentMax + 1 + index
        }));

        for (let i = 0; i < testQuestionsPayload.length; i += 50) {
          const tqBatch = testQuestionsPayload.slice(i, i + 50);
          const { error: tqError } = await supabase.from('test_questions').insert(tqBatch);
          if (tqError) {
            console.error('Failed to auto-assign questions to test:', tqError);
            throw new Error(`Questions were saved to Question Bank, but linking to test failed: ${tqError.message}`);
          }
        }
      }

      if (failedCount > 0) {
        setImportSummary({
          saved: savedCount,
          failed: failedCount,
          message: `Import partially completed: ${savedCount} question${savedCount === 1 ? '' : 's'} saved to Question Bank, but ${failedCount} row${failedCount === 1 ? '' : 's'} failed database insert. Review the Errors tab below.`
        });
        setPreviewFilter('errors');
        if (onImported) onImported();
      } else {
        setImportProgress(null);
        setError('');
        if (onImported) onImported();
        onClose();
      }
    } catch (insertError) {
      console.error('DB Insert Failed:', insertError);
      const message = getContentErrorMessage(insertError, 'Unable to import questions.');
      setError(`${message} ${savedCount} rows were saved in this run. Retry to continue with the remaining rows.`);
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = preview?.filter((item) => item.valid && !item.imported).length || 0;
  const importedCount = preview?.filter((item) => item.imported).length || 0;
  const duplicateCount = preview?.filter((item) => item.duplicate && !item.imported).length || 0;
  const invalidCount = preview?.filter((item) => !item.valid && !item.duplicate && !item.imported).length || 0;
  const rejectedCount = duplicateCount + invalidCount;

  const filteredPreview = useMemo(() => {
    if (!preview) return [];
    let items = preview;
    if (previewFilter === 'ready') {
      items = items.filter((item) => item.valid && !item.imported);
    } else if (previewFilter === 'errors') {
      items = items.filter((item) => !item.valid && !item.imported);
    } else if (previewFilter === 'saved') {
      items = items.filter((item) => item.imported);
    }

    if (previewSearch.trim()) {
      const q = previewSearch.trim().toLowerCase();
      items = items.filter((item) => {
        const textEn = String(item.row?.question_text || item.row?.question_en || '').toLowerCase();
        const textHi = String(item.row?.question_text_hi || item.row?.question_hi || '').toLowerCase();
        const subject = String(item.row?.subject || '').toLowerCase();
        const rowNum = String(item.originalRowNumber || '');
        const errs = (item.errors || []).join(' ').toLowerCase();
        return textEn.includes(q) || textHi.includes(q) || subject.includes(q) || rowNum.includes(q) || errs.includes(q);
      });
    }

    return items;
  }, [preview, previewFilter, previewSearch]);

  const previewItems = filteredPreview.slice(0, 50);
  const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const downloadRejectedRows = () => {
    const rejectedRows = (preview || []).filter((item) => !item.valid && !item.imported);
    if (!rejectedRows.length) return;

    const getOptText = (opts, idx) => {
      if (!opts || !Array.isArray(opts)) return '';
      const opt = opts[idx];
      if (!opt) return '';
      if (typeof opt === 'string') return opt;
      if (opt.en && opt.hi) return `${opt.en} | ${opt.hi}`;
      return opt.en || opt.text || opt.hi || opt.text_hi || '';
    };

    const csvRows = [
      ['row', 'category', 'question_text', 'question_text_hi', 'chapter_id', 'subject', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct_answer', 'errors'],
      ...rejectedRows.map((item, index) => [
        item.originalRowNumber || index + 1,
        item.duplicate ? 'duplicate' : 'invalid',
        item.row?.question_text || item.row?.question_en || item.row?.question_text_en || '',
        item.row?.question_text_hi || item.row?.question_hi || '',
        item.row?.chapter_id || '',
        item.row?.subject || '',
        getOptText(item.row?.options, 0),
        getOptText(item.row?.options, 1),
        getOptText(item.row?.options, 2),
        getOptText(item.row?.options, 3),
        getOptText(item.row?.options, 4),
        item.row?.correct_answer || '',
        item.errors.join(' | ')
      ])
    ];
    const blob = new Blob([csvRows.map((row) => row.map(csvEscape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'question-import-rejected-rows.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="modal-backdrop import-modal-backdrop"><section className="content-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <header className="import-modal-header"><div><div className="eyebrow">SAFE BULK AUTHORING</div><h2 id="import-title">Import questions from CSV or JSON</h2></div><button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
    <p className="dialog-intro">Review all rows before saving. Questions will be imported with status: <strong>{importStatus}</strong> and usage scope from each row or the default below.</p>
    <div className="import-template-row flex flex-wrap items-center justify-between gap-2.5 my-2.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-700/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="button button-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
          onClick={() => setShowGuide(!showGuide)}
        >
          <HelpCircle size={14} className="text-amber-400" />
          <span>{showGuide ? 'Hide Formatting Guide' : 'Question Formatting Guide'}</span>
        </button>

        <button
          type="button"
          className="button button-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
          onClick={handleCopyAiPrompt}
          title="Copy AI prompt to generate question batches in Claude / ChatGPT"
        >
          {copiedPrompt ? <Check size={14} className="text-emerald-400" /> : <Sparkles size={14} className="text-amber-300" />}
          <span>{copiedPrompt ? 'Prompt Copied!' : 'Copy AI Prompt for CSV'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-button text-xs flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold"
          onClick={downloadSampleCsv}
          title="Download .csv template with all 5 competitive question types"
        >
          <Download size={14} /> Download CSV Template
        </button>
        <button
          type="button"
          className="text-button text-xs flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold"
          onClick={downloadSampleJson}
          title="Download .json template with all 5 competitive question types"
        >
          <Download size={14} /> Download JSON Template
        </button>
      </div>
    </div>

    {/* On-screen Question Type Formatting Guide */}
    {showGuide && (
      <div className="formatting-guide-card my-3 p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Competitive Exam Question Standards & Syntax
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${activeGuideTab === 'mcq' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              onClick={() => setActiveGuideTab('mcq')}
            >
              1. MCQ (4 & 5-Option)
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${activeGuideTab === 'statement' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              onClick={() => setActiveGuideTab('statement')}
            >
              2. Statement & Assertion-Reason
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${activeGuideTab === 'matching' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              onClick={() => setActiveGuideTab('matching')}
            >
              3. Match Following
            </button>
          </div>
        </div>

        {activeGuideTab === 'mcq' && (
          <div className="text-xs space-y-2 text-slate-300">
            <p><strong>Standard 4-Option & 5-Option BPSC Style MCQ:</strong> Single-choice question with 4 (A-D) or 5 (A-E) options in English & Hindi. For BPSC, Option E represents <em>&quot;None of the above / More than one of the above&quot;</em>.</p>
            <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] space-y-1 text-slate-300 overflow-x-auto">
              <div className="text-slate-400"># Standard 4-Option (leave option_e empty in CSV):</div>
              <div>question_en: &quot;Which article of the Indian Constitution guarantees Equality Before Law?&quot;</div>
              <div>option_a_en: &quot;Article 12&quot; | option_b_en: &quot;Article 14&quot; | correct_answer: &quot;B&quot;</div>
              <div className="text-slate-400 mt-2"># BPSC 5-Option:</div>
              <div>option_e_en: &quot;None of the above / More than one of the above&quot;</div>
              <div>option_e_hi: &quot;उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक&quot;</div>
            </div>
          </div>
        )}

        {activeGuideTab === 'statement' && (
          <div className="text-xs space-y-2 text-slate-300">
            <p><strong>Statement & Assertion-Reason Questions:</strong> Use pipe <code className="text-amber-400">|</code> delimiters between prompt, numbered items / statements, and the concluding instruction.</p>
            <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] space-y-1 text-slate-300 overflow-x-auto">
              <div className="text-slate-400"># Multi-Statement Question Syntax:</div>
              <div>&quot;Consider the following statements: | (1) Statement 1 | (2) Statement 2 | Which of the statements given above is/are correct?&quot;</div>
              <div className="text-slate-400 mt-2"># Assertion & Reason Question Syntax:</div>
              <div>&quot;Assertion (A): [Assertion text] | Reason (R): [Reason text] | Choose the correct code:&quot;</div>
              <div className="text-slate-400 mt-1"># Hindi Equivalent:</div>
              <div>&quot;अभिकथन (A): [कथन] | कारण (R): [कारण] | सही कूट का चयन कीजिए:&quot;</div>
            </div>
          </div>
        )}

        {activeGuideTab === 'matching' && (
          <div className="text-xs space-y-2 text-slate-300">
            <p><strong>Match the Following:</strong> Use standardized pipe delimiters: <code className="text-amber-400">Match Column I with Column II: | Column I: (1)... (2)... | Column II: (A)... (B)... | Choose the correct matching:</code>. Automatically parsed into a bilingual 2-column comparison table with zero duplicate text.</p>
            <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] space-y-1 text-slate-300 overflow-x-auto">
              <div className="text-slate-400"># English Syntax:</div>
              <div>&quot;Match Column I with Column II: | Column I: (1) Harappa (2) Mohenjodaro | Column II: (A) Ravi (B) Indus | Choose the correct matching:&quot;</div>
              <div className="text-slate-400 mt-2"># Hindi Syntax (स्तंभ / सूची):</div>
              <div>&quot;स्तंभ I को स्तंभ II से सुमेलित कीजिए: | स्तंभ I: (1) हड़प्पा (2) मोहनजोदड़ो | स्तंभ II: (A) रावी (B) सिंधु | सही मिलान चुनिए:&quot;</div>
              <div className="text-slate-400 mt-1"># Options:</div>
              <div>A: 1-A, 2-B | B: 1-B, 2-A | C: 1-C, 2-D | D: 1-D, 2-C</div>
            </div>
          </div>
        )}
      </div>
    )}

    <div className="qbank-form-grid">
      <div className="field-label">
        <span>Target Chapter (Auto-fills Template & Upload)</span>
        <HierarchicalChapterSelect
          chapters={chapters}
          folders={folders}
          exams={exams}
          value={selectedChapterId}
          onChange={(chId) => {
            setSelectedChapterId(chId);
            if (chId && selectedTestId) {
              const currentTest = tests.find((t) => t.id === selectedTestId);
              if (currentTest && currentTest.chapter_id !== chId) {
                setSelectedTestId('');
              }
            }
          }}
          placeholder="All Chapters / From template"
        />
      </div>

      <label className="field-label">Link Imported Questions to Test
        <select
          className="text-input"
          value={selectedTestId}
          onChange={(event) => {
            const testId = event.target.value;
            setSelectedTestId(testId);
            if (testId) {
              const targetTest = tests.find((t) => t.id === testId);
              if (targetTest?.chapter_id && !selectedChapterId) {
                setSelectedChapterId(targetTest.chapter_id);
              }
            }
          }}
        >
          <option value="">None — Save to Question Bank only</option>
          {availableTests.map((test) => {
            const ch = chapterById.get(test.chapter_id);
            return (
              <option value={test.id} key={test.id}>
                {test.title} {ch ? `(${ch.title})` : ''}
              </option>
            );
          })}
        </select>
      </label>

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

    {selectedTestId && (
      <div className="flex items-center gap-2 p-2.5 my-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-300">
        <span>⚡ Auto-assign active: Questions will be saved to Question Bank and added to <strong>{tests.find((t) => t.id === selectedTestId)?.title}</strong> in sequence.</span>
      </div>
    )}
    <div className="file-upload-section" style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <label className="button button-outline" style={{ cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Upload size={14} />
          <span>{uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Upload CSV / JSON File'}</span>
          <input
            type="file"
            accept=".csv, .json, text/csv, application/json"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </label>
        {uploadedFileName && (
          <button
            type="button"
            className="text-button"
            style={{ color: '#F87171', fontSize: '11px' }}
            onClick={() => { setUploadedFileName(''); setJson(''); setPreview(null); }}
          >
            Clear file
          </button>
        )}
      </div>
      <UploadGuide
        formats=".csv, .json"
        dimensions="Template formatted columns or JSON array"
        maxSize="Max 5 MB per batch"
      />
    </div>
    <textarea
      className="text-input import-json-input font-mono text-xs"
      value={json}
      onChange={(event) => { setJson(event.target.value); setPreview(null); }}
      rows="10"
      spellCheck="false"
      placeholder={`[
  {
    "question_type": "mcq",
    "question_text": "Which article guarantees equality before law?",
    "question_text_hi": "विधि के समक्ष समता किस अनुच्छेद में है?",
    "options": [
      { "en": "Article 12", "hi": "अनुच्छेद 12" },
      { "en": "Article 14", "hi": "अनुच्छेद 14" },
      { "en": "Article 19", "hi": "अनुच्छेद 19" },
      { "en": "Article 21", "hi": "अनुच्छेद 21" }
    ],
    "correct_answer": "B",
    "subject": "Polity",
    "difficulty": "easy"
  }
]
// Or paste your CSV rows (with headers) here...`}
    />
    <button className="button button-outline" onClick={validate} disabled={isValidating || isImporting}><Filter size={15} /> {isValidating ? 'Validating…' : 'Validate & preview'}</button>
    {error && <div className="feedback error-feedback">{error}</div>}
    {preview && (
      <div className="import-preview space-y-3">
        <div className="import-preview-heading flex flex-wrap items-center justify-between gap-2">
          <strong>Import Preview</strong>
          <span className="text-xs text-slate-400">
            {validCount} ready · {importedCount} saved · {rejectedCount} rejected
          </span>
        </div>

        {importSummary && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
            <span>{importSummary.message}</span>
            <button
              type="button"
              className="text-xs font-bold text-amber-200 underline hover:text-white"
              onClick={() => setImportSummary(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Pills & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                previewFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              onClick={() => setPreviewFilter('all')}
            >
              All ({preview.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                previewFilter === 'ready'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              onClick={() => setPreviewFilter('ready')}
            >
              <Check size={12} />
              Ready to Import ({validCount})
            </button>
            {rejectedCount > 0 && (
              <button
                type="button"
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  previewFilter === 'errors'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-950/60 text-rose-300 hover:bg-rose-900/60 border border-rose-500/30'
                }`}
                onClick={() => setPreviewFilter('errors')}
              >
                <X size={12} />
                Errors & Duplicates ({rejectedCount})
              </button>
            )}
            {importedCount > 0 && (
              <button
                type="button"
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  previewFilter === 'saved'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                onClick={() => setPreviewFilter('saved')}
              >
                Saved ({importedCount})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search preview..."
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg text-xs pl-7 pr-2.5 py-1 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
              />
            </div>
            {rejectedCount > 0 && (
              <button
                type="button"
                className="button button-outline text-xs py-1 px-2.5 flex items-center gap-1 text-rose-400 hover:text-rose-300 border-rose-500/40"
                onClick={downloadRejectedRows}
                title="Export rows with errors or duplicates to CSV"
              >
                <Download size={13} />
                Export Rejected ({rejectedCount})
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center justify-between">
          <span>
            Showing {previewItems.length} of {filteredPreview.length} {previewFilter !== 'all' ? `(${previewFilter})` : ''} rows
            {filteredPreview.length > previewItems.length && ' (capped at first 50)'}
          </span>
          {rejectedCount > 0 && previewFilter !== 'errors' && (
            <button
              type="button"
              className="text-xs font-semibold text-rose-400 hover:underline flex items-center gap-1"
              onClick={() => setPreviewFilter('errors')}
            >
              <AlertTriangle size={12} />
              View {rejectedCount} problematic rows
            </button>
          )}
        </div>

        {previewItems.map((item, index) => {
          const rowNum = item.originalRowNumber ?? (index + 1);
          return (
            <div
              className={`import-preview-row ${item.imported ? 'valid' : item.valid ? 'valid' : 'invalid'} p-3 rounded-2xl border mb-3`}
              key={item.row?.id || `preview-${rowNum}-${index}`}
            >
              <div className="flex items-start gap-3 w-full">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-1 ${
                    item.imported
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : item.valid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {item.imported ? <Check size={14} /> : item.valid ? <Check size={14} /> : <X size={14} />}
                </span>
                <div className="flex-1 space-y-2.5 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        {item.row?.question_type || 'mcq'}
                      </span>
                      <span className="text-xs font-bold text-slate-300">Row {rowNum}</span>
                      {item.duplicate && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Duplicate
                        </span>
                      )}
                    </div>
                    <small className="text-xs text-slate-400">
                      {item.imported ? 'Saved in this import' : `Usage: ${usageScopeLabel(item.row?.usage_scope)} · Difficulty: ${item.row?.difficulty || 'medium'}`}
                    </small>
                  </div>

                  {/* Formatted English Question */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Question (English)</div>
                    <QuestionFormatter text={item.row?.question_text || item.row?.question_en} />
                  </div>

                  {/* Formatted Hindi Question if present */}
                  {(item.row?.question_text_hi || item.row?.question_hi) && (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">प्रश्न (Hindi)</div>
                      <QuestionFormatter text={item.row?.question_text_hi || item.row?.question_hi} />
                    </div>
                  )}

                  {/* Formatted Answer Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(item.row?.options || []).map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx);
                      const isCorrect = String(item.row?.correct_answer || '').toUpperCase() === letter;
                      const optEn = typeof opt === 'string' ? opt : opt?.en || opt?.text || '';
                      const optHi = typeof opt === 'object' ? opt?.hi || opt?.text_hi || '' : '';
                      return (
                        <div
                          key={letter}
                          className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                              : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                          }`}
                        >
                          <span className="font-mono font-bold mr-1">{letter}.</span>
                          <span className="flex-1">{optEn} {optHi && <span className="opacity-75">({optHi})</span>}</span>
                          {isCorrect && <Check size={13} className="text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {item.row?.explanation && (
                    <div className="text-xs text-slate-400 pt-1">
                      <strong className="text-slate-300">Explanation: </strong>
                      {item.row.explanation}
                    </div>
                  )}

                  {item.errors.map((message) => (
                    <div key={message} className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-1 rounded">
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
    <footer className="import-modal-actions">
      <button type="button" className="button button-outline" onClick={onClose} disabled={isImporting}>
        {importedCount > 0 && validCount === 0 ? 'Done' : 'Cancel'}
      </button>
      {importProgress && (
        <span className="field-hint">
          Saved {importProgress.saved} of {importProgress.total} questions…
        </span>
      )}
      <button
        type="button"
        className="button button-primary"
        onClick={handleImportQuestions}
        disabled={isImporting || isValidating || !validCount}
      >
        {isImporting
          ? `Saving ${importProgress?.saved || 0} of ${importProgress?.total || validCount}…`
          : validCount
            ? `Import ${validCount} Valid Question${validCount === 1 ? '' : 's'}${selectedTestId ? ' & Link to Test' : ''} (${importStatus})`
            : importedCount > 0
              ? `Saved ${importedCount} Question${importedCount === 1 ? '' : 's'}${selectedTestId ? ' & Linked to Test' : ''}`
              : 'Import Valid Questions'}
      </button>
    </footer>
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
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tests, setTests] = useState([]);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    supabase.from('tests').select('id, title, chapter_id').order('title').then(({ data, error: err }) => {
      if (!err && data && active) setTests(data);
    });
    return () => { active = false; };
  }, []);

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
        <button
          type="button"
          className="button bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white border-0 shadow-md shadow-indigo-600/25 flex items-center gap-1.5 font-bold"
          onClick={() => setAiGeneratorOpen(true)}
          title="Generate authentic State PSC / BPSC questions using AI"
        >
          <Sparkles size={15} /> AI Examiner (PCS)
        </button>
        <button className="button button-outline" onClick={() => setImportOpen(true)}><Upload size={15} /> Bulk import</button>
        <button className="button button-primary" onClick={() => setDialog({ question: null })}><Plus size={15} /> Author question</button>
      </div>
    </div>

    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 px-3.5 py-2.5 text-xs text-indigo-200 flex items-center gap-2 mb-4">
      <span>💡 <strong>त्वरित सहायता:</strong> प्रश्न बैंक में सवाल जोड़ते समय उसे किसी Chapter से अवश्य मैप करें। 'Bulk import' से आप एक साथ सैकड़ों सवाल CSV/JSON फ़ाइल द्वारा सीधे अपलोड कर सकते हैं।</span>
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
        <div className="filter-select min-w-[220px]">
          <span className="block text-xs font-semibold text-slate-400 mb-1">Folder</span>
          <HierarchicalFolderSelect
            folders={folders}
            exams={exams}
            selectedExamId={selectedExamId}
            value={selectedFolderId}
            onChange={(folderId) => {
              setSelectedFolderId(folderId);
              setSelectedChapterId('all');
            }}
            allOptionLabel="All folders"
          />
        </div>

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

    {dialog && createPortal(
      <QuestionDialog
        question={dialog.question}
        chapters={chapters}
        folders={folders}
        exams={exams}
        onClose={() => setDialog(null)}
        onSaved={refresh}
        onDelete={handleDeleteQuestions}
      />,
      document.body
    )}

    {importOpen && createPortal(
      <ImportDialog
        chapters={chapters}
        folders={folders}
        exams={exams}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />,
      document.body
    )}

    {aiGeneratorOpen && createPortal(
      <PcsQuestionGeneratorModal
        isOpen={aiGeneratorOpen}
        onClose={() => setAiGeneratorOpen(false)}
        chapters={chapters}
        tests={tests}
        onQuestionsInserted={() => {
          refresh();
        }}
      />,
      document.body
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

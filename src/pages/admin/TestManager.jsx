import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, CheckSquare, ChevronDown, ClipboardList, Clock3, Coins, FileQuestion, Plus, Search, Square, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getOptionEntries, TEST_PATTERNS } from '../../lib/tests';
import { getContentErrorMessage } from '../../lib/content';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const initialTest = {
  title: '', instructions: '', pattern: TEST_PATTERNS[0].value, duration_minutes: 60,
  attempt_limit: 1, positive_marks: 1, negative_marks: 0.25,
  mandatory_option_e_penalty: 0.25, coin_reward_enabled: true,
  chapter_id: '', solution_mode: 'after_submit', status: 'draft'
};

function slugifyTestTitle(title) {
  return String(title || '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'test';
}

function TestEditor({ test, chapters, linkedOptionCounts, onClose, onSaved }) {
  const [values, setValues] = useState(() => test
    ? { ...initialTest, ...test, status: String(test.status || 'draft').toLowerCase() }
    : { ...initialTest });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const setField = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const save = async (event) => {
    event.preventDefault();
    setError('');
    const title = String(values.title || '').trim();
    if (title.length < 3 || title.length > 120) { setError('Test title must be between 3 and 120 characters.'); return; }
    if (!values.chapter_id || !chapters.some((chapter) => chapter.id === values.chapter_id)) { setError('Select a valid chapter for this test.'); return; }
    if (!Number.isInteger(Number(values.duration_minutes)) || Number(values.duration_minutes) < 1 || Number(values.duration_minutes) > 1440) { setError('Duration must be between 1 and 1440 minutes.'); return; }
    if (!Number.isInteger(Number(values.attempt_limit)) || Number(values.attempt_limit) < 1 || Number(values.attempt_limit) > 100) { setError('Attempt limit must be between 1 and 100.'); return; }
    if (!(Number(values.positive_marks) > 0) || !Number.isFinite(Number(values.positive_marks))) { setError('Positive marks must be greater than zero.'); return; }
    if (Number(values.negative_marks) < 0 || !Number.isFinite(Number(values.negative_marks))) { setError('Negative marks cannot be less than zero.'); return; }
    if (values.pattern === 'bpsc-mandatory-e' && (Number(values.mandatory_option_e_penalty) < 0 || !Number.isFinite(Number(values.mandatory_option_e_penalty)))) { setError('The blank Option E penalty must be zero or greater.'); return; }
    const requiredOptions = TEST_PATTERNS.find((pattern) => pattern.value === values.pattern)?.optionCount;
    if (linkedOptionCounts.some((count) => count !== requiredOptions)) { setError(`This test contains questions that do not match the ${requiredOptions}-option pattern. Remove incompatible questions before changing its pattern.`); return; }
    if (!supabase) { setError('Supabase is not configured.'); return; }
    const payload = {
      title,
      slug: slugifyTestTitle(title),
      instructions: String(values.instructions || '').trim() || null,
      pattern: values.pattern,
      duration_minutes: Number(values.duration_minutes),
      attempt_limit: Number(values.attempt_limit),
      positive_marks: Number(values.positive_marks),
      negative_marks: Number(values.negative_marks),
      mandatory_option_e_penalty: values.pattern === 'bpsc-mandatory-e' ? Number(values.mandatory_option_e_penalty) : 0,
      coin_reward_enabled: Boolean(values.coin_reward_enabled),
      chapter_id: values.chapter_id,
      solution_mode: values.solution_mode || 'after_submit',
      status: String(values.status || 'draft').toLowerCase()
    };
    setSaving(true);
    try {
      const request = test ? supabase.from('tests').update(payload).eq('id', test.id) : supabase.from('tests').insert(payload);
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(getContentErrorMessage(saveError, 'Unable to save test configuration.'));
    } finally { setSaving(false); }
  };
  return <div className="modal-backdrop"><form className="content-dialog test-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="test-editor-title" onSubmit={save}>
    <button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}>×</button><div className="eyebrow">TEST CONFIGURATION</div><h2 id="test-editor-title">{test ? 'Edit test' : 'Create a test'}</h2>
    <label className="field-label">Test title *<input className="text-input" value={values.title} onChange={(event) => setField('title', event.target.value)} minLength="3" maxLength="120" required placeholder="e.g. Indian Polity — Chapter Test" /></label>
    <label className="field-label">Chapter *<select className="text-input" value={values.chapter_id} onChange={(event) => setField('chapter_id', event.target.value)} required><option value="">Select a chapter</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</select></label>
    <label className="field-label">Question pattern *<select className="text-input" value={values.pattern} onChange={(event) => setField('pattern', event.target.value)}>{TEST_PATTERNS.map((pattern) => <option value={pattern.value} key={pattern.value}>{pattern.label}</option>)}</select><small>{TEST_PATTERNS.find((item) => item.value === values.pattern)?.optionCount} options per question.</small></label>
    {values.pattern === 'bpsc-mandatory-e' && <label className="field-label">Penalty when student leaves Option E blank *<div className="number-input"><input aria-label="Mandatory Option E blank penalty" type="number" min="0" step="0.01" value={values.mandatory_option_e_penalty} onChange={(event) => setField('mandatory_option_e_penalty', event.target.value)} required /><span>marks deducted</span></div><small>Applies only when no answer is selected. Selecting option E is a valid response.</small></label>}
    <div className="test-config-grid"><label className="field-label">Duration (minutes) *<input className="text-input" type="number" min="1" max="1440" step="1" value={values.duration_minutes} onChange={(event) => setField('duration_minutes', event.target.value)} required /></label><label className="field-label">Attempt limit *<input className="text-input" type="number" min="1" max="100" step="1" value={values.attempt_limit} onChange={(event) => setField('attempt_limit', event.target.value)} required /></label><label className="field-label">Positive marks *<input className="text-input" type="number" min="0.01" step="0.01" value={values.positive_marks} onChange={(event) => setField('positive_marks', event.target.value)} required /></label><label className="field-label">Negative marks *<input className="text-input" type="number" min="0" step="0.01" value={values.negative_marks} onChange={(event) => setField('negative_marks', event.target.value)} required /></label></div>
    <label className="field-label">Instructions<textarea className="text-input content-textarea" rows="3" value={values.instructions || ''} onChange={(event) => setField('instructions', event.target.value)} placeholder="Instructions shown before the student starts." /></label>
    <label className="content-switch"><input type="checkbox" checked={Boolean(values.coin_reward_enabled)} onChange={(event) => setField('coin_reward_enabled', event.target.checked)} /><span>Enable Zyvra Coins reward (qualification and first-attempt rules enforced by server)</span></label>
    <label className="field-label">Answer & explanation display
      <select className="text-input" value={values.solution_mode || 'after_submit'} onChange={(event) => setField('solution_mode', event.target.value)}>
        <option value="after_submit">Exam Mode — show answers & explanations only after test submission</option>
        <option value="immediate">Practice Mode — show answer & explanation immediately upon selecting an option</option>
      </select>
      <small>Practice mode reveals correct answer, explanation, and option notes right as the student picks an answer.</small>
    </label>
    <label className="field-label">Availability<select className="text-input" value={values.status} onChange={(event) => { setField('status', event.target.value); setError(''); }}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="paused">Paused</option></select></label>
    {error && <div className="feedback error-feedback" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-gold" disabled={saving}>{saving ? 'Saving…' : test ? 'Save test' : 'Create test'}</button></div>
  </form></div>;
}

export default function TestManager() {
  const { chapters } = useContentCatalog();
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [testQuestions, setTestQuestions] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [query, setQuery] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [usageScopeFilter, setUsageScopeFilter] = useState('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [editor, setEditor] = useState(null);
  const [testToDelete, setTestToDelete] = useState(null);
  const [deletingTest, setDeletingTest] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const refresh = async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const [testResult, questionResult] = await Promise.all([
      supabase.from('tests').select('*').order('created_at', { ascending: false }),
      supabase.from('questions').select('*').order('created_at', { ascending: false })
    ]);
    const failed = [testResult, questionResult].find((result) => result.error);
    if (failed) throw failed.error;
    setTests(testResult.data || []);
    setQuestions(questionResult.data || []);
    setLoading(false);
  };
  useEffect(() => { refresh().catch((loadError) => { setError(getContentErrorMessage(loadError, 'Unable to load tests.')); setLoading(false); }); }, []);
  const selectedTest = tests.find((test) => test.id === selectedTestId);
  const testPattern = TEST_PATTERNS.find((pattern) => pattern.value === selectedTest?.pattern) || TEST_PATTERNS[0];
  const compatibleQuestions = useMemo(() => {
    if (!selectedTest) return [];
    return questions.filter((question) => {
      const optionCount = getOptionEntries(question.options).length;
      if (optionCount !== testPattern.optionCount || question.status !== 'published') return false;
      const usageScope = question.usage_scope || 'both';
      if (!['both', 'test_only'].includes(usageScope)) return false;
      if (usageScopeFilter !== 'all' && usageScope !== usageScopeFilter) return false;
      if (question.chapter_id !== selectedTest.chapter_id) return false;
      const search = questionSearch.trim().toLowerCase();
      return !search || `${question.question_text?.en || question.question_text || ''} ${question.subject || ''} ${question.tags || ''}`.toLowerCase().includes(search);
    });
  }, [questions, selectedTest, testPattern, questionSearch, usageScopeFilter]);
  const unlinkedQuestions = useMemo(() => {
    const existing = new Set(testQuestions.map((item) => item.question_id));
    return compatibleQuestions.filter((question) => !existing.has(question.id));
  }, [compatibleQuestions, testQuestions]);
  const allSelected = unlinkedQuestions.length > 0 && unlinkedQuestions.every((q) => selectedQuestionIds.includes(q.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      const unlinkedIds = new Set(unlinkedQuestions.map((q) => q.id));
      setSelectedQuestionIds((current) => current.filter((id) => !unlinkedIds.has(id)));
    } else {
      const unlinkedIds = unlinkedQuestions.map((q) => q.id);
      setSelectedQuestionIds((current) => Array.from(new Set([...current, ...unlinkedIds])));
    }
  };
  const orderedQuestions = testQuestions.map((link) => ({ ...link, question: questions.find((question) => question.id === link.question_id) })).filter((item) => item.question);
  const chapterTitle = (chapterId) => chapters.find((chapter) => chapter.id === chapterId)?.title || 'Unmapped chapter';
  const loadTestQuestions = async (testId) => {
    if (!testId || !supabase) { setTestQuestions([]); return; }
    const { data, error: loadError } = await supabase.from('test_questions').select('*').eq('test_id', testId).order('display_order', { ascending: true });
    if (loadError) throw loadError;
    setTestQuestions(data || []);
    setSelectedQuestionIds([]);
  };
  const selectTest = async (testId) => {
    setSelectedTestId(testId);
    setError('');
    try { await loadTestQuestions(testId); }
    catch (loadError) { setError(getContentErrorMessage(loadError, 'Unable to load this test’s question order.')); }
  };
  const saveTest = async () => {
    await refresh();
    if (editor?.test) await loadTestQuestions(editor.test.id);
  };
  const addSelected = async () => {
    if (!selectedTest || !selectedQuestionIds.length || !supabase) return;
    setError('');
    try {
      const existing = new Set(testQuestions.map((item) => item.question_id));
      const additions = selectedQuestionIds.filter((id) => !existing.has(id)).map((question_id, index) => ({
        test_id: selectedTest.id,
        question_id,
        display_order: testQuestions.length + index
      }));
      if (additions.length) {
        const { error: addError } = await supabase.from('test_questions').insert(additions);
        if (addError) throw addError;
      }
      await loadTestQuestions(selectedTest.id);
    } catch (addError) { setError(getContentErrorMessage(addError, 'Unable to add questions to this test.')); }
  };
  const moveQuestion = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= testQuestions.length || savingOrder) return;
    const reordered = [...testQuestions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((item, order) => ({ ...item, display_order: order }));
    setSavingOrder(true);
    try {
      const { error: orderError } = await supabase.from('test_questions').upsert(normalized, { onConflict: 'id' });
      if (orderError) throw orderError;
      setTestQuestions(normalized);
    } catch (orderError) { setError(getContentErrorMessage(orderError, 'Unable to update question order.')); }
    finally { setSavingOrder(false); }
  };
  const removeQuestion = async (link) => {
    if (!supabase) return;
    try {
      const { error: removeError } = await supabase.from('test_questions').delete().eq('id', link.id);
      if (removeError) throw removeError;
      await loadTestQuestions(selectedTest.id);
    } catch (removeError) { setError(getContentErrorMessage(removeError, 'Unable to remove question.')); }
  };

  const executeDeleteTest = async (test) => {
    if (!test || !supabase) return;
    setDeletingTest(true);
    setError('');
    try {
      // 1. Delete dependent records cleanly
      await supabase.from('test_questions').delete().eq('test_id', test.id);
      await supabase.from('test_attempts').delete().eq('test_id', test.id);

      // 2. Delete test from tests table and verify rows deleted
      const { data, error: deleteError } = await supabase
        .from('tests')
        .delete()
        .eq('id', test.id)
        .select();

      if (deleteError) throw deleteError;
      if (!data || data.length === 0) {
        throw new Error('Test could not be deleted. Check admin permissions (RLS policy).');
      }

      // 3. Immediately update state
      setTests((current) => current.filter((item) => item.id !== test.id));
      if (selectedTestId === test.id) {
        setSelectedTestId('');
        setTestQuestions([]);
      }
      setTestToDelete(null);
      setSuccessMessage(`“${test.title}” was permanently deleted.`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(getContentErrorMessage(err, 'Unable to delete this test.'));
    } finally {
      setDeletingTest(false);
    }
  };

  const filteredTests = tests.filter((test) => !query.trim() || `${test.title} ${test.pattern} ${chapterTitle(test.chapter_id)}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="test-manager-page">
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION / ASSESSMENT DESIGN</div><h1>Test manager</h1><p>Configure BPSC patterns, scoring rules and question order.</p></div><button className="button button-gold" onClick={() => setEditor({ test: null })}><Plus size={15} /> Create test</button></div>
    {error && <div className="feedback error-feedback" role="alert">{error}</div>}
    {successMessage && <div className="feedback success-feedback" role="status">{successMessage}</div>}
    <div className="test-manager-layout">
      <aside className="test-list-panel panel-card">
        <div className="section-heading"><div><div className="eyebrow">ASSESSMENTS</div><h2>All tests</h2></div><span className="chapter-item-count">{filteredTests.length}</span></div>
        <label className="content-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a test…" /></label>
        {loading ? <LoadingSkeleton rows={3} /> : filteredTests.map((test) => (
          <div key={test.id} className={`test-list-item-row ${selectedTestId === test.id ? 'selected' : ''}`}>
            <button
              type="button"
              className={`test-list-item ${selectedTestId === test.id ? 'selected' : ''}`}
              onClick={() => selectTest(test.id)}
            >
              <span className="test-list-icon"><ClipboardList size={17} /></span>
              <span><strong>{test.title}</strong><small>{chapterTitle(test.chapter_id)} · {test.duration_minutes} min</small></span>
              <span className={`content-status status-${test.status || 'draft'}`}>{test.status || 'draft'}</span>
            </button>
            <button
              type="button"
              className="icon-button test-delete-btn"
              title={`Delete ${test.title}`}
              aria-label={`Delete ${test.title}`}
              onClick={(event) => {
                event.stopPropagation();
                setTestToDelete(test);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </aside>
      <section className="test-builder-panel panel-card">{!selectedTest ? <div className="content-empty-state"><div className="placeholder-icon"><ClipboardList size={23} /></div><h2>Create a test or select one.</h2><p>Then add eligible published questions and arrange them in the order students will see.</p></div> : <>
        <div className="workspace-title-row">
          <div><div className="eyebrow">TEST BUILDER</div><h2>{selectedTest.title}</h2><p>{chapterTitle(selectedTest.chapter_id)} · {testPattern.label}</p></div>
          <div className="test-builder-actions">
            <button type="button" className="button button-outline" onClick={() => setEditor({ test: selectedTest })}>Edit settings</button>
            <button
              type="button"
              className="button button-danger-outline"
              onClick={() => setTestToDelete(selectedTest)}
              title="Delete this test permanently"
            >
              <Trash2 size={14} /> Delete test
            </button>
          </div>
        </div>
        <div className="test-config-chips"><span><Clock3 size={14} /> {selectedTest.duration_minutes} min</span><span><FileQuestion size={14} /> {orderedQuestions.length} questions</span><span>+{selectedTest.positive_marks} / −{selectedTest.negative_marks}</span><span><Coins size={14} /> {selectedTest.coin_reward_enabled ? 'Rewards enabled' : 'No rewards'}</span></div>
        <section className="test-order-section"><div className="section-heading"><div><div className="eyebrow">QUESTION SEQUENCE</div><h2>Test questions</h2></div><span className="chapter-item-count">Drag-free ordering controls</span></div>{!orderedQuestions.length && <div className="empty-content test-empty"><FileQuestion size={22} /><strong>No questions added yet.</strong><span>Use the question bank below to build this test.</span></div>}{orderedQuestions.map(({ id, question }, index) => <div className="test-order-row" key={id}><span className="order-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{question.question_text?.en || question.question_text}</strong><span>{question.subject} · {getOptionEntries(question.options).length} options</span></div><div className="order-controls"><button title="Move up" aria-label="Move question up" disabled={!index || savingOrder} onClick={() => moveQuestion(index, -1)}><ArrowUp size={15} /></button><button title="Move down" aria-label="Move question down" disabled={index === orderedQuestions.length - 1 || savingOrder} onClick={() => moveQuestion(index, 1)}><ArrowDown size={15} /></button><button title="Remove question" aria-label="Remove question" onClick={() => removeQuestion(testQuestions[index])}><Trash2 size={15} /></button></div></div>)}</section>
        <section className="test-question-picker"><div className="section-heading"><div><div className="eyebrow">COMPATIBLE QUESTIONS</div><h2>Question bank</h2></div><span className="chapter-item-count">{testPattern.optionCount}-option · Published</span></div><div className="test-question-picker-toolbar"><label className="content-search"><Search size={14} /><input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search this chapter’s questions…" /></label><label className="filter-select"><span>Usage scope</span><select className="text-input" value={usageScopeFilter} onChange={(event) => setUsageScopeFilter(event.target.value)}><option value="all">All test-eligible</option><option value="test_only">Test Only</option><option value="both">Both</option></select></label><button type="button" className="button button-outline" disabled={!unlinkedQuestions.length} onClick={toggleSelectAll} title={allSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}>{allSelected ? <CheckSquare size={14} /> : <Square size={14} />} {allSelected ? 'Deselect all' : unlinkedQuestions.length ? `Select all (${unlinkedQuestions.length})` : 'Select all'}</button></div><div className="compatible-list">{unlinkedQuestions.map((question) => <label className="compatible-question" key={question.id}><input type="checkbox" checked={selectedQuestionIds.includes(question.id)} onChange={(event) => setSelectedQuestionIds((current) => event.target.checked ? [...current, question.id] : current.filter((id) => id !== question.id))} /><span><strong>{question.question_text?.en || question.question_text}</strong><small>{question.subject} · {question.difficulty} · {question.usage_scope === 'test_only' ? 'Test Only' : 'Both'}</small></span></label>)}</div>{!unlinkedQuestions.length && <p className="field-hint">No additional published {testPattern.optionCount}-option questions are mapped to this chapter.</p>}<button className="button button-gold" disabled={!selectedQuestionIds.length} onClick={addSelected}><Plus size={14} /> Add {selectedQuestionIds.length || ''} selected question{selectedQuestionIds.length === 1 ? '' : 's'}</button></section>
      </>}</section>
    </div>
    {editor && <TestEditor
      test={editor.test}
      chapters={chapters}
      linkedOptionCounts={editor.test ? testQuestions.map((item) => getOptionEntries(questions.find((question) => question.id === item.question_id)?.options).length) : []}
      onClose={() => setEditor(null)}
      onSaved={saveTest}
    />}
    {testToDelete && (
      <div className="modal-backdrop" role="presentation">
        <div className="content-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-test-title">
          <div className="eyebrow text-danger">DANGER ZONE</div>
          <h2 id="confirm-delete-test-title">Permanently delete test?</h2>
          <p className="dialog-intro">
            Are you sure you want to delete <strong>“{testToDelete.title}”</strong>?
            This action cannot be undone. All linked questions, question order, and student attempts associated with this test will be permanently removed.
          </p>
          {error && <div className="feedback error-feedback" role="alert">{error}</div>}
          <div className="modal-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={deletingTest}
              onClick={() => { setTestToDelete(null); setError(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-danger"
              disabled={deletingTest}
              onClick={() => executeDeleteTest(testToDelete)}
            >
              {deletingTest ? 'Deleting…' : 'Delete test permanently'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}

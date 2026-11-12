import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Archive, ArrowDownToLine, ArrowLeft, Atom, BookMarked, BookOpen, Brain, Calculator, Check, ChevronRight, CircleDollarSign, Clock3, Copy, FileText, FlaskConical, Folder, FolderOpen, Globe2, GraduationCap, Landmark, Layers3, Pencil, Plus, ScrollText, Search, Trash2, X } from 'lucide-react';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getContentErrorMessage, getFolderPath, getFolderPricing, slugify } from '../../lib/content';
import { supabase } from '../../lib/supabase';

const examIcons = { BookOpen, GraduationCap, Landmark, Atom, Calculator, Globe2, Brain, ScrollText, FlaskConical, BookMarked };
const iconNames = Object.keys(examIcons);
const initialForm = { title: '', slug: '', description: '', icon: 'BookOpen', display_order: 0, status: 'published', exam_id: '', parent_folder_id: '', allow_tests: true, allow_practice: true, allow_notes: true, pricing_mode: 'free', price: '', subject: '', estimated_study_time_minutes: 20, access_mode: 'inherit' };

const normalizeResourceType = (type) => {
  const clean = String(type || '').trim().toLowerCase();
  if (clean === 'formula sheet' || clean === 'formula-sheet' || clean === 'formula_sheet') return 'formula_sheet';
  if (clean === 'revision sheet' || clean === 'revision-sheet' || clean === 'revision_sheet') return 'revision_sheet';
  if (clean === 'notes') return 'notes';
  return 'pdf';
};

const formatResourceType = (type) => ({
  pdf: 'PDF',
  formula_sheet: 'Formula Sheet',
  revision_sheet: 'Revision Sheet',
  notes: 'Notes'
}[String(type || '').toLowerCase()] || type || 'PDF');

const normalizePricingMode = (mode) => {
  const clean = String(mode || '').trim().toLowerCase();
  if (clean === 'paid-own' || clean === 'paid_own') return 'paid_own';
  if (clean === 'inherit-parent' || clean === 'inherit_parent' || clean === 'inherit') return 'inherit';
  return 'free';
};

const normalizeAccessMode = (mode) => {
  const clean = String(mode || '').trim().toLowerCase();
  if (clean === 'paid-own' || clean === 'paid_own') return 'paid_own';
  if (clean === 'inherit-parent' || clean === 'inherit_parent' || clean === 'inherit') return 'inherit';
  if (clean === 'free') return 'free';
  return 'inherit';
};

function CopyIdButton({ id, label = 'UUID' }) {
  const [copied, setCopied] = useState(false);

  const copy = async (event) => {
    event.stopPropagation();
    if (!id) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = id;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  };

  return (
    <button
      type="button"
      className={`copy-id-button ${copied ? 'copied' : ''}`}
      title={copied ? 'Copied to clipboard!' : `Copy ${label} (${id})`}
      aria-label={`Copy ${label}`}
      onClick={copy}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied && <span className="copy-id-badge">Copied!</span>}
    </button>
  );
}

function ResourceManagerModal({ chapter, onClose }) {
  const [resources, setResources] = useState([]);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({ title: '', resource_type: 'pdf', file_url: '', file_size: '', page_count: '', is_downloadable: false, is_free_preview: false, status: 'published' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const { data, error: loadError } = await supabase.from('chapter_resources').select('*').eq('chapter_id', chapter.id);
    if (loadError) throw loadError;
    setResources((data || []).sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0)));
  };
  useEffect(() => {
    let active = true;
    refresh().catch((loadError) => { if (active) setError(loadError.message || 'Unable to load chapter resources.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chapter.id]);

  const edit = (resource) => {
    setEditing(resource);
    setValues({
      title: resource.title || '',
      resource_type: normalizeResourceType(resource.resource_type || 'pdf'),
      file_url: resource.file_url || resource.url || '',
      file_size: resource.file_size || '',
      page_count: resource.page_count || '',
      is_downloadable: Boolean(resource.is_downloadable),
      is_free_preview: Boolean(resource.is_free_preview),
      status: resource.status || 'published'
    });
  };
  const reset = () => {
    setEditing(null);
    setValues({ title: '', resource_type: 'pdf', file_url: '', file_size: '', page_count: '', is_downloadable: false, is_free_preview: false, status: 'published' });
  };
  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (values.title.trim().length < 2) { setError('Enter a resource title with at least 2 characters.'); return; }
    if (!/^https?:\/\//i.test(values.file_url) && !values.file_url.trim()) { setError('Enter a document URL or storage object path.'); return; }
    if (values.page_count && (!Number.isInteger(Number(values.page_count)) || Number(values.page_count) < 1)) { setError('Page count must be a positive whole number.'); return; }
    setBusy(true);
    const payload = {
      chapter_id: chapter.id,
      title: values.title.trim(),
      resource_type: values.resource_type,
      file_url: values.file_url.trim(),
      file_size: String(values.file_size || '').trim() || null,
      page_count: values.page_count ? Math.trunc(Number(values.page_count)) : null,
      is_downloadable: values.is_downloadable,
      is_free_preview: values.is_free_preview,
      status: values.status
    };
    try {
      if (editing?.id) {
        const { data, error: updateError } = await supabase
          .from('chapter_resources')
          .update(payload)
          .eq('id', editing.id)
          .select();
        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          throw new Error('Update blocked by permissions or resource not found in database.');
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('chapter_resources')
          .insert(payload)
          .select();
        if (insertError) throw insertError;
        if (!data || data.length === 0) {
          throw new Error('Insert blocked by permissions or failed to save resource.');
        }
      }
      await refresh();
      reset();
    } catch (saveError) {
      setError(getContentErrorMessage(saveError, 'Unable to save this resource.'));
    } finally { setBusy(false); }
  };
  const archive = async (resource) => {
    setError('');
    try {
      const { error: archiveError } = await supabase.from('chapter_resources').update({ status: 'archived' }).eq('id', resource.id);
      if (archiveError) throw archiveError;
      await refresh();
      if (editing?.id === resource.id) reset();
    } catch (archiveError) {
      setError(getContentErrorMessage(archiveError, 'Unable to archive this resource.'));
    }
  };

  return <div className="modal-backdrop" role="presentation"><section className="content-dialog resource-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="resource-manager-title">
    <button className="modal-close" type="button" aria-label="Close resource manager" onClick={onClose}><X size={18} /></button>
    <div className="eyebrow">CHAPTER RESOURCES</div><h2 id="resource-manager-title">Manage resources</h2><p className="dialog-intro">{chapter.title} · Link notes, PDFs and revision sheets.</p>
    {loading ? <p className="field-hint">Loading resources…</p> : resources.length ? <div className="resource-admin-list">{resources.map((resource) => <div className="resource-admin-row" key={resource.id}><FileText size={17} /><span><strong>{resource.title}</strong><small>{formatResourceType(resource.resource_type)} · {resource.file_size || 'Size not set'} · {resource.status || 'published'}</small></span><button type="button" className="icon-button" aria-label={`Edit ${resource.title}`} onClick={() => edit(resource)}><Pencil size={15} /></button><button type="button" className="icon-button" aria-label={`Archive ${resource.title}`} onClick={() => archive(resource)}><Archive size={15} /></button></div>)}</div> : <div className="empty-content"><FileText size={20} /><strong>No resources linked yet.</strong><span>Add the first PDF or revision sheet below.</span></div>}
    <form className="resource-admin-form" onSubmit={save} noValidate>
      <div className="resource-admin-form-heading"><h3>{editing ? 'Edit resource' : 'Add a resource'}</h3>{editing && <button className="text-button" type="button" onClick={reset}>Cancel edit</button>}</div>
      <div className="content-form-row"><label className="field-label">Title <input className="text-input" value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} required minLength="2" maxLength="120" placeholder="e.g. Fundamental Rights — Quick Notes" /></label><label className="field-label">File type<select className="text-input" value={values.resource_type} onChange={(event) => setValues((current) => ({ ...current, resource_type: event.target.value }))}><option value="pdf">PDF</option><option value="formula_sheet">Formula Sheet</option><option value="revision_sheet">Revision Sheet</option><option value="notes">Notes</option></select></label></div>
      <label className="field-label">Document URL or storage path <input className="text-input" value={values.file_url} onChange={(event) => setValues((current) => ({ ...current, file_url: event.target.value }))} required placeholder="https://… or storage/object/path.pdf" /></label>
      <div className="content-form-row"><label className="field-label">File size <input className="text-input" value={values.file_size} onChange={(event) => setValues((current) => ({ ...current, file_size: event.target.value }))} placeholder="e.g. 2.4 MB" /></label><label className="field-label">Page count <input className="text-input" type="number" min="1" step="1" value={values.page_count} onChange={(event) => setValues((current) => ({ ...current, page_count: event.target.value }))} placeholder="Optional" /></label></div>
      <div className="content-switches"><label className="content-switch"><input type="checkbox" checked={values.is_free_preview} onChange={(event) => setValues((current) => ({ ...current, is_free_preview: event.target.checked }))} /><span>Free preview</span></label><label className="content-switch"><input type="checkbox" checked={values.is_downloadable} onChange={(event) => setValues((current) => ({ ...current, is_downloadable: event.target.checked }))} /><span>Allow downloads</span></label></div>
      <label className="field-label">Status<select className="text-input" value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))}><option value="published">Published</option><option value="draft">Draft</option></select></label>
      {error && <div className="feedback error-feedback">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Close</button><button type="submit" className="button button-gold" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save resource' : <><ArrowDownToLine size={15} /> Add resource</>}</button></div>
    </form>
  </section></div>;
}

function ContentDialog({ item, kind, exams, folders, chapters, defaultExamId, defaultParentId, onClose, onSaved }) {
  const draftKey = `zyvra_cm_draft_${kind}_${item?.id || 'new'}`;
  const [values, setValues] = useState(() => {
    const fallback = item ? {
      ...initialForm,
      ...item,
      pricing_mode: normalizePricingMode(item.pricing_mode),
      access_mode: normalizeAccessMode(item.access_mode),
      exam_id: item.exam_id || '',
      parent_folder_id: item.parent_folder_id || item.folder_id || '',
      price: item.price ?? '',
      estimated_study_time_minutes: item.estimated_study_time_minutes ?? item.estimated_minutes ?? 20
    } : {
      ...initialForm,
      exam_id: defaultExamId || exams[0]?.id || '',
      parent_folder_id: defaultParentId || ''
    };
    if (!item) {
      try {
        const draft = sessionStorage.getItem(draftKey);
        if (draft) return { ...fallback, ...JSON.parse(draft) };
      } catch {
        // ignore
      }
    }
    return fallback;
  });

  useEffect(() => {
    if (!item) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        // ignore
      }
    }
  }, [draftKey, values, item]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  };

  const handleClose = () => {
    clearDraft();
    onClose();
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const childFolders = folders.filter((folder) => {
    if (folder.exam_id !== values.exam_id) return false;
    if (kind === 'folder' && item?.id === folder.id) return false;
    if (kind === 'folder' && item && getFolderPath(folder, folders).some((part) => part.id === item.id)) return false;
    return true;
  });
  const slugCandidates = kind === 'exam'
    ? exams.filter((exam) => exam.id !== item?.id)
    : kind === 'folder'
      ? folders.filter((folder) => folder.id !== item?.id && folder.exam_id === values.exam_id && (folder.parent_folder_id || null) === (values.parent_folder_id || null))
      : chapters.filter((chapter) => chapter.id !== item?.id && (chapter.folder_id || null) === (values.parent_folder_id || null));
  const setField = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const autoSlug = (event) => {
    setField('title', event.target.value);
    if (!item || values.slug === slugify(item.title)) setField('slug', slugify(event.target.value));
  };
  const save = async (event) => {
    if (event) event.preventDefault();
    setError('');
    try {
      const title = (values.title || '').trim();
      const rawSlug = values.slug || slugify(title);
      const slug = slugify(rawSlug);

      if (title.length < 2 || title.length > 100) {
        throw new Error('Title must be between 2 and 100 characters.');
      }
      if (!slug || slug.length > 100) {
        throw new Error('Enter a valid slug using lowercase letters, numbers and hyphens.');
      }
      if (slugCandidates.some((candidate) => String(candidate.slug).toLowerCase() === slug)) {
        throw new Error('That slug is already used at this hierarchy level. Choose a unique slug.');
      }
      if (kind === 'folder' && !values.exam_id) {
        throw new Error('Choose an exam for this folder.');
      }
      if (kind === 'chapter' && !values.parent_folder_id) {
        throw new Error('Choose a parent folder for this chapter.');
      }
      if (kind === 'folder' && values.pricing_mode === 'inherit' && !values.parent_folder_id) {
        throw new Error('A top-level folder has no parent price to inherit. Choose Free or Paid-Own.');
      }
      if (kind === 'exam' && values.access_mode === 'paid_own' && !(Number(values.price) > 0)) {
        throw new Error('Enter a price greater than zero for paid exam access.');
      }
      if (values.pricing_mode === 'paid_own' && !(Number(values.price) > 0)) {
        throw new Error('Enter a price greater than zero for Paid-Own access.');
      }
      if (kind === 'chapter' && values.access_mode === 'paid_own' && !(Number(values.price) > 0)) {
        throw new Error('Enter a price greater than zero for paid chapter access.');
      }
      if (kind === 'chapter' && (!(values.subject || '').trim() || (values.subject || '').trim().length > 50)) {
        throw new Error('Enter a subject tag of 1–50 characters.');
      }
      const studyMins = Number(values.estimated_study_time_minutes || values.estimated_minutes || 20);
      if (kind === 'chapter' && (!Number.isInteger(studyMins) || studyMins < 1 || studyMins > 1440)) {
        throw new Error('Estimated study time must be between 1 and 1440 minutes.');
      }
      if (!supabase) {
        throw new Error('Supabase is not configured. Add your project URL and anon key before saving content.');
      }

      setBusy(true);

      const payload = {
        title,
        slug,
        description: values.description ? String(values.description).trim() || null : null,
        display_order: Math.max(0, Math.trunc(Number(values.display_order) || 0)),
        status: String(values.status || 'draft').toLowerCase()
      };
      if (kind === 'exam') {
        const isPaid = values.access_mode === 'paid_own';
        Object.assign(payload, {
          icon: values.icon || 'BookOpen',
          access_mode: isPaid ? 'paid_own' : 'free',
          price: isPaid ? Math.max(0, Number(values.price) || 0) : null
        });
      }
      if (kind === 'folder') {
        const pricingMode = normalizePricingMode(values.pricing_mode);
        Object.assign(payload, {
          exam_id: values.exam_id,
          parent_folder_id: values.parent_folder_id || null,
          parent_id: values.parent_folder_id || null,
          allow_tests: Boolean(values.allow_tests),
          allow_practice: Boolean(values.allow_practice),
          allow_notes: Boolean(values.allow_notes),
          pricing_mode: pricingMode,
          price: pricingMode === 'paid_own' ? Math.max(0, Number(values.price) || 0) : null
        });
      }
      if (kind === 'chapter') {
        const accessMode = normalizeAccessMode(values.access_mode);
        Object.assign(payload, {
          folder_id: values.parent_folder_id,
          subject: (values.subject || 'General').trim(),
          estimated_study_time_minutes: studyMins,
          access_mode: accessMode,
          price: accessMode === 'paid_own' ? Math.max(0, Number(values.price) || 0) : null
        });
      }

      const table = kind === 'exam' ? 'exams' : kind === 'folder' ? 'folders' : 'chapters';
      let savedRow = null;

      if (item?.id) {
        const { data, error: updateError } = await supabase
          .from(table)
          .update(payload)
          .eq('id', item.id)
          .select();
        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          throw new Error(`Update blocked by permissions or ${kind} not found in database.`);
        }
        savedRow = data[0];
      } else {
        const { data, error: insertError } = await supabase
          .from(table)
          .insert(payload)
          .select();
        if (insertError) throw insertError;
        if (!data || data.length === 0) {
          throw new Error(`Insert blocked by permissions or failed to create ${kind}.`);
        }
        savedRow = data[0];
      }

      await onSaved?.(savedRow, kind, item?.id ? 'update' : 'create');
      clearDraft();
      onClose();
    } catch (saveError) {
      console.error(`Failed to save ${kind}:`, saveError);
      setError(getContentErrorMessage(saveError, `Unable to save ${kind}.`));
    } finally {
      setBusy(false);
    }
  };

  const title = kind === 'exam' ? 'exam' : kind === 'folder' ? (values.parent_folder_id ? 'folder / subfolder' : 'main folder') : 'chapter';
  return <div className="modal-backdrop" role="presentation"><form className="content-dialog" role="dialog" aria-modal="true" aria-labelledby="content-dialog-title" onSubmit={save} noValidate>
    <button className="modal-close" type="button" aria-label="Close dialog" onClick={handleClose}><X size={18} /></button>
    <div className="eyebrow">{item ? 'EDIT CONTENT' : 'ADD TO YOUR HIERARCHY'}</div>
    <h2 id="content-dialog-title">{item ? 'Edit' : 'Create'} {title}</h2>
    <p className="dialog-intro">Fields marked required keep the learning hierarchy clear and searchable.</p>
    <label className="field-label">Title <span className="required-mark">*</span><input className="text-input" value={values.title} onChange={autoSlug} minLength="2" maxLength="100" required placeholder={kind === 'exam' ? 'e.g. Bihar Public Service Commission' : kind === 'chapter' ? 'e.g. Fundamental Rights' : 'e.g. NCERT Foundation'} /></label>
    <label className="field-label">Slug <span className="required-mark">*</span><input className="text-input" value={values.slug} onChange={(event) => setField('slug', event.target.value)} onBlur={() => setField('slug', slugify(values.slug))} required maxLength="100" pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*" placeholder="lowercase-words-with-hyphens" /><small>Unique in its hierarchy level. Used in links.</small></label>
    {kind === 'exam' && <><label className="field-label">Lucide icon<select className="text-input compact-select" value={values.icon} onChange={(event) => setField('icon', event.target.value)}>{iconNames.map((name) => <option key={name}>{name}</option>)}</select></label><p className="icon-preview"><span>{values.icon}</span>{(() => { const Icon = examIcons[values.icon] || BookOpen; return <Icon size={20} />; })()}</p>
      <label className="field-label">Exam access mode
        <select className="text-input" value={values.access_mode || 'free'} onChange={(event) => setField('access_mode', event.target.value)}>
          <option value="free">Free — entire exam syllabus is free to explore</option>
          <option value="paid_own">Paid-Own — set complete exam bundle price</option>
        </select>
      </label>
      {values.access_mode === 'paid_own' && (
        <label className="field-label">Exam bundle price (INR) <span className="required-mark">*</span>
          <input className="text-input" type="number" min="0.01" step="0.01" value={values.price} onChange={(event) => setField('price', event.target.value)} required placeholder="e.g. 499" />
        </label>
      )}
      <p className="field-hint">Purchasing an exam automatically unlocks all folders and chapters inside it.</p>
    </>}
    {kind === 'folder' && <>
      <label className="field-label">Exam <span className="required-mark">*</span><select className="text-input" value={values.exam_id} onChange={(event) => setValues((current) => ({ ...current, exam_id: event.target.value, parent_folder_id: '' }))} required><option value="">Select an exam</option>{exams.filter((exam) => exam.status !== 'archived').map((exam) => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select></label>
      <label className="field-label">Parent folder<select className="text-input" value={values.parent_folder_id} onChange={(event) => setField('parent_folder_id', event.target.value)}><option value="">None — top-level folder</option>{childFolders.map((folder) => <option value={folder.id} key={folder.id}>{getFolderPath(folder, folders).map((part) => part.title).join(' / ')}</option>)}</select><small>No parent price is applied unless you explicitly choose Inherit Parent.</small></label>
      <div className="field-label">Available learning options</div><div className="content-switches">{[['allow_tests', 'Tests'], ['allow_practice', 'Question practice'], ['allow_notes', 'Notes & PDFs']].map(([key, label]) => <label className="content-switch" key={key}><input type="checkbox" checked={Boolean(values[key])} onChange={(event) => setField(key, event.target.checked)} /><span>{label}</span></label>)}</div>
      <label className="field-label">Pricing mode<select className="text-input" value={values.pricing_mode} onChange={(event) => setField('pricing_mode', event.target.value)}><option value="free">Free — this folder has no price</option><option value="paid_own">Paid-Own — set this folder’s price</option><option value="inherit" disabled={!values.parent_folder_id}>Inherit Parent — explicitly use parent price</option></select></label>
      {values.pricing_mode === 'paid_own' && <label className="field-label">Folder price (INR) <span className="required-mark">*</span><input className="text-input" type="number" min="0.01" step="0.01" value={values.price} onChange={(event) => setField('price', event.target.value)} required /></label>}
      <div className={`effective-price ${values.pricing_mode === 'inherit' ? 'inherited-price' : ''}`}><CircleDollarSign size={17} /><div><strong>Effective access: {values.pricing_mode === 'free' ? 'Free' : values.pricing_mode === 'paid_own' ? (Number(values.price) > 0 ? `Paid · ₹${Number(values.price).toLocaleString('en-IN')}` : 'Paid · price required') : values.parent_folder_id ? getFolderPricing({ ...values, title: values.title || 'This folder', parent_folder_id: values.parent_folder_id }, folders).label : 'No parent price available — choose Free or Paid-Own'}</strong><span>Parent pricing never applies automatically. Inheritance is only active when you select it above.</span></div></div>
    </>}
    {kind === 'chapter' && <>
      <label className="field-label">Parent folder <span className="required-mark">*</span><select className="text-input" value={values.parent_folder_id} onChange={(event) => setField('parent_folder_id', event.target.value)} required><option value="">Select a folder</option>{folders.filter((folder) => folder.status !== 'archived').map((folder) => <option value={folder.id} key={folder.id}>{(exams.find((exam) => exam.id === folder.exam_id)?.title || 'Exam') + ' / ' + getFolderPath(folder, folders).map((part) => part.title).join(' / ')}</option>)}</select></label>
      <label className="field-label">Subject tag <span className="required-mark">*</span><input className="text-input" value={values.subject} onChange={(event) => setField('subject', event.target.value)} maxLength="50" required placeholder="e.g. Polity, Science, Math" /></label>
      <label className="field-label">Estimated study time (minutes) <span className="required-mark">*</span><input className="text-input" type="number" min="1" max="1440" step="1" value={values.estimated_study_time_minutes} onChange={(event) => setField('estimated_study_time_minutes', event.target.value)} required /></label>
      <label className="field-label">Access mode<select className="text-input" value={values.access_mode} onChange={(event) => setField('access_mode', event.target.value)}><option value="free">Free</option><option value="paid_own">Paid-Own</option><option value="inherit">Inherit Parent (explicit)</option></select></label>
      {values.access_mode === 'paid_own' && <label className="field-label">Chapter price (INR) <span className="required-mark">*</span><input className="text-input" type="number" min="0.01" step="0.01" value={values.price} onChange={(event) => setField('price', event.target.value)} required /></label>}
    </>}
    <label className="field-label">Description<textarea className="text-input content-textarea" value={values.description} onChange={(event) => setField('description', event.target.value)} rows="3" maxLength="1000" placeholder="A short, student-friendly overview." /></label>
    <div className="content-form-row"><label className="field-label">Display order<input className="text-input" type="number" min="0" step="1" value={values.display_order} onChange={(event) => setField('display_order', event.target.value)} /></label><label className="field-label">Status<select className="text-input" value={values.status} onChange={(event) => setField('status', event.target.value)}><option value="published">Published</option><option value="draft">Draft</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option></select></label></div>
    {error && <div className="feedback error-feedback">{error}</div>}
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={handleClose}>Cancel</button><button type="submit" className="button button-gold" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Create'}</button></div>
  </form></div>;
}

export default function ContentManager() {
  const { exams, folders, chapters, loading, error, refresh, removeExam, removeFolder, removeChapter } = useContentCatalog();
  const [selectedExamId, setSelectedExamId] = useState(() => {
    try {
      return sessionStorage.getItem('zyvra_cm_exam_id') || '';
    } catch {
      return '';
    }
  });
  const [pathIds, setPathIds] = useState(() => {
    try {
      const saved = sessionStorage.getItem('zyvra_cm_path_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(() => {
    try {
      const saved = sessionStorage.getItem('zyvra_cm_dialog');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [resourceChapter, setResourceChapter] = useState(() => {
    try {
      const saved = sessionStorage.getItem('zyvra_cm_resource_chapter');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [actionError, setActionError] = useState('');
  const [savingArchive, setSavingArchive] = useState('');
  const [examToDelete, setExamToDelete] = useState(null);
  const [deletingExam, setDeletingExam] = useState(false);
  const [contentToDelete, setContentToDelete] = useState(null);
  const [deletingContent, setDeletingContent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    try {
      if (selectedExamId) {
        sessionStorage.setItem('zyvra_cm_exam_id', selectedExamId);
      } else {
        sessionStorage.removeItem('zyvra_cm_exam_id');
      }
    } catch { /* ignore */ }
  }, [selectedExamId]);

  useEffect(() => {
    try {
      if (pathIds && pathIds.length > 0) {
        sessionStorage.setItem('zyvra_cm_path_ids', JSON.stringify(pathIds));
      } else {
        sessionStorage.removeItem('zyvra_cm_path_ids');
      }
    } catch { /* ignore */ }
  }, [pathIds]);

  useEffect(() => {
    try {
      if (dialog) {
        sessionStorage.setItem('zyvra_cm_dialog', JSON.stringify(dialog));
      } else {
        sessionStorage.removeItem('zyvra_cm_dialog');
      }
    } catch { /* ignore */ }
  }, [dialog]);

  useEffect(() => {
    try {
      if (resourceChapter) {
        sessionStorage.setItem('zyvra_cm_resource_chapter', JSON.stringify(resourceChapter));
      } else {
        sessionStorage.removeItem('zyvra_cm_resource_chapter');
      }
    } catch { /* ignore */ }
  }, [resourceChapter]);

  useEffect(() => {
    if (!loading && exams.length > 0 && selectedExamId) {
      if (!exams.some((exam) => exam.id === selectedExamId)) {
        setSelectedExamId('');
        setPathIds([]);
      }
    }
  }, [loading, exams, selectedExamId]);
  useEffect(() => {
    if (!successMessage) return undefined;
    const timeout = window.setTimeout(() => setSuccessMessage(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);
  const selectedExam = exams.find((exam) => exam.id === selectedExamId);
  const path = useMemo(() => pathIds.map((id) => folders.find((folder) => folder.id === id)).filter(Boolean), [pathIds, folders]);
  const currentFolder = path[path.length - 1];
  const visibleFolders = folders.filter((folder) => folder.exam_id === selectedExamId && (folder.parent_folder_id || null) === (currentFolder?.id || null));
  const visibleChapters = chapters.filter((chapter) => chapter.folder_id === currentFolder?.id);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredFolders = visibleFolders.filter((folder) => !normalizedSearch || `${folder.title} ${folder.slug} ${folder.description || ''}`.toLowerCase().includes(normalizedSearch));
  const filteredChapters = visibleChapters.filter((chapter) => !normalizedSearch || `${chapter.title} ${chapter.subject || ''} ${chapter.slug}`.toLowerCase().includes(normalizedSearch));
  const beginExam = (exam) => { setSelectedExamId(exam.id); setPathIds([]); setSearch(''); };
  const navigateToPath = (index) => setPathIds(path.slice(0, index + 1).map((folder) => folder.id));
  const handleDeleteClick = (exam) => {
    setActionError('');
    setSuccessMessage('');
    setExamToDelete(exam);
  };
  const handleDeleteFolder = (folder) => {
    setActionError('');
    setSuccessMessage('');
    setContentToDelete({ kind: 'folder', item: folder });
  };
  const handleDeleteChapter = (chapter) => {
    setActionError('');
    setSuccessMessage('');
    setContentToDelete({ kind: 'chapter', item: chapter });
  };
  const handleDeleteContentClick = (kind, item) => {
    if (kind === 'folder') handleDeleteFolder(item);
    else handleDeleteChapter(item);
  };
  const archive = async (kind, item) => {
    const typeLabel = kind === 'exam' ? 'exam' : kind === 'folder' ? 'folder' : 'chapter';
    if (!window.confirm(`Archive “${item.title}”? It will no longer appear in student discovery.`)) return;
    if (!supabase) { setActionError('Supabase is not configured. Connect it before archiving content.'); return; }
    setActionError('');
    setSavingArchive(item.id);
    try {
      const table = kind === 'exam' ? 'exams' : kind === 'folder' ? 'folders' : 'chapters';
      const { error: archiveError } = await supabase.from(table).update({ status: 'archived' }).eq('id', item.id);
      if (archiveError) throw archiveError;
      await refresh();
      if (kind === 'exam' && selectedExamId === item.id) { setSelectedExamId(''); setPathIds([]); }
      if (kind === 'folder' && pathIds.includes(item.id)) setPathIds(pathIds.slice(0, pathIds.indexOf(item.id)));
    } catch (archiveError) {
      setActionError(getContentErrorMessage(archiveError, `Unable to archive ${typeLabel}.`));
    } finally { setSavingArchive(''); }
  };
  const deleteExam = async () => {
    if (!examToDelete?.id) return;
    if (!supabase) {
      setActionError('Supabase is not configured. Connect it before deleting content.');
      return;
    }
    const exam = examToDelete;
    setActionError('');
    setSuccessMessage('');
    setDeletingExam(true);
    try {
      const examFolders = folders.filter((folder) => folder.exam_id === exam.id);
      const folderIds = examFolders.map((folder) => folder.id);
      if (folderIds.length) {
        const examChapters = chapters.filter((c) => folderIds.includes(c.folder_id));
        const chapterIds = examChapters.map((c) => c.id);
        if (chapterIds.length) {
          await supabase.from('questions').update({ chapter_id: null }).in('chapter_id', chapterIds);
          await supabase.from('chapter_resources').delete().in('chapter_id', chapterIds);
        }
        const { error: chaptersError } = await supabase.from('chapters').delete().in('folder_id', folderIds);
        if (chaptersError) throw chaptersError;
      }
      const { error: foldersError } = await supabase.from('folders').delete().eq('exam_id', exam.id);
      if (foldersError) throw foldersError;
      const { data: deletedRows, error: examError } = await supabase.from('exams').delete().eq('id', exam.id).select();
      if (examError) throw examError;

      removeExam(exam.id);
      if (selectedExamId === exam.id) {
        setSelectedExamId('');
        setPathIds([]);
      }
      setExamToDelete(null);
      setSuccessMessage(`“${exam.title || 'Exam'}” and its nested folders and chapters were permanently deleted.`);
      await refresh();
    } catch (deleteError) {
      setActionError(getContentErrorMessage(deleteError, 'Unable to delete this exam and its nested content.'));
      refresh().catch((refreshError) => setActionError(refreshError?.message || 'Unable to refresh the content hierarchy.'));
    } finally {
      setDeletingExam(false);
    }
  };

  const executeDeleteChapter = async (chapter) => {
    if (!chapter?.id) return;
    if (!supabase) {
      setActionError('Supabase is not configured. Connect it before deleting content.');
      return;
    }
    setActionError('');
    setDeletingContent(true);
    try {
      const chapterId = chapter.id;

      // 1. Unlink questions so they remain safely in the Question Bank without a chapter assignment
      const { error: unlinkError } = await supabase
        .from('questions')
        .update({ chapter_id: null })
        .eq('chapter_id', chapterId);
      if (unlinkError) console.warn('Unlink chapter questions note:', unlinkError.message);

      // 2. Delete chapter resources
      const { error: resError } = await supabase
        .from('chapter_resources')
        .delete()
        .eq('chapter_id', chapterId);
      if (resError) console.warn('Delete chapter resources note:', resError.message);

      // 3. Delete student bookmarks
      try {
        await supabase.from('student_bookmarks').delete().eq('chapter_id', chapterId);
      } catch (_) {}

      // 4. Delete chapter tests and their dependent records
      const { data: tests, error: testsLoadError } = await supabase
        .from('tests')
        .select('id')
        .eq('chapter_id', chapterId);
      if (testsLoadError) throw testsLoadError;

      const testIds = (tests || []).map((t) => t.id).filter(Boolean);
      if (testIds.length > 0) {
        try {
          await supabase.from('test_questions').delete().in('test_id', testIds);
        } catch (_) {}
        try {
          await supabase.from('test_attempts').delete().in('test_id', testIds);
        } catch (_) {}
        const { error: testsDeleteError } = await supabase
          .from('tests')
          .delete()
          .in('id', testIds);
        if (testsDeleteError) throw testsDeleteError;
      }

      // 5. Verify deletion via .delete().eq('id', id).select()
      const { data: deletedRows, error: chapterError } = await supabase
        .from('chapters')
        .delete()
        .eq('id', chapterId)
        .select('id');
      if (chapterError) throw chapterError;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Chapter could not be deleted or was not found in database.');
      }

      if (resourceChapter?.id === chapterId) setResourceChapter(null);
      setContentToDelete(null);
      removeChapter?.(chapterId);
      setSuccessMessage(`“${chapter.title || 'Chapter'}” and its resources/tests were permanently deleted.`);
      await refresh();
    } catch (deleteError) {
      console.error('Failed to delete chapter:', deleteError);
      setActionError(getContentErrorMessage(deleteError, 'Unable to delete this chapter and its dependent content.'));
      try {
        await refresh();
      } catch (refreshError) {
        setActionError(getContentErrorMessage(refreshError, 'Deletion failed and the content hierarchy could not be refreshed.'));
      }
    } finally {
      setDeletingContent(false);
    }
  };

  const executeDeleteFolder = async (folder) => {
    if (!folder?.id) return;
    if (!supabase) {
      setActionError('Supabase is not configured. Connect it before deleting content.');
      return;
    }
    setActionError('');
    setDeletingContent(true);
    try {
      // 1. Recursively find all child/sub-folder IDs
      const { data: allFoldersData, error: foldersError } = await supabase
        .from('folders')
        .select('id, parent_folder_id, parent_id')
        .eq('exam_id', folder.exam_id);
      if (foldersError) throw foldersError;

      const sourceFolders = allFoldersData || folders || [];
      const childrenByParent = new Map();
      sourceFolders.forEach((f) => {
        const parent = f.parent_folder_id || f.parent_id;
        const list = childrenByParent.get(parent) || [];
        list.push(f.id);
        childrenByParent.set(parent, list);
      });

      const descendantIds = [];
      const queue = [folder.id];
      const visited = new Set();
      while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        if (current !== folder.id) {
          descendantIds.push(current);
        }
        const children = childrenByParent.get(current) || [];
        queue.push(...children);
      }

      const allFolderIds = [folder.id, ...descendantIds];

      // 2. Find all chapters inside ANY of these folders
      const { data: folderChapters, error: chaptersError } = await supabase
        .from('chapters')
        .select('id')
        .in('folder_id', allFolderIds);
      if (chaptersError) throw chaptersError;

      const chapterIds = (folderChapters || []).map((c) => c.id).filter(Boolean);

      // 3. For all these chapters: unlink questions, delete resources, bookmarks, tests, chapters
      if (chapterIds.length > 0) {
        // Unlink questions so they remain safe in Question Bank
        const { error: unlinkError } = await supabase
          .from('questions')
          .update({ chapter_id: null })
          .in('chapter_id', chapterIds);
        if (unlinkError) console.warn('Unlink questions note:', unlinkError.message);

        // Delete chapter resources
        const { error: resError } = await supabase
          .from('chapter_resources')
          .delete()
          .in('chapter_id', chapterIds);
        if (resError) console.warn('Delete resources note:', resError.message);

        // Delete bookmarks
        try {
          await supabase.from('student_bookmarks').delete().in('chapter_id', chapterIds);
        } catch (_) {}

        // Find tests
        const { data: tests, error: testsLoadError } = await supabase
          .from('tests')
          .select('id')
          .in('chapter_id', chapterIds);
        if (testsLoadError) throw testsLoadError;

        const testIds = (tests || []).map((t) => t.id).filter(Boolean);
        if (testIds.length > 0) {
          try {
            await supabase.from('test_questions').delete().in('test_id', testIds);
          } catch (_) {}
          try {
            await supabase.from('test_attempts').delete().in('test_id', testIds);
          } catch (_) {}
          const { error: testsDelError } = await supabase
            .from('tests')
            .delete()
            .in('id', testIds);
          if (testsDelError) throw testsDelError;
        }

        // Delete chapters
        const { error: chDelError } = await supabase
          .from('chapters')
          .delete()
          .in('id', chapterIds);
        if (chDelError) throw chDelError;
      }

      // 4. Delete descendant sub-folders bottom-up
      const subFolderIds = allFolderIds.filter((id) => id !== folder.id);
      if (subFolderIds.length > 0) {
        const reversed = [...subFolderIds].reverse();
        const { error: subFolderError } = await supabase
          .from('folders')
          .delete()
          .in('id', reversed);
        if (subFolderError) throw subFolderError;
      }

      // 5. Verify deletion of the target folder via .delete().eq('id', id).select()
      const { data: deletedFolder, error: folderDeleteError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folder.id)
        .select('id');
      if (folderDeleteError) throw folderDeleteError;
      if (!deletedFolder || deletedFolder.length === 0) {
        throw new Error('Folder could not be deleted or was not found in database.');
      }

      // If navigation path was inside the deleted folder or its subfolders, step back
      if (pathIds.some((pId) => allFolderIds.includes(pId))) {
        const firstIdx = pathIds.findIndex((pId) => allFolderIds.includes(pId));
        setPathIds(pathIds.slice(0, firstIdx));
      }

      setContentToDelete(null);
      removeFolder?.(folder.id);
      setSuccessMessage(`“${folder.title || 'Folder'}” and all nested contents were permanently deleted.`);
      await refresh();
    } catch (deleteError) {
      console.error('Failed to delete folder:', deleteError);
      setActionError(getContentErrorMessage(deleteError, 'Unable to delete this folder and its nested content.'));
      try {
        await refresh();
      } catch (refreshError) {
        setActionError(getContentErrorMessage(refreshError, 'Deletion failed and the content hierarchy could not be refreshed.'));
      }
    } finally {
      setDeletingContent(false);
    }
  };

  const deleteContent = async () => {
    if (!contentToDelete?.item?.id) return;
    if (contentToDelete.kind === 'folder') {
      await executeDeleteFolder(contentToDelete.item);
    } else {
      await executeDeleteChapter(contentToDelete.item);
    }
  };
  const onSaved = async (savedItem, actionKind, actionType) => {
    setActionError('');
    await refresh();
    const name = savedItem?.title || actionKind || 'Item';
    const action = actionType === 'update' ? 'updated' : 'created';
    setSuccessMessage(`“${name}” was successfully ${action}.`);
  };
  const examIcon = (exam) => {
    const Icon = examIcons[exam.icon] || GraduationCap;
    return <Icon size={19} />;
  };
  const hierarchyCounts = (examId) => {
    const examFolders = folders.filter((folder) => folder.exam_id === examId);
    const ids = new Set(examFolders.map((folder) => folder.id));
    return { folders: examFolders.length, chapters: chapters.filter((chapter) => ids.has(chapter.folder_id)).length };
  };
  const folderCrumbs = currentFolder ? getFolderPath(currentFolder, folders) : [];

  return <div className="content-manager">
    <div className="page-heading content-manager-heading"><div><div className="eyebrow">ADMINISTRATION / CONTENT OPERATIONS</div><h1>Content manager</h1><p>Build and maintain the exam → folder → chapter learning hierarchy.</p></div><button className="button button-gold" onClick={() => setDialog({ kind: selectedExam ? 'folder' : 'exam', item: null })}><Plus size={16} /> {selectedExam ? 'Add folder' : 'Add exam'}</button></div>
    {(error || actionError) && <div className="feedback error-feedback" role="alert">{actionError || error}</div>}
    {successMessage && <div className="feedback success-feedback" role="status">{successMessage}</div>}
    <div className="content-manager-layout">
      <aside className="content-exam-rail panel-card">
        <div className="content-rail-title"><div><span className="eyebrow">YOUR CATALOGUE</span><h2>Exam hierarchy</h2></div><button className="icon-button" title="Add exam" onClick={() => setDialog({ kind: 'exam', item: null })}><Plus size={17} /></button></div>
        <label className="content-search"><Search size={15} /><input placeholder="Find an exam…" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedExamId(''); setPathIds([]); }} /></label>
        {loading && <div className="field-hint">Loading exams, folders and chapters…</div>}
        {!loading && exams.filter((exam) => !normalizedSearch || `${exam.title} ${exam.slug}`.toLowerCase().includes(normalizedSearch)).map((exam) => {
          const counts = hierarchyCounts(exam.id);
          return <div key={exam.id} className={`exam-rail-row ${selectedExamId === exam.id ? 'selected' : ''}`}>
            <button className="exam-rail-main" onClick={() => beginExam(exam)}><span className="exam-rail-icon">{examIcon(exam)}</span><span className="exam-rail-copy"><strong>{exam.title}</strong><small>{counts.folders} folders · {counts.chapters} chapters</small></span><ChevronRight size={15} /></button>
            <span className={`content-status status-${String(exam.status || 'draft').toLowerCase()}`}>{exam.status || 'draft'}</span>
            <div className="row-actions"><CopyIdButton id={exam.id} label="exam_id" /><button type="button" title="Edit exam" aria-label={`Edit ${exam.title}`} onClick={(event) => { event.stopPropagation(); setDialog({ kind: 'exam', item: exam }); }}><Pencil size={14} /></button><button type="button" title="Delete exam" aria-label={`Delete ${exam.title}`} disabled={deletingExam} onClick={(event) => { event.stopPropagation(); handleDeleteClick(exam); }}><Trash2 size={14} /></button><button type="button" title="Archive exam" aria-label={`Archive ${exam.title}`} disabled={savingArchive === exam.id} onClick={(event) => { event.stopPropagation(); archive('exam', exam); }}><Archive size={14} /></button></div>
          </div>;
        })}
        {!loading && !exams.length && <div className="empty-content"><GraduationCap size={24} /><strong>Your catalogue is ready</strong><span>Create your first exam to start building the hierarchy.</span><button className="button button-outline" onClick={() => setDialog({ kind: 'exam', item: null })}><Plus size={14} /> Create exam</button></div>}
      </aside>
      <section className="content-workspace panel-card">
        {!selectedExam ? <div className="content-empty-state"><div className="placeholder-icon"><Layers3 size={23} /></div><h2>Select an exam to get started.</h2><p>Browse its main folders, nested subfolders and chapters—or create a new exam.</p><div className="content-overview-stats"><span><GraduationCap size={16} />{exams.length} exams</span><span><Folder size={16} />{folders.length} folders</span><span><BookOpen size={16} />{chapters.length} chapters</span></div></div> : <>
          <div className="workspace-title-row"><div><div className="eyebrow">SELECTED EXAM</div><h2>{examIcon(selectedExam)} {selectedExam.title}</h2><p>{selectedExam.description || 'Add a short exam overview for students.'}</p></div><span className={`content-status status-${String(selectedExam.status || 'draft').toLowerCase()}`}>{selectedExam.status || 'draft'}</span></div>
          <nav className="content-breadcrumbs" aria-label="Content hierarchy"><button onClick={() => setPathIds([])} className={!path.length ? 'current' : ''}>{selectedExam.title}</button>{folderCrumbs.map((folder, index) => <span className="breadcrumb-part" key={folder.id}><ChevronRight size={13} /><button className={index === folderCrumbs.length - 1 ? 'current' : ''} onClick={() => navigateToPath(index)}>{folder.title}</button></span>)}</nav>
          {currentFolder && <div className="selected-folder-meta"><FolderOpen size={17} /><span>{currentFolder.title}</span><CopyIdButton id={currentFolder.id} label="current folder_id" /><span>{getFolderPricing(currentFolder, folders).label}</span></div>}
          <div className="workspace-toolbar"><div><h3>{currentFolder ? 'Folder contents' : 'Main folders'}</h3><span>{filteredFolders.length} folders · {filteredChapters.length} chapters</span></div><div className="workspace-actions"><label className="content-search"><Search size={14} /><input placeholder="Search here…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{currentFolder && <button className="button button-outline" onClick={() => setDialog({ kind: 'chapter', item: null })}><Plus size={14} /> Chapter</button>}<button className="button button-outline" onClick={() => setDialog({ kind: 'folder', item: null })}><Plus size={14} /> {currentFolder ? 'Subfolder' : 'Folder'}</button></div></div>
          {loading && <div className="field-hint">Refreshing catalogue…</div>}
          <div className="content-entry-list">
            {filteredFolders.map((folder) => {
              const count = chapters.filter((chapter) => chapter.folder_id === folder.id).length;
              const subCount = folders.filter((child) => child.parent_folder_id === folder.id).length;
              const pricing = getFolderPricing(folder, folders);
              return <article className="content-entry" key={folder.id}><button className="content-entry-main" onClick={() => { setPathIds([...pathIds, folder.id]); setSearch(''); }}><span className="content-entry-icon folder-entry-icon"><Folder size={18} /></span><span className="content-entry-copy"><strong>{folder.title}</strong><small>{folder.description || 'No description'} · {subCount} subfolders · {count} chapters</small></span><span className="entry-price">{pricing.label}</span><ChevronRight size={17} /></button><div className="content-entry-actions"><CopyIdButton id={folder.id} label="folder_id" /><span className={`content-status status-${String(folder.status || 'draft').toLowerCase()}`}>{folder.status || 'draft'}</span><button title="Edit folder" aria-label={`Edit ${folder.title}`} onClick={() => setDialog({ kind: 'folder', item: folder })}><Pencil size={14} /></button><button type="button" title="Delete folder and its contents" aria-label={`Delete ${folder.title}`} disabled={deletingContent} onClick={() => handleDeleteFolder(folder)}><Trash2 size={14} /></button><button title="Archive folder" aria-label={`Archive ${folder.title}`} disabled={savingArchive === folder.id} onClick={() => archive('folder', folder)}><Archive size={14} /></button></div></article>;
            })}
            {filteredChapters.map((chapter) => <article className="content-entry chapter-entry" key={chapter.id}><div className="content-entry-main"><span className="content-entry-icon chapter-entry-icon"><BookOpen size={18} /></span><span className="content-entry-copy"><strong>{chapter.title}</strong><small>{chapter.description || 'No description'}</small></span><span className="entry-price"><Clock3 size={13} /> {chapter.estimated_study_time_minutes || '—'} min</span></div><div className="content-entry-actions"><CopyIdButton id={chapter.id} label="chapter_id" /><span className="subject-pill">{chapter.subject || 'No subject'}</span><span className={`content-status status-${String(chapter.status || 'draft').toLowerCase()}`}>{chapter.status || 'draft'}</span><button title="Add / Manage Resources" aria-label={`Manage resources for ${chapter.title}`} onClick={() => setResourceChapter(chapter)}><FileText size={14} /></button><button title="Edit chapter" aria-label={`Edit ${chapter.title}`} onClick={() => setDialog({ kind: 'chapter', item: chapter })}><Pencil size={14} /></button><button type="button" title="Delete chapter and its contents" aria-label={`Delete ${chapter.title}`} disabled={deletingContent} onClick={() => handleDeleteChapter(chapter)}><Trash2 size={14} /></button><button title="Archive chapter" aria-label={`Archive ${chapter.title}`} disabled={savingArchive === chapter.id} onClick={() => archive('chapter', chapter)}><Archive size={14} /></button></div></article>)}
            {!filteredFolders.length && !filteredChapters.length && <div className="empty-content workspace-empty"><Folder size={23} /><strong>{currentFolder ? 'This folder is empty' : 'No main folders yet'}</strong><span>Add a folder or chapter to continue building this exam.</span></div>}
          </div>
          {currentFolder && <button className="back-folder-link" onClick={() => setPathIds(pathIds.slice(0, -1))}><ArrowLeft size={14} /> Back to {pathIds.length > 1 ? path[pathIds.length - 2]?.title : selectedExam.title}</button>}
        </>}
      </section>
    </div>
    {dialog && <ContentDialog kind={dialog.kind} item={dialog.item} exams={exams} folders={folders} chapters={chapters} defaultExamId={selectedExamId} defaultParentId={currentFolder?.id} onClose={() => setDialog(null)} onSaved={onSaved} />}
    {resourceChapter && <ResourceManagerModal chapter={resourceChapter} onClose={() => setResourceChapter(null)} />}
    {contentToDelete && createPortal(<div className="modal-backdrop delete-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (!deletingContent && event.target === event.currentTarget) setContentToDelete(null); }}><section className="content-dialog delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-content-title" aria-describedby="delete-content-warning">
      <div className="delete-confirm-icon"><AlertTriangle size={22} /></div>
      <h2 id="delete-content-title">Delete {contentToDelete.item.title || (contentToDelete.kind === 'folder' ? 'this folder' : 'this chapter')}?</h2>
      <p className="dialog-intro" id="delete-content-warning">{contentToDelete.kind === 'folder'
        ? 'This permanently deletes all nested folders, chapters, tests and resources. Questions will remain in the Question Bank without a chapter assignment.'
        : 'This permanently deletes the chapter, its tests and resources. Questions will remain in the Question Bank without a chapter assignment.'}</p>
      {actionError && <div className="feedback error-feedback" role="alert">{actionError}</div>}
      <div className="modal-actions"><button type="button" className="button button-outline" disabled={deletingContent} onClick={() => setContentToDelete(null)}>Cancel</button><button type="button" className="button button-danger" disabled={deletingContent} onClick={deleteContent}>{deletingContent ? 'Deleting…' : <><Trash2 size={15} /> Delete {contentToDelete.kind}</>}</button></div>
    </section></div>, document.body)}
    {examToDelete && createPortal(<div className="modal-backdrop delete-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (!deletingExam && event.target === event.currentTarget) setExamToDelete(null); }}><section className="content-dialog delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-exam-title" aria-describedby="delete-exam-warning">
      <div className="delete-confirm-icon"><AlertTriangle size={22} /></div>
      <h2 id="delete-exam-title">Delete {examToDelete.title || 'this exam'}?</h2>
      <p className="dialog-intro" id="delete-exam-warning">Are you sure you want to delete this exam? All nested folders and chapters will be permanently deleted.</p>
      {actionError && <div className="feedback error-feedback" role="alert">{actionError}</div>}
      <div className="modal-actions"><button type="button" className="button button-outline" disabled={deletingExam} onClick={() => setExamToDelete(null)}>Cancel</button><button type="button" className="button button-danger" disabled={deletingExam} onClick={deleteExam}>{deletingExam ? 'Deleting…' : <><Trash2 size={15} /> Delete exam</>}</button></div>
    </section></div>, document.body)}
  </div>;
}

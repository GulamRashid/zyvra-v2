import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Clock3, Folder, FolderOpen, LockKeyhole } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getChapterAccess, getFolderPath, getFolderPricing, isPublished } from '../../lib/content';
import useContentAccess from '../../hooks/useContentAccess';
import CheckoutModal from '../../components/common/CheckoutModal';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

function AccessBadge({ label }) {
  const lower = label.toLowerCase();
  const type = lower.includes('paid') || lower.includes('locked') ? 'paid' : lower.includes('coming') ? 'coming' : 'free';
  return <span className={`access-badge access-${type}`}>{label}</span>;
}

export default function FolderView() {
  const { folderId } = useParams();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const folder = folders.find((item) => item.id === folderId && isPublished(item));
  const exam = exams.find((item) => item.id === folder?.exam_id && isPublished(item));
  const path = useMemo(() => folder ? getFolderPath(folder, folders) : [], [folder, folders]);
  const hierarchyPublished = path.every(isPublished);
  const childFolders = folders.filter((item) => item.parent_folder_id === folder?.id && isPublished(item));
  const folderChapters = chapters.filter((chapter) => chapter.folder_id === folder?.id && isPublished(chapter));
  const parent = path.length > 1 ? path[path.length - 2] : null;
  const pricing = getFolderPricing(folder, folders);
  const accessItems = useMemo(() => [
    ...(pricing.amount > 0 ? [{ type: 'folder', id: folder.id, paid: true }] : []),
    ...childFolders.map((child) => ({ type: 'folder', id: child.id, paid: getFolderPricing(child, folders).amount > 0 })),
    ...folderChapters.map((chapter) => ({ type: 'chapter', id: chapter.id, paid: getChapterAccess(chapter, folder, folders).amount > 0 }))
  ], [folder?.id, pricing.amount, childFolders, folderChapters, folders]);
  const { accessByKey, loading: accessLoading, error: accessError } = useContentAccess(accessItems, user, supabase, refreshKey);
  const hasFolderAccess = pricing.amount <= 0 || accessByKey[`folder:${folder?.id}`] === true;
  return <div className="catalog-page">
    <nav className="student-breadcrumbs"><Link to="/explore">Explore</Link><ChevronRight size={14} />{exam && <><Link to={`/explore/${encodeURIComponent(exam.slug)}`}>{exam.title}</Link><ChevronRight size={14} /></>}{path.map((item, index) => <span className="breadcrumb-part" key={item.id}>{index > 0 && <ChevronRight size={14} />}{index === path.length - 1 ? <span>{item.title}</span> : <Link to={`/folder/${item.id}`}>{item.title}</Link>}</span>)}</nav>
    {error && <div className="feedback error-feedback">{error}</div>}
    {loading && <LoadingSkeleton rows={4} />}
    {!loading && !error && (!folder || !exam || !hierarchyPublished) && <div className="empty-content"><Folder size={25} /><strong>This folder isn’t available.</strong><span>It may be unpublished or its exam has changed.</span><Link className="button button-outline" to="/explore">Back to explore</Link></div>}
    {!loading && !error && folder && exam && hierarchyPublished && <>
      <section className="folder-hero"><div className="folder-hero-icon"><FolderOpen size={25} /></div><div className="eyebrow">{exam.title} / SYLLABUS</div><h1>{folder.title}</h1><p>{folder.description || 'Explore the topics and chapters in this learning section.'}</p><div className="folder-hero-meta"><AccessBadge label={pricing.amount ? hasFolderAccess ? 'Purchased' : pricing.label : 'Free'} />{pricing.amount > 0 && <span className="folder-price-note">Explicit pricing rule · {pricing.label}</span>}<span><Folder size={14} /> {childFolders.length} subfolders</span><span><BookOpen size={14} /> {folderChapters.length} chapters</span></div></section>
      {accessError && <div className="feedback error-feedback">{accessError}</div>}
      {pricing.amount > 0 && !hasFolderAccess && <section className="paywall-banner"><span className="paywall-icon"><LockKeyhole size={19} /></span><div><strong>Unlock Full Access for {`₹${pricing.amount.toLocaleString('en-IN')}`}</strong><span>Get the complete {folder.title} learning bundle, including its protected materials.</span></div><button className="button button-gold" disabled={!user || accessLoading} onClick={() => setCheckoutItem({ itemType: 'folder', itemId: folder.id, itemTitle: folder.title, tier: 'Folder Bundle', basePrice: pricing.amount })}>{accessLoading ? 'Checking access…' : 'Buy Now'} <ArrowRight size={14} /></button></section>}
      <div className="section-heading catalog-section-heading"><div><div className="eyebrow">INSIDE THIS SECTION</div><h2>Topics & chapters</h2></div><span className="folder-content-count">{childFolders.length + folderChapters.length} learning items</span></div>
      {!childFolders.length && !folderChapters.length && <div className="empty-content"><FolderOpen size={24} /><strong>More learning content coming soon.</strong><span>This section is being prepared for you.</span></div>}
      <div className="folder-item-list">{childFolders.map((child) => {
        const childPricing = getFolderPricing(child, folders);
        const count = chapters.filter((chapter) => chapter.folder_id === child.id && isPublished(chapter)).length;
        const childStatus = ['coming-soon', 'coming_soon'].includes(String(child.status || '').toLowerCase());
        const childAccess = childPricing.amount <= 0 || accessByKey[`folder:${child.id}`] === true;
        return <article className="folder-list-item purchase-list-item" key={child.id}><Link to={`/folder/${child.id}`} className="folder-list-main"><span className="folder-list-icon"><Folder size={18} /></span><span className="folder-list-copy"><strong>{child.title}</strong><small>{child.description || `${count} chapters to explore`}</small></span><span className="folder-list-meta"><AccessBadge label={childStatus ? 'Coming Soon' : childPricing.amount ? childAccess ? 'Purchased' : 'Paid' : 'Free'} /><span>{count} chapters</span></span><ChevronRight size={17} /></Link>{childPricing.amount > 0 && !childAccess && <button className="button button-outline buy-inline-button" onClick={() => setCheckoutItem({ itemType: 'folder', itemId: child.id, itemTitle: child.title, tier: 'Folder Bundle', basePrice: childPricing.amount })}>Buy {`₹${childPricing.amount}`} <ArrowRight size={13} /></button>}</article>;
      })}{folderChapters.map((chapter) => {
        const access = getChapterAccess(chapter, folder, folders);
        const hasAccess = access.amount <= 0 || accessByKey[`chapter:${chapter.id}`] === true;
        return <article className="folder-list-item purchase-list-item" key={chapter.id}><Link to={`/chapter/${chapter.id}`} className="folder-list-main chapter-list-main"><span className="folder-list-icon chapter-list-icon"><BookOpen size={18} /></span><span className="folder-list-copy"><strong>{chapter.title}</strong><small>{chapter.description || 'Chapter learning hub'}</small><span className="chapter-list-chips"><span className="subject-pill">{chapter.subject || 'General'}</span><span><Clock3 size={12} /> {chapter.estimated_study_time_minutes || '—'} min</span></span></span><span className="folder-list-meta"><AccessBadge label={access.amount > 0 ? hasAccess ? 'Purchased' : access.label : access.label} /></span><ArrowRight size={16} /></Link>{access.amount > 0 && !hasAccess && <button className="button button-outline buy-inline-button" onClick={() => setCheckoutItem({ itemType: 'chapter', itemId: chapter.id, itemTitle: chapter.title, tier: 'Chapter', basePrice: access.amount })}>Buy {`₹${access.amount}`} <ArrowRight size={13} /></button>}</article>;
      })}</div>
      {parent && <Link className="back-folder-link" to={`/folder/${parent.id}`}><ArrowRight className="back-arrow" size={14} /> Back to {parent.title}</Link>}
      {checkoutItem && <CheckoutModal {...checkoutItem} onClose={() => setCheckoutItem(null)} onCompleted={() => setRefreshKey((value) => value + 1)} />}
    </>}
  </div>;
}

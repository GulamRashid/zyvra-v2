import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Atom, BookMarked, BookOpen, Brain, Calculator, ChevronRight, Clock3, FlaskConical, Folder, Globe2, GraduationCap, Landmark, LockKeyhole, ScrollText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getFolderPricing, isPublished } from '../../lib/content';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import CheckoutModal from '../../components/common/CheckoutModal';
import useContentAccess from '../../hooks/useContentAccess';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const examIcons = { BookOpen, GraduationCap, Landmark, Atom, Calculator, Globe2, Brain, ScrollText, FlaskConical, BookMarked };

export default function ExamDetail() {
  const { examSlug } = useParams();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const exam = useMemo(() => exams.find((item) => item.slug === examSlug && isPublished(item)), [exams, examSlug]);
  const rootFolders = folders.filter((folder) => folder.exam_id === exam?.id && !folder.parent_folder_id && isPublished(folder));
  const examFolderIds = new Set(folders.filter((folder) => folder.exam_id === exam?.id && isPublished(folder)).map((folder) => folder.id));
  const Icon = examIcons[exam?.icon] || GraduationCap;
  const examPrice = Number(exam?.price || 0);
  const examIsPaid = examPrice > 0 || exam?.access_mode === 'paid-own' || exam?.access_mode === 'paid_own' || exam?.pricing_mode === 'paid-own' || exam?.pricing_mode === 'paid_own';
  const { accessByKey, loading: accessLoading, error: accessError } = useContentAccess(exam && examIsPaid ? [{ type: 'exam', id: exam.id, paid: true }] : [], user, supabase, refreshKey);
  const hasExamAccess = !examIsPaid || accessByKey[`exam:${exam?.id}`] === true;
  const countFolder = (rootId) => {
    const descendantIds = new Set([rootId]);
    let updated = true;
    while (updated) {
      updated = false;
      folders.filter((folder) => folder.exam_id === exam.id && isPublished(folder)).forEach((folder) => {
        if (folder.parent_folder_id && descendantIds.has(folder.parent_folder_id) && !descendantIds.has(folder.id)) {
          descendantIds.add(folder.id);
          updated = true;
        }
      });
    }
    return {
      folders: Math.max(0, descendantIds.size - 1),
      chapters: chapters.filter((chapter) => descendantIds.has(chapter.folder_id) && isPublished(chapter)).length
    };
  };
  return <div className="catalog-page">
    <nav className="student-breadcrumbs"><Link to="/explore">Explore</Link><ChevronRight size={14} /><span>{exam?.title || 'Exam syllabus'}</span></nav>
    {error && <div className="feedback error-feedback">{error}</div>}
    {loading && <LoadingSkeleton rows={4} />}
    {!loading && !error && !exam && <div className="empty-content"><GraduationCap size={25} /><strong>We couldn’t find this exam.</strong><span>It may be unpublished or no longer available.</span><Link className="button button-outline" to="/explore"><ArrowLeft size={15} /> Browse exams</Link></div>}
    {!loading && !error && exam && <>
      <section className="exam-hero"><div className="exam-hero-icon"><Icon size={31} /></div><div className="eyebrow">YOUR SYLLABUS, CLEARLY ORGANISED</div><h1>{exam.title}</h1><p>{exam.description || 'Explore the syllabus and start building a steady study rhythm.'}</p><div className="exam-hero-stats"><span><Folder size={15} /> {rootFolders.length} main sections</span><span><BookOpen size={15} /> {chapters.filter((chapter) => examFolderIds.has(chapter.folder_id) && isPublished(chapter)).length} learning chapters</span></div>{examIsPaid && !hasExamAccess && <button className="button button-gold exam-buy-button" disabled={!user || accessLoading} onClick={() => setCheckoutItem({ itemType: 'exam', itemId: exam.id, itemTitle: exam.title, tier: 'Exam Pass', basePrice: examPrice })}><LockKeyhole size={15} /> Unlock Exam Pass · ₹{examPrice.toLocaleString('en-IN')} <ArrowRight size={14} /></button>}</section>
      {accessError && <div className="feedback error-feedback">{accessError}</div>}
      <div className="section-heading catalog-section-heading"><div><div className="eyebrow">THE LEARNING PATH</div><h2>Explore the syllabus</h2></div><Link to="/explore" className="inline-link"><ArrowLeft size={14} /> All exams</Link></div>
      {!rootFolders.length && <div className="empty-content"><Folder size={24} /><strong>Syllabus coming soon</strong><span>Learning sections for this exam are being prepared.</span></div>}
      <div className="folder-cards-grid">{rootFolders.map((folder, index) => {
        const counts = countFolder(folder.id);
        const starts = ['01', '02', '03'];
        const price = getFolderPricing(folder, folders);
        return <article className="syllabus-card syllabus-purchase-card" key={folder.id}><Link to={`/folder/${folder.id}`} className="syllabus-card-link"><div className="syllabus-number">{starts[index] || String(index + 1).padStart(2, '0')}</div><div className="syllabus-card-icon"><Folder size={20} /></div><div className="syllabus-card-copy"><span className="eyebrow">LEARNING SECTION</span><h3>{folder.title}</h3><p>{folder.description || 'A thoughtfully organised set of topics to guide your preparation.'}</p><div className="syllabus-card-meta"><span><Folder size={13} /> {counts.folders} subfolders</span><span><BookOpen size={13} /> {counts.chapters} chapters</span></div></div><span className="syllabus-card-arrow"><ArrowRight size={17} /></span></Link>{price.amount > 0 && !hasExamAccess && <button className="button button-outline buy-inline-button" onClick={() => setCheckoutItem({ itemType: 'folder', itemId: folder.id, itemTitle: folder.title, tier: 'Folder Bundle', basePrice: price.amount })}>Buy bundle · ₹{price.amount.toLocaleString('en-IN')}</button>}</article>;
      })}</div>
      <div className="catalog-tip"><Clock3 size={15} /> You can explore free chapters before committing to a study plan.</div>
      {checkoutItem && <CheckoutModal {...checkoutItem} onClose={() => setCheckoutItem(null)} onCompleted={() => setRefreshKey((value) => value + 1)} />}
    </>}
  </div>;
}

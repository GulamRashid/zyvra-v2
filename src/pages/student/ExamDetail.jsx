import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Atom, BookMarked, BookOpen, Brain, Calculator, ChevronRight, Clock3, Crown, FlaskConical, Folder, Globe2, GraduationCap, Landmark, LockKeyhole, ScrollText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getFolderPricing, isPublished, sortContentItems } from '../../lib/content';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import CheckoutModal from '../../components/common/CheckoutModal';
import useContentAccess from '../../hooks/useContentAccess';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { formatCount, formatDays } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';

const examIcons = { BookOpen, GraduationCap, Landmark, Atom, Calculator, Globe2, Brain, ScrollText, FlaskConical, BookMarked };

const DEFAULT_FULL_PASS = {
  title: 'ZYVRA All-Access Full Pass',
  subtitle: 'सभी परीक्षाओं, टेस्ट्स और टूल्स का 1 साल का अनलिमिटेड एक्सेस',
  price: 499,
  validity_days: 365,
  is_active: true,
  include_all: true
};

export default function ExamDetail() {
  const { examSlug } = useParams();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const { language } = useThemeLanguage();
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullPassConfig, setFullPassConfig] = useState(DEFAULT_FULL_PASS);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('platform_settings')
      .select('setting_value, value')
      .or('setting_key.eq.full_pass_config,key.eq.full_pass_config')
      .maybeSingle()
      .then(({ data }) => {
        let val = data?.setting_value || data?.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch { val = null; }
        }
        if (val && typeof val === 'object') {
          setFullPassConfig((prev) => ({
            ...prev,
            ...val,
            price: val.price !== undefined ? Number(val.price) : prev.price,
            validity_days: val.validity_days !== undefined ? Number(val.validity_days) : prev.validity_days,
            is_active: val.is_active !== false,
            include_all: val.include_all !== false
          }));
        }
      })
      .catch((err) => console.warn('Could not load full pass config in ExamDetail:', err));
  }, []);
  const exam = useMemo(() => exams.find((item) => item.slug === examSlug && isPublished(item)), [exams, examSlug]);
  const rootFolders = useMemo(() => {
    const list = folders.filter((folder) => folder.exam_id === exam?.id && !folder.parent_folder_id && !folder.parent_id && isPublished(folder));
    return sortContentItems(list);
  }, [folders, exam?.id]);
  const examFolderIds = new Set(folders.filter((folder) => folder.exam_id === exam?.id && isPublished(folder)).map((folder) => folder.id));
  const totalExamChapters = chapters.filter((chapter) => examFolderIds.has(chapter.folder_id) && isPublished(chapter)).length;
  const Icon = examIcons[exam?.icon] || GraduationCap;
  const examPrice = Number(exam?.price || 0);
  const examIsPaid = examPrice > 0 || exam?.access_mode === 'paid-own' || exam?.access_mode === 'paid_own' || exam?.pricing_mode === 'paid-own' || exam?.pricing_mode === 'paid_own';
  const accessItems = useMemo(() => [
    ...(exam && examIsPaid ? [{ type: 'exam', id: exam.id, paid: true }] : []),
    ...rootFolders.filter((f) => getFolderPricing(f, folders).amount > 0).map((f) => ({ type: 'folder', id: f.id, paid: true }))
  ], [exam, examIsPaid, rootFolders, folders]);
  const { accessByKey, loading: accessLoading, error: accessError } = useContentAccess(accessItems, user, supabase, refreshKey);
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
  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-900 dark:text-slate-100">
      <nav className="student-breadcrumbs flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-indigo-400/80 overflow-x-auto no-scrollbar py-1">
        <Link
          to="/explore"
          className="w-7 h-7 rounded-lg dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white shrink-0 mr-1 transition-colors"
          aria-label="Back to explore"
        >
          <ArrowLeft size={14} />
        </Link>
        <Link to="/explore">{language === 'hi' ? 'परीक्षाएं' : 'Explore'}</Link>
        <ChevronRight size={13} className="shrink-0 text-slate-400" />
        <span className="dark:text-white text-slate-900 font-extrabold truncate">{exam?.title || (language === 'hi' ? 'पाठ्यक्रम' : 'Exam syllabus')}</span>
      </nav>
    {error && <div className="feedback error-feedback">{error}</div>}
    {loading && <LoadingSkeleton rows={4} />}
    {!loading && !error && !exam && <div className="empty-content"><GraduationCap size={25} /><strong>{language === 'hi' ? 'यह परीक्षा नहीं मिली।' : 'We couldn’t find this exam.'}</strong><span>{language === 'hi' ? 'यह अभी अप्रकाशित हो सकती है।' : 'It may be unpublished or no longer available.'}</span><Link className="button button-outline" to="/explore"><ArrowLeft size={15} /> {language === 'hi' ? 'सभी परीक्षाएं देखें' : 'Browse exams'}</Link></div>}
    {!loading && !error && exam && <>
      <section className="exam-hero"><div className="exam-hero-icon"><Icon size={31} /></div><div className="eyebrow">{language === 'hi' ? 'सुव्यवस्थित पाठ्यक्रम' : 'YOUR SYLLABUS, CLEARLY ORGANISED'}</div><h1>{exam.title}</h1><p>{exam.description || (language === 'hi' ? 'पाठ्यक्रम देखें और नियमित अध्ययन की शुरुआत करें।' : 'Explore the syllabus and start building a steady study rhythm.')}</p><div className="exam-hero-stats"><span><Folder size={15} /> {rootFolders.length} {language === 'hi' ? 'मुख्य विषय' : 'main sections'}</span><span><BookOpen size={15} /> {totalExamChapters} {language === 'hi' ? 'अध्याय' : 'learning chapters'}</span><Link to={`/syllabus/${encodeURIComponent(exam.slug || exam.id)}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-colors">{language === 'hi' ? 'सिलेबस ट्रैकर देखें' : 'Syllabus Tracker'} <ArrowRight size={13} /></Link></div>{examIsPaid && accessLoading && <span className="text-xs text-slate-500 dark:text-slate-300">{language === 'hi' ? 'एक्सेस जाँचा जा रहा है…' : 'Checking your access…'}</span>}</section>
      {accessError && <div className="feedback error-feedback">{accessError}</div>}
      {examIsPaid && !accessLoading && !accessError && !hasExamAccess && (
        <section className="paywall-banner exam-paywall-banner">
          <span className="paywall-icon"><LockKeyhole size={19} /></span>
          <div>
            <strong>{language === 'hi' ? `पूरा ${exam.title} अनलॉक करें` : `Unlock Complete ${exam.title}`} · ₹{examPrice.toLocaleString('en-IN')}</strong>
            <span>
              {language === 'hi'
                ? `₹${examPrice.toLocaleString('en-IN')} में ${rootFolders.length} विषय, ${totalExamChapters} अध्याय और सभी टेस्ट्स शामिल हैं।`
                : `Includes all ${formatCount(rootFolders.length, 'subject')}, ${formatCount(totalExamChapters, 'chapter')}, and all tests for ₹${examPrice.toLocaleString('en-IN')}.`}
              {fullPassConfig && fullPassConfig.is_active && (
                <>
                  {' '}
                  {language === 'hi'
                    ? `Full Pass (₹${fullPassConfig.price ?? DEFAULT_FULL_PASS.price}) में सभी परीक्षाएं + सभी प्रो स्टडी टूल्स (${fullPassConfig.validity_days || 365} दिन) अतिरिक्त मिलते हैं।`
                    : `Full Pass (₹${fullPassConfig.price ?? DEFAULT_FULL_PASS.price}) adds all exams + all Pro study tools for ${formatDays(fullPassConfig.validity_days || 365, 'en')}.`}
                </>
              )}
            </span>
          </div>
          <div className="paywall-actions flex flex-wrap items-center gap-2">
            <button
              className="button button-gold"
              disabled={!user || accessLoading}
              onClick={() => setCheckoutItem({
                itemType: 'exam',
                itemId: exam.id,
                itemTitle: exam.title,
                tier: 'Complete Exam Bundle',
                basePrice: examPrice
              })}
            >
              {accessLoading ? (language === 'hi' ? 'जाँच जारी है…' : 'Checking access…') : `${language === 'hi' ? `पूरा ${exam.title} अनलॉक करें` : `Unlock Complete ${exam.title}`} · ₹${examPrice.toLocaleString('en-IN')}`} <ArrowRight size={14} />
            </button>
            {fullPassConfig && fullPassConfig.is_active && (
              <button
                type="button"
                className="button button-outline"
                disabled={!user || accessLoading}
                onClick={() => setCheckoutItem({
                  itemType: 'full_pass',
                  itemId: 'global',
                  itemTitle: fullPassConfig.title || 'ZYVRA All-Access Full Pass',
                  tier: 'All-Access Pass',
                  basePrice: fullPassConfig.price ?? DEFAULT_FULL_PASS.price,
                  validityDays: fullPassConfig.validity_days || 365
                })}
              >
                <Crown size={14} className="text-amber-400" />
                <span>{language === 'hi' ? `या पूरा Full Pass लें · ₹${fullPassConfig.price ?? DEFAULT_FULL_PASS.price}` : `Or Get Full Pass · ₹${fullPassConfig.price ?? DEFAULT_FULL_PASS.price}`}</span>
              </button>
            )}
          </div>
        </section>
      )}
      <div className="section-heading catalog-section-heading"><div><div className="eyebrow">{language === 'hi' ? 'अध्ययन योजना' : 'THE LEARNING PATH'}</div><h2>{language === 'hi' ? 'पाठ्यक्रम और विषय' : 'Explore the syllabus'}</h2></div><Link to="/explore" className="inline-link"><ArrowLeft size={14} /> {language === 'hi' ? 'सभी परीक्षाएं' : 'All exams'}</Link></div>
      {!rootFolders.length && <div className="empty-content"><Folder size={24} /><strong>{language === 'hi' ? 'पाठ्यक्रम जल्द आ रहा है' : 'Syllabus coming soon'}</strong><span>{language === 'hi' ? 'इस परीक्षा के अध्ययन अनुभाग तैयार किए जा रहे हैं।' : 'Learning sections for this exam are being prepared.'}</span></div>}
      <div className="folder-cards-grid">{rootFolders.map((folder, index) => {
        const counts = countFolder(folder.id);
        const starts = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
        const price = getFolderPricing(folder, folders);
        const hasPurchasedExam = examIsPaid && accessByKey[`exam:${exam?.id}`] === true;
        const isRootUnlocked = hasPurchasedExam || price.amount <= 0 || accessByKey[`folder:${folder.id}`] === true;
        return <article className="syllabus-card syllabus-purchase-card" key={folder.id}>
          <Link to={`/folder/${folder.id}`} className="syllabus-card-link">
            <div className="syllabus-card-top">
              <div className="syllabus-card-icon"><Folder size={20} /></div>
              <div className="syllabus-card-top-right">
                <span className="syllabus-number">{starts[index] || String(index + 1).padStart(2, '0')}</span>
                <span className="syllabus-card-arrow"><ArrowRight size={15} /></span>
              </div>
            </div>
            <div className="syllabus-card-copy">
              <span className="eyebrow">{language === 'hi' ? 'अध्ययन विषय' : 'LEARNING SECTION'}</span>
              <h3>{folder.title}</h3>
              {folder.description && <p>{folder.description}</p>}
              <div className="syllabus-card-meta">
                <span><Folder size={12} /> {counts.folders} {language === 'hi' ? 'सब-फ़ोल्डर' : (counts.folders === 1 ? 'subfolder' : 'subfolders')}</span>
                <span>•</span>
                <span><BookOpen size={12} /> {counts.chapters} {language === 'hi' ? 'अध्याय' : (counts.chapters === 1 ? 'chapter' : 'chapters')}</span>
              </div>
            </div>
          </Link>
          <div className="syllabus-card-footer">
            <div className="syllabus-card-footer-left">
              {price.amount > 0 && accessLoading ? (
                <span className="access-badge">{language === 'hi' ? 'जाँच जारी है…' : 'Checking…'}</span>
              ) : price.amount > 0 ? (
                <span className={`access-badge ${isRootUnlocked ? 'access-free' : 'access-paid'}`}>
                  {isRootUnlocked ? (language === 'hi' ? 'अनलॉक किया हुआ' : 'Purchased') : price.label}
                </span>
              ) : (
                <span className="access-badge access-free">{language === 'hi' ? 'मुफ़्त' : 'Free'}</span>
              )}
            </div>
            {price.amount > 0 && !accessLoading && !accessError && !isRootUnlocked && (
              <button
                type="button"
                className="button button-gold buy-inline-button"
                onClick={() => setCheckoutItem({ itemType: 'folder', itemId: folder.id, itemTitle: folder.title, tier: 'Folder Bundle', basePrice: price.amount })}
              >
                {language === 'hi' ? 'बंडल खरीदें' : 'Buy bundle'} · ₹{price.amount.toLocaleString('en-IN')}
              </button>
            )}
          </div>
        </article>;
      })}</div>
      <div className="catalog-tip"><Clock3 size={15} /> {language === 'hi' ? 'प्लान लेने से पहले आप मुफ़्त अध्यायों को देख और हल कर सकते हैं।' : 'You can explore free chapters before committing to a study plan.'}</div>
      {checkoutItem && <CheckoutModal {...checkoutItem} onClose={() => setCheckoutItem(null)} onCompleted={() => setRefreshKey((value) => value + 1)} />}
      </>}
    </div>
  );
}

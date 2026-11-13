import { useMemo, useState } from 'react';
import { Atom, BookMarked, BookOpen, Brain, Calculator, FlaskConical, Globe2, GraduationCap, Landmark, ScrollText, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import useContentCatalog from '../../hooks/useContentCatalog';
import { isPublished } from '../../lib/content';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const examIcons = { BookOpen, GraduationCap, Landmark, Atom, Calculator, Globe2, Brain, ScrollText, FlaskConical, BookMarked };

export default function ExploreExams() {
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Dynamically derive categories from actual exams in database
  const categories = useMemo(() => {
    const list = ['All'];
    exams.forEach((exam) => {
      const cat = exam.category || exam.title;
      if (cat && !list.includes(cat)) {
        list.push(cat);
      }
    });
    return list;
  }, [exams]);

  const visibleExams = useMemo(() => exams.filter((exam) => {
    if (!isPublished(exam)) return false;
    if (selectedCategory !== 'All') {
      const matchCat = (exam.category || exam.title || '').toLowerCase() === selectedCategory.toLowerCase();
      if (!matchCat) return false;
    }
    return !search.trim() || `${exam.title} ${exam.slug} ${exam.description || ''}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [exams, selectedCategory, search]);

  return (
    <div className="explore-page">
      <div className="page-heading explore-heading">
        <div>
          <div className="eyebrow">YOUR NEXT GOAL STARTS HERE</div>
          <h1>Explore exams</h1>
          <p>Choose your exam. We’ll help you take it one step at a time.</p>
        </div>
        <div className="explore-count">
          <GraduationCap size={17} /> {visibleExams.length} {visibleExams.length === 1 ? 'exam' : 'exams'}
        </div>
      </div>

      <label className="explore-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search exams, subjects or syllabus…"
          aria-label="Search exams"
        />
        <kbd>⌘ K</kbd>
      </label>

      {categories.length > 2 && (
        <div className="category-filters" aria-label="Filter by exam category">
          {categories.map((item) => (
            <button
              key={item}
              className={`category-chip ${selectedCategory === item ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {error && <div className="feedback error-feedback">{error}</div>}
      {loading && <LoadingSkeleton rows={4} />}

      {!loading && !error && !visibleExams.length && (
        <div className="empty-content explore-empty">
          <BookOpen size={26} />
          <strong>No exams available matching your search.</strong>
          <span>Try a different keyword or view all exams.</span>
        </div>
      )}

      <div className="exam-cards-grid">
        {visibleExams.map((exam) => {
          const Icon = examIcons[exam.icon] || GraduationCap;
          const examFolders = folders.filter((folder) => folder.exam_id === exam.id && isPublished(folder));
          const folderIds = new Set(examFolders.map((folder) => folder.id));
          const chapterCount = chapters.filter((chapter) => folderIds.has(chapter.folder_id) && isPublished(chapter)).length;
          return (
            <article className="exam-card" key={exam.id}>
              <div className="exam-card-top">
                <div className="exam-card-icon"><Icon size={22} /></div>
                <span className="category-label">{exam.title}</span>
              </div>
              <h2>{exam.title}</h2>
              <p>{exam.description || 'A structured learning path with topics, practice and tests to help you prepare.'}</p>
              <div className="exam-card-meta">
                <span><BookOpen size={14} /> {examFolders.length} {examFolders.length === 1 ? 'folder' : 'folders'}</span>
                <span><Users size={14} /> {chapterCount} chapters</span>
              </div>
              <Link className="button button-gold exam-card-cta" to={`/explore/${encodeURIComponent(exam.slug || exam.id)}`}>
                Explore syllabus <span aria-hidden="true">→</span>
              </Link>
            </article>
          );
        })}
      </div>

      {!loading && !error && visibleExams.length > 0 && (
        <p className="explore-footer-note"><span className="live-dot" /> Curated paths to keep your study focused.</p>
      )}
    </div>
  );
}

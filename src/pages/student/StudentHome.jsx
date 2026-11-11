import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, ClipboardList, Coins, Flame, GraduationCap, Play, Sparkles, Target, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { isPublished } from '../../lib/content';
import OnboardingModal from './OnboardingModal';

const pathways = [
  { key: 'bpsc', title: 'BPSC TRE', match: /bpsc/i, tags: ['BPSC', 'TRE', 'General Studies'], tone: 'gold' },
  { key: 'ctet', title: 'CTET', match: /ctet/i, tags: ['CTET', 'Teaching Aptitude', 'NCERT'], tone: 'green' },
  { key: 'state', title: 'State Exams', match: /state/i, tags: ['State PSC', 'General Studies', 'Current Affairs'], tone: 'blue' }
];

const quickActions = [
  { title: 'liveTests', meta: 'Timed practice built around your exam', path: '/tests', Icon: ClipboardList, tone: 'gold' },
  { title: 'questionBank', meta: 'Explore topics and sharpen concepts', path: '/explore', Icon: BookOpen, tone: 'green' },
  { title: 'studyToolbox', meta: 'Focus timer, revision sheets and saves', path: '/toolbox', Icon: Wrench, tone: 'blue' },
  { title: 'myWallet', meta: 'Your balance and reward activity', path: '/wallet', Icon: Coins, tone: 'violet' }
];

function isComplete(attempt) {
  const status = String(attempt.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt.completed_at || attempt.submitted_at || attempt.finished_at);
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStreak(attempts) {
  const days = new Set(attempts.map((attempt) => {
    const timestamp = attempt.completed_at || attempt.submitted_at || attempt.finished_at || attempt.created_at;
    return timestamp ? localDateKey(timestamp) : '';
  }).filter(Boolean));
  const date = new Date();
  let today = localDateKey(date);
  if (!days.has(today)) {
    date.setDate(date.getDate() - 1);
    today = localDateKey(date);
    if (!days.has(today)) return 0;
  }
  let streak = 0;
  while (days.has(today)) {
    streak += 1;
    date.setDate(date.getDate() - 1);
    today = localDateKey(date);
  }
  return streak;
}

function loadSavedChapter(userId) {
  try {
    return JSON.parse(localStorage.getItem(`zyvra-last-chapter-${userId || 'guest'}`) || 'null');
  } catch (error) {
    console.error('Unable to read the last visited chapter:', error);
    return null;
  }
}

function loadDailyMinutes(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`zyvra-daily-study-${userId || 'guest'}`) || 'null');
    return saved?.date === localDateKey() ? Math.max(0, Number(saved.minutes) || 0) : 0;
  } catch (error) {
    console.error('Unable to read today’s study target progress:', error);
    return 0;
  }
}

export default function StudentHome() {
  const { profile, coinBalance, guest, user, supabase, refreshAccount } = useAuth();
  const { t, language } = useThemeLanguage();
  const { exams, folders, chapters } = useContentCatalog();
  const [dailyMinutes, setDailyMinutes] = useState(() => loadDailyMinutes(user?.id));
  const [savedChapter, setSavedChapter] = useState(() => loadSavedChapter(user?.id));
  const [attempts, setAttempts] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [resumeAttempt, setResumeAttempt] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(Boolean(supabase && user));
  const name = profile?.full_name?.split(' ')[0] || profile?.name?.split(' ')[0] || (guest ? 'Learner' : 'there');
  const currentDate = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }).format(new Date());
  const goal = 30;
  const completedMinutes = Math.min(dailyMinutes, goal);
  const goalPercent = Math.min(100, completedMinutes / goal * 100);

  useEffect(() => {
    if (user && supabase) {
      refreshAccount().catch((error) => console.error('Unable to refresh profile on home page load:', error));
    }
  }, [user?.id, supabase, refreshAccount]);

  useEffect(() => {
    setDailyMinutes(loadDailyMinutes(user?.id));
    setSavedChapter(loadSavedChapter(user?.id));
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const loadStudyOverview = async () => {
      if (!supabase) {
        setDashboardLoading(false);
        return;
      }
      const { data: tests, error: testsError } = await supabase.from('tests')
        .select('id,title,chapter_id,status').in('status', ['published', 'live', 'available']);
      if (testsError) throw testsError;
      if (!active) return;
      setAvailableTests(tests || []);
      if (!user) {
        setDashboardLoading(false);
        return;
      }
      const { data: rows, error: attemptsError } = await supabase.from('test_attempts').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(500);
      if (attemptsError) throw attemptsError;
      if (!active) return;
      const userAttempts = rows || [];
      setAttempts(userAttempts.filter(isComplete));
      const incomplete = userAttempts.find((attempt) => !isComplete(attempt)
        && ['started', 'in_progress', 'in progress', 'pending'].includes(String(attempt.status || '').toLowerCase())
        && attempt.test_id);
      if (incomplete) {
        const test = (tests || []).find((item) => item.id === incomplete.test_id);
        if (test) setResumeAttempt({ ...incomplete, testTitle: test.title });
      } else {
        setResumeAttempt(null);
      }
      setDashboardLoading(false);
    };
    loadStudyOverview().catch((error) => {
      if (active) {
        setDashboardError(error.message || 'Unable to load your study overview.');
        setDashboardLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase, user]);

  const streak = useMemo(() => getStreak(attempts), [attempts]);
  const testCounts = useMemo(() => {
    const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    return availableTests.reduce((counts, test) => {
      if (!['published', 'live', 'available'].includes(String(test.status || '').toLowerCase())) return counts;
      const chapter = chapterById.get(test.chapter_id);
      const folder = chapter && folderById.get(chapter.folder_id);
      const examId = folder?.exam_id;
      if (examId) counts[examId] = (counts[examId] || 0) + 1;
      return counts;
    }, {});
  }, [availableTests, chapters, folders]);

  const featuredPathways = useMemo(() => pathways.map((pathway) => {
    const exam = exams.find((item) => isPublished(item) && pathway.match.test(`${item.title} ${item.slug}`));
    const examFolders = exam ? folders.filter((folder) => folder.exam_id === exam.id && !folder.parent_folder_id && isPublished(folder)) : [];
    const syllabusTags = examFolders.slice(0, 2).map((folder) => folder.title);
    return {
      ...pathway,
      exam,
      count: exam ? testCounts[exam.id] || 0 : 0,
      tags: syllabusTags.length ? syllabusTags : pathway.tags
    };
  }), [exams, folders, testCounts]);

  const resumeTarget = resumeAttempt
    ? { title: resumeAttempt.testTitle, subtitle: 'Unfinished test · Pick up your attempt', path: `/quiz/${resumeAttempt.test_id}`, label: 'liveTests' }
    : savedChapter
      ? { title: savedChapter.title, subtitle: [savedChapter.examTitle, savedChapter.folderTitle, t('lastVisited')].filter(Boolean).join(' · '), path: `/chapter/${savedChapter.id}`, label: 'lastVisited' }
      : null;

  const addStudyTime = () => {
    const next = Math.min(goal, dailyMinutes + 5);
    setDailyMinutes(next);
    try {
      localStorage.setItem(`zyvra-daily-study-${user?.id || 'guest'}`, JSON.stringify({ date: localDateKey(), minutes: next }));
    } catch (error) {
      console.error('Unable to save today’s study target progress:', error);
    }
  };

  const shouldShowOnboarding = Boolean(
    user &&
    !guest &&
    profile &&
    (profile.onboarding_completed === false || profile.onboarding_completed === null)
  );

  return <div className="dashboard-page">
    {shouldShowOnboarding && <OnboardingModal />}
    <section className="welcome-row">
      <div>
        <div className="eyebrow">{currentDate.toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div>
        <h1>{t('greeting')}, {name}<span className="wave">✦</span></h1>
        <p>{t('ready')}</p>
      </div>
      <div className="streak-badge">
        <div className="streak-icon"><Flame size={20} /></div>
        <div><strong>{streak} {t('streakDays')}</strong><span>{t('currentStreak')}</span></div>
      </div>
    </section>
    {guest && <div className="guest-notice"><Sparkles size={16} /> You’re exploring in guest mode. <Link to="/auth">{t('signIn')}</Link> to save your progress.</div>}
    {dashboardError && <div className="feedback error-feedback">{dashboardError}</div>}

    <section className="dashboard-grid">
      <article className="continue-card">
        <div className="continue-content">
          <div className="card-overline"><span className="live-dot" /> {t('continueShelf').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div>
          {dashboardLoading ? <><h2>{t('loadingContinue')}</h2><p>{t('startExploring')}</p></> : resumeTarget ? <>
            <h2>{resumeTarget.title}</h2><p>{resumeTarget.subtitle}</p>
            <Link to={resumeTarget.path} className="button button-gold">{t('resume')} <ArrowRight size={16} /></Link>
          </> : <>
            <h2>{t('noActiveTest')}</h2><p>{t('startExploring')}</p>
            <Link to="/explore" className="button button-gold">{t('exploreExams')} <ArrowRight size={16} /></Link>
          </>}
        </div>
        <div className="continue-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="book-art"><BookOpen size={47} strokeWidth={1.2} /></div><span className="art-star star-one">✦</span><span className="art-star star-two">✧</span><span className="art-label">LEARN · PRACTISE · GROW</span></div>
      </article>
      <article className="daily-card panel-card">
        <div className="card-heading"><div><div className="eyebrow">{t('dailyTarget')}</div><h3>{language === 'hi' ? 'आपकी गति, आपका लक्ष्य' : 'Your rhythm, your pace'}</h3></div><div className="goal-icon"><Target size={19} /></div></div>
        <div className="goal-amount"><strong>{completedMinutes.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')}</strong><span>/ {goal} min</span></div>
        <div className="progress-track goal-track"><span style={{ width: `${goalPercent}%` }} /></div>
        <div className="goal-foot"><span>{completedMinutes >= goal ? t('targetReached') : `${goal - completedMinutes} ${t('minutesRemaining')}`}</span><button aria-label={language === 'hi' ? '5 मिनट जोड़ें' : 'Add 5 study minutes'} onClick={addStudyTime} disabled={completedMinutes >= goal}>{completedMinutes >= goal ? <Check size={14} /> : '+5'}</button></div>
      </article>
      <article className="coins-card panel-card"><div className="coins-orb"><span>✦</span></div><div className="eyebrow">{t('myWallet')}</div><h3>{t('coins')}</h3><div className="coin-total">{Number(coinBalance).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')} <span>coins</span></div><p>{language === 'hi' ? 'आपकी मेहनत, आपके पुरस्कार।' : 'Your learning effort, ready to redeem.'}</p><Link to="/wallet" className="inline-link">{t('myWallet')} <ChevronRight size={15} /></Link></article>
    </section>

    <section className="section-block pathway-section">
      <div className="section-heading"><div><div className="eyebrow">CHOOSE YOUR NEXT MILESTONE</div><h2>{t('featuredPathways')}</h2></div><Link to="/explore" className="inline-link">{t('exploreExams')} <ArrowRight size={15} /></Link></div>
      <div className="pathway-grid">{featuredPathways.map(({ key, title, exam, count, tags, tone }) => <Link className={`pathway-card ${tone}`} key={key} to={exam ? `/explore/${encodeURIComponent(exam.slug)}` : '/explore'}>
        <div className="pathway-card-top"><span className="pathway-icon"><GraduationCap size={19} /></span><span className="pathway-tests">{count} {t('testsCount')}</span></div>
        <h3>{exam?.title || title}</h3>
        <div className="pathway-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <span className="pathway-link">{t('syllabus')} <ArrowRight size={14} /></span>
      </Link>)}</div>
    </section>

    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">MAKE EVERY SESSION COUNT</div><h2>{t('quickActions')}</h2></div></div>
      <div className="action-grid">{quickActions.map(({ title, meta, path, Icon, tone }) => <Link className="action-card" key={title} to={path}>
        <div className={`action-icon ${tone}`}><Icon size={20} /></div>
        <div><h3>{t(title)}</h3><p>{language === 'hi' ? `${t(title)} के साथ अपनी तैयारी आगे बढ़ाएँ` : meta}</p></div>
        <ChevronRight size={17} className="action-arrow" />
      </Link>)}</div>
    </section>
    <div className="dashboard-footnote"><Sparkles size={14} /> {language === 'hi' ? 'नियमित अभ्यास ही आपकी सबसे बड़ी ताकत है।' : 'Your consistency is your superpower. Keep going.'}</div>
  </div>;
}

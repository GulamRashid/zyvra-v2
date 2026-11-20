import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileQuestion,
  HelpCircle,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { generatePcsExamQuestions } from '../../lib/gemini';
import QuestionFormatter from '../common/QuestionFormatter';

const EXAM_PRESETS = [
  { id: 'bpsc', name: 'BPSC (Bihar PSC)', optionsCount: 5, badge: '5 Options (Option E Included)', desc: 'बिहार लोक सेवा आयोग - 5वां विकल्प स्वतः शामिल' },
  { id: 'uppsc', name: 'UPPSC (Uttar Pradesh PSC)', optionsCount: 4, badge: '4 Options (Assertion-Reason)', desc: 'उत्तर प्रदेश लोक सेवा आयोग - कथन-कारण व कूट मिलान' },
  { id: 'mppsc', name: 'MPPSC (Madhya Pradesh PSC)', optionsCount: 4, badge: '4 Options (Fact & Concept)', desc: 'मध्य प्रदेश लोक सेवा आयोग - तथ्यात्मक व विश्लेषणात्मक' },
  { id: 'upsc', name: 'UPSC Civil Services Prelims', optionsCount: 4, badge: 'High Analytical Depth', desc: 'संघ लोक सेवा आयोग - गहन बहु-कथन मूल्यांकन' },
  { id: 'general_pcs', name: 'General State PCS', optionsCount: 4, badge: 'Standard PCS', desc: 'राज्य स्तरीय सिविल सेवा प्रारंभिक परीक्षा' }
];

const POPULAR_SUBJECTS = [
  'Indian Polity & Constitution (राजव्यवस्था एवं संविधान)',
  'Modern Indian History (आधुनिक भारत का इतिहास)',
  'Indian & World Geography (भारत एवं विश्व का भूगोल)',
  'Indian Economy (भारतीय अर्थव्यवस्था)',
  'General Science & Technology (सामान्य विज्ञान व प्रौद्योगिकी)',
  'Environment & Ecology (पर्यावरण एवं पारिस्थितिकी)',
  'Bihar Special GK (बिहार विशेष सामान्य ज्ञान)',
  'UP Special GK (उत्तर प्रदेश विशेष सामान्य ज्ञान)',
  'Current Affairs & Schemes (समसामयिकी एवं सरकारी योजनाएं)'
];

const TOPIC_SUGGESTIONS = {
  'Indian Polity & Constitution (राजव्यवस्था एवं संविधान)': [
    'मौलिक अधिकार एवं अनुच्छेद 19, 21',
    'राज्य के नीति निदेशक तत्व (DPSP) एवं मौलिक कर्तव्य',
    'संसद, संसदीय समितियां एवं विधायी प्रक्रिया',
    'राष्ट्रपति, राज्यपाल एवं उनकी वीटो/अध्यादेश शक्तियां',
    'सर्वोच्च न्यायालय, न्यायिक समीक्षा एवं जनहित याचिका (PIL)',
    'संवैधानिक एवं गैर-संवैधानिक निकाय (ECI, UPSC, CAG, NITI Aayog)'
  ],
  'Modern Indian History (आधुनिक भारत का इतिहास)': [
    '1857 का विद्रोह: कारण, प्रसार एवं असफलता',
    'सामाजिक-धार्मिक सुधार आंदोलन (ब्रह्म समाज, आर्य समाज)',
    'भारतीय राष्ट्रीय कांग्रेस के चरण (उदारवादी एवं गरमपंथी)',
    'गांधीवादी आंदोलन (असहयोग, सविनय अवज्ञा, भारत छोड़ो)',
    'ब्रिटिश कालीन भू-राजस्व नीतियां (स्थायी, रैयतवाड़ी, महालवाड़ी)',
    'क्रांतिकारी राष्ट्रवाद एवं प्रमुख षड्यंत्र केस'
  ],
  'Indian & World Geography (भारत एवं विश्व का भूगोल)': [
    'हिमालय का भू-आकृतिक विभाजन एवं प्रमुख दर्रे',
    'प्रायद्वीपीय अपवाह तंत्र (गंगा, सिंधु, गोदावरी, नर्मदा)',
    'भारतीय मानसून की क्रियाविधि एवं एल नीनो का प्रभाव',
    'भारत की प्रमुख मृदाएं, वनस्पति एवं कृषि प्रतिरूप',
    'खनिज एवं ऊर्जा संसाधन तथा औद्योगिक क्षेत्र'
  ],
  'Indian Economy (भारतीय अर्थव्यवस्था)': [
    'मौद्रिक नीति समिति (MPC) एवं RBI के उपकरण (Repo, CRR)',
    'मुद्रास्फीति (Inflation): प्रकार, मापन एवं नियंत्रण',
    'राजकोषीय नीति, घाटे (Fiscal Deficit) एवं बजट निर्माण',
    'बैंकिंग सुधार, NPA समस्या एवं वित्तीय समावेशन',
    'नीति आयोग एवं भारत में पंचवर्षीय योजनाओं का इतिहास'
  ]
};

export default function PcsQuestionGeneratorModal({
  isOpen,
  onClose,
  chapters = [],
  tests = [],
  onQuestionsInserted
}) {
  const { user, supabase } = useAuth();

  // Step 1: Form state
  const [examTarget, setExamTarget] = useState('bpsc');
  const [subject, setSubject] = useState(POPULAR_SUBJECTS[0]);
  const [topic, setTopic] = useState('मौलिक अधिकार एवं अनुच्छेद 19, 21');
  const [subtopic, setSubtopic] = useState('');
  const [questionMix, setQuestionMix] = useState('balanced');
  const [difficulty, setDifficulty] = useState('pcs_prelims');
  const [count, setCount] = useState(5);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');

  // Step 2: Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatusMsg, setGenStatusMsg] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [error, setError] = useState('');

  // Step 3: Review state
  const [previewLanguage, setPreviewLanguage] = useState('hi');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('कृपया मुख्य विषय (Topic) दर्ज करें।');
      return;
    }
    setError('');
    setIsGenerating(true);
    setSaveSuccess(false);
    setGeneratedQuestions([]);

    const statusUpdates = [
      'एनसीईआरटी (कक्षा 6-12) एवं प्रमाणिक संदर्भों का विश्लेषण...',
      'PCS प्रश्न पत्र शैली (बहु-कथन व कूट) का निर्माण...',
      'वास्तविक भटकाव (Distractor Traps) व विकल्पों का संयोजन...',
      'द्विभाषी अनुवाद एवं विस्तृत व्याख्या (KaTeX) का सत्यापन...'
    ];

    let statusIndex = 0;
    setGenStatusMsg(statusUpdates[0]);
    const timer = setInterval(() => {
      statusIndex = (statusIndex + 1) % statusUpdates.length;
      setGenStatusMsg(statusUpdates[statusIndex]);
    }, 2400);

    try {
      const results = await generatePcsExamQuestions({
        subject: subject.split('(')[0].trim(),
        topic: topic.trim(),
        subtopic: subtopic.trim(),
        examTarget,
        questionMix,
        difficulty,
        count: Number(count),
        chapterId: selectedChapterId || null
      });

      clearInterval(timer);
      setGeneratedQuestions(results || []);
    } catch (genError) {
      clearInterval(timer);
      console.error('PCS Question Generation Failed:', genError);
      setError(genError.message || 'प्रश्न निर्माण में त्रुटि हुई। कृपया पुनः प्रयास करें।');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveQuestion = (index) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveToDatabase = async () => {
    if (!generatedQuestions.length) return;
    if (!supabase || !user) {
      setError('Authentication error. Please sign in as admin.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // 1. Prepare clean rows for questions table
      const rowsToInsert = generatedQuestions.map((q) => ({
        question_text: q.question_text || '',
        question_text_hi: q.question_text_hi || null,
        question_type: 'mcq',
        options: q.options || [],
        correct_answer: String(q.correct_answer || 'A').toUpperCase(),
        explanation: q.explanation || null,
        explanation_hi: q.explanation_hi || null,
        distractor_notes: q.distractor_notes || {},
        subject: q.subject || subject.split('(')[0].trim(),
        difficulty: q.difficulty || 'hard',
        chapter_id: selectedChapterId || null,
        usage_scope: 'both',
        tags: q.tags || [examTarget.toUpperCase(), subject.split('(')[0].trim()],
        status: 'published'
      }));

      const { data: insertedQuestions, error: insertError } = await supabase
        .from('questions')
        .insert(rowsToInsert)
        .select('id');

      if (insertError) throw insertError;

      // 2. If a test is selected, link questions to test_questions
      if (selectedTestId && insertedQuestions && insertedQuestions.length > 0) {
        const { data: maxOrderData } = await supabase
          .from('test_questions')
          .select('order_index')
          .eq('test_id', selectedTestId)
          .order('order_index', { ascending: false })
          .limit(1);

        const startOrder = maxOrderData?.[0]?.order_index != null ? Number(maxOrderData[0].order_index) + 1 : 1;
        const testQuestionRows = insertedQuestions.map((q, idx) => ({
          test_id: selectedTestId,
          question_id: q.id,
          order_index: startOrder + idx
        }));

        const { error: linkError } = await supabase
          .from('test_questions')
          .insert(testQuestionRows);

        if (linkError) {
          console.warn('Could not link to test directly:', linkError);
        }
      }

      setSaveSuccess(true);
      if (onQuestionsInserted) {
        onQuestionsInserted(insertedQuestions.length);
      }
    } catch (saveError) {
      console.error('Failed to save questions to DB:', saveError);
      setError(saveError.message || 'डेटाबेस में प्रश्न सेव करने में त्रुटि हुई।');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl dark:bg-[#0B1120] bg-white border dark:border-slate-800 border-slate-200 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b dark:border-slate-800/80 border-slate-100 dark:bg-[#1E293B]/60 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black dark:text-white text-slate-900 tracking-tight">
                  PCS Examiner AI Question Generator
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/20">
                  State PSC Grade
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                NCERT, लक्ष्मीकांत व स्पेक्ट्रम संदर्भों पर आधारित प्रामाणिक बहु-कथन प्रश्न निर्माता
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:hover:bg-slate-800 hover:bg-slate-200 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            aria-label="Close generator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Check size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black dark:text-white text-slate-900">
                  सफलतापूर्वक सेव हो गया!
                </h3>
                <p className="text-sm text-slate-400">
                  सभी {generatedQuestions.length} PCS प्रश्न सीधे आपके प्रश्न बैंक में जुड़ चुके हैं।
                  {selectedTestId && ' और चुने गए टेस्ट से लिंक भी कर दिए गए हैं।'}
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSaveSuccess(false);
                    setGeneratedQuestions([]);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
                >
                  और प्रश्न बनाएं
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
                >
                  पूर्ण हुआ
                </button>
              </div>
            </div>
          ) : generatedQuestions.length === 0 ? (
            /* Setup Form */
            <div className="space-y-5">
              {/* Exam Target Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  1. लक्ष्य परीक्षा प्रारूप (Target Commission Pattern)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {EXAM_PRESETS.map((preset) => {
                    const isSelected = examTarget === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setExamTarget(preset.id)}
                        className={`p-3 rounded-2xl text-left border transition-all ${
                          isSelected
                            ? 'dark:bg-indigo-950/40 bg-indigo-50/60 border-indigo-500 dark:border-indigo-500 text-indigo-400 shadow-sm'
                            : 'dark:bg-[#1E293B]/40 bg-slate-50/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {preset.name}
                          </span>
                          {isSelected && <Check size={14} className="text-indigo-500" />}
                        </div>
                        <p className="text-[11px] leading-tight opacity-75">{preset.desc}</p>
                        <span className="inline-block mt-2 text-[10px] font-bold text-amber-500/90 dark:text-amber-400/90">
                          {preset.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject & Topic Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    2. विषय (Subject)
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      const suggestions = TOPIC_SUGGESTIONS[e.target.value];
                      if (suggestions && suggestions.length > 0) {
                        setTopic(suggestions[0]);
                      }
                    }}
                    className="w-full text-xs font-semibold p-2.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {POPULAR_SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    3. मुख्य विषय / टॉपिक (Main Curriculum Topic)
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="उदा. मौलिक अधिकार, प्रायद्वीपीय नदियां..."
                    className="w-full text-xs font-semibold p-2.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Topic Suggestions Pills */}
              {TOPIC_SUGGESTIONS[subject] && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500">
                    💡 अनुशंसित PCS टॉपिक्स (क्लिक करके चुनें):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {TOPIC_SUGGESTIONS[subject].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setTopic(sug)}
                        className={`text-[11px] px-2.5 py-1 rounded-xl transition-all ${
                          topic === sug
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'dark:bg-slate-800 bg-slate-100 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pattern, Difficulty & Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    4. प्रश्न प्रारूप (Format Mix)
                  </label>
                  <select
                    value={questionMix}
                    onChange={(e) => setQuestionMix(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="balanced">Balanced PCS Mix (बहु-कथन + कूट)</option>
                    <option value="statements">कथन 1, 2, 3 मूल्यांकन</option>
                    <option value="assertion_reason">कथन (A) एवं कारण (R)</option>
                    <option value="match_columns">सूची-I को सूची-II से सुमेलित</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    5. कठिनाई स्तर (Difficulty)
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pcs_prelims">Standard PCS Prelims (कठिन व गहन)</option>
                    <option value="pcs_advanced">Mains-Foundation (अत्यधिक विश्लेषणात्मक)</option>
                    <option value="moderate">Moderate Prelims (मध्यम स्तर)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    6. प्रश्नों की संख्या
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-2.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={3}>3 प्रश्न (Quick Check)</option>
                    <option value={5}>5 प्रश्न (अनुशंसित / Balanced)</option>
                    <option value={10}>10 प्रश्न (Full Section)</option>
                    <option value={15}>15 प्रश्न (Comprehensive)</option>
                  </select>
                </div>
              </div>

              {/* Chapter & Test Linking (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t dark:border-slate-800/60 border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    अध्याय से मैप करें (Map to Chapter - ऐच्छिक)
                  </label>
                  <select
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900"
                  >
                    <option value="">-- किसी अध्याय से लिंक न करें --</option>
                    {chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    सीधे टेस्ट में जोड़ें (Assign to Test - ऐच्छिक)
                  </label>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-[#1E293B] bg-white dark:text-white text-slate-900"
                  >
                    <option value="">-- सीधे किसी टेस्ट में न जोड़ें --</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Review Generated Questions */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b dark:border-slate-800 border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold dark:text-white text-slate-900">
                    निर्मित प्रश्न ({generatedQuestions.length})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">
                    सत्यापित व तैयार
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">भाषा:</span>
                  <div className="flex rounded-lg border dark:border-slate-700 border-slate-300 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewLanguage('hi')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        previewLanguage === 'hi'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      हिंदी
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewLanguage('en')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        previewLanguage === 'en'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>

              {/* Questions List Preview */}
              <div className="space-y-4">
                {generatedQuestions.map((q, qIndex) => {
                  const qText = previewLanguage === 'hi' ? q.question_text_hi || q.question_text : q.question_text;
                  const explanationText = previewLanguage === 'hi' ? q.explanation_hi || q.explanation : q.explanation;

                  return (
                    <article
                      key={qIndex}
                      className="p-4 sm:p-5 rounded-2xl dark:bg-[#1E293B]/60 bg-slate-50 border dark:border-slate-800 border-slate-200 space-y-3 relative group"
                    >
                      {/* Top Bar */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-500 tracking-wider">
                          Q{qIndex + 1} · {q.subject}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                            सही उत्तर: {q.correct_answer}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIndex)}
                            className="text-slate-400 hover:text-rose-400 p-1"
                            title="Remove this question"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="text-sm font-semibold dark:text-white text-slate-900 leading-relaxed whitespace-pre-wrap">
                        {qText}
                      </div>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(q.options || []).map((opt, optIdx) => {
                          const optKey = String.fromCharCode(65 + optIdx);
                          const isCorrect = optKey === q.correct_answer;
                          const optText = previewLanguage === 'hi' ? opt.hi || opt.en : opt.en;

                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                                isCorrect
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 dark:text-emerald-300 font-bold'
                                  : 'dark:bg-slate-900/60 bg-white border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 font-black text-[11px] bg-slate-200 dark:bg-slate-800">
                                {optKey}
                              </span>
                              <span className="flex-1">{optText}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation Accordion */}
                      {explanationText && (
                        <div className="p-3 rounded-xl dark:bg-slate-900/90 bg-white border dark:border-slate-800/80 border-slate-200 text-xs space-y-1">
                          <strong className="block text-indigo-400 font-bold">
                            📖 प्रामाणिक संदर्भ एवं व्याख्या:
                          </strong>
                          <p className="dark:text-slate-300 text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {explanationText}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Bar */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-t dark:border-slate-800 border-slate-100 dark:bg-[#1E293B]/60 bg-slate-50/70">
          {generatedQuestions.length === 0 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                रद्द करें
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <LoaderCircle size={15} className="spin" />
                    <span>{genStatusMsg || 'प्रश्न तैयार किए जा रहे हैं…'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>✦ PCS स्तर के प्रश्न जनरेट करें ({count} सवाल)</span>
                  </>
                )}
              </button>
            </>
          ) : !saveSuccess ? (
            <>
              <button
                type="button"
                onClick={() => setGeneratedQuestions([])}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                ← वापस बदलें
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-bold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw size={13} />
                  <span>पुनः जनरेट करें</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <LoaderCircle size={15} className="spin" />
                      <span>डेटाबेस में सेव हो रहा है…</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>सभी {generatedQuestions.length} प्रश्न डेटाबेस में जोड़ें</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>

      </div>
    </div>
  );
}

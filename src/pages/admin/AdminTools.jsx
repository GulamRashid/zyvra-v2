import { useEffect, useState } from 'react';
import {
  Wrench, Calculator, BookOpen, Clock, Brain, CheckCircle2,
  AlertCircle, RefreshCw, Save, ToggleLeft, ToggleRight, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const DEFAULT_TOOLS = [
  {
    id: 'pomodoro',
    name: 'Pomodoro Study Timer',
    category: 'Productivity',
    description: 'Interval study timer with customizable focus & break sessions.',
    icon: 'Clock',
    enabled: true,
    exams: ['ALL', 'BPSC', 'SSC', 'CTET']
  },
  {
    id: 'math-shortcuts',
    name: 'Speed Math & Mental Calculation',
    category: 'Quantitative Aptitude',
    description: 'Multiplication tricks, squares, cubes, and percentage fraction charts.',
    icon: 'Calculator',
    enabled: true,
    exams: ['SSC', 'BPSC', 'CTET']
  },
  {
    id: 'polity-articles',
    name: 'Constitution & Articles Quick Navigator',
    category: 'General Studies',
    description: 'Searchable index of all Indian Constitution articles and amendments.',
    icon: 'BookOpen',
    enabled: true,
    exams: ['BPSC', 'SSC']
  },
  {
    id: 'formula-sheet',
    name: 'Reasoning & Logic Formula Hub',
    category: 'Reasoning',
    description: 'Syllogism rules, blood relation trees, and seating arrangement diagrams.',
    icon: 'Brain',
    enabled: true,
    exams: ['SSC', 'CTET']
  }
];

export default function AdminTools() {
  const { supabase } = useAuth();
  const [tools, setTools] = useState(DEFAULT_TOOLS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  const loadTools = async (active = () => true) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error && error.code !== 'PGRST116') throw error;

      if (active() && data) {
        const row = data.find((r) => r.key === 'study_toolbox_config' || r.setting_key === 'study_toolbox_config');
        const val = row?.setting_value !== undefined ? row.setting_value : row?.value;
        if (val && Array.isArray(val)) {
          setTools(val);
        }
      }
    } catch (err) {
      console.warn('Error loading toolbox config:', err.message);
    } finally {
      if (active()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadTools(() => active);
    return () => { active = false; };
  }, [supabase]);

  const toggleTool = (toolId) => {
    setTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback({ text: '', type: '' });
    try {
      let { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'study_toolbox_config',
          setting_key: 'study_toolbox_config',
          setting_value: tools,
          value: tools
        }, { onConflict: 'setting_key' });

      if (error) {
        const fallback = await supabase
          .from('platform_settings')
          .upsert({
            key: 'study_toolbox_config',
            setting_key: 'study_toolbox_config',
            setting_value: tools,
            value: tools
          }, { onConflict: 'key' });
        if (fallback.error) throw fallback.error;
      }
      setFeedback({ text: 'Toolbox configurations saved and live for learners.', type: 'success' });
    } catch (err) {
      setFeedback({ text: err.message || 'Failed to save tools.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'Calculator': return <Calculator size={18} />;
      case 'Clock': return <Clock size={18} />;
      case 'BookOpen': return <BookOpen size={18} />;
      case 'Brain': return <Brain size={18} />;
      default: return <Wrench size={18} />;
    }
  };

  return (
    <div className="admin-tools-page">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">UTILITIES & STUDENT HELPERS</div>
          <h1>Study Toolbox Manager</h1>
          <p>Control the availability of interactive learning tools and calculators shown to students.</p>
        </div>
        <button
          className="button button-gold"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {feedback.text && (
        <div className={`feedback ${feedback.type === 'success' ? 'success-feedback' : 'error-feedback'}`} style={{ marginBottom: '20px' }}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedback.text}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="tools-grid">
          {tools.map((tool) => (
            <article
              key={tool.id}
              className={`panel-card admin-tool-card ${tool.enabled ? '' : 'disabled'}`}
            >
              <div>
                <div className="admin-tool-card-heading">
                  <div className="admin-tool-card-title">
                    <div className="setting-symbol">
                      {getIcon(tool.icon)}
                    </div>
                    <div>
                      <span className="admin-tool-category">{tool.category}</span>
                      <h3>{tool.name}</h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    className={`admin-tool-toggle ${tool.enabled ? 'enabled' : ''}`}
                    title={tool.enabled ? 'Disable tool' : 'Enable tool'}
                    aria-label={`${tool.enabled ? 'Disable' : 'Enable'} ${tool.name}`}
                  >
                    {tool.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                <p className="admin-tool-description">
                  {tool.description}
                </p>
              </div>

              <div className="admin-tool-card-footer">
                <div className="admin-tool-exams">
                  {(tool.exams || []).map((ex) => (
                    <span key={ex} className="admin-tool-exam-badge">
                      {ex}
                    </span>
                  ))}
                </div>
                <span className={`admin-tool-status ${tool.enabled ? 'enabled' : ''}`}>
                  {tool.enabled ? 'VISIBLE' : 'HIDDEN'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

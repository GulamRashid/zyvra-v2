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
    access_type: 'free',
    price: 0,
    validity_days: 30,
    exams: ['ALL', 'BPSC', 'SSC', 'CTET']
  },
  {
    id: 'math-shortcuts',
    name: 'Speed Math & Mental Calculation',
    category: 'Quantitative Aptitude',
    description: 'Multiplication tricks, squares, cubes, and percentage fraction charts.',
    icon: 'Calculator',
    enabled: true,
    access_type: 'free',
    price: 0,
    validity_days: 30,
    exams: ['SSC', 'BPSC', 'CTET']
  },
  {
    id: 'polity-articles',
    name: 'Constitution & Articles Quick Navigator',
    category: 'General Studies',
    description: 'Searchable index of all Indian Constitution articles and amendments.',
    icon: 'BookOpen',
    enabled: true,
    access_type: 'free',
    price: 0,
    validity_days: 30,
    exams: ['BPSC', 'SSC']
  },
  {
    id: 'formula-sheet',
    name: 'Reasoning & Logic Formula Hub',
    category: 'Reasoning',
    description: 'Syllogism rules, blood relation trees, and seating arrangement diagrams.',
    icon: 'Brain',
    enabled: true,
    access_type: 'free',
    price: 0,
    validity_days: 30,
    exams: ['SSC', 'CTET']
  }
];

export default function AdminTools() {
  const { supabase } = useAuth();
  const [tools, setTools] = useState(DEFAULT_TOOLS);
  const [combo, setCombo] = useState({ price: 0, validity_days: 30 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  const loadTools = async (active = () => true) => {
    if (!supabase) {
      if (active()) {
        setFeedback({ text: 'Supabase is unavailable. Toolbox settings could not be loaded.', type: 'error' });
        setLoading(false);
      }
      return;
    }
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error && error.code !== 'PGRST116') throw error;

      if (active() && data) {
        const row = data.find((r) => r.key === 'study_toolbox_config' || r.setting_key === 'study_toolbox_config');
        const pricingRow = data.find((r) => r.key === 'toolbox_pricing' || r.setting_key === 'toolbox_pricing');
        const rawTools = row?.setting_value !== undefined ? row.setting_value : row?.value;
        const rawPricing = pricingRow?.setting_value !== undefined ? pricingRow.setting_value : pricingRow?.value;
        const parsedTools = typeof rawTools === 'string' ? JSON.parse(rawTools) : rawTools;
        const parsedPricing = typeof rawPricing === 'string' ? JSON.parse(rawPricing) : rawPricing;
        if (Array.isArray(parsedTools)) {
          setTools(DEFAULT_TOOLS.map((defaultTool) => {
            const configured = parsedTools.find((tool) => tool?.id === defaultTool.id);
            return { ...defaultTool, ...(configured || {}) };
          }));
        }
        if (parsedPricing && typeof parsedPricing === 'object') {
          const pricingTools = parsedPricing.tools && typeof parsedPricing.tools === 'object' ? parsedPricing.tools : {};
          setTools((current) => current.map((tool) => ({
            ...tool,
            ...(pricingTools[tool.id] || {})
          })));
          if (parsedPricing.combo && typeof parsedPricing.combo === 'object') {
            setCombo({
              price: Math.max(0, Number(parsedPricing.combo.price) || 0),
              validity_days: Math.max(1, Number(parsedPricing.combo.validity_days) || 30)
            });
          }
        }
      }
    } catch (err) {
      if (active()) setFeedback({ text: err.message || 'Unable to load Toolbox settings.', type: 'error' });
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

  const updateTool = (toolId, changes) => {
    setTools((current) => current.map((tool) => tool.id === toolId ? { ...tool, ...changes } : tool));
  };

  const handleSave = async () => {
    if (!supabase) {
      setFeedback({ text: 'Supabase is unavailable. Toolbox settings were not saved.', type: 'error' });
      return;
    }
    if (tools.some((tool) => tool.access_type === 'premium' && Number(tool.price) <= 0)) {
      setFeedback({ text: 'Set an unlock price greater than zero for every premium tool.', type: 'error' });
      return;
    }
    setSaving(true);
    setFeedback({ text: '', type: '' });
    try {
      const [toolsResult, pricingResult] = await Promise.all([
        supabase
        .from('platform_settings')
        .upsert({
          key: 'study_toolbox_config',
          setting_key: 'study_toolbox_config',
          setting_value: tools
        }, { onConflict: 'setting_key' }),
        supabase
          .from('platform_settings')
          .upsert({
            key: 'toolbox_pricing',
            setting_key: 'toolbox_pricing',
            setting_value: {
              tools: Object.fromEntries(tools.map((tool) => [tool.id, {
                access_type: tool.access_type || 'free',
                price: Math.max(0, Number(tool.price) || 0),
                validity_days: Math.max(1, Number(tool.validity_days) || 30)
              }])),
              combo: {
                price: Math.max(0, Number(combo.price) || 0),
                validity_days: Math.max(1, Number(combo.validity_days) || 30)
              }
            }
          }, { onConflict: 'setting_key' })
      ]);
      if (toolsResult.error) throw toolsResult.error;
      if (pricingResult.error) throw pricingResult.error;
      setFeedback({ text: 'Tool availability and pricing saved for learners.', type: 'success' });
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

      <section className="panel-card toolbox-combo-settings">
        <div className="section-heading"><div><div className="eyebrow">BUNDLE OFFER</div><h2>Combo Access / Unlock All Tools</h2><p>Set the package price and access duration for the full Toolbox.</p></div><div className="setting-symbol"><Sparkles size={18} /></div></div>
        <div className="toolbox-combo-fields">
          <label className="field-label">Combo price (₹)<input className="text-input" type="number" min="0" step="1" value={combo.price} onChange={(event) => setCombo((current) => ({ ...current, price: event.target.value }))} /></label>
          <label className="field-label">Combo validity (days)<input className="text-input" type="number" min="1" step="1" value={combo.validity_days} onChange={(event) => setCombo((current) => ({ ...current, validity_days: event.target.value }))} /></label>
        </div>
      </section>

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
                  <span className={`admin-tool-status ${tool.enabled ? 'enabled' : ''}`}>
                    {tool.enabled ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="admin-tool-description">
                  {tool.description}
                </p>
              </div>

              <div className="admin-tool-pricing">
                <label className="field-label">Access type
                  <select className="text-input" value={tool.access_type || 'free'} onChange={(event) => updateTool(tool.id, { access_type: event.target.value })}>
                    <option value="free">Free</option>
                    <option value="premium">Locked / Paid</option>
                  </select>
                </label>
                <label className="field-label">Unlock price (₹)
                  <input className="text-input" type="number" min="0" step="1" value={tool.price ?? 0} onChange={(event) => updateTool(tool.id, { price: event.target.value })} disabled={tool.access_type !== 'premium'} />
                </label>
                <label className="field-label">Validity (days)
                  <input className="text-input" type="number" min="1" step="1" value={tool.validity_days ?? 30} onChange={(event) => updateTool(tool.id, { validity_days: event.target.value })} />
                </label>
              </div>

              <div className="admin-tool-card-footer">
                <div className="admin-tool-exams">
                  {(tool.exams || []).map((ex) => (
                    <span key={ex} className="admin-tool-exam-badge">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Coins, Save, Settings2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const defaultSlabs = [{ min_percentage: 90, coins: 50 }, { min_percentage: 80, coins: 30 }];
const parseSlabs = (value) => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some((row) => !Number.isFinite(Number(row.min_percentage)) || !Number.isFinite(Number(row.coins)))) {
    throw new Error('Reward slabs must be a list of percentage and coin values.');
  }
  return parsed.map((row) => ({ min_percentage: Number(row.min_percentage), coins: Number(row.coins) }));
};

export default function SettingsPreview({ compact = false }) {
  const { supabase } = useAuth();
  const [slabs, setSlabs] = useState(defaultSlabs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error: loadError } = await supabase.from('platform_settings').select('*');
      if (!active) return;
      if (loadError) setError(loadError.message);
      else {
        const row = (data || []).find((r) => r.key === 'test_coin_reward_slabs' || r.setting_key === 'test_coin_reward_slabs');
        if (row?.value !== undefined) {
          try { setSlabs(parseSlabs(row.value)); }
          catch (parseError) { setError(parseError.message); }
        }
      }
      setLoading(false);
    };
    load().catch((loadError) => { if (active) { setError(loadError.message || 'Unable to load reward settings.'); setLoading(false); } });
    return () => { active = false; };
  }, [supabase]);
  const updateSlab = (index, key, value) => setSlabs((current) => current.map((slab, item) => item === index ? { ...slab, [key]: value } : slab));
  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (!supabase) { setError('Configure Supabase before saving platform settings.'); return; }
    const normalized = slabs.map((slab) => ({ min_percentage: Number(slab.min_percentage), coins: Number(slab.coins) }));
    if (normalized.some((slab) => !Number.isFinite(slab.min_percentage) || slab.min_percentage < 0 || slab.min_percentage > 100 || !Number.isFinite(slab.coins) || slab.coins < 0)) {
      setError('Enter percentages from 0 to 100 and non-negative coin rewards.');
      return;
    }
    setSaving(true);
    try {
      let { error: saveError } = await supabase.from('platform_settings').upsert({ key: 'test_coin_reward_slabs', setting_key: 'test_coin_reward_slabs', value: normalized }, { onConflict: 'key' });
      if (saveError) {
        const fallback = await supabase.from('platform_settings').upsert({ key: 'test_coin_reward_slabs', setting_key: 'test_coin_reward_slabs', value: normalized }, { onConflict: 'setting_key' });
        if (fallback.error) throw fallback.error;
      }
      setSlabs(normalized);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save reward settings.');
    } finally { setSaving(false); }
  };
  return <section className={`panel-card settings-preview ${compact ? 'compact-preview' : ''}`}><div className="section-heading"><div><div className="eyebrow">PLATFORM SETTINGS</div><h2>Test reward slabs</h2><p>Choose coin rewards based on a student’s test percentage.</p></div><div className="setting-symbol"><Settings2 size={18} /></div></div>
    {loading ? <p className="field-hint">Loading platform settings…</p> : <form onSubmit={save}><div className="reward-slabs">{slabs.map((slab, index) => <div className="reward-row" key={index}><label><span>Score threshold</span><div className="number-input"><input aria-label="Minimum percentage" type="number" min="0" max="100" value={slab.min_percentage} onChange={(event) => updateSlab(index, 'min_percentage', event.target.value)} /><span>% and above</span></div></label><label><span>Coins awarded</span><div className="number-input"><Coins size={15} /><input aria-label="Coins awarded" type="number" min="0" value={slab.coins} onChange={(event) => updateSlab(index, 'coins', event.target.value)} /><span>coins</span></div></label></div>)}</div><div className="settings-actions">{error && <span className="settings-error">{error}</span>}{saved && <span className="settings-success">Settings saved.</span>}<button className="button button-gold" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save settings'}</button></div></form>}
    {!supabase && !loading && <p className="field-hint">Values shown are defaults. Connect Supabase to load and save platform settings.</p>}
  </section>;
}

import { useCallback, useEffect, useState } from 'react';
import { Coins, Power } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/auditLog';

function parseEnabledFlag(raw) {
  if (typeof raw === 'boolean') return raw;
  if (raw && typeof raw === 'object' && typeof raw.enabled === 'boolean') return raw.enabled;
  if (typeof raw === 'string') return raw.trim().toLowerCase() === 'true';
  return false; // Default OFF
}

export default function TestCoinsToggleCard() {
  const { user, supabase } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadSetting = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('value, setting_value')
        .or('key.eq.test_completion_coins_enabled,setting_key.eq.test_completion_coins_enabled')
        .maybeSingle();
      const raw = data?.setting_value !== undefined ? data.setting_value : data?.value;
      setEnabled(parseEnabledFlag(raw));
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSetting();
  }, [loadSetting]);

  const handleToggle = async () => {
    if (!supabase || saving || loading) return;
    const nextVal = !enabled;
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const payload = {
        key: 'test_completion_coins_enabled',
        setting_key: 'test_completion_coins_enabled',
        value: nextVal,
        setting_value: nextVal,
        updated_at: new Date().toISOString()
      };
      let { error: saveErr } = await supabase
        .from('platform_settings')
        .upsert(payload, { onConflict: 'setting_key' });
      if (saveErr) {
        const fb = await supabase
          .from('platform_settings')
          .upsert(payload, { onConflict: 'key' });
        if (fb.error) throw fb.error;
      }
      setEnabled(nextVal);
      setFeedback(`Test Completion Coins turned ${nextVal ? 'ON' : 'OFF'}.`);
      logAdminAction(supabase, {
        actor: user,
        action: 'toggle_test_completion_coins',
        targetType: 'platform_settings',
        targetId: 'test_completion_coins_enabled',
        details: { enabled: nextVal }
      });
    } catch (err) {
      setError(err.message || 'Unable to update Test Completion Coins setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-amber-500" />
          <span className="eyebrow">GLOBAL REWARD CONTROL</span>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Test Completion Coins — {loading ? 'Checking…' : enabled ? 'ON' : 'OFF'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          When OFF, test submissions award 0 coins and leave Wallet balance, Total Earned, and ledger unchanged. Referral coins remain separate and active.
        </p>
        {feedback && <p className="text-xs font-semibold text-emerald-500 pt-1">{feedback}</p>}
        {error && <p className="text-xs font-semibold text-rose-500 pt-1">{error}</p>}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || saving}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 min-h-[44px] ${
          enabled
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
        }`}
      >
        <Power size={15} />
        <span>{saving ? 'Updating…' : enabled ? 'ON — Click to Turn OFF' : 'OFF — Click to Turn ON'}</span>
      </button>
    </section>
  );
}

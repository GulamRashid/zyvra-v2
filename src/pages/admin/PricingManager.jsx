import { useEffect, useState } from 'react';
import { Coins, CreditCard, RefreshCw, Save, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatRupees, parseCoinRedemptionConfig } from '../../lib/commerce';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

function orderAmount(order, keys) {
  for (const key of keys) {
    if (order[key] !== undefined && order[key] !== null) return Number(order[key]) || 0;
  }
  return 0;
}

export default function PricingManager() {
  const { supabase } = useAuth();
  const [config, setConfig] = useState({ coins_per_rupee: 10, max_discount_percent: 20 });
  const [pricingEnabled, setPricingEnabled] = useState(true);
  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setError('');
    const [configResult, enabledResult, orderResult] = await Promise.all([
      supabase.from('platform_settings').select('*').or('setting_key.eq.coin_redemption_config,key.eq.coin_redemption_config').maybeSingle(),
      supabase.from('platform_settings').select('*').or('setting_key.eq.global_pricing_enabled,key.eq.global_pricing_enabled').maybeSingle(),
      supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(50)
    ]);
    const failed = [configResult, enabledResult, orderResult].find((result) => result.error);
    if (failed) throw failed.error;
    const configVal = configResult.data?.setting_value !== undefined ? configResult.data.setting_value : configResult.data?.value;
    setConfig(parseCoinRedemptionConfig(configVal));
    const enabledRaw = enabledResult.data?.setting_value !== undefined ? enabledResult.data.setting_value : enabledResult.data?.value;
    setPricingEnabled(typeof enabledRaw === 'object' && enabledRaw !== null
      ? enabledRaw.enabled !== false && enabledRaw.enabled !== 'false'
      : enabledRaw !== false && enabledRaw !== 'false');
    const recentOrders = orderResult.data || [];
    setOrders(recentOrders);
    const userIds = [...new Set(recentOrders.map((order) => order.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: userRows, error: usersError } = await supabase.from('profiles').select('id,full_name,email').in('id', userIds);
      if (usersError) throw usersError;
      setProfiles(Object.fromEntries((userRows || []).map((profile) => [profile.id, profile])));
    } else setProfiles({});
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    load().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load pricing settings and orders.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase]);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    let normalized;
    try { normalized = parseCoinRedemptionConfig(config); }
    catch (validationError) { setError(validationError.message); return; }
    if (!supabase) { setError('Configure Supabase before saving pricing settings.'); return; }
    setSaving(true);
    try {
      const settings = [
        { key: 'coin_redemption_config', setting_key: 'coin_redemption_config', setting_value: normalized, value: normalized },
        { key: 'global_pricing_enabled', setting_key: 'global_pricing_enabled', setting_value: { enabled: pricingEnabled }, value: { enabled: pricingEnabled } }
      ];
      let { error: saveError } = await supabase.from('platform_settings').upsert(settings, { onConflict: 'setting_key' });
      if (saveError) {
        const fallback = await supabase.from('platform_settings').upsert(settings, { onConflict: 'key' });
        if (fallback.error) throw fallback.error;
      }
      setConfig(normalized);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save pricing settings.');
    } finally { setSaving(false); }
  };

  return <div className="pricing-manager">
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION / COMMERCE</div><h1>Pricing & orders</h1><p>Configure checkout and coin discounts, then review recent transactions.</p></div><button className="button button-outline" onClick={() => { setLoading(true); load().catch((loadError) => { setError(loadError.message || 'Unable to refresh pricing data.'); setLoading(false); }); }} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button></div>
    {error && <div className="feedback error-feedback">{error}</div>}
    <section className="panel-card pricing-settings-card">
      <div className="section-heading"><div><div className="eyebrow">CHECKOUT CONTROLS</div><h2>Global pricing settings</h2><p>These rules are also validated by the checkout service.</p></div><span className="setting-symbol"><Tag size={18} /></span></div>
      {loading ? <LoadingSkeleton rows={2} /> : <form onSubmit={save}>
        <label className="pricing-enable-toggle"><span><strong>Enable paid purchases</strong><small>Turn off to pause paid content checkout across the platform.</small></span><input type="checkbox" checked={pricingEnabled} onChange={(event) => setPricingEnabled(event.target.checked)} /><span className="toggle-track" /></label>
        <div className="pricing-rule-grid">
          <label className="field-label">Coins per rupee<div className="pricing-input-wrap"><Coins size={16} /><input className="text-input" type="number" min="1" step="1" value={config.coins_per_rupee} onChange={(event) => setConfig((current) => ({ ...current, coins_per_rupee: event.target.value }))} required /></div><small>How many Zyvra Coins equal ₹1.</small></label>
          <label className="field-label">Maximum coin discount (%)<div className="pricing-input-wrap"><input className="text-input" type="number" min="0" max="100" step="1" value={config.max_discount_percent} onChange={(event) => setConfig((current) => ({ ...current, max_discount_percent: event.target.value }))} required /><span>%</span></div><small>Cap on the base price payable with coins.</small></label>
        </div>
        <div className="settings-actions">{saved && <span className="settings-success">Pricing settings saved.</span>}<button className="button button-gold" disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save settings'}</button></div>
      </form>}
    </section>
    <section className="panel-card payment-orders-card">
      <div className="section-heading"><div><div className="eyebrow">PAYMENT ACTIVITY</div><h2>Recent transactions</h2></div><span className="chapter-item-count">{orders.length} recent orders</span></div>
      {loading ? <LoadingSkeleton rows={3} /> : !orders.length ? <div className="empty-content"><CreditCard size={22} /><strong>No transactions yet.</strong><span>Completed and pending payment orders will appear here.</span></div> : <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>User</th><th>Item</th><th>Base price</th><th>Coin discount</th><th>Final amount</th><th>Status</th><th>Razorpay payment ID</th></tr></thead><tbody>{orders.map((order) => {
        const profile = profiles[order.user_id];
        const status = String(order.status || 'pending');
        return <tr key={order.id}><td><strong>{profile?.full_name || profile?.email || order.user_id || '—'}</strong></td><td><strong>{order.item_title || order.item_name || order.item_id || 'Learning access'}</strong><small>{order.item_type || 'Purchase'}</small></td><td>{formatRupees(orderAmount(order, ['base_amount', 'base_price', 'amount_before_discount']))}</td><td>{formatRupees(orderAmount(order, ['coin_discount_amount', 'coin_discount', 'discount_amount']))}{Number(order.coins_redeemed || order.coins_used) > 0 && <small>{Number(order.coins_redeemed || order.coins_used).toLocaleString()} coins</small>}</td><td><strong>{formatRupees(orderAmount(order, ['final_amount', 'amount', 'amount_paid']))}</strong></td><td><span className={`order-status order-${status.toLowerCase()}`}>{status}</span></td><td className="payment-id">{order.razorpay_payment_id || order.payment_id || '—'}</td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}

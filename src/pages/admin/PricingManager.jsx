import { useEffect, useState } from 'react';
import { BadgePercent, Coins, CreditCard, Plus, RefreshCw, Save, Tag, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatRupees, parseCoinRedemptionConfig } from '../../lib/commerce';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import useContentCatalog from '../../hooks/useContentCatalog';

function orderAmount(order, keys) {
  for (const key of keys) {
    if (order[key] !== undefined && order[key] !== null) return Number(order[key]) || 0;
  }
  return 0;
}

export default function PricingManager() {
  const { supabase } = useAuth();
  const { folders } = useContentCatalog();
  const [config, setConfig] = useState({ coins_per_rupee: 10, max_discount_percent: 20 });
  const [pricingEnabled, setPricingEnabled] = useState(true);
  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [coupons, setCoupons] = useState([]);
  const [couponDraft, setCouponDraft] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    scope: 'global',
    target_folder_id: '',
    active: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couponSaving, setCouponSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState('');
  const [couponError, setCouponError] = useState('');

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setError('');
    const [configResult, enabledResult, orderResult, couponResult] = await Promise.all([
      supabase.from('platform_settings').select('*').or('setting_key.eq.coin_redemption_config,key.eq.coin_redemption_config').maybeSingle(),
      supabase.from('platform_settings').select('*').or('setting_key.eq.global_pricing_enabled,key.eq.global_pricing_enabled').maybeSingle(),
      supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('platform_settings').select('*').or('setting_key.eq.coupon_codes,key.eq.coupon_codes').maybeSingle()
    ]);
    const failed = [configResult, enabledResult, orderResult, couponResult].find((result) => result.error);
    if (failed) throw failed.error;
    const configVal = configResult.data?.setting_value !== undefined ? configResult.data.setting_value : configResult.data?.value;
    setConfig(parseCoinRedemptionConfig(configVal));
    const enabledRaw = enabledResult.data?.setting_value !== undefined ? enabledResult.data.setting_value : enabledResult.data?.value;
    setPricingEnabled(typeof enabledRaw === 'object' && enabledRaw !== null
      ? enabledRaw.enabled !== false && enabledRaw.enabled !== 'false'
      : enabledRaw !== false && enabledRaw !== 'false');
    const recentOrders = orderResult.data || [];
    setOrders(recentOrders);
    const couponValue = couponResult.data?.setting_value !== undefined
      ? couponResult.data.setting_value
      : couponResult.data?.value;
    const parsedCoupons = typeof couponValue === 'string' ? JSON.parse(couponValue) : couponValue;
    setCoupons(Array.isArray(parsedCoupons)
      ? parsedCoupons.filter((coupon) => coupon && typeof coupon === 'object')
        .map((coupon) => ({ ...coupon, id: coupon.id || coupon.code }))
      : []);
    const userIds = [...new Set(recentOrders.map((order) => order.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: userRows, error: usersError } = await supabase.from('profiles').select('id,full_name,email').in('id', userIds);
      if (usersError) throw usersError;
      setProfiles(Object.fromEntries((userRows || []).map((profile) => [profile.id, profile])));
    } else setProfiles({});
    setLoading(false);
  };

  const saveCoupons = async (nextCoupons) => {
    if (!supabase) throw new Error('Configure Supabase before managing coupons.');
    const row = { setting_key: 'coupon_codes', key: 'coupon_codes', setting_value: nextCoupons };
    const { error: saveError } = await supabase.from('platform_settings').upsert(row, { onConflict: 'setting_key' });
    if (saveError) throw saveError;
    setCoupons(nextCoupons);
  };

  const addCoupon = async (event) => {
    event.preventDefault();
    setCouponError('');
    setCouponFeedback('');
    const code = couponDraft.code.trim().toUpperCase();
    const discountValue = Number(couponDraft.discount_value);
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      setCouponError('Use 3–32 letters, numbers, hyphens, or underscores for the coupon code.');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0
      || (couponDraft.discount_type === 'percent' && discountValue > 100)) {
      setCouponError(couponDraft.discount_type === 'percent'
        ? 'Enter a percentage between 1 and 100.'
        : 'Enter a flat discount greater than zero.');
      return;
    }
    if (couponDraft.scope !== 'global' && !couponDraft.target_folder_id) {
      setCouponError('Choose a folder or subfolder for this coupon.');
      return;
    }
    if (coupons.some((coupon) => String(coupon?.code || '').toUpperCase() === code)) {
      setCouponError('A coupon with this code already exists.');
      return;
    }

    const nextCoupon = {
      id: `${Date.now()}-${code}`,
      code,
      discount_type: couponDraft.discount_type,
      discount_value: discountValue,
      scope: couponDraft.scope,
      target_folder_id: couponDraft.scope === 'global' ? null : couponDraft.target_folder_id,
      active: Boolean(couponDraft.active),
      created_at: new Date().toISOString()
    };
    setCouponSaving(true);
    try {
      await saveCoupons([nextCoupon, ...coupons]);
      setCouponDraft({ code: '', discount_type: 'percent', discount_value: '', scope: 'global', target_folder_id: '', active: true });
      setCouponFeedback('Coupon saved.');
    } catch (saveError) {
      setCouponError(saveError.message || 'Unable to save this coupon.');
    } finally {
      setCouponSaving(false);
    }
  };

  const updateCoupon = async (id, changes) => {
    setCouponError('');
    setCouponFeedback('');
    setCouponSaving(true);
    try {
      await saveCoupons(coupons.map((coupon) => coupon.id === id ? { ...coupon, ...changes } : coupon));
      setCouponFeedback('Coupon updated.');
    } catch (saveError) {
      setCouponError(saveError.message || 'Unable to update this coupon.');
    } finally {
      setCouponSaving(false);
    }
  };

  const removeCoupon = async (id) => {
    setCouponError('');
    setCouponFeedback('');
    setCouponSaving(true);
    try {
      await saveCoupons(coupons.filter((coupon) => coupon.id !== id));
      setCouponFeedback('Coupon removed.');
    } catch (saveError) {
      setCouponError(saveError.message || 'Unable to remove this coupon.');
    } finally {
      setCouponSaving(false);
    }
  };

  const folderOptions = folders.filter((folder) => couponDraft.scope === 'subfolder'
    ? Boolean(folder.parent_folder_id)
    : !folder.parent_folder_id);
  const folderTitle = (folderId) => folders.find((folder) => folder.id === folderId)?.title || 'Selected learning content';

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
    <section className="panel-card coupon-manager-card">
      <div className="section-heading">
        <div><div className="eyebrow">PROMOTIONS</div><h2>Coupons & discounts</h2><p>Create and manage discount codes for subscriptions or learning content.</p></div>
        <span className="setting-symbol"><BadgePercent size={18} /></span>
      </div>
      {couponError && <div className="feedback error-feedback coupon-feedback">{couponError}</div>}
      {couponFeedback && <div className="feedback success-feedback coupon-feedback">{couponFeedback}</div>}
      <form className="coupon-form" onSubmit={addCoupon}>
        <label className="field-label">Coupon code
          <input className="text-input" value={couponDraft.code} onChange={(event) => setCouponDraft((draft) => ({ ...draft, code: event.target.value.toUpperCase() }))} placeholder="DIWALI50" maxLength={32} required />
        </label>
        <label className="field-label">Discount type
          <select className="text-input" value={couponDraft.discount_type} onChange={(event) => setCouponDraft((draft) => ({ ...draft, discount_type: event.target.value }))}>
            <option value="percent">Percentage (%)</option>
            <option value="flat">Flat amount (₹)</option>
          </select>
        </label>
        <label className="field-label">Discount amount
          <input className="text-input" type="number" min="1" max={couponDraft.discount_type === 'percent' ? '100' : undefined} step="0.01" value={couponDraft.discount_value} onChange={(event) => setCouponDraft((draft) => ({ ...draft, discount_value: event.target.value }))} placeholder={couponDraft.discount_type === 'percent' ? '50' : '100'} required />
        </label>
        <label className="field-label">Scope
          <select className="text-input" value={couponDraft.scope} onChange={(event) => setCouponDraft((draft) => ({ ...draft, scope: event.target.value, target_folder_id: '' }))}>
            <option value="global">Global / Unlock All</option>
            <option value="folder">Specific Folder</option>
            <option value="subfolder">Specific Subfolder</option>
          </select>
        </label>
        {couponDraft.scope !== 'global' && <label className="field-label">Target {couponDraft.scope === 'subfolder' ? 'subfolder' : 'folder'}
          <select className="text-input" value={couponDraft.target_folder_id} onChange={(event) => setCouponDraft((draft) => ({ ...draft, target_folder_id: event.target.value }))} required>
            <option value="">Select {couponDraft.scope === 'subfolder' ? 'a subfolder' : 'a folder'}</option>
            {folderOptions.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}
          </select>
        </label>}
        <label className="coupon-active-toggle"><input type="checkbox" checked={couponDraft.active} onChange={(event) => setCouponDraft((draft) => ({ ...draft, active: event.target.checked }))} /><span>Active immediately</span></label>
        <button className="button button-gold coupon-add-button" type="submit" disabled={couponSaving}><Plus size={15} />{couponSaving ? 'Saving…' : 'Create coupon'}</button>
      </form>
      {coupons.length === 0 ? <div className="empty-content coupon-empty"><Tag size={22} /><strong>No coupons yet.</strong><span>New discount codes will appear here after you create them.</span></div> : (
        <div className="coupon-list">
          {coupons.map((coupon) => (
            <article className="coupon-row" key={coupon.id || coupon.code}>
              <div className="coupon-code"><strong>{coupon.code || 'Unnamed coupon'}</strong><span>{coupon.discount_type === 'percent' ? `${Number(coupon.discount_value) || 0}% off` : `₹${Number(coupon.discount_value) || 0} off`}</span></div>
              <div className="coupon-scope"><strong>{coupon.scope === 'global' ? 'Global / Unlock All' : coupon.scope === 'subfolder' ? 'Specific Subfolder' : 'Specific Folder'}</strong><span>{coupon.scope === 'global' ? 'All eligible purchases' : folderTitle(coupon.target_folder_id)}</span></div>
              <div className="coupon-actions">
                <button type="button" className={`status-pill ${coupon.active ? 'coupon-status-active' : ''}`} onClick={() => updateCoupon(coupon.id, { active: !coupon.active })} disabled={couponSaving} aria-label={`${coupon.active ? 'Deactivate' : 'Activate'} ${coupon.code || 'coupon'}`}>{coupon.active ? 'Active' : 'Inactive'}</button>
                <button type="button" className="icon-button" onClick={() => removeCoupon(coupon.id)} disabled={couponSaving} aria-label={`Delete ${coupon.code || 'coupon'}`}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
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

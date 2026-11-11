import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Coins, CreditCard, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { formatRupees, getRpcValue, parseCoinRedemptionConfig } from '../../lib/commerce';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (script?.dataset.loaded === 'true') {
      reject(new Error('Razorpay Checkout did not initialize. Reload the page and try again.'));
      return;
    }
    if (!script) {
      script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT;
      script.async = true;
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; }, { once: true });
      document.body.appendChild(script);
    }
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Razorpay Checkout could not be loaded. Check your connection and try again.')), { once: true });
  });
}

export default function CheckoutModal({ itemType, itemId, itemTitle, tier, basePrice, onClose, onCompleted }) {
  const { user, supabase, refreshAccount } = useAuth();
  const { t, language } = useThemeLanguage();
  const [walletBalance, setWalletBalance] = useState(0);
  const [config, setConfig] = useState({ coins_per_rupee: 10, max_discount_percent: 20 });
  const [purchasesEnabled, setPurchasesEnabled] = useState(true);
  const [redeemCoins, setRedeemCoins] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCheckoutData = async () => {
      if (!supabase || !user) throw new Error(t('signInToPurchase'));
      const [walletResult, settingResult, pricingResult] = await Promise.all([
        supabase.from('coin_wallets').select('balance').eq('user_id', user.id).maybeSingle(),
        supabase.from('platform_settings').select('value').or('key.eq.coin_redemption_config,setting_key.eq.coin_redemption_config').maybeSingle(),
        supabase.from('platform_settings').select('value').or('key.eq.global_pricing_enabled,setting_key.eq.global_pricing_enabled').maybeSingle()
      ]);
      if (walletResult.error) throw walletResult.error;
      if (settingResult.error) throw settingResult.error;
      if (pricingResult.error) throw pricingResult.error;
      const parsedConfig = parseCoinRedemptionConfig(settingResult.data?.value);
      const pricingValue = pricingResult.data?.value;
      const enabled = typeof pricingValue === 'object' && pricingValue !== null
        ? pricingValue.enabled !== false && pricingValue.enabled !== 'false'
        : pricingValue !== false && pricingValue !== 'false';
      if (!active) return;
      setWalletBalance(Math.max(0, Math.floor(Number(walletResult.data?.balance || 0))));
      setConfig(parsedConfig);
      setPurchasesEnabled(enabled);
      setLoading(false);
    };
    loadCheckoutData().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to prepare checkout.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase, user, t]);

  const pricing = useMemo(() => {
    const base = Math.max(0, Number(basePrice) || 0);
    const discountLimit = Math.round(base * config.max_discount_percent) / 100;
    const maxCoins = Math.min(walletBalance, Math.floor(discountLimit * config.coins_per_rupee));
    const coinsUsed = redeemCoins ? maxCoins : 0;
    const discount = Math.min(base, coinsUsed / config.coins_per_rupee);
    return { base, maxCoins, coinsUsed, discount, payable: Math.max(0, base - discount) };
  }, [basePrice, config, redeemCoins, walletBalance]);

  const finishCheckout = async ({ orderId, paymentId, signature }) => {
    setError('');
    const { data, error: completionError } = await supabase.rpc('complete_successful_checkout', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_payment_signature: signature
    });
    if (completionError) throw completionError;
    const result = getRpcValue(data, ['success', 'order', 'status']);
    const confirmed = result === true
      || (result && typeof result === 'object' && result.success === true)
      || (typeof result === 'string' && ['success', 'paid', 'completed'].includes(result.toLowerCase()));
    if (!confirmed) {
      const message = result && typeof result === 'object' ? result.message : null;
      throw new Error(message || 'The payment service did not confirm this purchase. Contact support if your account was charged.');
    }
    await refreshAccount();
    setComplete(true);
    onCompleted?.(data);
  };

  const checkout = async () => {
    setError('');
    if (!supabase || !user) { setError(t('signInToPurchase')); return; }
    if (!purchasesEnabled) { setError('Purchases are temporarily paused. Please check back soon.'); return; }
    if (!Number.isFinite(pricing.base) || pricing.base <= 0) { setError('This item does not have a valid price. Contact support.'); return; }
    setBusy(true);
    try {
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      const localTestMode = !keyId && import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (localTestMode) {
        setSimulated(true);
        setComplete(true);
        setBusy(false);
        return;
      }
      if (!keyId && !localTestMode) throw new Error('Razorpay is not configured. Add VITE_RAZORPAY_KEY_ID to enable secure checkout.');
      const { data: orderData, error: orderError } = await supabase.rpc('create_checkout_order', {
        p_item_type: itemType,
        p_item_id: itemId,
        p_coins_to_redeem: pricing.coinsUsed
      });
      if (orderError) throw orderError;
      const order = getRpcValue(orderData, ['order']);
      if (!order || typeof order !== 'object') throw new Error('Checkout could not create a payment order.');
      const orderId = order.id || order.payment_order_id || order.order_id;
      const razorpayOrderId = order.razorpay_order_id;
      if (!orderId) throw new Error('The payment service did not return an order reference.');

      if (!keyId) throw new Error('Razorpay is not configured. Add VITE_RAZORPAY_KEY_ID to enable secure checkout.');
      if (!razorpayOrderId) throw new Error('The payment service did not return a Razorpay order ID.');
      if (!Number.isInteger(Number(order.amount_paise)) || Number(order.amount_paise) <= 0) throw new Error('The payment service returned an invalid order amount.');
      if (Number(order.amount_paise) !== Math.round(pricing.payable * 100)) throw new Error('The server price changed. Close checkout and reopen it to review the latest total.');
      await loadRazorpay();
      const checkoutInstance = new window.Razorpay({
        key: keyId,
        order_id: razorpayOrderId,
        amount: Number(order.amount_paise),
        currency: order.currency || 'INR',
        name: 'ZYVRA',
        description: `${tier}: ${itemTitle}`,
        prefill: { email: user.email },
        theme: { color: '#e4b85f' },
        handler: async (response) => {
          setBusy(true);
          try {
            await finishCheckout({
              orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            });
          } catch (completionError) {
            setError(completionError.message || 'Payment verification failed. Contact support with your payment ID.');
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) }
      });
      checkoutInstance.on('payment.failed', (event) => {
        setError(event.error?.description || 'Payment did not complete. Try another payment method.');
        setBusy(false);
      });
      checkoutInstance.open();
    } catch (checkoutError) {
      setError(checkoutError.message || 'Unable to start checkout. Please try again.');
      setBusy(false);
    }
  };

  return <div className="modal-backdrop checkout-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button className="modal-close" type="button" aria-label={t('closeCheckout')} onClick={onClose} disabled={busy}><X size={18} /></button>
      {complete ? <div className="checkout-success"><span><BadgeCheck size={29} /></span><div className="eyebrow">{simulated ? t('localPreview') : t('accessUnlocked')}</div><h2>{simulated ? t('previewComplete') : t('readyToBegin')}</h2><p>{simulated ? t('noPaymentMade') : t('paymentVerified')}</p><button className="button button-gold" onClick={onClose}>{simulated ? t('closePreview') : t('continueLearning')}</button></div> : <>
        <div className="eyebrow">{t('secureCheckout')}</div><h2 id="checkout-title">{t('unlockLearningPath')}</h2>
        <div className="checkout-item"><div><strong>{itemTitle}</strong><span>{tier}</span></div><span className="checkout-tier">{tier}</span></div>
        {loading ? <div className="checkout-loading"><LoaderCircle className="spin" size={18} /> {t('preparingCheckout')}</div> : <>
          <div className="checkout-breakdown"><div><span>{t('basePrice')}</span><strong>{formatRupees(pricing.base)}</strong></div>
            <label className="coin-redemption-toggle"><span className="coin-redemption-copy"><Coins size={18} /><span><strong>{t('redeemCoins')}</strong><small>{t('balance')}: {walletBalance.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')} {t('coins')} · {config.coins_per_rupee} {t('coinsEqualsRupee')}</small></span></span><input type="checkbox" checked={redeemCoins} onChange={(event) => setRedeemCoins(event.target.checked)} disabled={!pricing.maxCoins} /><span className="toggle-track" /></label>
            {redeemCoins && <div className="checkout-calculation"><span>{t('coinsUsed')} <strong>{pricing.coinsUsed.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')}</strong></span><span>{t('discount')} <strong>−{formatRupees(pricing.discount)}</strong></span><small>{t('upToDiscount')} {config.max_discount_percent}% {t('discount')} · {pricing.maxCoins.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')} {t('coins')} {language === 'hi' ? 'इस खरीद के लिए उपलब्ध' : 'available for this purchase'}</small></div>}
            <div className="checkout-total"><span>{t('payableNow')}</span><strong>{formatRupees(pricing.payable)}</strong></div>
          </div>
          {error && <div className="feedback error-feedback">{error}</div>}
          {!purchasesEnabled && <div className="feedback error-feedback">{t('purchasesPaused')}</div>}
          <button type="button" className="button button-gold button-full checkout-pay" onClick={checkout} disabled={busy || !user || !purchasesEnabled}><CreditCard size={16} />{busy ? t('verifyingCheckout') : purchasesEnabled ? `${t('continuePayment')} · ${formatRupees(pricing.payable)}` : t('purchasesPausedShort')}</button>
          <div className="checkout-secure-note"><LockKeyhole size={13} /> {t('paymentVerification')}</div>
        </>}
      </>}
    </section>
  </div>;
}

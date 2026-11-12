import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Coins, CreditCard, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { formatRupees, parseCoinRedemptionConfig } from '../../lib/commerce';
import { loadRazorpayScript } from '../../utils/razorpay';

async function postPaymentRequest(endpoint, payload, accessToken) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The payment service returned an invalid response.');
  }
  if (!response.ok) throw new Error(result?.error || 'The payment request could not be completed.');
  return result;
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
        supabase.from('platform_settings').select('*').or('setting_key.eq.coin_redemption_config,key.eq.coin_redemption_config').maybeSingle(),
        supabase.from('platform_settings').select('*').or('setting_key.eq.global_pricing_enabled,key.eq.global_pricing_enabled').maybeSingle()
      ]);
      if (walletResult.error) throw walletResult.error;
      if (settingResult.error) throw settingResult.error;
      if (pricingResult.error) throw pricingResult.error;
      const settingVal = settingResult.data?.setting_value !== undefined ? settingResult.data.setting_value : settingResult.data?.value;
      const parsedConfig = parseCoinRedemptionConfig(settingVal);
      const pricingRaw = pricingResult.data?.setting_value !== undefined ? pricingResult.data.setting_value : pricingResult.data?.value;
      const enabled = typeof pricingRaw === 'object' && pricingRaw !== null
        ? pricingRaw.enabled !== false && pricingRaw.enabled !== 'false'
        : pricingRaw !== false && pricingRaw !== 'false';
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

  const finishCheckout = async ({ orderId, razorpayOrderId, paymentId, signature, accessToken }) => {
    setError('');
    const result = await postPaymentRequest('/api/verify-payment', {
      order_id: orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    }, accessToken);
    if (result?.success !== true) {
      throw new Error(result?.error || 'The payment service did not confirm this purchase.');
    }
    await refreshAccount();
    setComplete(true);
    await onCompleted?.(result);
  };

  const getAccessToken = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = data?.session?.access_token;
    if (!accessToken) throw new Error(t('signInToPurchase'));
    return accessToken;
  };

  const checkout = async () => {
    setError('');
    if (!supabase || !user) { setError(t('signInToPurchase')); return; }
    if (!purchasesEnabled) { setError('Purchases are temporarily paused. Please check back soon.'); return; }
    if (!Number.isFinite(pricing.base) || pricing.base <= 0) { setError('This item does not have a valid price. Contact support.'); return; }
    setBusy(true);
    try {
      const envKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      const accessToken = await getAccessToken();
      const order = await postPaymentRequest('/api/create-order', {
        amount: pricing.payable,
        itemType,
        itemId,
        coinsToRedeem: pricing.coinsUsed
      }, accessToken);
      if (!order || typeof order !== 'object') throw new Error('Checkout could not create a payment order.');
      const orderId = order.id || order.payment_order_id || order.order_id;
      const razorpayOrderId = order.razorpay_order_id;
      if (!orderId) throw new Error('The payment service did not return an order reference.');

      const activeKeyId = order.keyId || order.key_id || envKeyId;
      const localTestMode = !activeKeyId && import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (localTestMode) {
        setSimulated(true);
        setComplete(true);
        setBusy(false);
        return;
      }
      if (!activeKeyId) throw new Error('Razorpay is not configured. Add VITE_RAZORPAY_KEY_ID or configure RAZORPAY_KEY_ID to enable secure checkout.');
      if (!razorpayOrderId) throw new Error('The payment service did not return a Razorpay order ID.');
      const orderPaise = Number(order.amount_paise || order.amount);
      if (!Number.isInteger(orderPaise) || orderPaise <= 0) throw new Error('The payment service returned an invalid order amount.');
      if (orderPaise !== Math.round(pricing.payable * 100)) throw new Error('The server price changed. Close checkout and reopen it to review the latest total.');
      await loadRazorpayScript();
      const checkoutInstance = new window.Razorpay({
        key: activeKeyId,
        order_id: razorpayOrderId,
        amount: orderPaise,
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
              razorpayOrderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              accessToken
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
        <div className="checkout-item"><div><strong>{itemTitle}</strong><span>{itemType === 'folder' ? (language === 'hi' ? 'फ़ोल्डर और इसके सभी सब-फ़ोल्डर व अध्याय अनलॉक होंगे' : 'Unlocks this folder and all sub-folders & chapters inside it') : tier}</span></div><span className="checkout-tier">{tier}</span></div>
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

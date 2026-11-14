import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Coins, CreditCard, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { formatRupees, parseCoinRedemptionConfig } from '../../lib/commerce';
import { getFriendlyErrorMessage } from '../../lib/errors';
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
        supabase.from('platform_settings').select('*').or('setting_key.eq.coin_redemption_config,key.eq.coin_redemption_config').limit(1).maybeSingle(),
        supabase.from('platform_settings').select('*').or('setting_key.eq.global_pricing_enabled,key.eq.global_pricing_enabled').limit(1).maybeSingle()
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
        setError(getFriendlyErrorMessage(loadError, 'Unable to prepare checkout.'));
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
        description: `${tier ? `${tier}: ` : ''}${itemTitle || 'Zyvra Learning'}`,
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
            setError(getFriendlyErrorMessage(completionError, 'Payment verification is pending or failed. If money was debited, your access will activate shortly or contact support with your payment ID.'));
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
          }
        }
      });
      checkoutInstance.on('payment.failed', (event) => {
        setError(event.error?.description || 'Payment did not complete. Try another payment method.');
        setBusy(false);
      });
      checkoutInstance.open();
    } catch (checkoutError) {
      setError(getFriendlyErrorMessage(checkoutError, 'Unable to start checkout. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="w-full max-w-md p-5 sm:p-6 rounded-3xl dark:bg-[#04140e] bg-white border dark:border-emerald-500/30 border-slate-300 dark:text-white text-slate-900 shadow-xl relative space-y-4 max-h-[calc(100dvh-24px)] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <button
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 dark:hover:text-white"
          type="button"
          aria-label={t('closeCheckout')}
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </button>

        {complete ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-[#22c55e] flex items-center justify-center mx-auto">
              <BadgeCheck size={32} />
            </div>
            <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
              {simulated ? t('localPreview') : t('accessUnlocked')}
            </div>
            <h2 className="text-lg font-black dark:text-white text-slate-900">
              {simulated ? t('previewComplete') : t('readyToBegin')}
            </h2>
            <p className="text-xs dark:text-emerald-300/80 text-slate-600">
              {simulated ? t('noPaymentMade') : t('paymentVerified')}
            </p>
            <button
              type="button"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-black shadow-glowGold min-h-[44px]"
              onClick={onClose}
            >
              {simulated ? t('closePreview') : t('continueLearning')}
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                {t('secureCheckout')}
              </div>
              <h2 id="checkout-title" className="text-base sm:text-lg font-black dark:text-white text-slate-900 mt-0.5">
                {t('unlockLearningPath')}
              </h2>
            </div>

            <div className="p-3.5 rounded-2xl dark:bg-emerald-950/60 bg-slate-50 border dark:border-emerald-500/20 border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                  {itemTitle}
                </strong>
                <span className="text-[10px] text-slate-500 dark:text-emerald-300/70 block truncate">
                  {itemType === 'folder'
                    ? language === 'hi'
                      ? 'फ़ोल्डर और इसके सभी सब-फ़ोल्डर व अध्याय अनलॉक होंगे'
                      : 'Unlocks this folder and all sub-folders & chapters inside it'
                    : tier}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black dark:bg-emerald-500/20 bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 shrink-0">
                {tier}
              </span>
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs dark:text-emerald-300 text-slate-600 font-bold flex items-center justify-center gap-2">
                <LoaderCircle className="animate-spin" size={16} /> <span>{t('preparingCheckout')}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl dark:bg-emerald-950/40 bg-slate-50 border dark:border-emerald-500/20 border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-emerald-300/80">{t('basePrice')}</span>
                    <strong className="font-extrabold dark:text-white text-slate-900">{formatRupees(pricing.base)}</strong>
                  </div>

                  {/* Coin redemption option */}
                  <label className="p-2 rounded-xl dark:bg-emerald-950/80 bg-white border dark:border-emerald-500/20 border-slate-200 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <Coins size={16} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <strong className="text-xs font-bold dark:text-white text-slate-900 block">
                          {t('redeemCoins')}
                        </strong>
                        <small className="text-[10px] text-slate-400 dark:text-emerald-400/60 block truncate">
                          {t('balance')}: {walletBalance.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')} {t('coins')} ({config.coins_per_rupee} coins = ₹1)
                        </small>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={redeemCoins}
                      onChange={(event) => setRedeemCoins(event.target.checked)}
                      disabled={!pricing.maxCoins}
                      className="accent-amber-400 w-4 h-4 cursor-pointer shrink-0 ml-2"
                    />
                  </label>

                  {redeemCoins && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-[11px] space-y-1 text-amber-800 dark:text-amber-300">
                      <div className="flex items-center justify-between">
                        <span>{t('coinsUsed')}</span>
                        <strong className="font-mono">
                          {pricing.coinsUsed.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US')}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t('discount')}</span>
                        <strong className="font-mono font-bold text-[#22c55e]">
                          −{formatRupees(pricing.discount)}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t dark:border-emerald-800/30 border-slate-200 flex items-center justify-between text-sm">
                    <span className="font-black dark:text-white text-slate-900">{t('payableNow')}</span>
                    <strong className="text-base font-black text-amber-600 dark:text-amber-400">
                      {formatRupees(pricing.payable)}
                    </strong>
                  </div>
                </div>

                {error && (
                  <div className="p-2.5 rounded-xl dark:bg-rose-950/40 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold">
                    {error}
                  </div>
                )}
                {!purchasesEnabled && (
                  <div className="p-2.5 rounded-xl dark:bg-amber-950/40 bg-amber-50 border border-amber-300 text-amber-700 text-xs font-bold">
                    {t('purchasesPaused')}
                  </div>
                )}

                <button
                  type="button"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-black font-black text-xs sm:text-sm shadow-glowGold flex items-center justify-center gap-2 min-h-[44px] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                  onClick={checkout}
                  disabled={busy || !user || !purchasesEnabled}
                >
                  {busy ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  <span>
                    {busy
                      ? t('verifyingCheckout')
                      : purchasesEnabled
                      ? `${t('continuePayment')} · ${formatRupees(pricing.payable)}`
                      : t('purchasesPausedShort')}
                  </span>
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-emerald-400/60 font-medium">
                  <LockKeyhole size={12} />
                  <span>{t('paymentVerification')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

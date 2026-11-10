export function parseCoinRedemptionConfig(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const config = parsed && typeof parsed === 'object' ? parsed : {};
  const coinsPerRupee = Number(config.coins_per_rupee ?? 10);
  const maxDiscountPercent = Number(config.max_discount_percent ?? 20);
  if (!Number.isFinite(coinsPerRupee) || coinsPerRupee <= 0 || !Number.isFinite(maxDiscountPercent) || maxDiscountPercent < 0 || maxDiscountPercent > 100) {
    throw new Error('Coin redemption settings are invalid. Ask an administrator to review them.');
  }
  return { coins_per_rupee: coinsPerRupee, max_discount_percent: maxDiscountPercent };
}

export function normalizeAccessResult(result) {
  let value = result;
  if (Array.isArray(value)) value = value[0];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['granted', 'active', 'owned', 'allowed'].includes(value.toLowerCase());
  if (value && typeof value === 'object') {
    for (const key of ['has_access', 'access_granted', 'allowed', 'is_granted']) {
      if (typeof value[key] === 'boolean') return value[key];
    }
    if (typeof value.status === 'string') return ['granted', 'active', 'owned', 'allowed'].includes(value.status.toLowerCase());
  }
  throw new Error('The access service returned an unexpected response.');
}

export function formatRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getRpcValue(data, keys) {
  let value = Array.isArray(data) ? data[0] : data;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return value; }
  }
  if (!value || typeof value !== 'object') return value;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  return value;
}

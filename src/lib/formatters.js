/**
 * Consistent spacing & pluralization helpers for UI counts and labels.
 */

export function formatCount(count, singular, plural = `${singular}s`) {
  const num = Number(count) || 0;
  const label = num === 1 ? singular : plural;
  return `${num.toLocaleString('en-IN')} ${label}`;
}

export function formatCoins(count) {
  return formatCount(count, 'coin', 'coins');
}

export function formatMinutes(minutes) {
  return formatCount(minutes, 'min', 'mins');
}

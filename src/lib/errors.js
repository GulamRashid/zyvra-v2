const friendlyErrorRules = [
  [/permission denied|profiles|row-level security|schema cache/i, 'Profile data abhi load nahi ho paya.'],
  [/network|fetch|timeout|offline/i, 'Connection check karke phir try karein.']
];

export function getFriendlyErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const message = typeof error?.message === 'string' ? error.message : String(error || '');
  const matchingRule = friendlyErrorRules.find(([pattern]) => pattern.test(message));
  return matchingRule?.[1] || fallback;
}

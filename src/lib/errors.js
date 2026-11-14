const sensitiveTechnicalPattern = /permission denied|row-level security|schema cache|syntax error|column .* does not exist|relation .* does not exist|violates .* constraint|duplicate key|PL\/pgSQL|at handler|node:internal|Bearer |service_role/i;

const friendlyErrorRules = [
  [/permission denied|profiles|row-level security|schema cache/i, 'Profile data abhi load nahi ho paya.'],
  [/network|fetch|timeout|offline|ECONNREFUSED/i, 'Connection check karke phir try karein.']
];

export function getFriendlyErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const message = typeof error?.message === 'string' ? error.message.trim() : String(error || '').trim();
  if (!message) return fallback;

  const matchingRule = friendlyErrorRules.find(([pattern]) => pattern.test(message));
  if (matchingRule) return matchingRule[1];

  if (sensitiveTechnicalPattern.test(message)) {
    return fallback;
  }

  return message;
}

/**
 * Consistent spacing & pluralization helpers for UI counts and labels.
 */

export function formatCount(count, singular, plural = `${singular}s`) {
  const num = Number(count) || 0;
  const label = num === 1 ? singular : plural;
  return `${num.toLocaleString('en-IN')} ${label}`;
}

export function formatLocalizedCount(count, enSingular, enPlural, hiLabel, language = 'en') {
  const num = Number(count) || 0;
  if (language === 'hi') {
    return `${num.toLocaleString('en-IN')} ${hiLabel}`;
  }
  return formatCount(num, enSingular, enPlural);
}

export function formatCoins(count, language = 'en') {
  return formatLocalizedCount(count, 'coin', 'coins', 'कॉइन्स', language);
}

export function formatMinutes(minutes, language = 'en') {
  return formatLocalizedCount(minutes, 'min', 'mins', 'मिनट', language);
}

export function formatDays(days, language = 'en') {
  return formatLocalizedCount(days, 'day', 'days', 'दिन', language);
}

export function formatQuestions(count, language = 'en') {
  return formatLocalizedCount(count, 'question', 'questions', 'प्रश्न', language);
}

export function formatTests(count, language = 'en') {
  return formatLocalizedCount(count, 'test', 'tests', 'टेस्ट', language);
}

export function formatTransactions(count, language = 'en') {
  return formatLocalizedCount(count, 'transaction', 'transactions', 'लेन-देन', language);
}

const OUTLOOK_EMAIL_DOMAIN = 'outlook.com';

export function isOutlookEmail(email?: string | null) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  const parts = normalized.split('@');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  return parts[1] === OUTLOOK_EMAIL_DOMAIN;
}

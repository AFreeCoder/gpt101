const WARNING_EMAIL_DOMAINS = new Set(['outlook.com', 'hotmail.com']);

export function isOutlookEmail(email?: string | null) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  const parts = normalized.split('@');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  return WARNING_EMAIL_DOMAINS.has(parts[1]);
}

const REDEEM_CONFIRMATION_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_TIMEZONE_OFFSET_HOURS = 8;

export function normalizeRedeemEmail(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function parseRedeemTime(
  value: unknown,
  timezoneOffsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS
): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric > 1e12 ? numeric : numeric * 1000;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  );
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - timezoneOffsetHours,
      Number(minute),
      Number(second)
    );
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickFirstPresentField(row: any, fields: string[]): unknown {
  if (!row || typeof row !== 'object') {
    return undefined;
  }

  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return undefined;
}

export function findCardRecord(
  payload: any,
  channelCardkey: string
): any | null {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.cards)
      ? payload.data.cards
      : Array.isArray(payload?.cards)
        ? payload.cards
        : Array.isArray(payload?.results)
          ? payload.results
          : [];

  const target = String(channelCardkey || '')
    .trim()
    .toLowerCase();

  return (
    rows.find((row: any) => {
      const code = pickFirstPresentField(row, [
        'cardCode',
        'card_code',
        'card_key',
        'cdk',
        'activation_code',
        'code',
        'key',
      ]);
      return (
        String(code || '')
          .trim()
          .toLowerCase() === target
      );
    }) || null
  );
}

export function isConfirmedCurrentRedemption(args: {
  isRedeemed: boolean;
  redeemEmail: unknown;
  redeemTime: unknown;
  chatgptEmail: string;
  attemptStartedAt: Date;
  checkedAt: Date;
  timezoneOffsetHours?: number;
}): boolean {
  if (!args.isRedeemed) {
    return false;
  }

  if (
    normalizeRedeemEmail(args.redeemEmail) !==
    normalizeRedeemEmail(args.chatgptEmail)
  ) {
    return false;
  }

  const redeemTime = parseRedeemTime(args.redeemTime, args.timezoneOffsetHours);
  if (!redeemTime) {
    return false;
  }

  const start = args.attemptStartedAt.getTime() - REDEEM_CONFIRMATION_WINDOW_MS;
  const end = args.checkedAt.getTime() + REDEEM_CONFIRMATION_WINDOW_MS;
  return redeemTime >= start && redeemTime <= end;
}

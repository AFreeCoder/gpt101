import { sql } from 'drizzle-orm';

import { BEIJING_TIME_ZONE } from '@/shared/lib/time';

export function formatDateForTimestampWithoutTimeZone(
  value: Date,
  timeZone = BEIJING_TIME_ZONE
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}:${byType.second}`;
}

export function dbTimestampFromDate(value: Date) {
  return sql`${formatDateForTimestampWithoutTimeZone(value)}`;
}

export function dbTimestampNow() {
  return dbTimestampFromDate(new Date());
}

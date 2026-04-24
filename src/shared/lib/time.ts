export function getIsoTimestr(): string {
  return new Date().toISOString();
}

export const BEIJING_TIME_ZONE = 'Asia/Shanghai';

export function formatBeijingDateTime(
  value: string | Date | number | null | undefined,
  placeholder = '-'
): string {
  if (!value) return placeholder;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return placeholder;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}:${byType.second}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatUtcParts(date: Date): string {
  return (
    [
      date.getUTCFullYear(),
      padDatePart(date.getUTCMonth() + 1),
      padDatePart(date.getUTCDate()),
    ].join('-') +
    ` ${padDatePart(date.getUTCHours())}:${padDatePart(date.getUTCMinutes())}:${padDatePart(date.getUTCSeconds())}`
  );
}

export function formatTimestampWithoutTimeZone(
  value: string | Date | number | null | undefined,
  placeholder = '-'
): string {
  if (!value) return placeholder;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return placeholder;
    return formatUtcParts(value);
  }

  const text = String(value).trim();
  const timestampMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/
  );
  if (timestampMatch) {
    const [, year, month, day, hour, minute, second] = timestampMatch;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return placeholder;

  return formatUtcParts(date);
}

export const getTimestamp = () => {
  let time = Date.parse(new Date().toUTCString());

  return time / 1000;
};

export const getMillisecond = () => {
  let time = new Date().getTime();

  return time;
};

export const getOneYearLaterTimestr = () => {
  const currentDate = new Date();
  const oneYearLater = new Date(currentDate);
  oneYearLater.setFullYear(currentDate.getFullYear() + 1);

  return oneYearLater.toISOString();
};

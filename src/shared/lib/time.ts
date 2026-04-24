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

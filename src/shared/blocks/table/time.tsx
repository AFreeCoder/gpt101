import moment from 'moment';
import { useLocale } from 'next-intl';

export function Time({
  value,
  placeholder,
  metadata,
  className,
}: {
  value: string | Date;
  placeholder?: string;
  metadata?: Record<string, any>;
  className?: string;
}) {
  const currentLocale = useLocale();

  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  const locale = currentLocale === 'zh' ? 'zh-cn' : currentLocale;

  return (
    <div className={className}>
      {metadata?.format
        ? moment(value).locale(locale).format(metadata?.format)
        : moment(value).locale(locale).fromNow()}
    </div>
  );
}

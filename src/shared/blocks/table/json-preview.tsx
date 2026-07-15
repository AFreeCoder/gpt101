function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return null;
  }
}

export function JsonPreview({
  value,
  placeholder,
  metadata,
  className,
}: {
  value: string;
  placeholder?: string;
  metadata?: Record<string, any>;
  className?: string;
}) {
  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  if (typeof value !== 'string') {
    return <div className={className}>{value}</div>;
  }

  const formattedJson = formatJson(value);

  if (formattedJson !== null) {
    return <pre className={className}>{formattedJson}</pre>;
  }

  return <div className={className}>{value}</div>;
}

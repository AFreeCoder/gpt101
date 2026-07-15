export function normalizeRemoteImageUrl(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (!url.hostname || url.username || url.password) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

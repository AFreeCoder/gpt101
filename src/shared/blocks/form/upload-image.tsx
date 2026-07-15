'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { ControllerRenderProps } from 'react-hook-form';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { normalizeRemoteImageUrl } from '@/shared/lib/image-url';
import { FormField } from '@/shared/types/blocks/form';

import { ImageUploader, ImageUploaderValue } from '../common';

interface UploadImageProps {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: any;
  metadata?: Record<string, any>;
  uploadUrl?: string;
  onUpload?: (files: File[]) => Promise<string[]>;
}

interface UrlInputConfig {
  label: string;
  placeholder: string;
  applyLabel: string;
  hint: string;
  invalidMessage: string;
}

export function UploadImage({
  field,
  formField,
  data,
  metadata,
  uploadUrl = '/api/storage/upload-image',
  onUpload,
}: UploadImageProps) {
  const maxImages = metadata?.max || 1;
  const maxSizeMB = metadata?.maxSizeMB || 10;
  const allowMultiple = maxImages > 1;
  const urlInput = metadata?.urlInput as UrlInputConfig | undefined;
  const urlInputId = useId();
  const urlHintId = `${urlInputId}-hint`;
  const urlErrorId = `${urlInputId}-error`;

  const previews = useMemo(() => {
    const value = formField.value;
    if (!value) return [];

    let urls: string[] = [];

    if (typeof value === 'string') {
      urls = value.includes(',') ? value.split(',').filter(Boolean) : [value];
    } else if (Array.isArray(value)) {
      urls = value;
    }

    return urls;
  }, [formField.value]);

  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const [urlError, setUrlError] = useState('');
  const [uploaderRevision, setUploaderRevision] = useState(0);
  const displayedUrl = urlDraft ?? previews[0] ?? '';

  const handleChange = useCallback(
    (items: ImageUploaderValue[]) => {
      const uploadedUrls = items
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);

      if (uploadedUrls.length > 0) {
        formField.onChange(allowMultiple ? uploadedUrls : uploadedUrls[0]);
      } else {
        formField.onChange(allowMultiple ? [] : '');
      }

      setUrlDraft(null);
      setUrlError('');
    },
    [formField, allowMultiple]
  );

  const handleApplyUrl = useCallback(() => {
    if (!urlInput) return;

    const normalizedUrl = normalizeRemoteImageUrl(displayedUrl);
    if (!normalizedUrl) {
      setUrlError(urlInput.invalidMessage);
      return;
    }

    setUrlDraft(null);
    setUrlError('');
    formField.onChange(normalizedUrl);
    setUploaderRevision((revision) => revision + 1);
  }, [displayedUrl, formField, urlInput]);

  return (
    <div className="space-y-3">
      <ImageUploader
        key={uploaderRevision}
        allowMultiple={allowMultiple}
        maxImages={maxImages}
        maxSizeMB={maxSizeMB}
        emptyHint={field.placeholder}
        defaultPreviews={previews}
        onChange={handleChange}
      />

      {urlInput && !allowMultiple && (
        <div className="border-border bg-muted/30 max-w-2xl rounded-lg border p-3">
          <Label htmlFor={urlInputId}>{urlInput.label}</Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id={urlInputId}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={displayedUrl}
              placeholder={urlInput.placeholder}
              aria-invalid={Boolean(urlError)}
              aria-describedby={
                urlError ? `${urlHintId} ${urlErrorId}` : urlHintId
              }
              onChange={(event) => {
                setUrlDraft(event.target.value);
                if (urlError) setUrlError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleApplyUrl();
                }
              }}
              className="bg-background"
            />
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer sm:shrink-0"
              disabled={!displayedUrl.trim()}
              onClick={handleApplyUrl}
            >
              {urlInput.applyLabel}
            </Button>
          </div>
          <p id={urlHintId} className="text-muted-foreground mt-2 text-xs">
            {urlInput.hint}
          </p>
          {urlError && (
            <p
              id={urlErrorId}
              role="alert"
              className="text-destructive mt-1 text-xs"
            >
              {urlError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

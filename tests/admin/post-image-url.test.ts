import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { normalizeRemoteImageUrl } from '../../src/shared/lib/image-url';

const repoRoot = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('remote image URLs accept http(s) links and reject unsafe schemes', () => {
  assert.equal(
    normalizeRemoteImageUrl(
      ' https://cdn.example.com/post/cover.webp?size=large '
    ),
    'https://cdn.example.com/post/cover.webp?size=large'
  );
  assert.equal(
    normalizeRemoteImageUrl('http://images.example.com/cover'),
    'http://images.example.com/cover'
  );

  for (const value of [
    '',
    '/local/image.png',
    '//cdn.example.com/image.png',
    'data:image/png;base64,abc',
    'javascript:alert(1)',
    'ftp://example.com/image.png',
    'https://user:password@example.com/image.png',
    'not a url',
  ]) {
    assert.equal(normalizeRemoteImageUrl(value), null);
  }
});

test('post add and edit forms enable localized image URL entry', () => {
  const pagePaths = [
    'src/app/[locale]/(admin)/admin/posts/add/page.tsx',
    'src/app/[locale]/(admin)/admin/posts/[id]/edit/page.tsx',
  ];

  for (const pagePath of pagePaths) {
    const source = readSource(pagePath);

    assert.match(source, /name: 'image',[\s\S]*urlInput:/);
    assert.match(source, /name: 'authorImage',[\s\S]*urlInput:/);
    assert.match(source, /fields\.image_url\.label/);
    assert.match(source, /fields\.image_url\.invalid/);
  }

  const uploaderSource = readSource('src/shared/blocks/form/upload-image.tsx');
  assert.match(uploaderSource, /type="url"/);
  assert.match(uploaderSource, /<Label htmlFor=\{urlInputId\}>/);
  assert.match(uploaderSource, /aria-invalid=\{Boolean\(urlError\)\}/);
  assert.match(uploaderSource, /event\.key === 'Enter'/);
  assert.match(uploaderSource, /key=\{uploaderRevision\}/);
  assert.match(uploaderSource, /setUploaderRevision/);
});

test('upload API explains missing storage configuration', () => {
  const source = readSource('src/app/api/storage/upload-image/route.ts');

  assert.match(source, /getProviderNames\(\)\.length === 0/);
  assert.match(source, /Image storage is not configured/);
  assert.match(source, /Admin Settings > Storage/);
  assert.match(source, /use an image URL/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function readSource(filePath: string) {
  return readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test('content config model only saves whitelisted keys and revalidates public paths', () => {
  const source = readSource('src/shared/models/content-config.ts');
  const libSource = readSource('src/shared/lib/content-config.ts');

  assert.match(libSource, /ALLOWED_CONTENT_CONFIG_KEYS/);
  assert.match(libSource, /homepage_faq_config/);
  assert.match(libSource, /homepage_faq_config:zh/);
  assert.match(libSource, /homepage_faq_config:en/);
  assert.match(libSource, /mirror_faq_config/);
  assert.match(libSource, /upgrade_notice_config/);
  assert.match(
    source,
    /const basePaths = \['\/', '\/chatgpt-mirror', '\/upgrade'\]/
  );
  assert.match(source, /locales\.flatMap/);
  assert.match(source, /\$\{locale\}\/chatgpt-mirror/);
  assert.match(source, /'\/chatgpt-mirror'/);
  assert.match(source, /'\/upgrade'/);
  assert.match(source, /\[content-config\] failed to read content config/);
  assert.match(source, /return values/);
  assert.match(source, /getContentConfigValuesStrict/);
  assert.doesNotMatch(source, /saveConfigs\(configs\)/);
});

test('admin content page is separate from settings and uses content permissions', () => {
  const source = readSource('src/app/[locale]/(admin)/admin/content/page.tsx');
  const zhSidebar = readSource(
    'src/config/locale/messages/zh/admin/sidebar.json'
  );
  const enSidebar = readSource(
    'src/config/locale/messages/en/admin/sidebar.json'
  );

  assert.match(source, /ContentConfigEditor/);
  assert.match(source, /getContentConfigValuesStrict/);
  assert.match(source, /resolveFaqContentConfigForAdmin/);
  assert.match(source, /getLocalizedContentConfigKey/);
  assert.match(source, /内容配置读取失败，暂不允许保存/);
  assert.match(source, /status: 'error'/);
  assert.match(source, /PERMISSIONS\.POSTS_READ/);
  assert.match(source, /PERMISSIONS\.POSTS_WRITE/);
  assert.doesNotMatch(source, /SETTINGS_WRITE/);
  assert.match(zhSidebar, /站点内容/);
  assert.match(enSidebar, /Site Content/);
});

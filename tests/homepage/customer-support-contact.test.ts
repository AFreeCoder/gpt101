import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  CUSTOMER_SUPPORT_LABEL,
  CUSTOMER_SUPPORT_QR_CODE_URL,
  CUSTOMER_SUPPORT_URL,
  replaceLegacyCustomerSupportText,
} from '../../src/shared/lib/customer-support';

const LEGACY_WECHAT_ID = 'AFreeCoder01';
const LEGACY_QR_CODE_URL =
  'https://tjjsjwhj-blog.oss-cn-beijing.aliyuncs.com/2026/03/05/17726209788829.jpg';
const PREVIOUS_QR_CODE_URL =
  'https://tjjsjwhj-blog.oss-cn-beijing.aliyuncs.com/article-publish-assistant/af54dc7e725beb4d7557d4d18a6141d881dac1d06aaed98d4d2825828ae89588.jpg';
const LEGACY_CUSTOMER_SUPPORT_URL =
  'https://work.weixin.qq.com/ca/cawcde156287e5f967';

function readCustomerFacingFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return readCustomerFacingFiles(filePath);
    }

    if (!/\.(?:json|mdx|ts|tsx)$/.test(entry.name)) {
      return [];
    }

    if (filePath.endsWith('src/shared/lib/customer-support.ts')) {
      return [];
    }

    return [readFileSync(filePath, 'utf8')];
  });
}

test('客服地址和二维码使用统一的新配置', () => {
  assert.equal(CUSTOMER_SUPPORT_URL, '#customer-support-dialog');
  assert.equal(CUSTOMER_SUPPORT_LABEL, '联系客服');
  assert.equal(
    CUSTOMER_SUPPORT_QR_CODE_URL,
    'https://tjjsjwhj-blog.oss-cn-beijing.aliyuncs.com/article-publish-assistant/82bb926252c354bd79b1b40843ef39e275b252ed95c1cba27b1217fa31f76189.png'
  );
});

test('后台历史 FAQ 中的客服微信号会被替换为客服文案', () => {
  assert.equal(
    replaceLegacyCustomerSupportText(
      '如有问题，请联系客服微信：AFreeCoder01，我们会协助处理。'
    ),
    '如有问题，请联系客服，我们会协助处理。'
  );
  assert.equal(
    replaceLegacyCustomerSupportText(
      'Contact support WeChat: AFreeCoder01 if you need help.'
    ),
    'Contact support if you need help.'
  );
});

test('面向用户的源码和内容不再包含旧微信号或旧二维码', () => {
  const customerFacingSource = [
    ...readCustomerFacingFiles(path.join(process.cwd(), 'src')),
    ...readCustomerFacingFiles(path.join(process.cwd(), 'content')),
  ].join('\n');

  assert.doesNotMatch(customerFacingSource, new RegExp(LEGACY_WECHAT_ID));
  assert.doesNotMatch(customerFacingSource, new RegExp(LEGACY_QR_CODE_URL));
  assert.doesNotMatch(customerFacingSource, new RegExp(PREVIOUS_QR_CODE_URL));
  assert.doesNotMatch(
    customerFacingSource,
    new RegExp(LEGACY_CUSTOMER_SUPPORT_URL)
  );
  assert.match(customerFacingSource, new RegExp(CUSTOMER_SUPPORT_URL));
  assert.match(customerFacingSource, new RegExp(CUSTOMER_SUPPORT_QR_CODE_URL));
});

test('全站客服链接由统一二维码弹窗接管', () => {
  const dialogSource = readFileSync(
    path.join(
      process.cwd(),
      'src/shared/components/customer-support-dialog.tsx'
    ),
    'utf8'
  );
  const layoutSource = readFileSync(
    path.join(process.cwd(), 'src/app/layout.tsx'),
    'utf8'
  );
  const floatingSource = readFileSync(
    path.join(
      process.cwd(),
      'src/themes/default/blocks/floating-customer-service.tsx'
    ),
    'utf8'
  );

  assert.match(dialogSource, /document\.addEventListener\('click'/);
  assert.match(dialogSource, /document\.addEventListener\('auxclick'/);
  assert.match(dialogSource, /isCustomerSupportLink/);
  assert.match(dialogSource, /event\.preventDefault\(\)/);
  assert.match(dialogSource, /CUSTOMER_SUPPORT_QR_CODE_URL/);
  assert.match(dialogSource, /max-w-\[17\.5rem\]/);
  assert.match(dialogSource, /h-11 w-11/);
  assert.doesNotMatch(dialogSource, /data-customer-support-bypass/);
  assert.doesNotMatch(dialogSource, /打开企业微信|Open WeCom/);
  assert.doesNotMatch(dialogSource, /href=\{CUSTOMER_SUPPORT_URL\}/);
  assert.match(floatingSource, /w-\[min\(15rem,calc\(100vw-1\.5rem\)\)\]/);
  assert.match(floatingSource, /motion-reduce:animate-none/);
  assert.match(floatingSource, /h-11 w-11/);
  assert.match(floatingSource, /在线客服/);
  assert.match(floatingSource, /有任何问题请联系客服/);
  assert.match(floatingSource, /微信扫码联系客服/);
  assert.doesNotMatch(floatingSource, /data-customer-support-bypass/);
  assert.doesNotMatch(floatingSource, /href=/);
  assert.match(layoutSource, /<CustomerSupportDialog locale=\{locale\} \/>/);
});

test('顶部导航在首页明确滚动到专业客服支持区域', () => {
  const headerSource = readFileSync(
    path.join(process.cwd(), 'src/themes/default/blocks/header.tsx'),
    'utf8'
  );
  const customerSupportSource = readFileSync(
    path.join(process.cwd(), 'src/themes/default/blocks/customer-support.tsx'),
    'utf8'
  );

  assert.match(headerSource, /CUSTOMER_SUPPORT_SECTION_HASH/);
  assert.match(headerSource, /scrollIntoView/);
  assert.match(headerSource, /handleNavItemClick/);
  assert.match(headerSource, /prefers-reduced-motion/);
  assert.match(customerSupportSource, /section\.id \|\| 'customer-support'/);
  assert.match(customerSupportSource, /md:scroll-mt-28/);
});

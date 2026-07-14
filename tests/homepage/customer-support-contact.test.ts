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
  assert.equal(
    CUSTOMER_SUPPORT_URL,
    'https://work.weixin.qq.com/ca/cawcde156287e5f967'
  );
  assert.equal(CUSTOMER_SUPPORT_LABEL, '联系客服');
  assert.equal(
    CUSTOMER_SUPPORT_QR_CODE_URL,
    'https://tjjsjwhj-blog.oss-cn-beijing.aliyuncs.com/article-publish-assistant/af54dc7e725beb4d7557d4d18a6141d881dac1d06aaed98d4d2825828ae89588.jpg'
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
  assert.match(customerFacingSource, new RegExp(CUSTOMER_SUPPORT_URL));
  assert.match(customerFacingSource, new RegExp(CUSTOMER_SUPPORT_QR_CODE_URL));
});

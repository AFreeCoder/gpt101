import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateRedeemCode,
  normalizeRedeemCode,
  normalizeRedeemCodePrefix,
  validateRedeemCodeFormat,
  validateRedeemCodePrefix,
} from '../../src/shared/lib/redeem-code';

test('本站卡密默认仍生成 GPT101 前缀', () => {
  const code = generateRedeemCode();

  assert.match(code, /^GPT101-[A-Z0-9]{32}$/);
  assert.equal(validateRedeemCodeFormat(code), true);
});

test('本站卡密支持生成并校验自定义渠道前缀', () => {
  const code = generateRedeemCode('media88');

  assert.match(code, /^MEDIA88-[A-Z0-9]{32}$/);
  assert.equal(validateRedeemCodeFormat(code), true);
  assert.equal(
    validateRedeemCodeFormat('MEDIA88-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'),
    true
  );
});

test('卡密格式校验保持严格的前缀和 32 位主体结构', () => {
  assert.equal(
    normalizeRedeemCode(' media88-abcdefghijklmnopqrstuvwxyz012345 '),
    'MEDIA88-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'
  );

  for (const invalidCode of [
    'MEDIA88ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    'MEDIA88--ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    'M-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    `${'A'.repeat(21)}-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345`,
    'MEDIA_88-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    '媒体88-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    'MEDIA88-ABCDEFGHIJKLMNOPQRSTUVWXYZ01234',
    'MEDIA88-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456',
    'MEDIA88-ABCDEFGHIJKLMNOPQRSTUVWXYZ01234_',
  ]) {
    assert.equal(
      validateRedeemCodeFormat(invalidCode),
      false,
      `${invalidCode} should be rejected`
    );
  }
});

test('卡密前缀只允许 2 到 20 位字母数字', () => {
  assert.equal(normalizeRedeemCodePrefix(' kol9 '), 'KOL9');
  assert.equal(validateRedeemCodePrefix('KOL9'), true);
  assert.equal(validateRedeemCodePrefix(''), false);
  assert.equal(validateRedeemCodePrefix('   '), false);
  assert.equal(validateRedeemCodePrefix('A'), false);
  assert.equal(validateRedeemCodePrefix('GPT101-PLUS'), false);
  assert.equal(validateRedeemCodePrefix('GPT101_PLUS'), false);
  assert.equal(validateRedeemCodePrefix('A'.repeat(21)), false);
  assert.throws(() => generateRedeemCode('GPT101-PLUS'), /卡密前缀/);
});

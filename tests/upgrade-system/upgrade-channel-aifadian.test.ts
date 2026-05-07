import assert from 'node:assert/strict';
import test from 'node:test';

import { createAifadianAdapter } from '../../src/extensions/upgrade-channel/adapters/aifadian';
import { getAdapter } from '../../src/extensions/upgrade-channel/registry';

function buildSessionJson(planType = 'free') {
  return JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType },
    accessToken: 'header.payload.signature',
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('aifadian 充值成功时直接返回成功', async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const adapter = createAifadianAdapter({
    fetchImpl: (async (input, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const url = String(input);
      calls.push({ url, body });

      if (url.endsWith('/verify/cdk')) {
        return jsonResponse({ status: 'valid' });
      }

      if (url.endsWith('/recharge')) {
        return jsonResponse({ success: true, message: '充值成功' });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_aifadian_success',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'AIFADIAN-GOOD-CARD',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.message, '充值成功');
  }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { cdk: 'AIFADIAN-GOOD-CARD' });
  assert.equal(calls[1].body.cdk, 'AIFADIAN-GOOD-CARD');
  assert.equal(calls[1].body.session_data.user.email, 'user@example.com');
});

test('aifadian 充值异常后二次验卡仍有效时释放渠道卡密并允许后续渠道', async () => {
  const verifyStatuses = ['valid', 'valid'];
  const adapter = createAifadianAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);

      if (url.endsWith('/verify/cdk')) {
        const status = verifyStatuses.shift();
        assert.ok(status, 'verify 响应已耗尽');
        return jsonResponse({ status });
      }

      if (url.endsWith('/recharge')) {
        return jsonResponse({
          success: false,
          message: '上游返回了无法识别的异常',
        });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_aifadian_release',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'AIFADIAN-RELEASE-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'release');
    assert.equal(result.stopFallback, undefined);
    assert.equal(result.preserveRedeemCode, undefined);
    assert.match(result.message, /二次验卡仍有效/);
  }
  assert.equal(verifyStatuses.length, 0);
});

test('aifadian 充值异常后二次验卡不可用时占用渠道卡密并转人工处理', async () => {
  const verifyStatuses = ['valid', 'used'];
  const adapter = createAifadianAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);

      if (url.endsWith('/verify/cdk')) {
        const status = verifyStatuses.shift();
        assert.ok(status, 'verify 响应已耗尽');
        return jsonResponse({ status });
      }

      if (url.endsWith('/recharge')) {
        return jsonResponse({
          success: false,
          message: '上游返回了无法识别的异常',
        });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_aifadian_consume',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'AIFADIAN-CONSUME-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'consume');
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.match(result.message, /二次验卡状态为 used/);
  }
  assert.equal(verifyStatuses.length, 0);
});

test('aifadian 首次验卡无效时禁用渠道卡密', async () => {
  const adapter = createAifadianAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);

      if (url.endsWith('/verify/cdk')) {
        return jsonResponse({ status: 'invalid' });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_aifadian_invalid',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'AIFADIAN-BAD-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'disable');
    assert.equal(result.stopFallback, undefined);
    assert.match(result.message, /verify\/cdk 失败/);
  }
});

test('aifadian 注册 cdk.aifadian.org 官方渠道 driver', () => {
  assert.ok(getAdapter('cdk.aifadian.org'));
  assert.ok(getAdapter('cdk-aifadian'));
});

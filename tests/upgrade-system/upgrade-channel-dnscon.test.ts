import assert from 'node:assert/strict';
import test from 'node:test';

import { createDnsconAdapter } from '../../src/extensions/upgrade-channel/adapters/dnscon';
import { getAdapter } from '../../src/extensions/upgrade-channel/registry';

function buildSessionJson(overrides: Record<string, any> = {}) {
  return JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: {
      id: 'account_123',
      planType: 'free',
      structure: 'personal',
    },
    accessToken: 'header.payload.signature',
    ...overrides,
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

test('dnscon 充值成功时会先验卡再提交完整 Session JSON', async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const adapter = createDnsconAdapter({
    fetchImpl: (async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || '{}'));
      calls.push({ url, body });

      if (url.endsWith('/redeem/verify')) {
        return jsonResponse({
          code: 200,
          msg: '操作成功',
          data: { exists: true, valid: true },
        });
      }

      if (url.endsWith('/redeem/submit')) {
        return jsonResponse({ success: true, msg: '充值成功' });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const sessionToken = buildSessionJson();
  const result = await adapter.execute({
    taskId: 'task_dnscon_success',
    productCode: 'plus',
    memberType: 'month',
    sessionToken,
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-GOOD-CARD',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.message, '充值成功');
  }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { cardCode: 'DNSCON-GOOD-CARD' });
  assert.deepEqual(calls[1].body, {
    cardCode: 'DNSCON-GOOD-CARD',
    tokenContent: sessionToken,
  });
});

test('dnscon 首次验卡无效时禁用渠道卡密', async () => {
  const adapter = createDnsconAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);
      assert.ok(url.endsWith('/redeem/verify'));
      return jsonResponse({
        code: 200,
        msg: '操作成功',
        data: { exists: false, message: '卡密不存在或已禁用' },
      });
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_dnscon_invalid_verify',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-BAD-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.retryable, false);
    assert.equal(result.cardkeyAction, 'disable');
    assert.equal(result.stopFallback, undefined);
    assert.match(result.message, /redeem\/verify 失败：卡密不存在或已禁用/);
  }
});

test('dnscon submit 明确返回卡密不可用时禁用渠道卡密', async () => {
  const responses = [
    jsonResponse({
      code: 200,
      data: { exists: true, valid: true },
    }),
    jsonResponse({
      code: 404,
      msg: '卡密信息不存在或未启用',
      data: [],
    }),
  ];

  const adapter = createDnsconAdapter({
    fetchImpl: (async () => {
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_dnscon_submit_bad_card',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-SUBMIT-BAD-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'disable');
    assert.equal(result.stopFallback, undefined);
    assert.match(result.message, /redeem\/submit 失败：卡密信息不存在或未启用/);
  }
  assert.equal(responses.length, 0);
});

test('dnscon submit 异常后二次验卡仍有效时释放渠道卡密并允许后续渠道', async () => {
  const verifyResponses = [
    { code: 200, data: { exists: true, valid: true } },
    { code: 200, data: { exists: true, valid: true } },
  ];

  const adapter = createDnsconAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);

      if (url.endsWith('/redeem/verify')) {
        const body = verifyResponses.shift();
        assert.ok(body, 'verify 响应已耗尽');
        return jsonResponse(body);
      }

      if (url.endsWith('/redeem/submit')) {
        return jsonResponse({
          success: false,
          msg: '上游返回临时异常',
        });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_dnscon_uncertain_release',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-RELEASE-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'release');
    assert.equal(result.stopFallback, undefined);
    assert.equal(result.preserveRedeemCode, undefined);
    assert.match(result.message, /二次验卡仍有效/);
  }
  assert.equal(verifyResponses.length, 0);
});

test('dnscon submit 异常后二次验卡无效时占用渠道卡密并转人工处理', async () => {
  const verifyResponses = [
    { code: 200, data: { exists: true, valid: true } },
    { code: 200, data: { exists: true, valid: false, message: '卡密已使用' } },
  ];

  const adapter = createDnsconAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);

      if (url.endsWith('/redeem/verify')) {
        const body = verifyResponses.shift();
        assert.ok(body, 'verify 响应已耗尽');
        return jsonResponse(body);
      }

      if (url.endsWith('/redeem/submit')) {
        return jsonResponse({
          success: false,
          msg: '上游返回临时异常',
        });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_dnscon_uncertain_consume',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-CONSUME-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'consume');
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.match(result.message, /二次验卡无效，需人工处理/);
  }
  assert.equal(verifyResponses.length, 0);
});

test('dnscon 二次验卡失败时保守占用渠道卡密并转人工处理', async () => {
  let verifyCount = 0;
  const adapter = createDnsconAdapter({
    fetchImpl: (async (input) => {
      const url = String(input);

      if (url.endsWith('/redeem/verify')) {
        verifyCount++;
        if (verifyCount === 1) {
          return jsonResponse({
            code: 200,
            data: { exists: true, valid: true },
          });
        }
        throw new Error('verify network down');
      }

      if (url.endsWith('/redeem/submit')) {
        return jsonResponse({ success: false, msg: '上游返回临时异常' });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_dnscon_verify_failure_consume',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-VERIFY-FAIL-CARD',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.cardkeyAction, 'consume');
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.match(result.message, /二次验卡失败，需人工处理/);
  }
});

test('dnscon 拒绝不完整或非个人版 Session JSON，且不会请求上游', async () => {
  let calls = 0;
  const adapter = createDnsconAdapter({
    fetchImpl: (async () => {
      calls++;
      return jsonResponse({});
    }) as typeof fetch,
  });

  const missingAccountResult = await adapter.execute({
    taskId: 'task_dnscon_missing_account',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson({ account: { planType: 'free' } }),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-GOOD-CARD',
  });

  assert.equal(missingAccountResult.ok, false);
  if (!missingAccountResult.ok) {
    assert.match(missingAccountResult.message, /Session Data 格式错误/);
  }

  const workspaceResult = await adapter.execute({
    taskId: 'task_dnscon_workspace_account',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson({
      account: {
        id: 'account_123',
        planType: 'free',
        structure: 'workspace',
      },
    }),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'DNSCON-GOOD-CARD',
  });

  assert.equal(workspaceResult.ok, false);
  if (!workspaceResult.ok) {
    assert.match(workspaceResult.message, /请使用个人版 Token/);
  }

  assert.equal(calls, 0);
});

test('dnscon 注册 dnscon.xyz 官方渠道 driver', () => {
  assert.ok(getAdapter('dnscon.xyz'));
});

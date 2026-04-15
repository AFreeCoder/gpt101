import assert from 'node:assert/strict';
import test from 'node:test';

import { create9977aiAdapter } from '../../src/extensions/upgrade-channel/adapters/9977ai';

function buildSessionJson(email = 'user@example.com') {
  return JSON.stringify({
    user: { id: 'user_123', email },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'header.payload.signature',
  });
}

function jsonResponse(body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

test('9977ai 在 submit_json 失败后会自动重试 reuse_record 直到成功', async () => {
  const calls: Array<{ url: string; method: string; body: string; cookie: string }> = [];
  const responses = [
    jsonResponse(
      { success: true, status: 'active', is_new: true, email: '' },
      { 'set-cookie': 'PHPSESSID=test-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, message: '上游处理中，请稍后重试' }),
    jsonResponse({ success: false, error: '首次复用失败' }),
    jsonResponse({ success: true, message: '复用成功' }),
  ];

  const adapter = create9977aiAdapter({
    fetchImpl: (async (input, init) => {
      const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body || '');
      calls.push({
        url: input.toString(),
        method: init?.method || 'GET',
        body,
        cookie: String(init?.headers && (init.headers as Record<string, string>).Cookie || ''),
      });
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_1',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-4O9C-ATFT-O2E7',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.message || '', /复用成功/);
  }
  assert.equal(calls.length, 4);
  assert.match(calls[0].body, /action=verify_code/);
  assert.match(calls[1].body, /action=submit_json/);
  assert.match(calls[2].body, /action=reuse_record/);
  assert.match(calls[3].body, /action=reuse_record/);
  assert.match(calls[1].cookie, /PHPSESSID=test-session/);
});

test('9977ai 在 verify_code 返回已绑定记录时终止后续渠道并保留卡密占用', async () => {
  const adapter = create9977aiAdapter({
    fetchImpl: (async () =>
      jsonResponse(
        {
          success: true,
          status: 'used',
          is_new: false,
          email: 'bound@example.com',
        },
        { 'set-cookie': 'PHPSESSID=bound-session; path=/; HttpOnly' }
      )) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_2',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson('bound@example.com'),
    chatgptEmail: 'bound@example.com',
    channelCardkey: 'EDVB-5CKV-L9EK-6GEY',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.equal(result.cardkeyAction, 'consume');
    assert.equal(
      result.message,
      '9977 渠道充值异常：该卡密已存在历史升级记录，需人工处理'
    );
  }
});

test('9977ai 在 verify_code 请求失败时返回带渠道前缀的错误', async () => {
  const adapter = create9977aiAdapter({
    fetchImpl: (async () => {
      throw new Error('network down');
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_2a',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-VERIFY-FAIL-0001',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.message,
      '9977 渠道充值异常：verify_code 请求失败：network down'
    );
  }
});

test('9977ai 在 verify_code 返回失败时返回带渠道前缀的错误', async () => {
  const adapter = create9977aiAdapter({
    fetchImpl: (async () =>
      jsonResponse({
        success: false,
        error: '卡密不存在',
      })) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_2b',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-VERIFY-FAIL-0002',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.message,
      '9977 渠道充值异常：verify_code 失败：卡密不存在'
    );
  }
});

test('9977ai 在 submit_json 与 3 次 reuse_record 都失败后返回终止型失败', async () => {
  const calls: string[] = [];
  const responses = [
    jsonResponse(
      { success: true, status: 'active', is_new: true, email: '' },
      { 'set-cookie': 'PHPSESSID=retry-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, error: '提交失败' }),
    jsonResponse({ success: false, error: '复用失败 1' }),
    jsonResponse({ success: false, error: '复用失败 2' }),
    jsonResponse({ success: false, error: '会话失效' }),
  ];

  const adapter = create9977aiAdapter({
    fetchImpl: (async (_, init) => {
      const body =
        init?.body instanceof URLSearchParams
          ? init.body.toString()
          : String(init?.body || '');
      calls.push(body);
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_3',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-RETRY-FAIL-0001',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(calls.length, 5);
    assert.deepEqual(
      calls.map((body) => body.match(/action=([^&]+)/)?.[1] || ''),
      ['verify_code', 'submit_json', 'reuse_record', 'reuse_record', 'reuse_record']
    );
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.equal(result.cardkeyAction, 'consume');
    assert.equal(
      result.message,
      '9977 渠道充值异常：submit_json 失败后自动复用 3 次仍未成功：会话失效'
    );
  }
});

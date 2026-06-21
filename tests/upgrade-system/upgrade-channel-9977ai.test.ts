import assert from 'node:assert/strict';
import test from 'node:test';

import { create9977aiAdapter } from '../../src/extensions/upgrade-channel/adapters/9977ai';

const FIXED_NOW = new Date('2026-05-07T06:41:18Z');

function buildSessionJson(email = 'user@example.com') {
  return JSON.stringify({
    user: { id: 'user_123', email },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'header.payload.signature',
  });
}

function jsonResponse(
  body: unknown,
  headers?: Record<string, string>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function readJsonBody(init?: RequestInit): any {
  return init?.body ? JSON.parse(String(init.body)) : {};
}

function requestPath(input: RequestInfo | URL) {
  return new URL(input.toString()).pathname;
}

test('9977ai 新版接口在充值失败后会自动重试复用直到成功', async () => {
  const calls: Array<{
    path: string;
    method: string;
    body: any;
    cookie: string;
  }> = [];
  const sessionJson = buildSessionJson();
  const responses = [
    jsonResponse(
      {
        success: true,
        data: { allow_new_submission: true, has_existing_record: false },
      },
      { 'set-cookie': 'PHPSESSID=test-session; path=/; HttpOnly' }
    ),
    jsonResponse(
      { success: false, message: '上游处理中，请稍后重试' },
      {},
      503
    ),
    jsonResponse({ success: false, error: '首次复用失败' }),
    jsonResponse({ success: true, message: '复用成功' }),
  ];

  const adapter = create9977aiAdapter({
    fetchImpl: (async (input, init) => {
      calls.push({
        path: requestPath(input),
        method: init?.method || 'GET',
        body: readJsonBody(init),
        cookie: String(
          (init?.headers && (init.headers as Record<string, string>).Cookie) ||
            ''
        ),
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
    sessionToken: sessionJson,
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-4O9C-ATFT-O2E7',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.message || '', /复用成功/);
  }
  assert.equal(calls.length, 4);
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      '/api-verify-unified.php',
      '/simple-submit-recharge-unified.php',
      '/api-recharge-reuse-unified.php',
      '/api-recharge-reuse-unified.php',
    ]
  );
  assert.equal(calls[0].body.activation_code, 'EDVB-4O9C-ATFT-O2E7');
  assert.equal(calls[1].body.user_data, sessionJson);
  assert.equal(calls[2].body.action, 'reuse_record');
  assert.match(calls[1].cookie, /PHPSESSID=test-session/);
});

test('9977ai 新版验证返回已绑定记录时终止后续渠道并保留卡密占用', async () => {
  const calls: string[] = [];
  const adapter = create9977aiAdapter({
    fetchImpl: (async (input) => {
      calls.push(requestPath(input));
      return jsonResponse(
        {
          success: true,
          data: {
            allow_new_submission: false,
            has_existing_record: true,
            existing_record: {
              email: 'bound@example.com',
              updated_at: '2026-05-07 14:41:18',
            },
          },
        },
        { 'set-cookie': 'PHPSESSID=bound-session; path=/; HttpOnly' }
      );
    }) as typeof fetch,
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
  assert.deepEqual(calls, ['/api-verify-unified.php']);
});

test('9977ai 复用记录失败后二次验卡确认同邮箱同时间窗口后判成功', async () => {
  const calls: Array<{ path: string; body: any }> = [];
  const responses = [
    jsonResponse(
      {
        success: true,
        data: { allow_new_submission: true, has_existing_record: false },
      },
      { 'set-cookie': 'PHPSESSID=confirm-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, error: '提交结果无法确认' }),
    jsonResponse({ success: false, error: '复用失败 1' }),
    jsonResponse({ success: false, error: '复用失败 2' }),
    jsonResponse({ success: false, error: '会话失效' }),
    jsonResponse({
      success: true,
      data: {
        allow_new_submission: false,
        has_existing_record: true,
        existing_record: {
          email: 'USER@example.com',
          updated_at: '2026-05-07 14:41:18',
        },
      },
    }),
  ];

  const adapter = create9977aiAdapter({
    now: () => FIXED_NOW,
    fetchImpl: (async (input, init) => {
      calls.push({ path: requestPath(input), body: readJsonBody(init) });
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_confirm_used',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-CONFIRM-USED',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.message || '', /二次验卡确认渠道卡密已兑换/);
  }
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      '/api-verify-unified.php',
      '/simple-submit-recharge-unified.php',
      '/api-recharge-reuse-unified.php',
      '/api-recharge-reuse-unified.php',
      '/api-recharge-reuse-unified.php',
      '/api-verify-unified.php',
    ]
  );
});

test('9977ai 二次验卡兑换邮箱不匹配时仍转人工处理', async () => {
  const responses = [
    jsonResponse(
      {
        success: true,
        data: { allow_new_submission: true, has_existing_record: false },
      },
      { 'set-cookie': 'PHPSESSID=other-email-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, error: '提交结果无法确认' }),
    jsonResponse({ success: false, error: '复用失败 1' }),
    jsonResponse({ success: false, error: '复用失败 2' }),
    jsonResponse({ success: false, error: '会话失效' }),
    jsonResponse({
      success: true,
      data: {
        allow_new_submission: false,
        has_existing_record: true,
        existing_record: {
          email: 'other@example.com',
          updated_at: '2026-05-07 14:41:18',
        },
      },
    }),
  ];

  const adapter = create9977aiAdapter({
    now: () => FIXED_NOW,
    fetchImpl: (async () => {
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_other_email',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-OTHER-EMAIL',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.equal(result.cardkeyAction, 'consume');
    assert.match(result.message, /仍未成功/);
  }
});

test('9977ai 在新版验证请求失败时返回带渠道前缀的错误', async () => {
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
      '9977 渠道充值异常：卡密验证请求失败：network down'
    );
  }
});

test('9977ai 在新版验证返回失败时返回带渠道前缀的错误', async () => {
  const adapter = create9977aiAdapter({
    fetchImpl: (async () =>
      jsonResponse(
        {
          success: false,
          message: '卡密不存在',
        },
        {},
        400
      )) as typeof fetch,
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
    assert.equal(result.message, '9977 渠道充值异常：卡密验证失败：卡密不存在');
  }
});

test('9977ai 在新版充值与 3 次复用都失败后二次验卡仍有效则释放卡密', async () => {
  const calls: Array<{ path: string; body: any }> = [];
  const responses = [
    jsonResponse(
      {
        success: true,
        data: { allow_new_submission: true, has_existing_record: false },
      },
      { 'set-cookie': 'PHPSESSID=retry-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, error: '提交失败' }),
    jsonResponse({ success: false, error: '复用失败 1' }),
    jsonResponse({ success: false, error: '复用失败 2' }),
    jsonResponse({ success: false, error: '会话失效' }),
    jsonResponse({
      success: true,
      data: { allow_new_submission: true, has_existing_record: false },
    }),
  ];

  const adapter = create9977aiAdapter({
    fetchImpl: (async (input, init) => {
      calls.push({ path: requestPath(input), body: readJsonBody(init) });
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
    assert.equal(calls.length, 6);
    assert.deepEqual(
      calls.map((call) => call.path),
      [
        '/api-verify-unified.php',
        '/simple-submit-recharge-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-verify-unified.php',
      ]
    );
    assert.equal(result.stopFallback, undefined);
    assert.equal(result.preserveRedeemCode, undefined);
    assert.equal(result.cardkeyAction, 'release');
    assert.equal(result.retryable, true);
    assert.match(result.message, /二次验卡仍有效/);
    assert.match(result.message, /会话失效/);
  }
});

test('9977ai 在复用记录明确不存在时终止失败并释放卡密占用', async () => {
  const calls: Array<{ path: string; body: any }> = [];
  const responses = [
    jsonResponse(
      {
        success: true,
        data: { allow_new_submission: true, has_existing_record: false },
      },
      { 'set-cookie': 'PHPSESSID=no-record-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, error: '提交失败' }),
    jsonResponse({ success: false, error: '未找到对应的充值记录' }),
    jsonResponse({ success: false, error: '未找到对应的充值记录' }),
    jsonResponse({ success: false, error: '未找到对应的充值记录' }),
    jsonResponse({
      success: true,
      data: { allow_new_submission: true, has_existing_record: false },
    }),
  ];

  const adapter = create9977aiAdapter({
    fetchImpl: (async (input, init) => {
      calls.push({ path: requestPath(input), body: readJsonBody(init) });
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_no_record',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-NO-RECORD-0001',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      calls.map((call) => call.path),
      [
        '/api-verify-unified.php',
        '/simple-submit-recharge-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-verify-unified.php',
      ]
    );
    assert.equal(result.stopFallback, undefined);
    assert.equal(result.preserveRedeemCode, undefined);
    assert.equal(result.cardkeyAction, 'release');
    assert.equal(result.retryable, true);
    assert.match(result.message, /二次验卡仍有效/);
    assert.match(result.message, /未找到对应的充值记录/);
  }
});

test('9977ai 在复用安卓记录不存在时终止失败并释放卡密占用', async () => {
  const calls: Array<{ path: string; body: any }> = [];
  const responses = [
    jsonResponse(
      {
        success: true,
        data: { allow_new_submission: true, has_existing_record: false },
      },
      { 'set-cookie': 'PHPSESSID=no-android-record-session; path=/; HttpOnly' }
    ),
    jsonResponse({ success: false, error: '提交失败' }),
    jsonResponse({
      success: false,
      error: '该卡密没有可复用的安卓充值记录，请走正常充值',
    }),
    jsonResponse({
      success: false,
      error: '该卡密没有可复用的安卓充值记录，请走正常充值',
    }),
    jsonResponse({
      success: false,
      error: '该卡密没有可复用的安卓充值记录，请走正常充值',
    }),
    jsonResponse({
      success: true,
      data: { allow_new_submission: true, has_existing_record: false },
    }),
  ];

  const adapter = create9977aiAdapter({
    fetchImpl: (async (input, init) => {
      calls.push({ path: requestPath(input), body: readJsonBody(init) });
      const response = responses.shift();
      assert.ok(response, '测试响应已耗尽');
      return response;
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_9977_no_android_record',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'EDVB-NO-ANDROID-RECORD-0001',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      calls.map((call) => call.path),
      [
        '/api-verify-unified.php',
        '/simple-submit-recharge-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-recharge-reuse-unified.php',
        '/api-verify-unified.php',
      ]
    );
    assert.equal(result.stopFallback, undefined);
    assert.equal(result.preserveRedeemCode, undefined);
    assert.equal(result.cardkeyAction, 'release');
    assert.equal(result.retryable, true);
    assert.match(result.message, /二次验卡仍有效/);
    assert.match(result.message, /没有可复用的安卓充值记录/);
  }
});

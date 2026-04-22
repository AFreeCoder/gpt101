import assert from 'node:assert/strict';
import test from 'node:test';

import adapter987ai from '../../src/extensions/upgrade-channel/adapters/987ai';

function buildSessionJson(email = 'user@example.com') {
  return JSON.stringify({
    user: { id: 'user_123', email },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'header.payload.signature',
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('987ai 在渠道卡密验证失败时要求禁用坏卡并保留错误信息', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input) => {
    calls.push(String(input));
    return jsonResponse({
      available: false,
      error: '卡密已被使用',
    });
  }) as typeof fetch;

  try {
    const result = await adapter987ai.execute({
      taskId: 'task_987ai_1',
      productCode: 'plus',
      memberType: 'month',
      sessionToken: buildSessionJson(),
      chatgptEmail: 'user@example.com',
      channelCardkey: 'BAD-CARD-001',
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0], /\/card-keys\/BAD-CARD-001$/);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.retryable, false);
      assert.equal(result.cardkeyAction, 'disable');
      assert.equal(result.message, '渠道卡密不可用: 卡密已被使用');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

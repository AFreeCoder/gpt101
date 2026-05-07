import assert from 'node:assert/strict';
import test from 'node:test';

import { create987aiAdapter } from '../../src/extensions/upgrade-channel/adapters/987ai';

const FIXED_NOW = new Date('2026-05-07T06:41:18Z');

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
  const calls: string[] = [];
  const adapter = create987aiAdapter({
    fetchImpl: (async (input) => {
      calls.push(String(input));
      return jsonResponse({
        available: false,
        error: '卡密已被使用',
      });
    }) as typeof fetch,
  });

  const result = await adapter.execute({
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
});

test('987ai 会持续等待排队任务直到上游返回终态', async () => {
  const calls: string[] = [];
  const pollStatuses = [
    ...Array.from({ length: 35 }, (_, index) => ({
      status: index % 2 === 0 ? 'pending' : 'processing',
      queue_position: 35 - index,
    })),
    { status: 'completed', result: '充值成功' },
  ];

  const adapter = create987aiAdapter({
    pollIntervalMs: 0,
    fetchImpl: (async (input, init) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/card-keys/GOOD-CARD-QUEUE')) {
        return jsonResponse({ available: true });
      }

      if (url.endsWith('/parse-token')) {
        return jsonResponse({ success: true, message: 'user@example.com' });
      }

      if (url.endsWith('/tasks') && init?.method === 'POST') {
        return jsonResponse({
          success: true,
          task_id: 'queue-task-id',
        });
      }

      if (url.endsWith('/tasks/queue-task-id')) {
        const response = pollStatuses.shift();
        assert.ok(response, '轮询响应已耗尽');
        return jsonResponse(response);
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_987ai_queue',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'GOOD-CARD-QUEUE',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.message, '充值成功');
  }
  assert.equal(pollStatuses.length, 0);
  assert.equal(
    calls.filter((url) => url.endsWith('/tasks/queue-task-id')).length,
    36
  );
});

test('987ai 任务状态连续查询失败且批量查卡确认同邮箱后判成功', async () => {
  const calls: string[] = [];
  let pollCount = 0;
  let cardVerifyCount = 0;

  const adapter = create987aiAdapter({
    pollIntervalMs: 0,
    maxConsecutivePollErrors: 3,
    now: () => FIXED_NOW,
    fetchImpl: (async (input, init) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/card-keys/GOOD-CARD-USED')) {
        cardVerifyCount++;
        return jsonResponse(
          cardVerifyCount === 1
            ? { available: true }
            : { available: false, error: '卡密已使用' }
        );
      }

      if (url.endsWith('/parse-token')) {
        return jsonResponse({ success: true, message: 'user@example.com' });
      }

      if (url.endsWith('/tasks') && init?.method === 'POST') {
        return jsonResponse({
          success: true,
          task_id: 'uncertain-task-id',
        });
      }

      if (url.endsWith('/tasks/uncertain-task-id')) {
        pollCount++;
        throw new Error('status timeout');
      }

      if (url.endsWith('/card-keys/batch-query')) {
        return jsonResponse({
          success: true,
          data: [
            {
              card_key: 'GOOD-CARD-USED',
              status: 1,
              user_id: 'USER@example.com',
              used_at: '2026-05-07T06:41:18Z',
            },
          ],
        });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_987ai_uncertain',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'GOOD-CARD-USED',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.message || '', /批量查卡确认渠道卡密已兑换/);
  }
  assert.equal(pollCount, 3);
  assert.deepEqual(
    calls.map((url) => new URL(url).pathname),
    [
      '/api/card-keys/GOOD-CARD-USED',
      '/api/parse-token',
      '/api/tasks',
      '/api/tasks/uncertain-task-id',
      '/api/tasks/uncertain-task-id',
      '/api/tasks/uncertain-task-id',
      '/api/card-keys/GOOD-CARD-USED',
      '/api/card-keys/batch-query',
    ]
  );
});

test('987ai 批量查卡兑换邮箱不匹配时仍转人工处理', async () => {
  let cardVerifyCount = 0;

  const adapter = create987aiAdapter({
    pollIntervalMs: 0,
    maxConsecutivePollErrors: 1,
    now: () => FIXED_NOW,
    fetchImpl: (async (input, init) => {
      const url = String(input);

      if (url.endsWith('/card-keys/GOOD-CARD-OTHER')) {
        cardVerifyCount++;
        return jsonResponse(
          cardVerifyCount === 1
            ? { available: true }
            : { available: false, error: '卡密已使用' }
        );
      }

      if (url.endsWith('/parse-token')) {
        return jsonResponse({ success: true, message: 'user@example.com' });
      }

      if (url.endsWith('/tasks') && init?.method === 'POST') {
        return jsonResponse({
          success: true,
          task_id: 'other-email-task-id',
        });
      }

      if (url.endsWith('/tasks/other-email-task-id')) {
        throw new Error('status timeout');
      }

      if (url.endsWith('/card-keys/batch-query')) {
        return jsonResponse({
          success: true,
          data: [
            {
              card_key: 'GOOD-CARD-OTHER',
              status: 1,
              user_id: 'other@example.com',
              used_at: '2026-05-07T06:41:18Z',
            },
          ],
        });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as typeof fetch,
  });

  const result = await adapter.execute({
    taskId: 'task_987ai_other_email',
    productCode: 'plus',
    memberType: 'month',
    sessionToken: buildSessionJson(),
    chatgptEmail: 'user@example.com',
    channelCardkey: 'GOOD-CARD-OTHER',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopFallback, true);
    assert.equal(result.preserveRedeemCode, true);
    assert.equal(result.cardkeyAction, 'consume');
    assert.match(result.message, /需人工处理/);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractSessionAccountVerificationInput,
  mergeUpgradeTaskMetadata,
  parseUpgradeTaskMetadata,
  replaceSessionAccountFields,
  replaceSessionPlanType,
  resolveSessionAccountPayload,
} from '../../src/shared/services/upgrade-task-helpers';

test('resolveSessionAccountPayload 解析完整 session JSON', () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'access-token-123',
  });

  const result = resolveSessionAccountPayload(sessionToken);

  assert.deepEqual(result, {
    email: 'user@example.com',
    accountId: 'account_123',
    currentPlan: 'free',
    accessToken: 'access-token-123',
  });
});

test('replaceSessionPlanType 只替换 session JSON 的 account.planType', () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'plus', name: 'Personal' },
    accessToken: 'access-token-123',
  });

  const result = replaceSessionPlanType(sessionToken, 'free');

  assert.deepEqual(JSON.parse(result), {
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free', name: 'Personal' },
    accessToken: 'access-token-123',
  });
});

test('replaceSessionPlanType 遇到非 JSON token 时保持原样', () => {
  const sessionToken = 'header.payload.signature';

  assert.equal(replaceSessionPlanType(sessionToken, 'free'), sessionToken);
});

test('replaceSessionAccountFields 补齐 session JSON 的 account 字段', () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { name: 'Personal', structure: 'personal' },
    accessToken: 'access-token-123',
  });

  const result = replaceSessionAccountFields(sessionToken, {
    accountId: 'account_from_remote',
    currentPlan: 'FREE',
  });

  assert.deepEqual(JSON.parse(result), {
    user: { id: 'user_123', email: 'user@example.com' },
    account: {
      id: 'account_from_remote',
      planType: 'free',
      name: 'Personal',
      structure: 'personal',
    },
    accessToken: 'access-token-123',
  });
});

test('extractSessionAccountVerificationInput 允许缺少 account 字段但仍要求 user.email', () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    accessToken: 'access-token-123',
  });

  assert.deepEqual(extractSessionAccountVerificationInput(sessionToken), {
    email: 'user@example.com',
    accountId: '',
    currentPlan: '',
    accessToken: 'access-token-123',
  });

  assert.throws(
    () =>
      extractSessionAccountVerificationInput(
        JSON.stringify({
          user: { id: 'user_123' },
          accessToken: 'access-token-123',
        })
      ),
    /缺少 user.email/
  );
});

test('resolveSessionAccountPayload 拒绝缺少字段的 session JSON', () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
  });

  assert.throws(
    () => resolveSessionAccountPayload(sessionToken),
    /缺少 accessToken/
  );
});

test('resolveSessionAccountPayload 拒绝缺少必要 claims 的 JWT token', () => {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_123',
      'https://api.openai.com/profile': {},
      'https://api.openai.com/auth': {},
    })
  ).toString('base64url');
  const sessionToken = `header.${payload}.signature`;

  assert.throws(
    () => resolveSessionAccountPayload(sessionToken),
    /无法解析 Token/
  );
});

test('resolveSessionAccountPayload 解析包含 profile/auth claims 的 JWT token', () => {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_123',
      'https://api.openai.com/profile': {
        email: 'jwt@example.com',
      },
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'account_from_jwt',
        chatgpt_plan_type: 'free',
      },
    })
  ).toString('base64url');
  const sessionToken = `header.${payload}.signature`;

  const result = resolveSessionAccountPayload(sessionToken);

  assert.deepEqual(result, {
    email: 'jwt@example.com',
    accountId: 'account_from_jwt',
    currentPlan: 'free',
    accessToken: sessionToken,
  });
});

test('resolveSessionAccountPayload 不把 chatgpt_user_id 或 sub 当 account.id', () => {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'google-oauth2|123456',
      'https://api.openai.com/profile': {
        email: 'jwt@example.com',
      },
      'https://api.openai.com/auth': {
        chatgpt_user_id: 'user_123',
        chatgpt_plan_type: 'free',
      },
    })
  ).toString('base64url');
  const sessionToken = `header.${payload}.signature`;

  assert.throws(
    () => resolveSessionAccountPayload(sessionToken),
    /无法解析 Token/
  );
});

test('resolveSessionAccountPayload 对 JWT plus 用户返回明确拦截提示', () => {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_123',
      'https://api.openai.com/profile': {
        email: 'plus@example.com',
      },
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'account_plus',
        chatgpt_plan_type: 'plus',
      },
    })
  ).toString('base64url');
  const sessionToken = `header.${payload}.signature`;

  assert.throws(
    () => resolveSessionAccountPayload(sessionToken),
    /当前为 Plus 会员/
  );
});

test('mergeUpgradeTaskMetadata 合并人工成功信息并可回读', () => {
  const metadata = mergeUpgradeTaskMetadata(undefined, {
    adminNote: '人工补单',
    manualSuccessChannelId: 'channel_123',
    manualSuccessChannelName: '987AI',
    manualSuccessChannelCardkey: 'CARD-123',
  });

  assert.deepEqual(parseUpgradeTaskMetadata(metadata), {
    adminNote: '人工补单',
    manualSuccessChannelId: 'channel_123',
    manualSuccessChannelName: '987AI',
    manualSuccessChannelCardkey: 'CARD-123',
  });
});

test('mergeUpgradeTaskMetadata 遇到 undefined 时保留已有字段', () => {
  const metadata = mergeUpgradeTaskMetadata(
    JSON.stringify({
      adminNote: '已有备注',
      manualSuccessChannelName: '987AI',
    }),
    {
      adminNote: undefined,
      manualSuccessChannelCardkey: 'CARD-456',
    }
  );

  assert.deepEqual(parseUpgradeTaskMetadata(metadata), {
    adminNote: '已有备注',
    manualSuccessChannelName: '987AI',
    manualSuccessChannelCardkey: 'CARD-456',
  });
});

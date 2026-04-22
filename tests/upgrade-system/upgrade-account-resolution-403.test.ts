import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveVerifiedSessionAccount } from '../../src/shared/services/upgrade-account-resolver';

const CHATGPT_HOME_URL = 'https://chatgpt.com/';
const CHATGPT_ACCOUNTS_CHECK_URL =
  'https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27';

function buildJwt(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

test('resolveVerifiedSessionAccount 在 ChatGPT 校验返回 403 时提示稍后重试', async () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'access-token-forbidden',
  });

  await assert.rejects(
    () =>
      resolveVerifiedSessionAccount(sessionToken, {
        fetchImpl: (async (input) => {
          if (input.toString() === CHATGPT_HOME_URL) {
            return new Response('', { status: 200 });
          }

          assert.equal(input.toString(), CHATGPT_ACCOUNTS_CHECK_URL);
          return new Response(
            JSON.stringify({
              error: {
                message: 'Access forbidden by upstream',
              },
            }),
            {
              status: 403,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }) as typeof fetch,
      }),
    /账号校验服务暂时不可用，请稍后重试/
  );
});

test('resolveVerifiedSessionAccount 在 ChatGPT 校验返回终止型 403 时提示账号受限', async () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'access-token-deactivated',
  });

  await assert.rejects(
    () =>
      resolveVerifiedSessionAccount(sessionToken, {
        fetchImpl: (async (input) => {
          if (input.toString() === CHATGPT_HOME_URL) {
            return new Response('', { status: 200 });
          }

          assert.equal(input.toString(), CHATGPT_ACCOUNTS_CHECK_URL);
          return new Response(
            JSON.stringify({
              error: {
                message:
                  'This OpenAI account has been deactivated due to policy violation.',
              },
            }),
            {
              status: 403,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }) as typeof fetch,
      }),
    /账号当前被限制或已停用/
  );
});

test('resolveVerifiedSessionAccount 在提供账号校验器时优先使用校验器结果', async () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
    accessToken: buildJwt({
      sub: 'user_123',
      'https://api.openai.com/profile': {
        email: 'user@example.com',
      },
      'https://api.openai.com/auth': {
        chatgpt_user_id: 'account_123',
        chatgpt_plan_type: 'free',
      },
    }),
  });

  const result = await resolveVerifiedSessionAccount(sessionToken, {
    accountVerifier: async () => ({
      email: 'user@example.com',
      accountId: 'account_123',
      currentPlan: 'free',
    }),
    fetchImpl: (async () => {
      assert.fail(
        'fetchImpl should not be called when accountVerifier is provided'
      );
    }) as typeof fetch,
  } as any);

  assert.equal(result.email, 'user@example.com');
  assert.equal(result.accountId, 'account_123');
  assert.equal(result.currentPlan, 'free');
});

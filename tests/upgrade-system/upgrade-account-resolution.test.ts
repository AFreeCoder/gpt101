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

function mockAccountsCheckResponse(body: unknown, status = 200) {
  return async (input: RequestInfo | URL) => {
    if (input.toString() === CHATGPT_HOME_URL) {
      return new Response('', { status: 200 });
    }

    assert.equal(input.toString(), CHATGPT_ACCOUNTS_CHECK_URL);

    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };
}

test('resolveVerifiedSessionAccount 以远程返回的当前套餐为准拦截 plus 用户', async () => {
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

  await assert.rejects(
    () =>
      resolveVerifiedSessionAccount(sessionToken, {
        fetchImpl: mockAccountsCheckResponse({
          accounts: {
            account_123: {
              account: {
                account_id: 'account_123',
                plan_type: 'plus',
                is_default: true,
              },
            },
          },
        }) as typeof fetch,
      }),
    /当前为 Plus 会员/
  );
});

test('resolveVerifiedSessionAccount 会先预热 chatgpt cookie 再校验账号', async () => {
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

  const calls: Array<{ url: string; headers: Headers }> = [];

  const result = await resolveVerifiedSessionAccount(sessionToken, {
    fetchImpl: (async (input, init) => {
      const url = input.toString();
      const headers = new Headers(init?.headers);
      calls.push({ url, headers });

      if (url === CHATGPT_HOME_URL) {
        return new Response('', {
          status: 200,
          headers: {
            'set-cookie':
              '__Secure-next-auth.callback-url=https%3A%2F%2Fchatgpt.com; Path=/; Secure',
          },
        });
      }

      assert.equal(url, CHATGPT_ACCOUNTS_CHECK_URL);
      return new Response(
        JSON.stringify({
          accounts: {
            account_123: {
              account: {
                account_id: 'account_123',
                plan_type: 'free',
                is_default: true,
              },
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }) as typeof fetch,
  });

  assert.equal(calls[0]?.url, CHATGPT_HOME_URL);
  assert.equal(calls[1]?.url, CHATGPT_ACCOUNTS_CHECK_URL);
  assert.match(
    calls[1]?.headers.get('cookie') || '',
    /__Secure-next-auth\.callback-url=/
  );
  assert.equal(calls[1]?.headers.get('origin'), 'https://chatgpt.com');
  assert.ok(calls[1]?.headers.get('oai-device-id'));
  assert.equal(result.accountId, 'account_123');
});

test('resolveVerifiedSessionAccount 在远程账号与当前 token 信息不一致时拒绝提交', async () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_local', planType: 'free' },
    accessToken: buildJwt({
      sub: 'user_123',
      'https://api.openai.com/profile': {
        email: 'user@example.com',
      },
      'https://api.openai.com/auth': {
        chatgpt_user_id: 'account_local',
        chatgpt_plan_type: 'free',
      },
    }),
  });

  await assert.rejects(
    () =>
      resolveVerifiedSessionAccount(sessionToken, {
        fetchImpl: mockAccountsCheckResponse({
          accounts: {
            account_remote: {
              account: {
                account_id: 'account_remote',
                plan_type: 'free',
                is_default: true,
              },
            },
          },
        }) as typeof fetch,
      }),
    /账号信息不一致/
  );
});

test('resolveVerifiedSessionAccount 在 access token 无效时返回明确错误', async () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'access-token-invalid',
  });

  await assert.rejects(
    () =>
      resolveVerifiedSessionAccount(sessionToken, {
        fetchImpl: mockAccountsCheckResponse(
          {
            error: 'invalid_token',
          },
          401
        ) as typeof fetch,
      }),
    /access token 无效或已过期/
  );
});

test('resolveVerifiedSessionAccount 在远程获取失败时提示稍后重试', async () => {
  const sessionToken = JSON.stringify({
    user: { id: 'user_123', email: 'user@example.com' },
    account: { id: 'account_123', planType: 'free' },
    accessToken: 'access-token-network-error',
  });

  await assert.rejects(
    () =>
      resolveVerifiedSessionAccount(sessionToken, {
        fetchImpl: (async () => {
          throw new Error('connect timeout');
        }) as typeof fetch,
      }),
    /账号校验服务暂时不可用，请稍后重试/
  );
});

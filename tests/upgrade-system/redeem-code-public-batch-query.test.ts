import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  handlePublicRedeemCodeBatchQuery,
  POST as publicBatchQueryPost,
} from '../../src/app/api/redeem-codes/batch-query/route';

const repoRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('public batch query page exposes a channel-facing cardkey lookup tool', () => {
  const pagePath = 'src/app/[locale]/(landing)/batch-query/page.tsx';
  const clientPath =
    'src/app/[locale]/(landing)/batch-query/batch-query-client.tsx';
  const standalonePagePath = 'src/app/batch-query/page.tsx';
  const routePath = 'src/app/api/redeem-codes/batch-query/route.ts';
  const proxyPath = 'src/proxy.ts';

  assert.equal(existsSync(path.join(repoRoot, pagePath)), true);
  assert.equal(existsSync(path.join(repoRoot, clientPath)), true);
  assert.equal(existsSync(path.join(repoRoot, standalonePagePath)), false);
  assert.equal(existsSync(path.join(repoRoot, routePath)), true);

  const pageSource = readSource(pagePath);
  const clientSource = readSource(clientPath);
  const routeSource = readSource(routePath);
  const proxySource = readSource(proxyPath);

  assert.match(pageSource, /BatchQueryClient/);
  assert.match(pageSource, /index:\s*false/);
  assert.match(clientSource, /本站卡密批量查询/);
  assert.match(clientSource, /textarea/);
  assert.match(clientSource, /最多 100 个/);
  assert.match(clientSource, /\/api\/redeem-codes\/batch-query/);
  assert.doesNotMatch(clientSource, /\/api\/admin\/redeem-codes\/batch-query/);
  assert.doesNotMatch(clientSource, /ShieldCheck/);
  assert.doesNotMatch(clientSource, /外部渠道/);
  assert.doesNotMatch(clientSource, /<div[^>]*>\s*G\s*<\/div>/);
  assert.doesNotMatch(clientSource, /text-sm[^>]*>\s*GPT101\s*<\/div>/);
  assert.match(clientSource, /使用邮箱/);
  assert.match(clientSource, /usedByEmail/);
  assert.match(clientSource, /usedAt/);
  assert.match(clientSource, /overflow-x-auto/);
  assert.match(clientSource, /bg-background/);
  assert.match(clientSource, /bg-card/);
  assert.match(clientSource, /max-w-7xl/);
  assert.match(clientSource, /space-y-5/);
  assert.doesNotMatch(clientSource, /lg:grid-cols-\[minmax/);

  assert.match(routeSource, /queryRedeemCodeUsageBatch/);
  assert.match(routeSource, /maskRedeemCodeUsagePublicResult/);
  assert.match(routeSource, /validateRedeemCodeFormat/);
  assert.match(routeSource, /enforceMinIntervalRateLimit/);
  assert.match(routeSource, /recordPublicBatchQueryAudit/);
  assert.match(routeSource, /查询失败，请稍后重试/);
  assert.doesNotMatch(routeSource, /requirePermission/);
  assert.doesNotMatch(routeSource, /PERMISSIONS/);
  assert.doesNotMatch(routeSource, /err\.message \|\|/);

  assert.doesNotMatch(proxySource, /BATCH_QUERY_PUBLIC_PATH/);
  assert.doesNotMatch(proxySource, /isBatchQueryPublicPath/);
});

test('public batch query API returns validation errors without requiring database access', async () => {
  const req = new Request('http://localhost/api/redeem-codes/batch-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codes: Array.from({ length: 101 }, (_, index) => `GPT101-${index}`),
    }),
  });

  const res = await publicBatchQueryPost(req);
  const data = await res.json();

  assert.equal(data.code, -1);
  assert.equal(data.message, '最多查询 100 个卡密');
});

test('public batch query API rejects malformed cardkeys before querying storage', async () => {
  let queried = false;
  const req = new Request('http://localhost/api/redeem-codes/batch-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes: ['not-a-real-cardkey'] }),
  });

  const res = await handlePublicRedeemCodeBatchQuery(req, async () => {
    queried = true;
    throw new Error('should not query storage');
  });
  const data = await res.json();

  assert.equal(queried, false);
  assert.equal(data.code, -1);
  assert.equal(data.message, '卡密格式不正确');
});

test('public batch query API masks successful route responses', async () => {
  const validCode = `GPT101-${'A'.repeat(32)}`;
  const req = new Request('http://localhost/api/redeem-codes/batch-query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '198.51.100.21',
    },
    body: JSON.stringify({ codes: [` ${validCode.toLowerCase()} `] }),
  });

  const res = await handlePublicRedeemCodeBatchQuery(req, async (codes) => {
    assert.deepEqual(codes, [validCode]);
    return {
      items: [
        {
          code: validCode,
          state: 'used',
          used: true,
          status: 'consumed',
          productCode: 'gpt',
          memberType: 'plus',
          usedAt: new Date('2026-06-02T10:20:30.000Z'),
          usedByEmail: 'used@example.com',
        },
      ],
      summary: {
        total: 1,
        used: 1,
        unused: 0,
        disabled: 0,
        notFound: 0,
      },
    };
  });
  const data = await res.json();

  assert.equal(data.code, 0);
  assert.equal(data.data.items[0].usedByEmail, 'us***@example.com');
  assert.equal(JSON.stringify(data).includes('used@example.com'), false);
  assert.deepEqual(data.data.summary, {
    total: 1,
    used: 1,
    unused: 0,
    disabled: 0,
    notFound: 0,
  });
});

test('public batch query API rate limits repeated successful lookups by client identity', async () => {
  const validCode = `GPT101-${'B'.repeat(32)}`;
  const url = 'http://localhost/api/redeem-codes/batch-query';
  const headers = {
    'Content-Type': 'application/json',
    'x-forwarded-for': '198.51.100.22',
  };
  const makeReq = () =>
    new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ codes: [validCode] }),
    });
  const query = async () => ({
    items: [
      {
        code: validCode,
        state: 'unused' as const,
        used: false,
        status: 'available',
        productCode: 'gpt',
        memberType: 'plus',
        usedAt: null,
        usedByEmail: null,
      },
    ],
    summary: {
      total: 1,
      used: 0,
      unused: 1,
      disabled: 0,
      notFound: 0,
    },
  });

  const first = await handlePublicRedeemCodeBatchQuery(makeReq(), query);
  const second = await handlePublicRedeemCodeBatchQuery(makeReq(), query);
  const firstData = await first.json();
  const secondData = await second.json();

  assert.equal(firstData.code, 0);
  assert.equal(second.status, 429);
  assert.equal(secondData.code, -1);
  assert.equal(secondData.message, '查询过于频繁，请稍后重试');
});

import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test, { after } from 'node:test';
import { count, eq, inArray, like } from 'drizzle-orm';

import { POST as verifyOrderPost } from '../../src/app/api/partner/upgrade/verify-order/route';
import {
  redeemCode,
  redeemCodeBatch,
  upgradePartnerApp,
  upgradePartnerAuditLog,
  upgradePartnerNonce,
  upgradePartnerOrder,
  upgradeTask,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import { closePostgresDb } from '../../src/core/db/postgres';
import {
  assertPartnerRequestIsSecure,
  authenticatePartnerRequest,
  createPartnerApp,
  queryPartnerTaskStatus,
  resolvePartnerAccount,
  rotatePartnerAppSecret,
  submitPartnerUpgradeTask,
  verifyPartnerOrder,
} from '../../src/shared/services/partner-upgrade';
import { UpgradeTaskStatus } from '../../src/shared/services/upgrade-task';

after(async () => {
  await closePostgresDb();
});

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function signPartnerRequest(args: {
  secret: string;
  method: string;
  path: string;
  timestamp: number;
  nonce: string;
  rawBody: string;
}) {
  const bodyHash = createHash('sha256').update(args.rawBody).digest('hex');
  const canonical = [
    args.method.toUpperCase(),
    args.path,
    String(args.timestamp),
    args.nonce,
    bodyHash,
  ].join('\n');

  return createHmac('sha256', args.secret).update(canonical).digest('hex');
}

function signedHeaders(args: {
  appKey: string;
  secret: string;
  method: string;
  path: string;
  rawBody: string;
  nonce?: string;
  timestamp?: number;
}) {
  const timestamp = args.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = args.nonce ?? uid('nonce');
  const signature = signPartnerRequest({
    secret: args.secret,
    method: args.method,
    path: args.path,
    timestamp,
    nonce,
    rawBody: args.rawBody,
  });

  return {
    headers: new Headers({
      'content-type': 'application/json',
      'x-gpt101-app-key': args.appKey,
      'x-gpt101-timestamp': String(timestamp),
      'x-gpt101-nonce': nonce,
      'x-gpt101-signature': signature,
    }),
    nonce,
    timestamp,
    signature,
  };
}

async function cleanupByPrefix(prefix: string) {
  const tx = db();
  const [appRows, orderRows, taskRows, batchRows] = await Promise.all([
    tx
      .select({ id: upgradePartnerApp.id })
      .from(upgradePartnerApp)
      .where(like(upgradePartnerApp.appKey, `${prefix}%`)),
    tx
      .select({
        id: upgradePartnerOrder.id,
        redeemCodeId: upgradePartnerOrder.redeemCodeId,
        taskId: upgradePartnerOrder.taskId,
      })
      .from(upgradePartnerOrder)
      .where(like(upgradePartnerOrder.externalOrderNo, `${prefix}%`)),
    tx
      .select({ id: upgradeTask.id })
      .from(upgradeTask)
      .where(like(upgradeTask.taskNo, `${prefix}%`)),
    tx
      .select({ id: redeemCodeBatch.id })
      .from(redeemCodeBatch)
      .where(like(redeemCodeBatch.id, `${prefix}%`)),
  ]);

  const appIds = appRows.map((row: { id: string }) => row.id);
  const orderIds = orderRows.map((row: { id: string }) => row.id);
  const linkedTaskIds = orderRows
    .map((row: { taskId: string | null }) => row.taskId)
    .filter((id: string | null): id is string => Boolean(id));
  const taskIds = [
    ...taskRows.map((row: { id: string }) => row.id),
    ...linkedTaskIds,
  ];
  const codeIds = orderRows.map(
    (row: { redeemCodeId: string }) => row.redeemCodeId
  );
  const relatedCodeRows =
    codeIds.length > 0
      ? await tx
          .select({ batchId: redeemCode.batchId })
          .from(redeemCode)
          .where(inArray(redeemCode.id, codeIds))
      : [];
  const batchIds = [
    ...batchRows.map((row: { id: string }) => row.id),
    ...relatedCodeRows.map((row: { batchId: string }) => row.batchId),
  ];

  if (taskIds.length > 0) {
    await tx
      .delete(upgradeTaskAttempt)
      .where(inArray(upgradeTaskAttempt.taskId, taskIds));
    await tx.delete(upgradeTask).where(inArray(upgradeTask.id, taskIds));
  }
  if (orderIds.length > 0) {
    await tx
      .delete(upgradePartnerOrder)
      .where(inArray(upgradePartnerOrder.id, orderIds));
  }
  if (codeIds.length > 0) {
    await tx.delete(redeemCode).where(inArray(redeemCode.id, codeIds));
  }
  if (batchIds.length > 0) {
    await tx
      .delete(redeemCodeBatch)
      .where(inArray(redeemCodeBatch.id, batchIds));
  }
  if (appIds.length > 0) {
    await tx
      .delete(upgradePartnerAuditLog)
      .where(inArray(upgradePartnerAuditLog.partnerAppId, appIds));
    await tx
      .delete(upgradePartnerNonce)
      .where(inArray(upgradePartnerNonce.partnerAppId, appIds));
    await tx
      .delete(upgradePartnerApp)
      .where(inArray(upgradePartnerApp.id, appIds));
  }
}

async function seedPartnerApp(prefix: string, overrides?: { status?: string }) {
  const [app] = await db()
    .insert(upgradePartnerApp)
    .values({
      id: uid(`${prefix}_app`),
      appKey: `${prefix}_app_key`,
      appSecret: `${prefix}_app_secret`,
      name: `${prefix} partner`,
      status: overrides?.status ?? 'active',
      allowedProducts: JSON.stringify([
        { productCode: 'gpt', memberType: 'plus' },
      ]),
    })
    .returning();

  return app;
}

test('authenticatePartnerRequest 校验 HMAC 签名并拒绝重复 nonce', async () => {
  const prefix = `partnerauth${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const rawBody = JSON.stringify({ externalOrderNo: `${prefix}-ORDER` });
  const path = '/api/partner/upgrade/verify-order';
  const { headers } = signedHeaders({
    appKey: app.appKey,
    secret: app.appSecret,
    method: 'POST',
    path,
    rawBody,
    nonce: `${prefix}-nonce`,
  });

  try {
    const auth = await authenticatePartnerRequest({
      method: 'POST',
      path,
      headers,
      rawBody,
    });

    assert.equal(auth.app.appKey, app.appKey);
    await assert.rejects(
      () =>
        authenticatePartnerRequest({
          method: 'POST',
          path,
          headers,
          rawBody,
        }),
      /重复请求/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('authenticatePartnerRequest 清理过期 nonce 并记录失败审计', async () => {
  const prefix = `partneraudit${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const rawBody = JSON.stringify({ externalOrderNo: `${prefix}-ORDER` });
  const path = '/api/partner/upgrade/verify-order';
  const nonce = `${prefix}-nonce`;

  await db()
    .insert(upgradePartnerNonce)
    .values({
      id: uid(`${prefix}_nonce`),
      partnerAppId: app.id,
      appKey: app.appKey,
      nonce,
      method: 'POST',
      path,
      bodyHash: createHash('sha256').update(rawBody).digest('hex'),
      expiresAt: new Date(Date.now() - 60_000),
    });

  const { headers } = signedHeaders({
    appKey: app.appKey,
    secret: app.appSecret,
    method: 'POST',
    path,
    rawBody,
    nonce,
  });
  const badHeaders = new Headers(headers);
  badHeaders.set('x-gpt101-signature', '0'.repeat(64));

  try {
    await assert.rejects(
      () =>
        authenticatePartnerRequest({
          method: 'POST',
          path,
          headers: badHeaders,
          rawBody,
        }),
      /请求签名无效/
    );

    await authenticatePartnerRequest({
      method: 'POST',
      path,
      headers,
      rawBody,
    });

    const nonceRows = await db()
      .select()
      .from(upgradePartnerNonce)
      .where(eq(upgradePartnerNonce.nonce, nonce));
    const auditRows = await db()
      .select()
      .from(upgradePartnerAuditLog)
      .where(eq(upgradePartnerAuditLog.partnerAppId, app.id));

    assert.equal(nonceRows.length, 1);
    assert.equal(
      auditRows.some((row: any) => row.outcome === 'failed'),
      true
    );
    assert.equal(
      auditRows.some((row: any) => row.outcome === 'success'),
      true
    );
    assert.equal(
      auditRows.some((row: any) => row.requestBodyHash?.includes(rawBody)),
      false
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('authenticatePartnerRequest 限制失败鉴权审计写入量', async () => {
  const prefix = `partnerauditlimit${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const rawBody = JSON.stringify({ externalOrderNo: `${prefix}-ORDER` });
  const path = '/api/partner/upgrade/verify-order';

  try {
    for (let index = 0; index < 25; index += 1) {
      const { headers } = signedHeaders({
        appKey: app.appKey,
        secret: app.appSecret,
        method: 'POST',
        path,
        rawBody,
        nonce: `${prefix}-bad-${index}`,
      });
      headers.set('x-gpt101-signature', '0'.repeat(64));

      await assert.rejects(
        () =>
          authenticatePartnerRequest({
            method: 'POST',
            path,
            headers,
            rawBody,
          }),
        /请求签名无效/
      );
    }

    const auditRows = await db()
      .select()
      .from(upgradePartnerAuditLog)
      .where(eq(upgradePartnerAuditLog.partnerAppId, app.id));

    assert.equal(auditRows.length, 20);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('partner 鉴权默认不信任 forwarded 头，除非显式开启可信代理头', async () => {
  const prefix = `partnerproxy${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  await db()
    .update(upgradePartnerApp)
    .set({ ipAllowlist: '203.0.113.10' })
    .where(eq(upgradePartnerApp.id, app.id));
  const appWithIp = {
    ...app,
    ipAllowlist: '203.0.113.10',
  };
  const rawBody = JSON.stringify({ externalOrderNo: `${prefix}-ORDER` });
  const path = '/api/partner/upgrade/verify-order';
  const signed = signedHeaders({
    appKey: app.appKey,
    secret: app.appSecret,
    method: 'POST',
    path,
    rawBody,
    nonce: `${prefix}-no-trust`,
  });
  signed.headers.set('x-forwarded-for', '203.0.113.10');
  const previousTrust = process.env.PARTNER_TRUSTED_PROXY_HEADERS;
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    delete process.env.PARTNER_TRUSTED_PROXY_HEADERS;
    await assert.rejects(
      () =>
        authenticatePartnerRequest({
          method: 'POST',
          path,
          headers: signed.headers,
          rawBody,
        }),
      /当前 IP 不允许/
    );

    process.env.PARTNER_TRUSTED_PROXY_HEADERS = 'true';
    const trusted = signedHeaders({
      appKey: appWithIp.appKey,
      secret: appWithIp.appSecret,
      method: 'POST',
      path,
      rawBody,
      nonce: `${prefix}-trusted`,
    });
    trusted.headers.set('x-forwarded-for', '203.0.113.10');
    const auth = await authenticatePartnerRequest({
      method: 'POST',
      path,
      headers: trusted.headers,
      rawBody,
    });
    assert.equal(auth.app.appKey, app.appKey);

    (process.env as Record<string, string | undefined>)['NODE_ENV'] =
      'production';
    process.env.PARTNER_TRUSTED_PROXY_HEADERS = 'false';
    assert.throws(
      () =>
        assertPartnerRequestIsSecure(
          new Request(`http://localhost${path}`, {
            headers: { 'x-forwarded-proto': 'https' },
          })
        ),
      /仅支持 HTTPS/
    );
  } finally {
    if (previousTrust === undefined) {
      delete process.env.PARTNER_TRUSTED_PROXY_HEADERS;
    } else {
      process.env.PARTNER_TRUSTED_PROXY_HEADERS = previousTrust;
    }
    if (previousNodeEnv === undefined) {
      delete (process.env as Record<string, string | undefined>)['NODE_ENV'];
    } else {
      (process.env as Record<string, string | undefined>)['NODE_ENV'] =
        previousNodeEnv;
    }
    await cleanupByPrefix(prefix);
  }
});

test('createPartnerApp 分发独立密钥且 rotatePartnerAppSecret 使旧密钥失效', async () => {
  const prefix = `partnerkey${Date.now()}`;
  await cleanupByPrefix(prefix);

  try {
    const created = await createPartnerApp({
      name: `${prefix} partner`,
      appKeyPrefix: prefix,
      allowedProducts: [{ productCode: 'gpt', memberType: 'plus' }],
    });
    const rawBody = JSON.stringify({ externalOrderNo: `${prefix}-ORDER` });
    const path = '/api/partner/upgrade/verify-order';
    const firstAuth = signedHeaders({
      appKey: created.app.appKey,
      secret: created.appSecret,
      method: 'POST',
      path,
      rawBody,
      nonce: `${prefix}-before-rotate`,
    });

    const auth = await authenticatePartnerRequest({
      method: 'POST',
      path,
      headers: firstAuth.headers,
      rawBody,
    });
    assert.equal(auth.app.appKey, created.app.appKey);

    const rotated = await rotatePartnerAppSecret(created.app.id);
    const oldSecretHeaders = signedHeaders({
      appKey: created.app.appKey,
      secret: created.appSecret,
      method: 'POST',
      path,
      rawBody,
      nonce: `${prefix}-old-secret`,
    });
    const newSecretHeaders = signedHeaders({
      appKey: created.app.appKey,
      secret: rotated.appSecret,
      method: 'POST',
      path,
      rawBody,
      nonce: `${prefix}-new-secret`,
    });

    await assert.rejects(
      () =>
        authenticatePartnerRequest({
          method: 'POST',
          path,
          headers: oldSecretHeaders.headers,
          rawBody,
        }),
      /请求签名无效/
    );

    const rotatedAuth = await authenticatePartnerRequest({
      method: 'POST',
      path,
      headers: newSecretHeaders.headers,
      rawBody,
    });
    assert.equal(rotatedAuth.app.appKey, created.app.appKey);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('verifyPartnerOrder 拒绝未显式配置的 partner 商品', async () => {
  const prefix = `partnerproduct${Date.now()}`;
  await cleanupByPrefix(prefix);
  const [app] = await db()
    .insert(upgradePartnerApp)
    .values({
      id: uid(`${prefix}_app`),
      appKey: `${prefix}_app_key`,
      appSecret: `${prefix}_app_secret`,
      name: `${prefix} partner`,
      status: 'active',
      allowedProducts: null,
    })
    .returning();

  try {
    await assert.rejects(
      () =>
        verifyPartnerOrder({
          app,
          externalOrderNo: `${prefix}-ORDER-1`,
          productCode: 'gpt',
          memberType: 'plus',
        }),
      /接入方未配置可用商品/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('verifyPartnerOrder 幂等创建外部订单到内部升级凭证的映射', async () => {
  const prefix = `partnerorder${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const externalOrderNo = `${prefix}-ORDER-1`;

  try {
    const first = await verifyPartnerOrder({
      app,
      externalOrderNo,
      productCode: 'gpt',
      memberType: 'plus',
    });
    const second = await verifyPartnerOrder({
      app,
      externalOrderNo,
      productCode: 'gpt',
      memberType: 'plus',
    });

    const [orderTotal] = await db()
      .select({ value: count() })
      .from(upgradePartnerOrder)
      .where(eq(upgradePartnerOrder.externalOrderNo, externalOrderNo));
    const [codeRow] = await db()
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.id, first.redeemCodeId));

    assert.equal(first.orderId, second.orderId);
    assert.equal(first.redeemCodeId, second.redeemCodeId);
    assert.equal(orderTotal.value, 1);
    assert.equal(codeRow.productCode, 'gpt');
    assert.equal(codeRow.memberType, 'plus');
    assert.equal(codeRow.status, 'available');
    assert.match(codeRow.code, /^GPT101-[A-F0-9]{32}$/);
    assert.equal(codeRow.code.includes(externalOrderNo), false);

    await assert.rejects(
      () =>
        verifyPartnerOrder({
          app,
          externalOrderNo,
          productCode: 'gpt',
          memberType: 'pro100',
        }),
      /订单商品不一致/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('submitPartnerUpgradeTask 复用同一外部订单任务并限制 taskNo 归属', async () => {
  const prefix = `partnersubmit${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const otherApp = await seedPartnerApp(`${prefix}other`);
  const externalOrderNo = `${prefix}-ORDER-1`;
  const sessionToken = JSON.stringify({
    user: { id: 'partner_user', email: 'partner@example.com' },
    account: { id: 'partner_account', planType: 'plus' },
    accessToken: 'partner-access-token',
  });

  try {
    await verifyPartnerOrder({
      app,
      externalOrderNo,
      productCode: 'gpt',
      memberType: 'plus',
    });

    const first = await submitPartnerUpgradeTask(
      {
        app,
        externalOrderNo,
        sessionToken,
        chatgptEmail: 'ignored@example.com',
        chatgptAccountId: 'ignored_account',
        chatgptCurrentPlan: 'free',
        clientIp: '127.0.0.1',
        userAgent: 'partner-test',
      },
      {
        accountResolver: async () => ({
          email: 'partner@example.com',
          accountId: 'partner_account',
          currentPlan: 'free',
          accessToken: 'test-access-token',
        }),
      }
    );
    const second = await submitPartnerUpgradeTask(
      {
        app,
        externalOrderNo,
        sessionToken,
        chatgptEmail: 'ignored@example.com',
        chatgptAccountId: 'ignored_account',
        chatgptCurrentPlan: 'free',
      },
      {
        accountResolver: async () => ({
          email: 'partner@example.com',
          accountId: 'partner_account',
          currentPlan: 'free',
          accessToken: 'test-access-token',
        }),
      }
    );

    const [orderRow] = await db()
      .select()
      .from(upgradePartnerOrder)
      .where(eq(upgradePartnerOrder.externalOrderNo, externalOrderNo));
    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.taskNo, first.taskNo));

    assert.equal(first.taskNo, second.taskNo);
    assert.equal(orderRow.taskId, taskRow.id);
    assert.equal(taskRow.status, UpgradeTaskStatus.PENDING);
    assert.equal(taskRow.chatgptEmail, 'partner@example.com');
    assert.deepEqual(JSON.parse(taskRow.metadata), {
      partnerAppKey: app.appKey,
      partnerOrderId: orderRow.id,
      externalOrderNo,
    });

    const visibleStatus = await queryPartnerTaskStatus({
      app,
      taskNo: first.taskNo,
    });
    const hiddenStatus = await queryPartnerTaskStatus({
      app: otherApp,
      taskNo: first.taskNo,
    });

    assert.equal(visibleStatus?.taskNo, first.taskNo);
    assert.equal(hiddenStatus, null);
  } finally {
    await cleanupByPrefix(prefix);
    await cleanupByPrefix(`${prefix}other`);
  }
});

test('submitPartnerUpgradeTask 并发提交同一外部订单时返回同一个 taskNo', async () => {
  const prefix = `partnerconcurrent${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const externalOrderNo = `${prefix}-ORDER-1`;
  const sessionToken = JSON.stringify({
    user: { id: 'partner_user', email: 'partner@example.com' },
    account: { id: 'partner_account', planType: 'plus' },
    accessToken: 'partner-access-token',
  });
  let resolverCalls = 0;
  let releaseResolver!: () => void;
  const resolverBarrier = new Promise<void>((resolve) => {
    releaseResolver = resolve;
  });
  const accountResolver = async () => {
    resolverCalls += 1;
    if (resolverCalls === 2) releaseResolver();
    await resolverBarrier;
    return {
      email: 'partner@example.com',
      accountId: 'partner_account',
      currentPlan: 'free',
      accessToken: 'test-access-token',
    };
  };

  try {
    await verifyPartnerOrder({
      app,
      externalOrderNo,
      productCode: 'gpt',
      memberType: 'plus',
    });

    const [first, second] = await Promise.all([
      submitPartnerUpgradeTask(
        {
          app,
          externalOrderNo,
          sessionToken,
          chatgptEmail: 'ignored-1@example.com',
        },
        { accountResolver }
      ),
      submitPartnerUpgradeTask(
        {
          app,
          externalOrderNo,
          sessionToken,
          chatgptEmail: 'ignored-2@example.com',
        },
        { accountResolver }
      ),
    ]);
    const [orderRow] = await db()
      .select()
      .from(upgradePartnerOrder)
      .where(eq(upgradePartnerOrder.externalOrderNo, externalOrderNo));
    const taskRows = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.redeemCodeId, orderRow.redeemCodeId));

    assert.equal(first.taskNo, second.taskNo);
    assert.equal(taskRows.length, 1);
    assert.equal(orderRow.taskId, taskRows[0].id);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('resolvePartnerAccount 不向第三方返回 accessToken', async () => {
  const prefix = `partnerresolve${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const externalOrderNo = `${prefix}-ORDER-1`;

  try {
    await verifyPartnerOrder({
      app,
      externalOrderNo,
      productCode: 'gpt',
      memberType: 'plus',
    });

    const account = await resolvePartnerAccount(
      {
        app,
        externalOrderNo,
        sessionToken: 'session-token',
      },
      {
        accountResolver: async () => ({
          email: 'partner@example.com',
          accountId: 'partner_account',
          currentPlan: 'free',
          accessToken: 'sensitive-access-token',
        }),
      }
    );

    assert.deepEqual(account, {
      email: 'partner@example.com',
      accountId: 'partner_account',
      currentPlan: 'free',
    });
    assert.equal((account as any).accessToken, undefined);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('partner verify-order route 要求签名并返回内部订单映射结果', async () => {
  const prefix = `partnerroute${Date.now()}`;
  await cleanupByPrefix(prefix);
  const app = await seedPartnerApp(prefix);
  const path = '/api/partner/upgrade/verify-order';
  const rawBody = JSON.stringify({
    externalOrderNo: `${prefix}-ORDER-1`,
    productCode: 'gpt',
    memberType: 'plus',
  });
  const { headers } = signedHeaders({
    appKey: app.appKey,
    secret: app.appSecret,
    method: 'POST',
    path,
    rawBody,
  });

  try {
    const missingAuthResponse = await verifyOrderPost(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        body: rawBody,
      })
    );
    const missingAuthPayload = await missingAuthResponse.json();
    assert.equal(missingAuthPayload.code, -1);

    const response = await verifyOrderPost(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers,
        body: rawBody,
      })
    );
    const payload = await response.json();

    assert.equal(payload.code, 0);
    assert.equal(payload.data.valid, true);
    assert.equal(payload.data.productCode, 'gpt');
    assert.equal(payload.data.memberType, 'plus');
    assert.equal(payload.data.externalOrderNo, `${prefix}-ORDER-1`);
    assert.equal(payload.data.redeemCode, undefined);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

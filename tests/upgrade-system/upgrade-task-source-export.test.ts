import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { inArray, like } from 'drizzle-orm';

import {
  redeemCode,
  redeemCodeBatch,
  upgradePartnerApp,
  upgradePartnerOrder,
  upgradeTask,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import { closePostgresDb } from '../../src/core/db/postgres';
import {
  getTaskList,
  UpgradeTaskStatus,
} from '../../src/shared/services/upgrade-task';

after(async () => {
  await closePostgresDb();
});

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeCode(prefix: string, suffix: string) {
  const body = `${prefix}${suffix}`
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(32, 'X')
    .slice(0, 32);

  return `GPT101-${body}`;
}

async function cleanupByPrefix(prefix: string) {
  const tx = db();
  const [appRows, orderRows, taskRows, batchRows, codeRows] = await Promise.all(
    [
      tx
        .select({ id: upgradePartnerApp.id })
        .from(upgradePartnerApp)
        .where(like(upgradePartnerApp.appKey, `${prefix}%`)),
      tx
        .select({ id: upgradePartnerOrder.id })
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
      tx
        .select({ id: redeemCode.id })
        .from(redeemCode)
        .where(like(redeemCode.code, `GPT101-${prefix.toUpperCase()}%`)),
    ]
  );

  const appIds = appRows.map((row: { id: string }) => row.id);
  const orderIds = orderRows.map((row: { id: string }) => row.id);
  const taskIds = taskRows.map((row: { id: string }) => row.id);
  const batchIds = batchRows.map((row: { id: string }) => row.id);
  const codeIds = codeRows.map((row: { id: string }) => row.id);

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
      .delete(upgradePartnerApp)
      .where(inArray(upgradePartnerApp.id, appIds));
  }
}

async function seedSourceTasks(prefix: string) {
  const email = `${prefix}@example.com`;
  const appId = uid(`${prefix}_app`);
  const appKey = `${prefix}_partner_app`;
  const externalOrderNo = `${prefix}-ORDER-1001`;
  const partnerBatchId = `${prefix}-partner-batch`;
  const partnerCodeId = uid(`${prefix}_partner_code`);
  const partnerCode = makeCode(prefix, 'PARTNER');
  const partnerTaskId = uid(`${prefix}_partner_task`);
  const partnerTaskNo = `${prefix}-TASK-PARTNER`;
  const partnerOrderId = uid(`${prefix}_partner_order`);
  const siteBatchId = `${prefix}-site-batch`;
  const siteCodeId = uid(`${prefix}_site_code`);
  const siteCode = makeCode(prefix, 'SITE');
  const siteTaskId = uid(`${prefix}_site_task`);
  const siteTaskNo = `${prefix}-TASK-SITE`;

  await db()
    .insert(upgradePartnerApp)
    .values({
      id: appId,
      appKey,
      appSecret: `${prefix}_secret`,
      name: `${prefix} 第三方来源`,
      status: 'active',
      allowedProducts: JSON.stringify([
        { productCode: 'gpt', memberType: 'plus' },
      ]),
    });

  await db()
    .insert(redeemCodeBatch)
    .values([
      {
        id: partnerBatchId,
        title: `${appKey}-${externalOrderNo}`,
        productCode: 'gpt',
        memberType: 'plus',
        count: 1,
        unitPrice: '0.00',
        createdBy: `partner:${appKey}`,
      },
      {
        id: siteBatchId,
        title: `${prefix} site batch`,
        productCode: 'gpt',
        memberType: 'plus',
        count: 1,
        unitPrice: '179.00',
        createdBy: 'admin',
      },
    ]);

  await db()
    .insert(redeemCode)
    .values([
      {
        id: partnerCodeId,
        batchId: partnerBatchId,
        code: partnerCode,
        productCode: 'gpt',
        memberType: 'plus',
        status: 'consumed',
        usedByTaskId: partnerTaskId,
        usedAt: new Date('2026-06-16T09:01:00.000Z'),
      },
      {
        id: siteCodeId,
        batchId: siteBatchId,
        code: siteCode,
        productCode: 'gpt',
        memberType: 'plus',
        status: 'consumed',
        usedByTaskId: siteTaskId,
        usedAt: new Date('2026-06-16T09:02:00.000Z'),
      },
    ]);

  await db()
    .insert(upgradeTask)
    .values([
      {
        id: partnerTaskId,
        taskNo: partnerTaskNo,
        redeemCodeId: partnerCodeId,
        redeemCodePlain: partnerCode,
        productCode: 'gpt',
        memberType: 'plus',
        sessionToken: '{"partner":true}',
        chatgptEmail: email,
        chatgptAccountId: `${prefix}_partner_account`,
        chatgptCurrentPlan: 'free',
        status: UpgradeTaskStatus.PENDING,
        metadata: JSON.stringify({
          partnerAppKey: appKey,
          partnerOrderId,
          externalOrderNo,
        }),
        createdAt: new Date('2026-06-16T09:01:00.000Z'),
        updatedAt: new Date('2026-06-16T09:01:00.000Z'),
      },
      {
        id: siteTaskId,
        taskNo: siteTaskNo,
        redeemCodeId: siteCodeId,
        redeemCodePlain: siteCode,
        productCode: 'gpt',
        memberType: 'plus',
        sessionToken: '{"site":true}',
        chatgptEmail: email,
        chatgptAccountId: `${prefix}_site_account`,
        chatgptCurrentPlan: 'free',
        status: UpgradeTaskStatus.PENDING,
        createdAt: new Date('2026-06-16T09:02:00.000Z'),
        updatedAt: new Date('2026-06-16T09:02:00.000Z'),
      },
    ]);

  await db().insert(upgradePartnerOrder).values({
    id: partnerOrderId,
    partnerAppId: appId,
    externalOrderNo,
    productCode: 'gpt',
    memberType: 'plus',
    redeemCodeId: partnerCodeId,
    taskId: partnerTaskId,
    status: 'submitted',
  });

  return {
    appKey,
    email,
    externalOrderNo,
    partnerTaskNo,
    siteCode,
    siteTaskNo,
  };
}

test('getTaskList 支持按订单来源筛选并返回第三方来源信息', async () => {
  const prefix = `tasksource${Date.now()}`;
  await cleanupByPrefix(prefix);

  try {
    const seeded = await seedSourceTasks(prefix);
    const partnerList = await getTaskList({
      page: 1,
      pageSize: 10,
      search: seeded.email,
      sourceType: 'partner',
    });
    const siteList = await getTaskList({
      page: 1,
      pageSize: 10,
      search: seeded.email,
      sourceType: 'site',
    });
    const externalOrderList = await getTaskList({
      page: 1,
      pageSize: 10,
      search: seeded.externalOrderNo,
    });

    assert.deepEqual(
      partnerList.items.map((item: any) => item.taskNo),
      [seeded.partnerTaskNo]
    );
    assert.equal((partnerList.items[0] as any).sourceType, 'partner');
    assert.equal(
      (partnerList.items[0] as any).partnerAppName,
      `${prefix} 第三方来源`
    );
    assert.equal((partnerList.items[0] as any).partnerAppKey, seeded.appKey);
    assert.equal(
      (partnerList.items[0] as any).externalOrderNo,
      seeded.externalOrderNo
    );
    assert.deepEqual(
      siteList.items.map((item: any) => item.taskNo),
      [seeded.siteTaskNo]
    );
    assert.equal((siteList.items[0] as any).sourceType, 'site');
    assert.deepEqual(
      externalOrderList.items.map((item: any) => item.taskNo),
      [seeded.partnerTaskNo]
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('导出升级结果 CSV 包含订单来源和外部订单号流水号', async () => {
  const prefix = `taskexport${Date.now()}`;
  await cleanupByPrefix(prefix);

  try {
    const seeded = await seedSourceTasks(prefix);
    const upgradeTaskModule = await import(
      '../../src/shared/services/upgrade-task'
    );
    const exportTaskListToCsv = (upgradeTaskModule as any).exportTaskListToCsv;

    assert.equal(typeof exportTaskListToCsv, 'function');

    const csv = await exportTaskListToCsv({
      search: seeded.email,
      sourceType: 'partner',
    });

    assert.match(csv, /订单来源/);
    assert.match(csv, /第三方来源/);
    assert.match(csv, /外部订单号\/流水号/);
    assert.doesNotMatch(csv, /接入方式/);
    assert.doesNotMatch(csv, /API接入/);
    assert.match(csv, new RegExp(seeded.externalOrderNo));
    assert.match(csv, new RegExp(`${prefix} 第三方来源`));
    assert.doesNotMatch(csv, new RegExp(seeded.siteCode));
  } finally {
    await cleanupByPrefix(prefix);
  }
});

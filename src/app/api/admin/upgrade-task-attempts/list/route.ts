import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { PERMISSIONS, requirePermission } from '@/core/rbac';
import {
  channelCardkey,
  upgradeChannel,
  upgradeTask,
  upgradeTaskAttempt,
} from '@/config/db/schema';
import { respData, respErr } from '@/shared/lib/resp';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 30;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) conditions.push(eq(upgradeTaskAttempt.status, status));
    if (search) {
      // 搜索任务编号或本站卡密：先查 taskId
      conditions.push(
        sql`${upgradeTaskAttempt.taskId} IN (SELECT id FROM upgrade_task WHERE task_no = ${search} OR redeem_code_plain = ${search})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db()
      .select({
        id: upgradeTaskAttempt.id,
        taskId: upgradeTaskAttempt.taskId,
        channelId: upgradeTaskAttempt.channelId,
        channelCardkeyId: upgradeTaskAttempt.channelCardkeyId,
        attemptNo: upgradeTaskAttempt.attemptNo,
        status: upgradeTaskAttempt.status,
        errorMessage: upgradeTaskAttempt.errorMessage,
        durationMs: upgradeTaskAttempt.durationMs,
        startedAt: upgradeTaskAttempt.startedAt,
        finishedAt: upgradeTaskAttempt.finishedAt,
      })
      .from(upgradeTaskAttempt)
      .where(where)
      .orderBy(desc(upgradeTaskAttempt.startedAt))
      .limit(pageSize)
      .offset(offset);

    const [{ total }] = await db()
      .select({ total: count() })
      .from(upgradeTaskAttempt)
      .where(where);

    // 批量补充 taskNo、本站卡密和 channelName
    const taskIds = [
      ...new Set(items.map((i: { taskId: string }) => i.taskId)),
    ];
    const channelIds = [
      ...new Set(items.map((i: { channelId: string }) => i.channelId)),
    ];

    const taskMap = new Map<
      string,
      { taskNo: string; redeemCodePlain: string }
    >();
    if (taskIds.length > 0) {
      const tasks = await db()
        .select({
          id: upgradeTask.id,
          taskNo: upgradeTask.taskNo,
          redeemCodePlain: upgradeTask.redeemCodePlain,
        })
        .from(upgradeTask)
        .where(sql`${upgradeTask.id} IN ${taskIds}`);
      tasks.forEach(
        (t: { id: string; taskNo: string; redeemCodePlain: string }) =>
          taskMap.set(t.id, {
            taskNo: t.taskNo,
            redeemCodePlain: t.redeemCodePlain,
          })
      );
    }

    const channelMap = new Map<string, string>();
    if (channelIds.length > 0) {
      const channels = await db()
        .select({ id: upgradeChannel.id, name: upgradeChannel.name })
        .from(upgradeChannel)
        .where(sql`${upgradeChannel.id} IN ${channelIds}`);
      channels.forEach((c: { id: string; name: string }) =>
        channelMap.set(c.id, c.name)
      );
    }

    // 批量补充渠道卡密
    const cardkeyIds = [
      ...new Set(
        items
          .map((i: { channelCardkeyId: string | null }) => i.channelCardkeyId)
          .filter(Boolean)
      ),
    ];
    const cardkeyMap = new Map<string, string>();
    if (cardkeyIds.length > 0) {
      const cardkeys = await db()
        .select({ id: channelCardkey.id, cardkey: channelCardkey.cardkey })
        .from(channelCardkey)
        .where(sql`${channelCardkey.id} IN ${cardkeyIds}`);
      cardkeys.forEach((c: { id: string; cardkey: string }) =>
        cardkeyMap.set(c.id, c.cardkey)
      );
    }

    const enriched = items.map(
      (i: {
        taskId: string;
        channelId: string;
        channelCardkeyId: string | null;
      }) => {
        const taskInfo = taskMap.get(i.taskId);

        return {
          ...i,
          taskNo: taskInfo?.taskNo || '',
          redeemCodePlain: taskInfo?.redeemCodePlain || '',
          channelName: channelMap.get(i.channelId) || '',
          channelCardkeyValue: i.channelCardkeyId
            ? cardkeyMap.get(i.channelCardkeyId) || ''
            : '',
        };
      }
    );

    return respData({ items: enriched, total });
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}

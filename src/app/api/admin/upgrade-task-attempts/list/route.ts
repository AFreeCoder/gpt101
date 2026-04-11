import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { upgradeTaskAttempt, upgradeTask, upgradeChannel } from '@/config/db/schema';
import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';

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
      // 搜索任务编号：先查 taskId
      conditions.push(
        sql`${upgradeTaskAttempt.taskId} IN (SELECT id FROM upgrade_task WHERE task_no = ${search})`
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

    // 批量补充 taskNo 和 channelName
    const taskIds = [...new Set(items.map((i) => i.taskId))];
    const channelIds = [...new Set(items.map((i) => i.channelId))];

    const taskMap = new Map<string, string>();
    if (taskIds.length > 0) {
      const tasks = await db()
        .select({ id: upgradeTask.id, taskNo: upgradeTask.taskNo })
        .from(upgradeTask)
        .where(sql`${upgradeTask.id} IN ${taskIds}`);
      tasks.forEach((t) => taskMap.set(t.id, t.taskNo));
    }

    const channelMap = new Map<string, string>();
    if (channelIds.length > 0) {
      const channels = await db()
        .select({ id: upgradeChannel.id, name: upgradeChannel.name })
        .from(upgradeChannel)
        .where(sql`${upgradeChannel.id} IN ${channelIds}`);
      channels.forEach((c) => channelMap.set(c.id, c.name));
    }

    const enriched = items.map((i) => ({
      ...i,
      taskNo: taskMap.get(i.taskId) || '',
      channelName: channelMap.get(i.channelId) || '',
    }));

    return respData({ items: enriched, total });
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}

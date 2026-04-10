import { respData, respErr } from '@/shared/lib/resp';
import { pickAndRunTasks } from '@/shared/services/upgrade-task';

// 手动触发 worker（用户提交后立即调一次加速处理）
export async function POST(req: Request) {
  try {
    const processed = await pickAndRunTasks(5);
    return respData({ processed });
  } catch (err: any) {
    return respErr(err.message || 'Worker execution failed');
  }
}

import { respData, respErr } from '@/shared/lib/resp';
import { queryTaskStatus } from '@/shared/services/upgrade-task';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskNo: string }> }
) {
  try {
    const { taskNo } = await params;
    if (!taskNo) return respErr('缺少任务编号');

    const status = await queryTaskStatus(taskNo);
    if (!status) return respErr('任务不存在');

    return respData(status);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}

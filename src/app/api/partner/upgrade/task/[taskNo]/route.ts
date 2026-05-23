import { respData, respErr } from '@/shared/lib/resp';
import {
  authenticatePartnerGetRequest,
  queryPartnerTaskStatus,
} from '@/shared/services/partner-upgrade';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskNo: string }> }
) {
  try {
    const { taskNo } = await params;
    const { app } = await authenticatePartnerGetRequest(req);
    const status = await queryPartnerTaskStatus({ app, taskNo });

    if (!status) return respErr('任务不存在');

    return respData(status);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}

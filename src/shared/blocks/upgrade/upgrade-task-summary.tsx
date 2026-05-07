import { getProductMemberLabel } from '@/shared/lib/redeem-code';
import { formatTimestampWithoutTimeZone } from '@/shared/lib/time';

export interface UpgradeTaskSummaryData {
  taskNo: string;
  status: string;
  productCode?: string;
  memberType?: string;
  chatgptEmail?: string;
  chatgptCurrentPlan?: string | null;
  manualRequired?: boolean;
  createdAt?: string | Date | null;
  finishedAt?: string | Date | null;
}

export function UpgradeTaskSummary({ task }: { task: UpgradeTaskSummaryData }) {
  const rows = [
    ['任务编号', task.taskNo],
    ['客户邮箱', task.chatgptEmail || '-'],
    [
      '升级会员',
      task.productCode && task.memberType
        ? getProductMemberLabel(task.productCode, task.memberType)
        : '-',
    ],
    ['完成时间', formatTimestampWithoutTimeZone(task.finishedAt)],
  ].filter((row) => row[1] !== '-');

  return (
    <div className="space-y-2 rounded-lg bg-white/70 p-4 text-sm dark:bg-white/5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4">
          <span className="shrink-0 text-gray-500 dark:text-gray-400">
            {label}
          </span>
          <span className="min-w-0 text-right font-medium break-all text-gray-900 dark:text-gray-100">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

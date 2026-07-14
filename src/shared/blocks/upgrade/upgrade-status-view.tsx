'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import {
  UpgradeTaskSummary,
  type UpgradeTaskSummaryData,
} from '@/shared/blocks/upgrade/upgrade-task-summary';
import {
  CUSTOMER_SUPPORT_LABEL,
  CUSTOMER_SUPPORT_URL,
} from '@/shared/lib/customer-support';

interface TaskStatus extends UpgradeTaskSummaryData {
  taskNo: string;
  status: string;
  message: string;
  productCode: string;
  memberType: string;
  chatgptEmail: string;
  chatgptCurrentPlan?: string | null;
  manualRequired: boolean;
  createdAt: string;
  finishedAt?: string | null;
}

export type UpgradeStatusViewProps = {
  taskNo?: string;
  supportContact?: string | null;
  /** @deprecated 客服入口统一展示为“联系客服”。 */
  supportContactLabel?: string;
  failedHelpText?: string;
  /** 与 UpgradeFlow 一致：'default' / 'channel' */
  variant?: 'default' | 'channel';
};

export function UpgradeStatusView({
  taskNo: taskNoProp,
  supportContact = CUSTOMER_SUPPORT_URL,
  failedHelpText,
  variant = 'default',
}: UpgradeStatusViewProps = {}) {
  const isChannel = variant === 'channel';
  const params = useParams();
  const taskNo = taskNoProp || (params.taskNo as string);

  const [task, setTask] = useState<TaskStatus | null>(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/upgrade/task/${taskNo}`);
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        setPolling(false);
        return;
      }
      setTask(data.data);

      // 终态停止轮询
      if (['succeeded', 'failed', 'canceled'].includes(data.data.status)) {
        setPolling(false);
      }
    } catch {
      setError('网络错误');
    }
  }, [taskNo]);

  useEffect(() => {
    fetchStatus();

    if (!polling) return;

    const timer = setInterval(fetchStatus, 2000);
    // 最长轮询 2 分钟
    const timeout = setTimeout(() => {
      setPolling(false);
      clearInterval(timer);
    }, 120_000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [fetchStatus, polling]);

  const statusConfig: Record<string, { icon: string; color: string }> =
    isChannel
      ? {
          pending: { icon: '⏳', color: 'text-[#C77C12]' },
          running: { icon: '⚙️', color: 'text-[#9A3412]' },
          succeeded: { icon: '✅', color: 'text-[#8A5A12]' },
          failed: { icon: '❌', color: 'text-destructive' },
          canceled: { icon: '🚫', color: 'text-muted-foreground' },
        }
      : {
          pending: { icon: '⏳', color: 'text-yellow-600' },
          running: { icon: '⚙️', color: 'text-blue-600' },
          succeeded: { icon: '✅', color: 'text-green-600' },
          failed: { icon: '❌', color: 'text-red-600' },
          canceled: { icon: '🚫', color: 'text-gray-600' },
        };

  // channel 走 D3 语义类；default 保持原浅色样式逐字不变
  const cardCls = isChannel
    ? 'border-border bg-card'
    : 'border-gray-200 bg-white shadow-sm';
  const subtleText = isChannel ? 'text-muted-foreground' : 'text-gray-500';
  const strongText = isChannel ? 'text-foreground' : 'text-gray-700';
  const spinnerColor = isChannel ? 'border-primary' : 'border-blue-600';
  const ctaCls = isChannel
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'bg-green-600 text-white hover:bg-green-700';

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1
        className={`mb-8 text-center text-2xl font-bold ${isChannel ? 'text-foreground' : 'text-gray-900'}`}
      >
        升级进度
      </h1>

      {error && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${isChannel ? 'bg-destructive/10 text-destructive' : 'bg-red-50 text-red-600'}`}
        >
          {error}
        </div>
      )}

      {task ? (
        <div className={`rounded-xl border p-6 ${cardCls}`}>
          <div className="mb-6 text-center">
            <span className="text-4xl">
              {statusConfig[task.status]?.icon || '❓'}
            </span>
            <p
              className={`mt-3 text-lg font-semibold ${statusConfig[task.status]?.color || (isChannel ? 'text-muted-foreground' : 'text-gray-600')}`}
            >
              {task.message}
            </p>
          </div>

          <UpgradeTaskSummary task={task} />

          {polling && (
            <div
              className={`mt-4 flex items-center justify-center gap-2 text-sm ${subtleText}`}
            >
              <div
                className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${spinnerColor}`}
              />
              正在查询最新状态...
            </div>
          )}

          {task.status === 'failed' && failedHelpText && (
            <div className={`mt-4 text-center text-sm ${subtleText}`}>
              {failedHelpText}
              <span className={`font-mono ${strongText}`}>{task.taskNo}</span>
            </div>
          )}

          {task.status === 'failed' && !failedHelpText && supportContact && (
            <div className={`mt-4 text-center text-sm ${subtleText}`}>
              请
              <a
                href={supportContact}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-medium underline underline-offset-2 ${strongText}`}
              >
                {CUSTOMER_SUPPORT_LABEL}
              </a>
              ，并提供任务编号
              <span className={`font-mono ${strongText}`}>{task.taskNo}</span>
            </div>
          )}

          {task.status === 'succeeded' && (
            <div className="mt-4 text-center">
              <a
                href="https://chat.openai.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-block rounded-lg px-6 py-2 text-sm font-medium ${ctaCls} ${isChannel ? 'channel-lift' : ''}`}
              >
                前往 ChatGPT →
              </a>
            </div>
          )}
        </div>
      ) : (
        !error && (
          <div className="flex items-center justify-center py-12">
            <div
              className={`h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${spinnerColor}`}
            />
          </div>
        )
      )}
    </div>
  );
}

export default UpgradeStatusView;

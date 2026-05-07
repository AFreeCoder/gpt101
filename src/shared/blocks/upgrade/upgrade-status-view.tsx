'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import {
  UpgradeTaskSummary,
  type UpgradeTaskSummaryData,
} from '@/shared/blocks/upgrade/upgrade-task-summary';

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
  supportContactLabel?: string;
  failedHelpText?: string;
};

export function UpgradeStatusView({
  taskNo: taskNoProp,
  supportContact = 'AFreeCoder01',
  supportContactLabel = '微信',
  failedHelpText,
}: UpgradeStatusViewProps = {}) {
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

  const statusConfig: Record<string, { icon: string; color: string }> = {
    pending: { icon: '⏳', color: 'text-yellow-600' },
    running: { icon: '⚙️', color: 'text-blue-600' },
    succeeded: { icon: '✅', color: 'text-green-600' },
    failed: { icon: '❌', color: 'text-red-600' },
    canceled: { icon: '🚫', color: 'text-gray-600' },
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">
        升级进度
      </h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {task ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <span className="text-4xl">
              {statusConfig[task.status]?.icon || '❓'}
            </span>
            <p
              className={`mt-3 text-lg font-semibold ${statusConfig[task.status]?.color || 'text-gray-600'}`}
            >
              {task.message}
            </p>
          </div>

          <UpgradeTaskSummary task={task} />

          {polling && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              正在查询最新状态...
            </div>
          )}

          {task.status === 'failed' && failedHelpText && (
            <div className="mt-4 text-center text-sm text-gray-500">
              {failedHelpText}
              <span className="font-mono text-gray-700">{task.taskNo}</span>
            </div>
          )}

          {task.status === 'failed' && !failedHelpText && supportContact && (
            <div className="mt-4 text-center text-sm text-gray-500">
              请联系客服{supportContactLabel}：
              <span className="font-medium text-gray-700">
                {supportContact}
              </span>
              ，提供任务编号
              <span className="font-mono text-gray-700">{task.taskNo}</span>
            </div>
          )}

          {task.status === 'succeeded' && (
            <div className="mt-4 text-center">
              <a
                href="https://chat.openai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                前往 ChatGPT →
              </a>
            </div>
          )}
        </div>
      ) : (
        !error && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )
      )}
    </div>
  );
}

export default UpgradeStatusView;

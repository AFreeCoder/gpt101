/**
 * GPT101 Upgrade Worker
 *
 * 独立 Node.js 进程，定时从数据库拉取 pending 的升级任务并执行。
 * Docker 中用同一镜像、不同入口启动：node worker.js
 *
 * 使用方式：
 *   npx tsx worker.ts        # 开发环境
 *   node worker.js           # 生产环境（需先 build）
 */

// 注册所有 adapter（在 runner 被调用前）
import './src/extensions/upgrade-channel/adapters/mock';

import { pickAndRunTasks } from './src/shared/services/upgrade-task';

const POLL_INTERVAL_MS = 30_000; // 30 秒
const MAX_TASKS_PER_TICK = 5;

let running = true;

async function tick() {
  try {
    const processed = await pickAndRunTasks(MAX_TASKS_PER_TICK);
    if (processed > 0) {
      console.log(`[worker] Processed ${processed} task(s)`);
    }
  } catch (err) {
    console.error('[worker] Error during tick:', err);
  }
}

async function main() {
  console.log('[worker] Starting upgrade worker...');
  console.log(`[worker] Poll interval: ${POLL_INTERVAL_MS}ms, max tasks per tick: ${MAX_TASKS_PER_TICK}`);

  // 立即执行一次
  await tick();

  // 定时轮询
  const timer = setInterval(async () => {
    if (!running) return;
    await tick();
  }, POLL_INTERVAL_MS);

  // 优雅退出
  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    running = false;
    clearInterval(timer);
    // 等待当前任务完成（最多 30 秒）
    setTimeout(() => {
      console.log('[worker] Force exit');
      process.exit(0);
    }, 30_000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});

import type { UpgradeChannelAdapter, UpgradeRequest } from '../types';
import { registerAdapter } from '../registry';

/**
 * Mock adapter 用于开发和测试
 * 通过环境变量 MOCK_ADAPTER_MODE 控制行为：
 *   success (默认) — 1 秒后返回成功
 *   fail_cardkey   — 模拟渠道卡密验证失败
 *   fail_token     — 模拟 Token 验证失败
 *   fail_upgrade   — 模拟升级执行失败
 *   timeout        — 模拟超时（30 秒后失败）
 */
const mockAdapter: UpgradeChannelAdapter = {
  async execute(req: UpgradeRequest) {
    const mode = process.env.MOCK_ADAPTER_MODE || 'success';

    console.log(`[mock-adapter] mode=${mode}, email=${req.chatgptEmail}, product=${req.productCode}`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    switch (mode) {
      case 'fail_cardkey':
        return {
          ok: false as const,
          retryable: false,
          message: '渠道卡密不可用: 卡密已使用或已过期',
        };

      case 'fail_token':
        return {
          ok: false as const,
          retryable: false,
          message: 'Token 验证失败: 解析Token失败: invalid token',
        };

      case 'fail_upgrade':
        return {
          ok: false as const,
          retryable: false,
          message: '升级失败: 该账号不满足升级条件',
        };

      case 'timeout':
        await new Promise((resolve) => setTimeout(resolve, 29000));
        return {
          ok: false as const,
          retryable: true,
          message: '升级超时：渠道响应超时',
        };

      default:
        return { ok: true as const, message: 'Mock upgrade succeeded' };
    }
  },
};

registerAdapter('mock', mockAdapter);

export default mockAdapter;

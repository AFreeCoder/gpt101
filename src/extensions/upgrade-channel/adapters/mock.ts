import type { UpgradeChannelAdapter, UpgradeRequest } from '../types';
import { registerAdapter } from '../registry';

/**
 * Mock adapter 用于开发和测试
 * 始终返回成功，延迟 1 秒模拟网络请求
 */
const mockAdapter: UpgradeChannelAdapter = {
  async execute(req: UpgradeRequest) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `[mock-adapter] upgrade ${req.chatgptEmail} to ${req.productCode}`,
      req.channelCardkey ? `with cardkey ${req.channelCardkey.slice(0, 6)}...` : ''
    );

    return { ok: true as const, message: 'Mock upgrade succeeded' };
  },
};

registerAdapter('mock', mockAdapter);

export default mockAdapter;

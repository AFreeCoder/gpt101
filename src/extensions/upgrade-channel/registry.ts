import type { UpgradeChannelAdapter } from './types';

const adapters = new Map<string, UpgradeChannelAdapter>();

export function registerAdapter(
  driver: string,
  adapter: UpgradeChannelAdapter
) {
  adapters.set(driver, adapter);
}

export function getAdapter(driver: string): UpgradeChannelAdapter | undefined {
  return adapters.get(driver);
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

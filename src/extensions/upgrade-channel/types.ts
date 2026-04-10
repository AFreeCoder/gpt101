export interface UpgradeRequest {
  taskId: string;
  productCode: 'plus' | 'pro' | 'team';
  sessionToken: string;
  chatgptEmail: string;
  channelCardkey?: string;
}

export type UpgradeResult =
  | { ok: true; message?: string }
  | { ok: false; retryable: boolean; message: string };

export interface UpgradeChannelAdapter {
  execute(req: UpgradeRequest): Promise<UpgradeResult>;
}

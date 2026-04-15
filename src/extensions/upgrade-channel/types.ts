export interface UpgradeRequest {
  taskId: string;
  productCode: string;
  memberType: string;
  sessionToken: string;
  chatgptEmail: string;
  channelCardkey?: string;
}

export type UpgradeFailedCardkeyAction = 'release' | 'consume' | 'disable';

export type UpgradeResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      retryable: boolean;
      message: string;
      stopFallback?: boolean;
      preserveRedeemCode?: boolean;
      cardkeyAction?: UpgradeFailedCardkeyAction;
    };

export interface UpgradeChannelAdapter {
  execute(req: UpgradeRequest): Promise<UpgradeResult>;
}

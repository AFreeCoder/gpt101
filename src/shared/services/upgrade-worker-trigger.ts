type UpgradeWorkerRunner = (maxCount: number) => Promise<unknown>;

export function queueUpgradeTaskProcessing(
  maxCount: number = 1,
  runner: UpgradeWorkerRunner
) {
  void Promise.resolve()
    .then(() => runner(maxCount))
    .catch((error) => {
      console.error('[upgrade] async worker trigger failed:', error);
    });
}

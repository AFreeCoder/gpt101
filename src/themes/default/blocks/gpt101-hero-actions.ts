import type { Button } from '@/shared/types/blocks/common';

export function getUpgradeButtonAction(button?: Button) {
  if (button?.url) {
    return {
      type: 'link' as const,
      href: button.url,
    };
  }

  return {
    type: 'modal' as const,
    href: null,
  };
}

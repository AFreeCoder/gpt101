/**
 * Google Ads 转化追踪工具
 *
 * 参考 Google Ads 官方推荐的转化代码片段，
 * 在用户点击出站购买链接时发送 conversion 事件。
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * 确保 gtag 函数存在（即使脚本尚未加载也能入队）
 */
function ensureGtag() {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: any[]) => {
      window.dataLayer!.push(args);
    };
  }
}

/**
 * Google Ads 转化 send_to 值
 * 格式: AW-XXXXXXXXX/YYYYYYY
 */
const CONVERSION_SEND_TO =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO || '';

/**
 * 发送 Google Ads 转化事件
 *
 * 对应 Google Ads 官方推荐的 gtag_report_conversion 模式：
 * gtag('event', 'conversion', { send_to: 'AW-xxx/yyy', event_callback: cb })
 *
 * @param url - 出站链接 URL（用于 callback 跳转，当前场景由调用方处理跳转）
 * @param callback - 事件发送完成后的回调
 */
export function sendOutboundClick(
  url: string,
  _label?: string,
  callback?: () => void,
) {
  ensureGtag();
  if (!window.gtag || !CONVERSION_SEND_TO) {
    callback?.();
    return;
  }

  let called = false;
  const safeCallback = () => {
    if (called) return;
    called = true;
    callback?.();
  };

  // 发送 Google Ads 转化事件
  window.gtag('event', 'conversion', {
    send_to: CONVERSION_SEND_TO,
    event_callback: safeCallback,
  });

  // 兜底：确保回调一定执行，避免阻塞用户操作
  setTimeout(safeCallback, 1000);
}

/**
 * Google Ads / Analytics 事件追踪工具
 *
 * 迁移自旧 Astro 站点 src/pages/lp/g/upgrade-chatgpt.astro 的 initOutboundTracking 逻辑。
 * 用于在用户点击出站购买链接时，向 Google Ads 发送转化事件。
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
 * 发送出站链接点击事件（含转化追踪）
 *
 * 1. 发送 Google Ads conversion 事件（如果配置了 send_to）
 * 2. 发送自定义 instant_upgrade_gpt_click 事件
 * 3. 使用 beacon 传输确保页面跳转前数据发送成功
 *
 * @param url - 出站链接 URL
 * @param label - 事件标签（默认使用 URL）
 * @param callback - 事件发送完成后的回调
 */
export function sendOutboundClick(
  url: string,
  label?: string,
  callback?: () => void
) {
  ensureGtag();
  if (!window.gtag) {
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
  if (CONVERSION_SEND_TO) {
    window.gtag('event', 'conversion', {
      send_to: CONVERSION_SEND_TO,
      transport_type: 'beacon',
      event_callback: safeCallback,
      event_timeout: 400,
    });
  }

  // 发送自定义出站点击事件
  window.gtag('event', 'instant_upgrade_gpt_click', {
    event_category: 'outbound',
    event_label: label || url,
    value: 1,
    transport_type: 'beacon',
    event_callback: safeCallback,
    event_timeout: 400,
  });

  // 兜底：确保回调一定执行，避免阻塞用户操作
  setTimeout(safeCallback, 450);
}

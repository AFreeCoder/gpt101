import { ReactNode } from 'react';
import Script from 'next/script';

import { AnalyticsConfigs, AnalyticsProvider } from '.';

/**
 * Google Ads 配置
 */
export interface GoogleAdsConfigs extends AnalyticsConfigs {
  adsId: string; // Google Ads ID，格式: AW-XXXXXXXXXX
}

/**
 * Google Ads 分析提供商
 * 用于转化跟踪和再营销
 */
export class GoogleAdsProvider implements AnalyticsProvider {
  readonly name = 'google-ads';

  configs: GoogleAdsConfigs;

  constructor(configs: GoogleAdsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    // Google Ads 转化跟踪不需要 gtag('config', 'AW-xxx')，
    // 只通过 send_to 参数显式发送 conversion 事件即可。
    // 如果注册了 config，会导致 conversion 事件被全局目标和 send_to 各处理一次（重复）。
    // gtag/js 脚本由 GoogleAnalyticsProvider 加载；若未配置 GA，此处兜底加载。
    return (
      <Script
        id={this.name}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
              var s = document.createElement('script');
              s.src = 'https://www.googletagmanager.com/gtag/js?id=${this.configs.adsId}';
              s.async = true;
              document.head.appendChild(s);
              gtag('js', new Date());
            }
          `,
        }}
      />
    );
  }
}

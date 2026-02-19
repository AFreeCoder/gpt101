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
    // 运行时检测 gtag/js 是否已被其他 provider（如 GA）加载，
    // 未加载时自行加载，避免重复加载导致转化事件被处理两次。
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
            gtag('config', '${this.configs.adsId}');
          `,
        }}
      />
    );
  }
}

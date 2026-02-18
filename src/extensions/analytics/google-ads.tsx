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
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${this.configs.adsId}`}
          strategy="afterInteractive"
          async
        />
        <Script
          id={this.name}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${this.configs.adsId}');
            `,
          }}
        />
      </>
    );
  }
}

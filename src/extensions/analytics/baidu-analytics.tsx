import { ReactNode, Suspense } from 'react';
import Script from 'next/script';

import { AnalyticsConfigs, AnalyticsProvider } from '.';
import { BaiduPageviewTracker } from './baidu-pageview-tracker';

/**
 * 百度统计配置
 */
export interface BaiduAnalyticsConfigs extends AnalyticsConfigs {
  baiduId: string; // 百度统计站点 ID
}

/**
 * 百度统计分析提供商
 * @website https://tongji.baidu.com/
 */
export class BaiduAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'baidu-analytics';

  configs: BaiduAnalyticsConfigs;

  constructor(configs: BaiduAnalyticsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    const baiduId = JSON.stringify(this.configs.baiduId);

    return (
      <Script
        id={this.name}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            var _hmt = _hmt || [];
            (function() {
              var hm = document.createElement("script");
              hm.src = "https://hm.baidu.com/hm.js?" + ${baiduId};
              var s = document.getElementsByTagName("script")[0];
              s.parentNode.insertBefore(hm, s);
            })();
          `,
        }}
      />
    );
  }

  getBodyScripts(): ReactNode {
    return (
      <Suspense fallback={null}>
        <BaiduPageviewTracker />
      </Suspense>
    );
  }
}

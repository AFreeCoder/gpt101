// 站点配置文件 - 按页面组织的可配置内容
export const siteConfig = {
  // 首页配置
  homepage: {
    links: {
      cardPurchase: 'https://yk.dtyuedan.cn//liebiao/9B8CF6155C962D6B',       // 卡密购买
      immediateUpgrade: '/chatgpt-plus-maintenance',   // 立即升级 - 维护页面
      orderQuery: 'https://yk.dtyuedan.cn/orderquery',                                // 卡密订单查询
      mirrorExperience: '/chatgpt-mirror',                          // 镜像服务体验
    },
    buttons: {
      cardPurchase: '卡密购买',
      immediateUpgrade: '立即升级',
      orderQuery: '卡密订单查询',
      mirrorExperience: '立刻体验',
    },
  },

  // 镜像服务页配置
  mirrorPage: {
    links: {
      purchase: 'https://yk.dtyuedan.cn//liebiao/B6A99FB56CE7A1B7',           // 立即购买
      query: 'https://yk.dtyuedan.cn/orderquery',                                          // 订单查询
      plusRecharge: '/',                                            // Plus代充
      useNow: 'https://gpt.dtyuedan.cn',                            // 立刻使用
    },
    buttons: {
      purchase: '卡密购买',
      query: '订单查询',
      plusRecharge: 'Plus代充',
      useNow: '立刻使用',
    },
  },

  // 导航配置
  navigation: {
    links: {
      home: '/',
      mirror: '/chatgpt-mirror',
      blog: '/tutorials',
      customerSupport: '/#customer-support',
    },
    buttons: {
      customerSupport: '客服支持',
      comparison: '功能演示',
    },
  },

  // 外部服务链接
  external: {
    chatgptStatus: 'https://status.openai.com/',
  },

  // 价格配置（预留扩展）
  pricing: {
    mirror: {
      daily: 5,
      weekly: 25,
      monthly: 58,
    },
    plus: {
      monthly: 144,
    },
  },

  // 联系信息配置（预留扩展）
  contact: {
    qq: '2316149029',
  },

  // 网站基本信息配置（预留扩展）
  site: {
    name: 'ChatGPT 一站式服务',
    description: '专业可靠的ChatGPT服务提供商',
    domain: 'gpt101.org', // 预留域名配置
  },
} as const;

// 类型定义（确保类型安全）
export type SiteConfig = typeof siteConfig;
export type HomepageConfig = typeof siteConfig.homepage;
export type MirrorPageConfig = typeof siteConfig.mirrorPage;
export type NavigationConfig = typeof siteConfig.navigation;
export type PricingConfig = typeof siteConfig.pricing;
// 站点配置文件 - 按页面组织的可配置内容
export const siteConfig = {
  // 首页配置
  homepage: {
    links: {
      cardPurchase: 'https://fe.dtyuedan.cn/shop/F2OLER91/g2kxdj', // 卡密购买
      // cardPurchase: '/chatgpt-plus-maintenance', // 卡密购买
      immediateUpgrade: 'https://gptplus.biz/recharge', // 立即升级 - 维护页面
      orderQuery: 'https://fe.dtyuedan.cn/order', // 卡密订单查询
      mirrorExperience: '/chatgpt-mirror', // 镜像服务体验
    },
    buttons: {
      cardPurchase: '卡密购买',
      immediateUpgrade: '立即升级',
      orderQuery: '卡密订单查询',
      mirrorExperience: '立刻体验',
    },
    // 购买渠道配置 - 用于"立即升级"弹窗
    purchaseChannels: [
      {
        id: 1,
        label: '【推荐1】ChatGPT官网会员自动充值',
        url: 'https://gptplus.biz/recharge',
        color: 'from-blue-500 to-blue-500',
        description: '',
      },
      {
        id: 2,
        label: '【推荐2】ChatGPT官网会员自动充值',
        url: 'https://gptplus.biz/recharge',
        color: 'from-blue-500 to-blue-500',
        description: '',
      },
      // {
      //   id: 3,
      //   label: '【推荐3】ChatGPT官网会员自动充值',
      //   url: 'https://gptoline.com/',
      //   color: 'from-blue-500 to-blue-500',
      //   description: '',
      // },
      // {
      //   id: 4,
      //   label: '【推荐4】ChatGPT官网会员自动充值',
      //   url: 'https://gpt.plus-app.site/',
      //   color: 'from-blue-500 to-blue-500',
      //   description: '',
      // },
      {
        id: 5,
        label: '【备用】ChatGPT官网会员自动充值',
        url: '',
        color: 'from-blue-500 to-blue-500',
        description: '该渠道为备用渠道，购买完后请联系客服QQ:2316149029',
      },
    ],
  },

  // 镜像服务页配置
  mirrorPage: {
    links: {
      purchase: 'https://fe.dtyuedan.cn/shop/F2OLER91/3fptbk', // 立即购买
      // purchase: '/chatgpt-plus-maintenance', // 卡密购买
      query: 'https://fe.dtyuedan.cn/order', // 订单查询
      plusRecharge: '/', // Plus代充
      useNow: 'https://chatshare.biz', // 立刻使用
    },
    buttons: {
      purchase: '购买',
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

  // 公告栏配置
  announcements: [
    {
      id: 1,
      text: '通知：受苹果风控影响，成本大涨，近期价格有较大波动，后续成本下降后，价格会逐步下降，请关注本站公告～',
      link: '', // 可选：点击公告跳转的链接
    },
  ],

  // 统计分析配置
  analytics: {
    // 谷歌统计 (Google Analytics 4)
    google: {
      id: 'G-KPY9887M4F', // 格式: G-XXXXXXXXXX 或 GA-XXXXXXXXXX
      enabled: true, // 启用/禁用谷歌统计
    },
    // 百度统计
    baidu: {
      id: '35999906c23d844610453823877173a8', // 百度统计站点ID
      enabled: true, // 启用/禁用百度统计
    },
  },
} as const;

// 类型定义（确保类型安全）
export type SiteConfig = typeof siteConfig;
export type HomepageConfig = typeof siteConfig.homepage;
export type MirrorPageConfig = typeof siteConfig.mirrorPage;
export type NavigationConfig = typeof siteConfig.navigation;
export type PricingConfig = typeof siteConfig.pricing;

// 站点配置文件 - 按页面组织的可配置内容
export const siteConfig = {
  // 首页配置
  homepage: {
    // Hero Section 文案
    hero: {
      title: {
        gradient: '一站式 ChatGPT', // 渐变色部分
        normal: '充值服务', // 普通色部分
      },
      subtitle: 'Plus / Pro / Team 全支持，微信支付宝秒到账，无需信用卡',
    },
    links: {
      cardPurchase: '/qf-dtyuedan-buy', // 卡密购买入口（站内跳转）
      cardPurchaseEmbed: 'https://fe.dtyuedan.cn/shop/F2OLER91/g2kxdj', // 站内 iframe 嵌入的实际地址
      orderQuery: 'https://fe.dtyuedan.cn/order', // 卡密订单查询
      upgradeXiaobeiEmbed: 'https://gptget.pro/',
      upgrade987aiEmbed: 'https://www.987ai.vip/recharge',
      mirrorExperience: '/chatgpt-mirror', // 镜像服务体验
      tutorial: '/how-to-upgrade-gpt-plus', // 使用教程
      survey: 'https://f.kdocs.cn/g/Y2b8l5Fu/', // 问卷调查（需要替换为实际链接）
    },
    buttons: {
      cardPurchase: '购买',
      immediateUpgrade: '立即升级',
      orderQuery: '订单查询',
      mirrorExperience: '立刻体验',
      tutorial: '使用教程',
      survey: '填写问卷领5元优惠',
    },
    // 核心卖点配置（避免与副标题重复）
    features: [
      { text: '无需海外信用卡', icon: 'check' },
      { text: '微信/支付宝', icon: 'check' },
      { text: '1分钟到账', icon: 'check' },
      { text: '正规渠道', icon: 'check' },
      { text: '支持开票', icon: 'check' },
      { text: '失败退款', icon: 'check' },
    ],
    // 购买渠道配置 - 用于"立即升级"弹窗
    purchaseChannels: [
      {
        id: 1,
        label: '【推荐1】ChatGPT官网会员自助充值(充你的号)',
        url: '/gpt-upgrade-987ai',
        embedTarget: 'https://www.987ai.vip/recharge',
        color: 'from-blue-500 to-blue-500',
        description: '站内跳转独立页面下单，若无法加载请改用其他渠道',
      },
      {
        id: 2,
        label: '【推荐2】ChatGPT官网会员自助充值(充你的号)',
        url: '/gpt-upgrade-xiaobei',
        embedTarget: 'https://gptget.pro/',
        color: 'from-blue-500 to-blue-500',
        description: '站内跳转独立页面下单，若无法加载请改用其他渠道',
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
        label: '【备用】ChatGPT官网会员充值(充你的号)',
        url: '',
        embedTarget: '',
        color: 'from-blue-500 to-blue-500',
        description: '购买完后请联系客服QQ:2316149029',
      },
      {
        id: 6,
        label: '【Pro充值】ChatGPT Pro 会员充值(充你的号)',
        url: '',
        embedTarget: '',
        color: 'from-blue-500 to-blue-500',
        description: '请联系客服QQ:2316149029 充值',
      },
    ],
  },

  // 镜像服务页配置
  mirrorPage: {
    links: {
      purchase: '/qf-dtyuedan-mirror-buy', // 立即购买入口（站内跳转）
      purchaseEmbed: 'https://fe.dtyuedan.cn/shop/F2OLER91/3fptbk', // 站内 iframe 嵌入的实际地址
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

  // 联系信息配置
  contact: {
    qq: '2316149029',
    // 客服卡片配置
    customerService: {
      title: '在线QQ客服',
      subtitle: '有任何请联系客服',
      qrCode: {
        path: '/qq-qrcode.png', // QQ二维码图片路径（相对于public目录）
        label: '扫码添加客服QQ',
      },
      qqNumber: {
        label: '客服QQ号',
      },
      serviceTime: {
        title: '在线时间：9:00 ~ 23:00',
      },
      toast: {
        successMessage: '已复制到剪贴板',
      },
    },
  },

  // 网站基本信息配置（预留扩展）
  site: {
    name: 'ChatGPT 一站式服务',
    description: '专业可靠的ChatGPT服务提供商',
    domain: 'gpt101.org', // 预留域名配置
  },

  // 公告栏配置
  announcements: [
    // {
    //   id: 1,
    //   text: '通知：受礼品卡限额影响，成本大涨，近期价格有较大波动，实在抱歉，后续成本下降后，价格会逐步下降，请关注本站公告～',
    //   link: '', // 可选：点击公告跳转的链接
    // },
  ] as Array<{ id: number | string; text: string; link?: string }>,

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

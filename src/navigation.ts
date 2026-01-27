import { getPermalink, getBlogPermalink } from './utils/permalinks';
import { siteConfig } from './config/site';

export const headerData = {
  links: [
    {
      text: '首页',
      href: getPermalink(siteConfig.navigation.links.home),
    },
    {
      text: '镜像服务',
      href: getPermalink(siteConfig.navigation.links.mirror),
    },
    {
      text: '教程中心',
      href: getPermalink(siteConfig.navigation.links.blog),
    },
    {
      text: '客服支持',
      href: getPermalink(siteConfig.navigation.links.customerSupport),
    },
  ],
  actions: [],
};

export const footerData = {
  links: [
    {
      title: '服务',
      links: [
        { text: 'GPT Plus 代充', href: getPermalink(siteConfig.navigation.links.home) },
        { text: 'GPT 镜像服务', href: getPermalink(siteConfig.navigation.links.mirror) },
      ],
    },
    {
      title: '支持',
      links: [
        { text: '服务条款', href: getPermalink('/terms') },
        { text: '隐私政策', href: getPermalink('/privacy') },
      ],
    },
    {
      title: '教程',
      links: [
        { text: 'GPT Plus 充值教程', href: getPermalink('/how-to-upgrade-gpt-plus') },
        { text: '镜像服务使用指南', href: getPermalink('/chatgpt-mirror-guide') },
        { text: '充值避坑指南', href: getPermalink('/2025-latest-7-way-to-upgrade-chatgpt-plus') },
        { text: '更多教程', href: getBlogPermalink() },
      ],
    },
    {
      title: '联系我们',
      links: [
        { text: '客服QQ: 2316149029', href: 'https://wpa.qq.com/msgrd?v=3&uin=2316149029&site=qq&menu=yes' },
        { text: '邮箱: support@gpt101.org', href: 'mailto:support@gpt101.org' },
      ],
    },
  ],
  secondaryLinks: [
    { text: '服务条款', href: getPermalink('/terms') },
    { text: '隐私政策', href: getPermalink('/privacy') },
  ],
  socialLinks: [],
  footNote: `
    © 2025 GPT101 · 稳定运营2年+ · 客服在线时间 9:00-23:00
  `,
};

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
      text: '教程',
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
        { text: 'ChatGPT Plus代充', href: getPermalink(siteConfig.navigation.links.home) },
        { text: 'ChatGPT镜像服务', href: getPermalink(siteConfig.navigation.links.mirror) },
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
        { text: 'ChatGPT使用指南', href: getBlogPermalink() },
        { text: 'Plus会员教程', href: getBlogPermalink() },
        { text: '更多教程', href: getBlogPermalink() },
      ],
    },
    {
      title: '联系',
      links: [
        { text: '客服QQ: 2316149029' },
      ],
    },
  ],
  secondaryLinks: [
    { text: '服务条款', href: getPermalink('/terms') },
    { text: '隐私政策', href: getPermalink('/privacy') },
  ],
  socialLinks: [],
  footNote: `
    © 2025 ChatGPT 一站式服务 · 专业可靠的ChatGPT服务提供商
  `,
};

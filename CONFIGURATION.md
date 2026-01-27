# 站点配置说明

## 概述

本项目采用集中式配置管理，所有可配置内容都统一在 `src/config/site.ts` 文件中管理。这种设计确保了配置的一致性、可维护性和未来的可扩展性。

## 配置文件位置

```
src/config/site.ts
```

## 当前已配置化的元素

### 1. 链接配置 (`siteConfig.links`)

#### 主要服务链接

- `mirrorService.purchase`: 镜像服务购买链接
- `mirrorService.query`: 镜像服务订单查询链接

#### Plus代充链接

- `plusRecharge.main`: Plus代充主页链接

#### 导航链接

- `navigation.home`: 首页链接
- `navigation.mirror`: 镜像服务页面链接
- `navigation.blog`: 博客/教程链接
- `navigation.customerSupport`: 客服支持链接

#### 外部服务链接

- `external.chatgptStatus`: ChatGPT状态页面链接

### 2. 按钮文案配置 (`siteConfig.buttons`)

- `purchase`: 购买按钮文案
- `query`: 查询按钮文案
- `experience`: 体验按钮文案
- `plusRecharge`: Plus代充按钮文案
- `customerSupport`: 客服支持按钮文案
- `comparison`: 功能对比按钮文案

## 使用方法

### 在页面中使用配置

```astro
---
import { siteConfig } from '~/config/site';
---

<!-- 使用配置的链接 -->
<a href={siteConfig.links.mirrorService.purchase}>
  {siteConfig.buttons.purchase}
</a>
```

### 修改配置

1. 打开 `src/config/site.ts`
2. 修改对应的配置项
3. 保存文件，更改会自动应用到所有引用该配置的页面

## 已应用配置化的页面

### 1. 首页 (`src/pages/index.astro`)

- Plus代充相关按钮链接
- 镜像服务跳转链接

### 2. 镜像服务页 (`src/pages/chatgpt-mirror.astro`)

- 购买按钮链接和文案
- 订单查询按钮链接和文案
- Plus代充跳转链接和文案

### 3. 导航菜单 (`src/navigation.ts`)

- 主导航链接
- 页脚链接

## 预留的扩展配置

配置文件已为未来功能预留了扩展空间：

### 价格配置 (`siteConfig.pricing`)

```typescript
pricing: {
  mirror: {
    daily: 5,
    weekly: 25,
    monthly: 58,
  },
  plus: {
    monthly: 144,
  },
}
```

### 联系信息配置 (`siteConfig.contact`)

```typescript
contact: {
  qq: '2316149029',
}
```

### 网站基本信息配置 (`siteConfig.site`)

```typescript
site: {
  name: 'GPT101',
  description: '一站式 GPT 充值服务',
  domain: 'gpt101.org',
}
```

## 类型安全

配置文件使用 TypeScript 编写，提供了完整的类型定义：

```typescript
export type SiteConfig = typeof siteConfig;
export type LinkConfig = typeof siteConfig.links;
export type ButtonConfig = typeof siteConfig.buttons;
export type PricingConfig = typeof siteConfig.pricing;
```

这确保了在使用配置时的类型安全和IDE智能提示。

## 最佳实践

1. **集中管理**: 所有配置都在一个文件中，便于维护
2. **类型安全**: 使用 TypeScript 确保配置的正确性
3. **语义化命名**: 配置项名称清晰表达其用途
4. **分类组织**: 按功能模块组织配置项
5. **预留扩展**: 为未来功能预留配置空间

## 扩展指南

当需要添加新的配置项时：

1. 在 `siteConfig` 对象中添加新的配置项
2. 遵循现有的命名和组织模式
3. 更新相关的类型定义
4. 在需要的页面中导入并使用配置
5. 更新本文档说明

这种配置系统为项目的长期维护和功能扩展提供了坚实的基础。

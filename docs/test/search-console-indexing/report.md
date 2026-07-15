# Search Console 索引治理测试报告

日期：2026-07-15
环境：macOS，本地 Next.js 16.2.9，Node 测试串行执行

## 自动化结果

| 检查                | 结果   | 说明                                                                              |
| ------------------- | ------ | --------------------------------------------------------------------------------- |
| SEO 定向测试        | 通过   | 17/17，通过 robots、sitemap、canonical、hreflang、教程路由和工具页策略断言        |
| 完整测试            | 通过   | 244 项：205 通过、39 跳过、0 失败                                                 |
| TypeScript          | 通过   | `pnpm exec tsc --noEmit`                                                          |
| ESLint              | 通过   | 0 错误、0 warning                                                                 |
| 改动格式检查        | 通过   | 新增代码、测试和过程文档通过 Prettier；两个历史 JSON 保持原格式，避免无关重排     |
| 全仓格式基线        | 未全绿 | `pnpm format:check` 仍报告多项既有文件格式问题，本次未批量改写无关文件            |
| 默认配置生产构建    | 通过   | `pnpm build`                                                                      |
| Docker 等价环境验收 | 通过   | 默认配置构建后，以生产域名和中文默认语言启动，确认 sitemap 在运行时读取中文配置   |
| 构建外部资源依赖    | 已复核 | 一次重建因教程 OSS 图片尺寸探测连接超时失败；三个资源随后均返回 200，重试构建通过 |

## HTTP 生产模式验收

本地以生产域名和中文默认语言启动构建产物，并模拟反向代理头：

| URL                                     | 验收结果                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `/robots.txt`                           | 政策页不再被禁止；后台、设置、活动和 API 仍被禁止                                  |
| `/sitemap.xml`                          | 15 个规范 URL；双语公开页包含成对语言链接，教程仅中文；无 noindex 页和动态当前时间 |
| `/`                                     | `index, follow`，canonical 为 `https://gpt101.org/`，HTML 无手工全局 hreflang      |
| `/faq`                                  | 200；HTTP `Link` 正确声明 `/en/faq` 与 `/faq`                                      |
| `/privacy-policy`                       | 200；`index, follow`；canonical 自引用                                             |
| `/en/chatgpt-mirror`                    | 200；英文标题和描述；canonical 自引用                                              |
| `/upgrade?source=home`                  | 200；`noindex, nofollow`；无首页 canonical 和 hreflang                             |
| `/chat`                                 | 200；`noindex, nofollow`；无首页 canonical 和 hreflang                             |
| `/en/tutorials/how-to-upgrade-gpt-plus` | 308 到中文规范 URL，并保留公网域名和 HTTPS                                         |
| `/tutorials/how-to-upgrade-gpt-plus`    | 200；无英文 hreflang，只保留正常资源预加载链接                                     |

## 剩余验证

Search Console 的状态变化依赖部署后的 Google 重新抓取。本报告只能确认代码和最终 HTTP 响应符合预期，不能在未上线时确认索引数量变化。

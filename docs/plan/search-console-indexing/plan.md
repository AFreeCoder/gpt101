# Search Console 索引治理执行计划

日期：2026-07-15
设计基线：`docs/design/search-console-indexing/design.md`

- [x] 从最新 `origin/main` 创建独立分支和 worktree。
- [x] 复核 Search Console 样本、生产响应和当前代码，完成需求与设计边界。
- [x] 先补充失败的 SEO 回归测试，覆盖 robots、canonical、hreflang、教程语言和 sitemap。
- [x] 修复通用元数据默认行为，并给首页和工具流程补齐明确策略。
- [x] 删除根布局错误 hreflang，增加教程单语言路由守卫。
- [x] 重建只含规范可索引 URL 的站点地图，并放开公开政策页抓取。
- [x] 运行针对性测试、完整测试、Lint、格式检查和生产构建。
- [x] 检查最终 diff 与工作树状态，记录需在部署后执行的 Search Console 操作。

# 测试

## 默认基线

运行完整测试入口：

```bash
pnpm test
```

默认入口会执行全部不依赖外部服务的测试。依赖 PostgreSQL 的集成测试仍会出现在测试报告中；未提供 `DATABASE_URL` 时，它们会明确标记为 `skipped`，不会把环境缺失误报为业务逻辑失败。

## PostgreSQL 集成测试

数据库集成测试会写入并清理数据。请只连接隔离的测试数据库，不要使用生产数据库：

```bash
DATABASE_URL='postgres://...' pnpm test
```

数据库需要预先完成当前版本的 schema migration。提供 `DATABASE_URL` 后，默认测试入口会自动执行这些集成测试，并将连接或 schema 问题作为真实失败报告。

数据库集成测试会共享同一个测试库，默认入口因此将测试文件串行执行，避免并发用例互相抢占待处理任务或库存数据。

## 其他基线检查

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

ESLint 9 使用 Next.js Core Web Vitals flat config。Next 16 新引入、但尚未完成全仓迁移的 React Compiler 检查暂时按 warning 报告；Hook 调用顺序等已纳入阻断基线。

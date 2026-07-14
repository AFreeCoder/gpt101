import test, { after } from 'node:test';

import { closePostgresDb } from '../../src/core/db/postgres';

after(async () => {
  await closePostgresDb();
});

/**
 * 数据库集成测试只在显式提供连接地址时运行。
 *
 * 这些测试会写入并清理数据，因此本地和 CI 都应使用隔离的测试数据库。
 * 未配置 DATABASE_URL 时保留测试条目并标记为 skipped，避免把环境缺失
 * 误报为业务逻辑回归。
 */
export const databaseTest = process.env.DATABASE_URL?.trim() ? test : test.skip;

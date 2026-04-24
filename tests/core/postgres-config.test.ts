import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPostgresConnectionOptions,
  shouldUsePostgresSingleton,
} from '../../src/core/db/postgres';

test('buildPostgresConnectionOptions 仅在非 public schema 时设置 search_path', () => {
  assert.deepEqual(buildPostgresConnectionOptions('public'), {});

  assert.deepEqual(buildPostgresConnectionOptions('web'), {
    connection: {
      options: '-c search_path=web',
    },
  });
});

test('shouldUsePostgresSingleton 在 Node 运行时默认启用单例连接，并保留显式关闭开关', () => {
  assert.equal(
    shouldUsePostgresSingleton({
      isCloudflareWorker: false,
      dbSingletonEnabled: 'false',
    }),
    false
  );

  assert.equal(
    shouldUsePostgresSingleton({
      isCloudflareWorker: false,
      dbSingletonEnabled: 'true',
    }),
    true
  );

  assert.equal(
    shouldUsePostgresSingleton({
      isCloudflareWorker: false,
    }),
    true
  );

  assert.equal(
    shouldUsePostgresSingleton({
      isCloudflareWorker: true,
      dbSingletonEnabled: 'true',
    }),
    false
  );
});

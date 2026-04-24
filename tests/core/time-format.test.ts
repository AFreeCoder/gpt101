import assert from 'node:assert/strict';
import test from 'node:test';

import * as dbTime from '../../src/shared/lib/db-time';
import * as time from '../../src/shared/lib/time';

test('formatBeijingDateTime 固定按北京时间格式化 ISO 时间', () => {
  assert.equal(typeof time.formatBeijingDateTime, 'function');

  assert.equal(
    (time as any).formatBeijingDateTime('2026-04-24T03:29:05.000Z'),
    '2026-04-24 11:29:05'
  );
});

test('formatDateForTimestampWithoutTimeZone 将 JS Date 转为北京时间 timestamp 字符串', () => {
  assert.equal(
    dbTime.formatDateForTimestampWithoutTimeZone(
      new Date('2026-04-24T01:43:11.000Z')
    ),
    '2026-04-24 09:43:11'
  );
});

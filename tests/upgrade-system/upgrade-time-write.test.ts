import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

const DB_TIME_ASSIGNMENTS = [
  {
    file: 'src/shared/services/upgrade-task.ts',
    patterns: [
      /startedAt:\s*new Date\(/,
      /finishedAt:\s*new Date\(/,
      /usedAt:\s*new Date\(/,
    ],
  },
  {
    file: 'src/extensions/upgrade-channel/runner.ts',
    patterns: [/startedAt:\s*new Date\(/, /finishedAt:\s*new Date\(/],
  },
  {
    file: 'src/shared/models/redeem-code.ts',
    patterns: [/usedAt:\s*new Date\(/, /disabledAt:\s*new Date\(/],
  },
  {
    file: 'src/shared/models/channel-cardkey.ts',
    patterns: [/usedAt:\s*new Date\(/],
  },
];

test('升级系统写入 timestamp 字段时不直接传 JS Date', () => {
  const offenders: string[] = [];

  for (const { file, patterns } of DB_TIME_ASSIGNMENTS) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(source)) {
        offenders.push(`${file}: ${pattern.source}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

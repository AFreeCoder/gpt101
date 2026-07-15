import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repository = 'ghcr.io/afreecoder/gpt101';
const retentionScript = path.join(
  process.cwd(),
  'deploy',
  'image-retention.sh'
);

function createFakeDocker() {
  const directory = mkdtempSync(path.join(tmpdir(), 'gpt101-docker-'));
  const dockerPath = path.join(directory, 'docker');
  const logPath = path.join(directory, 'docker.log');

  writeFileSync(
    dockerPath,
    `#!/usr/bin/env bash
set -euo pipefail

log_file="\${FAKE_DOCKER_LOG:?}"
repository="ghcr.io/afreecoder/gpt101"

image_id_for_ref() {
  case "$1" in
    gpt101:latest|"$repository":sha-current) echo 'sha256:current' ;;
    gpt101:rollback-latest|gpt101:rollback-20260714_120000-prev1|"$repository":sha-prev1) echo 'sha256:prev1' ;;
    gpt101:rollback-20260713_120000-prev2|"$repository":sha-prev2) echo 'sha256:prev2' ;;
    gpt101:rollback-20260712_120000-prev3|"$repository":sha-prev3) echo 'sha256:prev3' ;;
    "$repository":sha-failed) echo 'sha256:failed' ;;
    *) return 1 ;;
  esac
}

repo_tags_for_id() {
  case "$1" in
    sha256:current)
      printf '%s\\n' 'gpt101:latest' "$repository:sha-current"
      ;;
    sha256:prev1)
      printf '%s\\n' 'gpt101:rollback-latest' 'gpt101:rollback-20260714_120000-prev1' "$repository:sha-prev1"
      ;;
    sha256:prev2)
      printf '%s\\n' 'gpt101:rollback-20260713_120000-prev2' "$repository:sha-prev2"
      ;;
    sha256:prev3)
      printf '%s\\n' 'gpt101:rollback-20260712_120000-prev3' "$repository:sha-prev3" 'example/other:shared'
      ;;
    sha256:failed)
      printf '%s\\n' "$repository:sha-failed"
      ;;
  esac
}

if [ "\${1:-}" = 'inspect' ]; then
  printf '%s\\n' 'sha256:current'
  exit 0
fi

if [ "\${1:-}" = 'image' ] && [ "\${2:-}" = 'ls' ]; then
  printf '%s\\n' \\
    'gpt101:latest' \\
    "$repository:sha-current" \\
    'gpt101:rollback-latest' \\
    'gpt101:rollback-20260714_120000-prev1' \\
    "$repository:sha-prev1" \\
    'gpt101:rollback-20260713_120000-prev2' \\
    "$repository:sha-prev2" \\
    'gpt101:rollback-20260712_120000-prev3' \\
    "$repository:sha-prev3" \\
    "$repository:sha-failed" \\
    'example/unrelated:latest'
  exit 0
fi

if [ "\${1:-}" = 'image' ] && [ "\${2:-}" = 'inspect' ]; then
  target="\${@: -1}"
  if [ "\${4:-}" = '{{.Id}}' ]; then
    image_id_for_ref "$target"
  else
    repo_tags_for_id "$target"
  fi
  exit 0
fi

if [ "\${1:-}" = 'container' ] && [ "\${2:-}" = 'ls' ]; then
  ancestor="\${@: -1}"
  if [ "\${FAKE_PROTECTED_ID:-}" = "\${ancestor#ancestor=}" ]; then
    printf '%s\\n' 'protected-container'
  fi
  exit 0
fi

if [ "\${1:-}" = 'image' ] && [ "\${2:-}" = 'rm' ]; then
  printf '%s\\n' "\${3:?}" >> "$log_file"
  exit 0
fi

printf '未处理的 fake docker 调用: %s\\n' "$*" >&2
exit 64
`,
    'utf8'
  );
  chmodSync(dockerPath, 0o755);

  return {
    directory,
    logPath,
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function runRetention(
  options: { dryRun?: boolean; protectedId?: string } = {}
) {
  const fake = createFakeDocker();
  const args = [retentionScript, '--repository', repository, '--keep', '3'];
  if (options.dryRun) args.push('--dry-run');

  const result = spawnSync('bash', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fake.directory}:${process.env.PATH}`,
      FAKE_DOCKER_LOG: fake.logPath,
      FAKE_PROTECTED_ID: options.protectedId ?? '',
    },
  });
  const removedRefs = existsSync(fake.logPath)
    ? readFileSync(fake.logPath, 'utf8')
    : '';

  return { ...fake, result, removedRefs };
}

test('保留当前和最近两个成功版本，并清理更旧及失败镜像', () => {
  const run = runRetention();
  try {
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.match(run.removedRefs, /gpt101:rollback-20260712_120000-prev3/);
    assert.match(run.removedRefs, /ghcr\.io\/afreecoder\/gpt101:sha-prev3/);
    assert.match(run.removedRefs, /ghcr\.io\/afreecoder\/gpt101:sha-failed/);
    assert.doesNotMatch(run.removedRefs, /sha-current|sha-prev1|sha-prev2/);
    assert.doesNotMatch(run.removedRefs, /example\/other:shared/);
  } finally {
    run.cleanup();
  }
});

test('dry-run 只预览，不调用镜像删除', () => {
  const run = runRetention({ dryRun: true });
  try {
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.equal(run.removedRefs, '');
    assert.match(run.result.stdout, /预览/);
  } finally {
    run.cleanup();
  }
});

test('待清理镜像仍被容器引用时跳过并返回失败', () => {
  const run = runRetention({ protectedId: 'sha256:prev3' });
  try {
    assert.equal(run.result.status, 1);
    assert.doesNotMatch(run.removedRefs, /sha-prev3/);
    assert.match(run.removedRefs, /sha-failed/);
    assert.match(run.result.stderr, /仍被容器引用/);
  } finally {
    run.cleanup();
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readText(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

test('docker build workflow 推送 sha 镜像并传递广告 conversion build arg', () => {
  const workflow = readText('.github', 'workflows', 'docker-build.yaml');

  assert.match(workflow, /type=sha,format=long/);
  assert.match(workflow, /docker\/build-push-action@v5/);
  assert.match(
    workflow,
    /build-args:\s*\|[\s\S]*NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO=/
  );
  assert.match(workflow, /IMAGE_NAME=/);
});

test('deploy workflow 只拉取镜像并启动，不再在服务器本地 build', () => {
  const workflow = readText('.github', 'workflows', 'deploy.yml');

  assert.doesNotMatch(workflow, /docker compose build/);
  assert.match(workflow, /docker login ghcr\.io/);
  assert.match(workflow, /docker pull "\$APP_IMAGE"/);
  assert.match(
    workflow,
    /APP_IMAGE="\$\{IMAGE_REPOSITORY\}:sha-\$\{DEPLOY_SHA\}"/
  );
  assert.match(workflow, /port:\s*22222/);
});

test('生产 compose 通过 APP_IMAGE 引用镜像，不再声明 build', () => {
  const compose = readText('deploy', 'docker-compose.yml');

  assert.match(
    compose,
    /gpt101:\n(?:.*\n)*?\s+image: \$\{APP_IMAGE:\?APP_IMAGE is required\}/
  );
  assert.doesNotMatch(compose, /gpt101:\n(?:.*\n)*?\s+build:/);
  assert.match(
    compose,
    /gpt101-worker:\n(?:.*\n)*?\s+image: \$\{APP_IMAGE:\?APP_IMAGE is required\}/
  );
});

test('生产 compose 使用降频后的 healthcheck，避免高频 docker exec', () => {
  const compose = readText('deploy', 'docker-compose.yml');

  assert.match(compose, /gpt101:\n(?:.*\n)*?\s+interval: 300s/);
  assert.match(compose, /gpt101-postgres:\n(?:.*\n)*?\s+interval: 60s/);
});

test('rollback 脚本不再触发 docker compose build', () => {
  const script = readText('deploy', 'rollback.sh');

  assert.doesNotMatch(script, /docker compose build/);
  assert.match(script, /upsert_env "\$DEPLOY_DIR\/\.env" APP_IMAGE /);
  assert.match(
    script,
    /docker compose up -d --remove-orphans gpt101 gpt101-worker/
  );
});

test('部署环境模板暴露 APP_IMAGE，并提示所需的 GitHub Actions secrets', () => {
  const envExample = readText('deploy', '.env.example');

  assert.match(envExample, /^APP_IMAGE=/m);
  assert.match(envExample, /GHCR_USERNAME/);
  assert.match(envExample, /GHCR_TOKEN/);
});
